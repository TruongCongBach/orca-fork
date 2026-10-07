import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { RefreshCw } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitLogGraphRow } from '../../../../shared/git-log-graph-layout'
import {
  GIT_LOG_GRAPH_ROW_HEIGHT,
  gitLogGraphHitToggle,
  hitTestGitLogGraphRow,
  type GitLogGraphHit
} from '../../../../shared/git-log-graph-hit-test'
import { gitLogGraphHighlight } from '../../../../shared/git-log-graph-path-highlight'
import type { GitHistoryCommitAction } from '../right-sidebar/source-control/sync/git-history-commit-context-menu'
import { gitLogColumnsMinWidth } from './git-log-columns-model'
import { GitLogCommitHeader } from './git-log-commit-header'
import { GitLogCommitRow } from './git-log-commit-row'
import { gitLogGraphWidth } from './git-log-graph-row'
import type { GitLogGraphModel } from './use-git-log-graph-model'
import { useGitLogColumns } from './git-log-store'

const ROW_HEIGHT = GIT_LOG_GRAPH_ROW_HEIGHT
const LOAD_MORE_THRESHOLD_ROWS = 40

export function GitLogCommitList({
  items,
  model,
  onToggleFragment,
  currentRef,
  status,
  error,
  hasMore,
  loadingMore,
  selectedCommitId,
  onLoadMore,
  onSelect,
  onAction
}: {
  items: GitHistoryItem[]
  model: GitLogGraphModel
  onToggleFragment: (fragmentId: string, collapse: boolean) => void
  currentRef?: GitHistoryItemRef
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  selectedCommitId: string | null
  onLoadMore: () => void
  onSelect: (item: GitHistoryItem) => void
  onAction: (action: GitHistoryCommitAction, item: GitHistoryItem) => void
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const columns = useGitLogColumns()
  const minWidth = gitLogColumnsMinWidth(columns)
  const { rows, layout, fragments, collapsedEdgeTargets } = model
  const graphWidth = gitLogGraphWidth(layout.laneCount)
  const visibleItems = useMemo(() => rows.map((row) => row.item), [rows])

  // Why local state: hover must not re-render the details panel through the tab store.
  const [hoverHit, setHoverHit] = useState<GitLogGraphHit | null>(null)
  const highlight = useMemo(
    () => gitLogGraphHighlight(hoverHit, layout, fragments),
    [fragments, hoverHit, layout]
  )
  const hoverToggle = gitLogGraphHitToggle(hoverHit)
  const hitAt = useCallback(
    (event: React.MouseEvent<HTMLElement>, graphRow: GitLogGraphRow): GitLogGraphHit | null => {
      const bounds = event.currentTarget.getBoundingClientRect()
      return hitTestGitLogGraphRow(
        graphRow,
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        { fragments, collapsedEdgeTargets }
      )
    },
    [collapsedEdgeTargets, fragments]
  )
  const handleGraphMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>, graphRow: GitLogGraphRow): void => {
      const hit = hitAt(event, graphRow)
      setHoverHit((current) => (sameGraphHit(current, hit) ? current : hit))
    },
    [hitAt]
  )
  // Why: a press on a run's lane segment folds/unfolds it; a press on a dot (or a segment outside
  // any run) falls through to the row's normal commit selection.
  const handleGraphMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>, graphRow: GitLogGraphRow): void => {
      const toggle = gitLogGraphHitToggle(hitAt(event, graphRow))
      if (toggle) {
        event.preventDefault()
        event.stopPropagation()
        onToggleFragment(toggle.fragmentId, toggle.collapse)
      }
    },
    [hitAt, onToggleFragment]
  )
  const clearHover = useCallback(() => setHoverHit(null), [])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })
  const virtualRows = virtualizer.getVirtualItems()
  const lastVisibleIndex = virtualRows.at(-1)?.index ?? 0

  useEffect(() => {
    if (hasMore && !loadingMore && lastVisibleIndex >= rows.length - LOAD_MORE_THRESHOLD_ROWS) {
      onLoadMore()
    }
  }, [hasMore, lastVisibleIndex, loadingMore, onLoadMore, rows.length])

  const selectedIndex = selectedCommitId
    ? visibleItems.findIndex((item) => item.id === selectedCommitId)
    : -1
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }
      event.preventDefault()
      const nextIndex = Math.min(
        visibleItems.length - 1,
        Math.max(0, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1))
      )
      const next = visibleItems[nextIndex]
      if (next) {
        onSelect(next)
        const rowIndex = rows.findIndex((row) => row.id === next.id)
        virtualizer.scrollToIndex(rowIndex, { align: 'auto' })
      }
    },
    [onSelect, rows, selectedIndex, virtualizer, visibleItems]
  )

  if (status === 'error') {
    return (
      <div className="p-3 text-xs break-words text-destructive" data-testid="git-log-error">
        {error}
      </div>
    )
  }
  if (status === 'ready' && items.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        {translate('gitLog.list.empty', 'No commits match the current filters')}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      role="grid"
      tabIndex={0}
      aria-busy={status === 'loading'}
      className="relative h-full min-h-0 overflow-auto scrollbar-sleek outline-none"
      data-testid="git-log-commit-list"
      onKeyDown={handleKeyDown}
    >
      <GitLogCommitHeader columns={columns} minWidth={minWidth} />
      {status === 'loading' && items.length === 0 ? (
        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
          <RefreshCw className="size-3 animate-spin" />
          {translate('gitLog.list.loading', 'Loading commits…')}
        </div>
      ) : null}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', minWidth }}>
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index]!
          const graphRow = layout.rows[virtualRow.index]!
          const hovered = hoverHit?.rowId === row.id
          return (
            <div
              key={row.id}
              className="absolute left-0 right-0"
              style={{ top: virtualRow.start, height: ROW_HEIGHT }}
            >
              <GitLogCommitRow
                item={row.item}
                graphRow={graphRow}
                graphWidth={graphWidth}
                columns={columns}
                minWidth={minWidth}
                selected={row.id === selectedCommitId}
                currentRefId={currentRef?.id}
                onSelect={onSelect}
                onAction={onAction}
                collapsedEdgeTargets={collapsedEdgeTargets}
                graphHighlight={highlight}
                graphPointer={hovered && hoverToggle !== null}
                graphTitle={hovered ? collapsedTitle(hoverHit, fragments) : undefined}
                onGraphMouseDown={(event) => handleGraphMouseDown(event, graphRow)}
                onGraphMouseMove={(event) => handleGraphMouseMove(event, graphRow)}
                onGraphMouseLeave={clearHover}
              />
            </div>
          )
        })}
      </div>
      {loadingMore ? (
        <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-muted-foreground">
          <RefreshCw className="size-3 animate-spin" />
          {translate('gitLog.list.loadingMore', 'Loading more commits…')}
        </div>
      ) : null}
    </div>
  )
}

function sameGraphHit(a: GitLogGraphHit | null, b: GitLogGraphHit | null): boolean {
  if (!a || !b || a.rowId !== b.rowId) {
    return a === b
  }
  if (a.kind === 'node' || b.kind === 'node') {
    return a.kind === b.kind
  }
  // A whole run highlights as one unit, so moving within it keeps the same hover state.
  return a.fragmentId && b.fragmentId
    ? a.fragmentId === b.fragmentId && a.collapsed === b.collapsed
    : a.edge === b.edge
}

function collapsedTitle(
  hit: GitLogGraphHit | null,
  fragments: GitLogGraphModel['fragments']
): string | undefined {
  if (hit?.kind !== 'edge' || !hit.collapsed) {
    return undefined
  }
  const fragment = fragments.find((candidate) => candidate.id === hit.fragmentId)
  return translate('gitLog.graph.hiddenCommits', '{{value0}} commits hidden — click to expand', {
    value0: Math.max(0, (fragment?.commitIds.length ?? 2) - 2)
  })
}
