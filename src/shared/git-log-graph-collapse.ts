import type { GitLogGraphCommit, GitLogGraphLayout } from './git-log-graph-layout'

// "Collapse linear branches" for the Git Log graph (IDE-style). A linear fragment is a chain of
// commits on one lane (the main line included) where every link is child -> its only parent and
// that parent has no other child in the log. Collapsing keeps the chain's top and bottom commits,
// drops the commits between them, and links top -> bottom directly; that edge is drawn dashed.

export const GIT_LOG_MIN_FRAGMENT_LENGTH = 3

export type GitLogLinearFragment = {
  /** Top (newest) commit id; stable key for the fragment's collapsed state. */
  id: string
  /** Commit ids from top to bottom, endpoints included. */
  commitIds: string[]
}

export function findGitLogLinearFragments(
  commits: readonly GitLogGraphCommit[],
  layout: GitLogGraphLayout
): GitLogLinearFragment[] {
  const laneById = new Map(layout.rows.map((row) => [row.id, row.lane]))
  const loaded = new Set(commits.map((commit) => commit.id))
  const childCount = new Map<string, number>()
  for (const commit of commits) {
    for (const parentId of commit.parentIds) {
      if (loaded.has(parentId)) {
        childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1)
      }
    }
  }
  // next[c] = p when c links down to p inside a fragment.
  const next = new Map<string, string>()
  const hasLinkIn = new Set<string>()
  for (const commit of commits) {
    const parentId = commit.parentIds[0]
    if (
      commit.parentIds.length === 1 &&
      parentId &&
      loaded.has(parentId) &&
      childCount.get(parentId) === 1 &&
      laneById.get(commit.id) === laneById.get(parentId)
    ) {
      next.set(commit.id, parentId)
      hasLinkIn.add(parentId)
    }
  }
  const fragments: GitLogLinearFragment[] = []
  for (const commit of commits) {
    if (!next.has(commit.id) || hasLinkIn.has(commit.id)) {
      continue
    }
    const commitIds = [commit.id]
    let current = next.get(commit.id)
    while (current) {
      commitIds.push(current)
      current = next.get(current)
    }
    if (commitIds.length >= GIT_LOG_MIN_FRAGMENT_LENGTH) {
      fragments.push({ id: commit.id, commitIds })
    }
  }
  return fragments
}

/**
 * Drops the hidden commits of collapsed fragments and re-parents each fragment's top straight onto
 * its bottom. `collapsedEdgeTargets` maps the bottom commit id to the fragment id: the only lane
 * leading down into that bottom is the collapsed (dashed) edge.
 */
export function applyGitLogCollapsedFragments<T extends GitLogGraphCommit>(
  commits: readonly T[],
  fragments: readonly GitLogLinearFragment[],
  collapsed: ReadonlySet<string>
): {
  rows: T[]
  graphCommits: GitLogGraphCommit[]
  collapsedEdgeTargets: ReadonlyMap<string, string>
} {
  const hidden = new Set<string>()
  const topToBottom = new Map<string, string>()
  const collapsedEdgeTargets = new Map<string, string>()
  for (const fragment of fragments) {
    const bottom = fragment.commitIds.at(-1)
    if (!collapsed.has(fragment.id) || !bottom) {
      continue
    }
    topToBottom.set(fragment.id, bottom)
    collapsedEdgeTargets.set(bottom, fragment.id)
    for (const id of fragment.commitIds.slice(1, -1)) {
      hidden.add(id)
    }
  }
  const rows = commits.filter((commit) => !hidden.has(commit.id))
  const graphCommits = rows.map((commit): GitLogGraphCommit => {
    const bottom = topToBottom.get(commit.id)
    return bottom ? { id: commit.id, parentIds: [bottom] } : commit
  })
  return { rows, graphCommits, collapsedEdgeTargets }
}

/** Fragment that hides `commitId`, if any (used to auto-expand around the selected commit). */
export function fragmentHidingCommit(
  fragments: readonly GitLogLinearFragment[],
  collapsed: ReadonlySet<string>,
  commitId: string
): string | null {
  for (const fragment of fragments) {
    if (collapsed.has(fragment.id) && fragment.commitIds.slice(1, -1).includes(commitId)) {
      return fragment.id
    }
  }
  return null
}

/**
 * Fragment whose lane segment leads down into `commitId`: any segment inside the run, including the
 * one into its first hidden commit. The line into the top belongs to the commit above (a merge).
 */
export function fragmentForLaneTarget(
  fragments: readonly GitLogLinearFragment[],
  commitId: string
): string | null {
  for (const fragment of fragments) {
    if (fragment.commitIds.indexOf(commitId) > 0) {
      return fragment.id
    }
  }
  return null
}
