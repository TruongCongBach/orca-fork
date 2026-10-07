import { GIT_HISTORY_LANE_COLORS, GIT_HISTORY_REF_COLOR } from './git-history-types'
import type { GitHistoryGraphColorId } from './git-history-types'

// IDE-style commit graph layout for the Git Log tab: every branch keeps one vertical lane with a
// stable color for its whole life, commits are dots on their lane, and merge/fork edges are
// straight segments between row centers. Lanes never shift sideways; a freed lane is reused by
// the next branch that needs one, so pass-through lines are always vertical.

export type GitLogGraphEdge = {
  /** Lane index at the upper row's center. */
  from: number
  /** Lane index at the lower row's center. */
  to: number
  color: GitHistoryGraphColorId
  /** Commit the line leads down to (the commit its lane is waiting for). */
  target?: string
}

export type GitLogGraphRow = {
  id: string
  lane: number
  color: GitHistoryGraphColorId
  /** Edges from the previous row's center into this row's center. */
  incoming: GitLogGraphEdge[]
  /** Edges from this row's center to the next row's center (open lanes at the last row). */
  outgoing: GitLogGraphEdge[]
}

export type GitLogGraphLayout = {
  rows: GitLogGraphRow[]
  /** Widest lane index used by any node or edge, plus one. */
  laneCount: number
}

export type GitLogGraphCommit = { id: string; parentIds: readonly string[] }

type Lane = { expect: string; color: GitHistoryGraphColorId }
type PendingEdge = { from: number; lane: number; color: GitHistoryGraphColorId }

function firstFreeLane(lanes: (Lane | null)[], after = -1): number {
  for (let index = after + 1; index < lanes.length; index += 1) {
    if (!lanes[index]) {
      return index
    }
  }
  return lanes.length
}

function laneExpecting(lanes: (Lane | null)[], id: string): number {
  return lanes.findIndex((lane) => lane?.expect === id)
}

export function buildGitLogGraphLayout(
  commits: readonly GitLogGraphCommit[],
  options: { headId?: string } = {}
): GitLogGraphLayout {
  const lanes: (Lane | null)[] = []
  const rows: GitLogGraphRow[] = []
  let pending: PendingEdge[] = []
  let colorIndex = -1
  let laneCount = 1
  const nextColor = (): GitHistoryGraphColorId => {
    colorIndex = (colorIndex + 1) % GIT_HISTORY_LANE_COLORS.length
    return GIT_HISTORY_LANE_COLORS[colorIndex]!
  }

  for (const commit of commits) {
    const expecting: number[] = []
    lanes.forEach((lane, index) => {
      if (lane?.expect === commit.id) {
        expecting.push(index)
      }
    })
    const node = expecting.length > 0 ? Math.min(...expecting) : firstFreeLane(lanes)
    const color =
      expecting.length > 0
        ? lanes[node]!.color
        : commit.id === options.headId
          ? GIT_HISTORY_REF_COLOR
          : nextColor()

    const incoming = pending.map((edge) => ({
      from: edge.from,
      to: lanes[edge.lane]?.expect === commit.id ? node : edge.lane,
      color: edge.color,
      target: lanes[edge.lane]?.expect
    }))
    const previousRow = rows.at(-1)
    if (previousRow) {
      previousRow.outgoing = incoming
    }

    for (const index of expecting) {
      lanes[index] = null
    }
    const nextPending: PendingEdge[] = []
    lanes.forEach((lane, index) => {
      if (lane) {
        nextPending.push({ from: index, lane: index, color: lane.color })
      }
    })

    commit.parentIds.forEach((parentId, parentIndex) => {
      if (parentIndex === 0) {
        // Why: the first parent always continues the commit's own lane, even when another lane
        // already waits for it; all waiting lanes then converge straight into the parent's dot.
        lanes[node] = { expect: parentId, color }
        nextPending.push({ from: node, lane: node, color })
        return
      }
      let target = laneExpecting(lanes, parentId)
      // Why: joining a far-away lane would draw one edge sweeping across every lane in between;
      // a nearby lane of its own keeps the line vertical until it converges into the parent.
      if (target === -1 || Math.abs(target - node) > 1) {
        target = firstFreeLane(lanes, node)
        lanes[target] = { expect: parentId, color: nextColor() }
      }
      nextPending.push({ from: node, lane: target, color: lanes[target]!.color })
    })

    while (lanes.length > 0 && !lanes.at(-1)) {
      lanes.pop()
    }
    pending = nextPending
    rows.push({ id: commit.id, lane: node, color, incoming, outgoing: [] })
    laneCount = Math.max(
      laneCount,
      node + 1,
      lanes.length,
      ...incoming.map((edge) => Math.max(edge.from, edge.to) + 1)
    )
  }

  const lastRow = rows.at(-1)
  if (lastRow) {
    // Lanes still open below the loaded page continue straight down until the next page arrives.
    lastRow.outgoing = pending.map((edge) => ({
      from: edge.from,
      to: edge.lane,
      color: edge.color,
      target: lanes[edge.lane]?.expect
    }))
  }
  return { rows, laneCount }
}
