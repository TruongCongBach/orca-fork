import React from 'react'
import {
  GIT_LOG_GRAPH_LANE_WIDTH,
  GIT_LOG_GRAPH_NODE_RADIUS,
  GIT_LOG_GRAPH_ROW_HEIGHT,
  gitLogGraphLaneX
} from '../../../../shared/git-log-graph-hit-test'
import type { GitLogGraphEdge, GitLogGraphRow } from '../../../../shared/git-log-graph-layout'
import type { GitLogGraphHighlight } from '../../../../shared/git-log-graph-path-highlight'
import { graphColor } from '../right-sidebar/source-control/sync/git-history-graph-svg'

const STROKE_WIDTH = 1.5
const HIGHLIGHT_STROKE_WIDTH = 2.5
// Why: radius + half stroke (5) stays inside the lane's half-width (7), so the SVG never clips it.
const HIGHLIGHT_NODE_STROKE_WIDTH = 2
const COLLAPSED_DASH = '2 2'
const CHEVRON_HALF_HEIGHT = 1.5
// Below the highlighted node (bottom at center + 5) with >= 2px clear, inside the row.
const CHEVRON_Y = GIT_LOG_GRAPH_ROW_HEIGHT - 2.5

// Why halves: an edge runs from one row's center to the next row's center. Each row SVG draws
// the half that falls inside it; the two halves meet at the shared border on the edge's
// midpoint, so diagonals render as one straight segment across rows.
function EdgeHalf({
  edge,
  half,
  dashed,
  highlighted,
  bottomEndY = GIT_LOG_GRAPH_ROW_HEIGHT
}: {
  edge: GitLogGraphEdge
  half: 'top' | 'bottom'
  dashed: boolean
  highlighted: boolean
  /** Where a bottom half stops; shortened so it ends before the collapse chevron. */
  bottomEndY?: number
}): React.JSX.Element {
  const from = gitLogGraphLaneX(edge.from)
  const to = gitLogGraphLaneX(edge.to)
  const mid = (from + to) / 2
  const center = GIT_LOG_GRAPH_ROW_HEIGHT / 2
  const bottomEndX =
    from + ((mid - from) * (bottomEndY - center)) / (GIT_LOG_GRAPH_ROW_HEIGHT - center)
  const [x1, y1, x2, y2] =
    half === 'top' ? [mid, 0, to, center] : [from, center, bottomEndX, bottomEndY]
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={graphColor(edge.color)}
      strokeWidth={highlighted ? HIGHLIGHT_STROKE_WIDTH : STROKE_WIDTH}
      strokeLinecap={dashed ? 'butt' : 'round'}
      strokeDasharray={dashed ? COLLAPSED_DASH : undefined}
    />
  )
}

/** Downward chevron under a collapsed run's top commit (points toward the run's bottom). */
function CollapsedArrow({ lane, color }: { lane: number; color: GitLogGraphRow['color'] }) {
  const x = gitLogGraphLaneX(lane)
  const y = CHEVRON_Y
  const h = CHEVRON_HALF_HEIGHT
  return (
    <path
      d={`M ${x - 3} ${y - h} L ${x} ${y + h} L ${x + 3} ${y - h}`}
      fill="none"
      stroke={graphColor(color)}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

export function GitLogGraphRowSvg({
  row,
  width,
  isHead,
  collapsedEdgeTargets,
  highlight
}: {
  row: GitLogGraphRow
  width: number
  isHead: boolean
  /** Bottom commit ids of collapsed runs: edges leading into them are drawn dashed. */
  collapsedEdgeTargets: ReadonlyMap<string, string>
  highlight: GitLogGraphHighlight
}): React.JSX.Element {
  const center = GIT_LOG_GRAPH_ROW_HEIGHT / 2
  const isDashed = (edge: GitLogGraphEdge): boolean =>
    Boolean(edge.target && collapsedEdgeTargets.has(edge.target))
  const startsCollapsedRun = row.outgoing.some((edge) => edge.from === row.lane && isDashed(edge))
  const hollow = isHead || highlight.commitIds.has(row.id)
  return (
    <svg
      width={width}
      height={GIT_LOG_GRAPH_ROW_HEIGHT}
      viewBox={`0 0 ${width} ${GIT_LOG_GRAPH_ROW_HEIGHT}`}
      aria-hidden="true"
      className="block shrink-0"
    >
      {row.incoming.map((edge, index) => (
        <EdgeHalf
          key={`in-${index}`}
          edge={edge}
          half="top"
          dashed={isDashed(edge)}
          highlighted={highlight.edges.has(edge)}
        />
      ))}
      {row.outgoing.map((edge, index) => (
        <EdgeHalf
          key={`out-${index}`}
          edge={edge}
          half="bottom"
          dashed={isDashed(edge)}
          highlighted={highlight.edges.has(edge)}
          bottomEndY={
            startsCollapsedRun && edge.from === row.lane && isDashed(edge)
              ? CHEVRON_Y - CHEVRON_HALF_HEIGHT - 1.5
              : undefined
          }
        />
      ))}
      {startsCollapsedRun ? <CollapsedArrow lane={row.lane} color={row.color} /> : null}
      {/* Highlighted nodes turn hollow (like HEAD), as WebStorm does for a hovered run. */}
      <circle
        cx={gitLogGraphLaneX(row.lane)}
        cy={center}
        r={GIT_LOG_GRAPH_NODE_RADIUS}
        fill={hollow ? 'var(--background)' : graphColor(row.color)}
        stroke={graphColor(row.color)}
        strokeWidth={hollow ? HIGHLIGHT_NODE_STROKE_WIDTH : 0}
      />
    </svg>
  )
}

export function gitLogGraphWidth(laneCount: number): number {
  return GIT_LOG_GRAPH_LANE_WIDTH * Math.max(1, laneCount)
}
