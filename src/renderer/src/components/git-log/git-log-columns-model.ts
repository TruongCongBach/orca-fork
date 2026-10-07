// Pure column model for the Git Log commit table: order, widths, minimums, reset.

export type GitLogColumnId = 'graph' | 'subject' | 'author' | 'date' | 'hash'

export type GitLogColumn = { id: GitLogColumnId; width: number }

export const GIT_LOG_COLUMN_MIN_WIDTH: Record<GitLogColumnId, number> = {
  graph: 28,
  subject: 160,
  author: 60,
  date: 80,
  hash: 56
}

export const GIT_LOG_COLUMN_MAX_WIDTH = 2000

export const DEFAULT_GIT_LOG_COLUMNS: readonly GitLogColumn[] = [
  { id: 'graph', width: 132 },
  { id: 'subject', width: 420 },
  { id: 'author', width: 144 },
  { id: 'date', width: 136 },
  { id: 'hash', width: 76 }
]

export function defaultGitLogColumns(): GitLogColumn[] {
  return DEFAULT_GIT_LOG_COLUMNS.map((column) => ({ ...column }))
}

export function clampGitLogColumnWidth(id: GitLogColumnId, width: number): number {
  if (!Number.isFinite(width)) {
    return GIT_LOG_COLUMN_MIN_WIDTH[id]
  }
  return Math.min(
    GIT_LOG_COLUMN_MAX_WIDTH,
    Math.max(GIT_LOG_COLUMN_MIN_WIDTH[id], Math.round(width))
  )
}

export function resizeGitLogColumn(
  columns: readonly GitLogColumn[],
  id: GitLogColumnId,
  width: number
): GitLogColumn[] {
  return columns.map((column) =>
    column.id === id ? { ...column, width: clampGitLogColumnWidth(id, width) } : column
  )
}

/** Moves `id` into `targetId`'s slot (before it when moving left, after it when moving right). */
export function moveGitLogColumn(
  columns: readonly GitLogColumn[],
  id: GitLogColumnId,
  targetId: GitLogColumnId
): GitLogColumn[] {
  const from = columns.findIndex((column) => column.id === id)
  const to = columns.findIndex((column) => column.id === targetId)
  if (from === -1 || to === -1 || from === to) {
    return [...columns]
  }
  const next = [...columns]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

/** CSS grid template: fixed px widths, the subject column also absorbs any spare room. */
export function gitLogColumnsTemplate(columns: readonly GitLogColumn[]): string {
  return columns
    .map((column) =>
      column.id === 'subject' ? `minmax(${column.width}px, 1fr)` : `${column.width}px`
    )
    .join(' ')
}

export function gitLogColumnsMinWidth(columns: readonly GitLogColumn[]): number {
  return columns.reduce((sum, column) => sum + column.width, 0)
}
