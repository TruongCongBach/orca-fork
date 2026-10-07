import type { GitLogLinearFragment } from './git-log-graph-collapse'
import { fragmentForLaneTarget } from './git-log-graph-collapse'
import type { GitLogGraphEdge, GitLogGraphRow } from './git-log-graph-layout'

// Geometry of one Git Log graph row; the renderer draws with the same numbers it hit-tests with.
export const GIT_LOG_GRAPH_ROW_HEIGHT = 24
export const GIT_LOG_GRAPH_LANE_WIDTH = 14
export const GIT_LOG_GRAPH_NODE_RADIUS = 4
// Why tight: the run line passes through the dot, so only the dot itself should mean "select".
const NODE_HIT_RADIUS = GIT_LOG_GRAPH_NODE_RADIUS + 1.5
const EDGE_HIT_DISTANCE = 4

export function gitLogGraphLaneX(lane: number): number {
  return GIT_LOG_GRAPH_LANE_WIDTH * lane + GIT_LOG_GRAPH_LANE_WIDTH / 2
}

export type GitLogGraphHitContext = {
  fragments: readonly GitLogLinearFragment[]
  /** Bottom commit id -> collapsed fragment id (see `applyGitLogCollapsedFragments`). */
  collapsedEdgeTargets: ReadonlyMap<string, string>
}

export type GitLogGraphHit =
  | { kind: 'node'; rowId: string }
  | {
      kind: 'edge'
      rowId: string
      edge: GitLogGraphEdge
      /** Linear fragment the edge belongs to; clicking it collapses (or expands) that fragment. */
      fragmentId: string | null
      /** The edge is the dashed stand-in for a collapsed fragment. */
      collapsed: boolean
    }

type Segment = { x1: number; y1: number; x2: number; y2: number }

/** Each row draws half of every edge crossing it (see `git-log-graph-row.tsx`). */
function edgeHalfSegment(edge: GitLogGraphEdge, half: 'top' | 'bottom'): Segment {
  const from = gitLogGraphLaneX(edge.from)
  const to = gitLogGraphLaneX(edge.to)
  const mid = (from + to) / 2
  const center = GIT_LOG_GRAPH_ROW_HEIGHT / 2
  return half === 'top'
    ? { x1: mid, y1: 0, x2: to, y2: center }
    : { x1: from, y1: center, x2: mid, y2: GIT_LOG_GRAPH_ROW_HEIGHT }
}

function distanceToSegment(x: number, y: number, s: Segment): number {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const lengthSq = dx * dx + dy * dy
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / lengthSq))
  return Math.hypot(x - (s.x1 + t * dx), y - (s.y1 + t * dy))
}

/** What sits under (x, y) in one graph row's local coordinates: its dot, an edge, or nothing. */
export function hitTestGitLogGraphRow(
  row: GitLogGraphRow,
  x: number,
  y: number,
  context: GitLogGraphHitContext
): GitLogGraphHit | null {
  const center = GIT_LOG_GRAPH_ROW_HEIGHT / 2
  if (Math.hypot(x - gitLogGraphLaneX(row.lane), y - center) <= NODE_HIT_RADIUS) {
    return { kind: 'node', rowId: row.id }
  }
  const candidates = [
    ...row.incoming.map((edge) => ({ edge, half: 'top' as const })),
    ...row.outgoing.map((edge) => ({ edge, half: 'bottom' as const }))
  ]
  let best: { edge: GitLogGraphEdge; distance: number } | null = null
  for (const { edge, half } of candidates) {
    const distance = distanceToSegment(x, y, edgeHalfSegment(edge, half))
    if (distance > EDGE_HIT_DISTANCE) {
      continue
    }
    // Why: where a diagonal meets a vertical at the node, prefer the vertical lane on a tie.
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && edge.from === edge.to && best.edge.from !== best.edge.to)
    ) {
      best = { edge, distance }
    }
  }
  if (!best) {
    return null
  }
  const { edge } = best
  const collapsedId = edge.target ? context.collapsedEdgeTargets.get(edge.target) : undefined
  const fragmentId =
    collapsedId ?? (edge.target ? fragmentForLaneTarget(context.fragments, edge.target) : null)
  return { kind: 'edge', rowId: row.id, edge, fragmentId, collapsed: Boolean(collapsedId) }
}

/** Collapse/expand request for a click on `hit`, or null when the click should select instead. */
export function gitLogGraphHitToggle(
  hit: GitLogGraphHit | null
): { fragmentId: string; collapse: boolean } | null {
  if (hit?.kind !== 'edge' || !hit.fragmentId) {
    return null
  }
  return { fragmentId: hit.fragmentId, collapse: !hit.collapsed }
}
