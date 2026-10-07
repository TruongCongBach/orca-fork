import { describe, expect, it } from 'vitest'
import {
  GIT_LOG_COLUMN_MAX_WIDTH,
  GIT_LOG_COLUMN_MIN_WIDTH,
  defaultGitLogColumns,
  gitLogColumnsTemplate,
  moveGitLogColumn,
  resizeGitLogColumn
} from './git-log-columns-model'

const order = (columns: { id: string }[]): string[] => columns.map((column) => column.id)

describe('git log columns', () => {
  it('resizes one column and clamps to its minimum and the global maximum', () => {
    const columns = defaultGitLogColumns()
    expect(resizeGitLogColumn(columns, 'author', 200).find((c) => c.id === 'author')!.width).toBe(
      200
    )
    expect(resizeGitLogColumn(columns, 'author', 5).find((c) => c.id === 'author')!.width).toBe(
      GIT_LOG_COLUMN_MIN_WIDTH.author
    )
    expect(resizeGitLogColumn(columns, 'graph', 1e9).find((c) => c.id === 'graph')!.width).toBe(
      GIT_LOG_COLUMN_MAX_WIDTH
    )
    expect(
      resizeGitLogColumn(columns, 'date', Number.NaN).find((c) => c.id === 'date')!.width
    ).toBe(GIT_LOG_COLUMN_MIN_WIDTH.date)
  })

  it('moves a column into the target slot in either direction', () => {
    const columns = defaultGitLogColumns()
    expect(order(columns)).toEqual(['graph', 'subject', 'author', 'date', 'hash'])
    expect(order(moveGitLogColumn(columns, 'date', 'subject'))).toEqual([
      'graph',
      'date',
      'subject',
      'author',
      'hash'
    ])
    expect(order(moveGitLogColumn(columns, 'graph', 'author'))).toEqual([
      'subject',
      'author',
      'graph',
      'date',
      'hash'
    ])
    expect(order(moveGitLogColumn(columns, 'hash', 'hash'))).toEqual(order(columns))
  })

  it('lets only the subject column absorb spare width', () => {
    expect(gitLogColumnsTemplate(defaultGitLogColumns())).toBe(
      '132px minmax(420px, 1fr) 144px 136px 76px'
    )
  })

  it('returns fresh default copies for reset', () => {
    const first = defaultGitLogColumns()
    first[0]!.width = 999
    expect(defaultGitLogColumns()[0]!.width).toBe(132)
  })
})
