import React, { useRef, useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  gitLogColumnsTemplate,
  type GitLogColumn,
  type GitLogColumnId
} from './git-log-columns-model'
import { gitLogColumnActions } from './git-log-store'

export function gitLogColumnLabel(id: GitLogColumnId): string {
  switch (id) {
    case 'graph':
      return translate('gitLog.columns.graph', 'Graph')
    case 'subject':
      return translate('gitLog.columns.subject', 'Subject')
    case 'author':
      return translate('gitLog.columns.author', 'Author')
    case 'date':
      return translate('gitLog.columns.date', 'Date')
    case 'hash':
      return translate('gitLog.columns.hash', 'Hash')
  }
}

function ResizeHandle({
  columnId,
  cellRef,
  resizingRef
}: {
  columnId: GitLogColumnId
  cellRef: React.RefObject<HTMLDivElement | null>
  resizingRef: React.RefObject<boolean>
}): React.JSX.Element {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={translate('gitLog.columns.resize', 'Resize {{value0}} column', {
        value0: gitLogColumnLabel(columnId)
      })}
      data-testid={`git-log-column-resize-${columnId}`}
      className="absolute top-0 right-0 z-10 h-full w-2 translate-x-1 cursor-col-resize hover:bg-ring/40"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        // Why: start from the rendered width — the subject column can be wider than its stored minimum.
        const startWidth = cellRef.current?.getBoundingClientRect().width ?? 0
        dragRef.current = { startX: event.clientX, startWidth }
        resizingRef.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (drag) {
          gitLogColumnActions.resize(columnId, drag.startWidth + event.clientX - drag.startX)
        }
      }}
      onPointerUp={(event) => {
        dragRef.current = null
        resizingRef.current = false
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
    />
  )
}

const REORDER_THRESHOLD_PX = 4

function columnIdAtPoint(x: number, y: number): GitLogColumnId | null {
  const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-git-log-column]')
  const id = cell?.dataset.gitLogColumn
  return (['graph', 'subject', 'author', 'date', 'hash'] as const).find((c) => c === id) ?? null
}

function HeaderCell({
  column,
  isDropTarget,
  onDropTargetChange
}: {
  column: GitLogColumn
  isDropTarget: boolean
  onDropTargetChange: (id: GitLogColumnId | null) => void
}): React.JSX.Element {
  const cellRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)
  // Why pointer events, not HTML5 drag-and-drop: Electron routes native drags through the OS and
  // the app's document-level drop guards; a pointer drag stays inside the table.
  const reorderRef = useRef<{ startX: number; active: boolean } | null>(null)
  return (
    <div
      ref={cellRef}
      role="columnheader"
      data-git-log-column={column.id}
      data-testid={`git-log-column-${column.id}`}
      className={cn(
        'relative flex h-6 min-w-0 cursor-grab items-center px-2 text-[11px] text-muted-foreground select-none',
        isDropTarget && 'bg-accent/60'
      )}
      onPointerDown={(event) => {
        if (event.button !== 0 || resizingRef.current) {
          return
        }
        reorderRef.current = { startX: event.clientX, active: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const reorder = reorderRef.current
        if (!reorder) {
          return
        }
        if (!reorder.active && Math.abs(event.clientX - reorder.startX) < REORDER_THRESHOLD_PX) {
          return
        }
        reorder.active = true
        const target = columnIdAtPoint(event.clientX, event.clientY)
        onDropTargetChange(target && target !== column.id ? target : null)
      }}
      onPointerUp={(event) => {
        const reorder = reorderRef.current
        reorderRef.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        onDropTargetChange(null)
        const target = reorder?.active ? columnIdAtPoint(event.clientX, event.clientY) : null
        if (target && target !== column.id) {
          gitLogColumnActions.move(column.id, target)
        }
      }}
      onPointerCancel={() => {
        reorderRef.current = null
        onDropTargetChange(null)
      }}
    >
      <span className="truncate">{gitLogColumnLabel(column.id)}</span>
      <ResizeHandle columnId={column.id} cellRef={cellRef} resizingRef={resizingRef} />
    </div>
  )
}

export function GitLogCommitHeader({
  columns,
  minWidth
}: {
  columns: GitLogColumn[]
  minWidth: number
}): React.JSX.Element {
  const [dropTarget, setDropTarget] = useState<GitLogColumnId | null>(null)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="row"
          data-testid="git-log-commit-header"
          className="sticky top-0 z-20 grid border-b border-border bg-background pr-3"
          style={{ gridTemplateColumns: gitLogColumnsTemplate(columns), minWidth }}
        >
          {columns.map((column) => (
            <HeaderCell
              key={column.id}
              column={column}
              isDropTarget={dropTarget === column.id}
              onDropTargetChange={setDropTarget}
            />
          ))}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => gitLogColumnActions.reset()}>
          {translate('gitLog.columns.reset', 'Reset columns')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
