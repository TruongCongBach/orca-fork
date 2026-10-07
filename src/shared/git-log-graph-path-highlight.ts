import type { GitLogLinearFragment } from './git-log-graph-collapse'
import type { GitLogGraphEdge, GitLogGraphLayout } from './git-log-graph-layout'
import type { GitLogGraphHit } from './git-log-graph-hit-test'

// What to emphasize while the pointer rests on the graph. Edges are matched by identity: the
// layout shares one edge object between a row's `outgoing` and the next row's `incoming`.

export type GitLogGraphHighlight = {
  /** Commits whose dot gets a ring. */
  commitIds: ReadonlySet<string>
  edges: ReadonlySet<GitLogGraphEdge>
}

export const EMPTY_GIT_LOG_GRAPH_HIGHLIGHT: GitLogGraphHighlight = {
  commitIds: new Set(),
  edges: new Set()
}

function fragmentHighlight(
  layout: GitLogGraphLayout,
  fragment: GitLogLinearFragment
): GitLogGraphHighlight {
  // Only the run's own lane leads into its non-top commits (each has exactly one child).
  const targets = new Set(fragment.commitIds.slice(1))
  const visible = new Set(layout.rows.map((row) => row.id))
  const edges = new Set<GitLogGraphEdge>()
  for (const row of layout.rows) {
    for (const edge of [...row.incoming, ...row.outgoing]) {
      if (edge.target && targets.has(edge.target)) {
        edges.add(edge)
      }
    }
  }
  return { commitIds: new Set(fragment.commitIds.filter((id) => visible.has(id))), edges }
}

/** Lane path of a merge's merged-in parent: from the merge dot down to the parent's dot. */
function mergeEdgeHighlight(
  layout: GitLogGraphLayout,
  rowId: string,
  edge: GitLogGraphEdge
): GitLogGraphHighlight {
  const target = edge.target
  const rowIndex = layout.rows.findIndex((row) => row.id === rowId)
  const row = layout.rows[rowIndex]
  // A hit from a previous layout (e.g. right after a toggle) no longer matches any edge.
  if (!target || !row || (!row.incoming.includes(edge) && !row.outgoing.includes(edge))) {
    return EMPTY_GIT_LOG_GRAPH_HIGHLIGHT
  }
  // Index of the row above the edge (the edge spans upper..upper+1).
  let upper = row.incoming.includes(edge) ? rowIndex - 1 : rowIndex
  const path = [edge]
  let top = edge
  while (upper >= 0) {
    const above = layout.rows[upper]!.incoming.find(
      (candidate) => candidate.target === target && candidate.to === top.from
    )
    if (!above) {
      break
    }
    path.unshift(above)
    top = above
    upper -= 1
  }
  const origin = layout.rows[upper]
  // A merged-in parent leaves the merge dot sideways; first-parent lanes start straight down.
  if (!origin || origin.lane !== top.from || top.from === top.to) {
    return EMPTY_GIT_LOG_GRAPH_HIGHLIGHT
  }
  let bottom = edge
  let lower = upper + path.length
  while (layout.rows[lower] && layout.rows[lower]!.id !== target) {
    const below = layout.rows[lower]!.outgoing.find(
      (candidate) => candidate.target === target && candidate.from === bottom.to
    )
    if (!below) {
      break
    }
    path.push(below)
    bottom = below
    lower += 1
  }
  const commitIds = new Set([origin.id])
  if (layout.rows[lower]?.id === target) {
    commitIds.add(target)
  }
  return { commitIds, edges: new Set(path) }
}

export function gitLogGraphHighlight(
  hit: GitLogGraphHit | null,
  layout: GitLogGraphLayout,
  fragments: readonly GitLogLinearFragment[]
): GitLogGraphHighlight {
  if (hit?.kind !== 'edge') {
    return EMPTY_GIT_LOG_GRAPH_HIGHLIGHT
  }
  const fragment = hit.fragmentId
    ? fragments.find((candidate) => candidate.id === hit.fragmentId)
    : undefined
  return fragment
    ? fragmentHighlight(layout, fragment)
    : mergeEdgeHighlight(layout, hit.rowId, hit.edge)
}
