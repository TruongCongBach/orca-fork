import type { GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitLogRef } from '../../../../shared/git-log-query'

// Groups refs into the Git Log ref tree: HEAD (Current Branch) / Local / Remote (per remote) / Tags.

export type GitLogRefTreeGroup = {
  id: 'head' | 'local' | 'remote' | 'tags'
  refs: GitLogRef[]
  /** Remote groups only: refs bucketed per remote name, in name order. */
  remotes?: { remote: string; refs: GitLogRef[] }[]
}

function byName(a: GitLogRef, b: GitLogRef): number {
  return a.shortName.localeCompare(b.shortName)
}

export function buildGitLogRefTree(
  refs: readonly GitLogRef[],
  currentRef: GitHistoryItemRef | undefined,
  query: string
): GitLogRefTreeGroup[] {
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? refs.filter((ref) => ref.shortName.toLowerCase().includes(needle))
    : [...refs]
  const local = visible.filter((ref) => ref.category === 'local').sort(byName)
  const remote = visible.filter((ref) => ref.category === 'remote').sort(byName)
  const tags = visible.filter((ref) => ref.category === 'tag').sort(byName)

  const remoteBuckets = new Map<string, GitLogRef[]>()
  for (const ref of remote) {
    const name = ref.remote ?? ''
    remoteBuckets.set(name, [...(remoteBuckets.get(name) ?? []), ref])
  }

  // Why: HEAD is the checked-out branch (or a detached commit); it stays visible while searching
  // only when it matches, like every other row.
  const headRef: GitLogRef | undefined =
    currentRef?.revision &&
    (!needle || currentRef.name.toLowerCase().includes(needle) || 'head'.includes(needle))
      ? {
          fullName: currentRef.category === 'branches' ? currentRef.id : 'HEAD',
          shortName: currentRef.category === 'branches' ? currentRef.name : 'HEAD',
          category: 'local',
          oid: currentRef.revision
        }
      : undefined

  return [
    { id: 'head', refs: headRef ? [headRef] : [] },
    { id: 'local', refs: local },
    {
      id: 'remote',
      refs: remote,
      remotes: [...remoteBuckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, bucket]) => ({ remote: name, refs: bucket }))
    },
    { id: 'tags', refs: tags }
  ]
}

/** Label for a remote-tracking branch inside its remote bucket (`origin/feat/x` -> `feat/x`). */
export function remoteBranchLabel(ref: GitLogRef): string {
  return ref.remote && ref.shortName.startsWith(`${ref.remote}/`)
    ? ref.shortName.slice(ref.remote.length + 1)
    : ref.shortName
}
