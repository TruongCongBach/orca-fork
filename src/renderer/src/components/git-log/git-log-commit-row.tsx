import React from 'react'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitHistoryGraphColorId } from '../../../../shared/git-history-types'
import type { GitLogGraphRow } from '../../../../shared/git-log-graph-layout'
import type { GitLogGraphHighlight } from '../../../../shared/git-log-graph-path-highlight'
import { dedupeRemoteTrackingRefs } from '../../../../shared/git-history-ref-display'
import { GIT_HISTORY_REF_COLOR } from '../../../../shared/git-history-types'
import { graphColor } from '../right-sidebar/source-control/sync/git-history-graph-svg'
import {
  GitHistoryCommitContextMenu,
  type GitHistoryCommitAction
} from '../right-sidebar/source-control/sync/git-history-commit-context-menu'
import { gitLogColumnsTemplate, type GitLogColumn } from './git-log-columns-model'
import { formatGitLogRowDate } from './git-log-format'
import { GitLogGraphRowSvg } from './git-log-graph-row'

function RefLabel({
  itemRef,
  color
}: {
  itemRef: GitHistoryItemRef
  color: GitHistoryGraphColorId
}): React.JSX.Element {
  return (
    <span
      className="max-w-[12rem] min-w-0 truncate rounded border px-1 text-[10px] leading-4"
      title={itemRef.name}
      style={{ borderColor: graphColor(color), color: graphColor(color) }}
    >
      {itemRef.name}
    </span>
  )
}

export function GitLogCommitRow({
  item,
  graphRow,
  graphWidth,
  columns,
  minWidth,
  selected,
  currentRefId,
  onSelect,
  onAction,
  collapsedEdgeTargets,
  graphHighlight,
  graphPointer,
  graphTitle,
  onGraphMouseDown,
  onGraphMouseMove,
  onGraphMouseLeave
}: {
  item: GitHistoryItem
  graphRow: GitLogGraphRow
  graphWidth: number
  columns: GitLogColumn[]
  minWidth: number
  selected: boolean
  currentRefId?: string
  onSelect: (item: GitHistoryItem) => void
  onAction: (action: GitHistoryCommitAction, item: GitHistoryItem) => void
  collapsedEdgeTargets: ReadonlyMap<string, string>
  graphHighlight: GitLogGraphHighlight
  /** The pointer rests on a segment that collapses/expands a linear run. */
  graphPointer: boolean
  graphTitle?: string
  /** Lane-segment presses fold linear branches; it stops propagation when it handles one. */
  onGraphMouseDown: (event: React.MouseEvent<HTMLElement>) => void
  onGraphMouseMove: (event: React.MouseEvent<HTMLElement>) => void
  onGraphMouseLeave: () => void
}): React.JSX.Element {
  const isMerge = item.parentIds.length > 1
  const refs = dedupeRemoteTrackingRefs(item.references ?? [], {
    preserveRefIds: currentRefId ? [currentRefId] : undefined
  })
  const cell = (column: GitLogColumn): React.ReactNode => {
    switch (column.id) {
      case 'graph':
        return (
          <div
            key="graph"
            className={cn('h-6 overflow-hidden', graphPointer && 'cursor-pointer')}
            title={graphTitle}
            onMouseDown={onGraphMouseDown}
            onMouseMove={onGraphMouseMove}
            onMouseLeave={onGraphMouseLeave}
          >
            <GitLogGraphRowSvg
              row={graphRow}
              width={graphWidth}
              isHead={refs.some((ref) => ref.id === currentRefId)}
              collapsedEdgeTargets={collapsedEdgeTargets}
              highlight={graphHighlight}
            />
          </div>
        )
      case 'subject':
        return (
          <div
            key="subject"
            className="flex min-w-0 items-center gap-1.5 overflow-hidden px-2"
            title={item.message}
          >
            <span className="min-w-[40%] flex-1 truncate">{item.subject}</span>
            {refs.length > 0 ? (
              <span className="flex max-w-[60%] min-w-0 shrink items-center gap-1 overflow-hidden">
                {refs.map((ref) => (
                  <RefLabel
                    key={ref.id}
                    itemRef={ref}
                    color={ref.id === currentRefId ? GIT_HISTORY_REF_COLOR : graphRow.color}
                  />
                ))}
              </span>
            ) : null}
          </div>
        )
      case 'author':
        return (
          <span
            key="author"
            className={cn('truncate px-2', !isMerge && 'font-medium')}
            title={item.authorEmail}
          >
            {item.author}
          </span>
        )
      case 'date':
        return (
          <span key="date" className="truncate px-2 text-right tabular-nums">
            {formatGitLogRowDate(item.timestamp)}
          </span>
        )
      case 'hash':
        return (
          <span key="hash" className="truncate px-2 font-mono text-[11px]" title={item.id}>
            {item.displayId ?? item.id.slice(0, 8)}
          </span>
        )
    }
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="row"
          aria-selected={selected}
          data-testid="git-log-commit-row"
          className={cn(
            'grid h-6 cursor-default items-center pr-3 text-xs',
            selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40',
            isMerge && !selected && 'text-muted-foreground'
          )}
          style={{ gridTemplateColumns: gitLogColumnsTemplate(columns), minWidth }}
          onMouseDown={() => onSelect(item)}
        >
          {columns.map(cell)}
        </div>
      </ContextMenuTrigger>
      <GitHistoryCommitContextMenu item={item} onAction={onAction} />
    </ContextMenu>
  )
}
