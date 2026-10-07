import { useMemo } from 'react'
import type { GitHistoryItem } from '../../../../shared/git-history'
import {
  applyGitLogCollapsedFragments,
  findGitLogLinearFragments,
  type GitLogLinearFragment
} from '../../../../shared/git-log-graph-collapse'
import {
  buildGitLogGraphLayout,
  type GitLogGraphLayout
} from '../../../../shared/git-log-graph-layout'

export type GitLogGraphCommitWithItem = {
  id: string
  parentIds: readonly string[]
  item: GitHistoryItem
}

export type GitLogGraphModel = {
  /** Visible commits; `layout.rows` is index-aligned with it. */
  rows: GitLogGraphCommitWithItem[]
  layout: GitLogGraphLayout
  fragments: GitLogLinearFragment[]
  collapsed: ReadonlySet<string>
  /** Bottom commit id -> collapsed fragment id; the edge into that bottom is drawn dashed. */
  collapsedEdgeTargets: ReadonlyMap<string, string>
}

/** Graph layout for one Log tab: content-filter parent pruning, linear fragments, collapse state. */
export function useGitLogGraphModel(
  items: readonly GitHistoryItem[],
  hasContentFilter: boolean,
  headId: string | undefined,
  collapsedIds: readonly string[]
): GitLogGraphModel {
  const base = useMemo(() => {
    // Why: a filtered log skips the commits between matches; keeping their parent ids would open a
    // new lane per row. Dropping parents outside the result draws matches as unconnected dots.
    const ids = hasContentFilter ? new Set(items.map((item) => item.id)) : null
    const graphCommits: GitLogGraphCommitWithItem[] = items.map((item) => ({
      id: item.id,
      parentIds: ids ? item.parentIds.filter((id) => ids.has(id)) : item.parentIds,
      item
    }))
    const layout = buildGitLogGraphLayout(graphCommits, { headId })
    return { graphCommits, layout, fragments: findGitLogLinearFragments(graphCommits, layout) }
  }, [hasContentFilter, headId, items])

  const collapsedKey = collapsedIds.join('\n')
  return useMemo(() => {
    const known = new Set(base.fragments.map((fragment) => fragment.id))
    const collapsed = new Set(
      collapsedKey ? collapsedKey.split('\n').filter((id) => known.has(id)) : []
    )
    const applied = applyGitLogCollapsedFragments(base.graphCommits, base.fragments, collapsed)
    const layout =
      collapsed.size > 0 ? buildGitLogGraphLayout(applied.graphCommits, { headId }) : base.layout
    return {
      rows: applied.rows,
      layout,
      fragments: base.fragments,
      collapsed,
      collapsedEdgeTargets: applied.collapsedEdgeTargets
    }
  }, [base, collapsedKey, headId])
}
