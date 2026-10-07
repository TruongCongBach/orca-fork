import { describe, expect, it } from 'vitest'
import type { GitHistoryExecutor } from './git-history'
import { loadGitHistoryFromExecutor } from './git-history'
import { normalizeGitHistoryOptions } from './git-log-loader'

const HEAD_OID = 'a'.repeat(40)
const OTHER_OID = 'b'.repeat(40)

function logRecord(hash: string, parents: string[], message: string): string {
  return `${[hash, 'Ada', 'ada@example.com', '1700000000', '1700000000', parents.join(' '), '', '', message].join('\n')}\0`
}

function createExecutor(logStdout: string): { executor: GitHistoryExecutor; calls: string[][] } {
  const calls: string[][] = []
  const executor: GitHistoryExecutor = async (args) => {
    calls.push(args)
    if (args[0] === 'rev-parse' && args.includes('HEAD^{commit}')) {
      return { stdout: `${HEAD_OID}\n` }
    }
    if (args[0] === 'rev-parse' && args.includes('bbbb^{commit}')) {
      return { stdout: `${OTHER_OID}\n` }
    }
    if (args[0] === 'rev-parse') {
      throw new Error('unknown revision')
    }
    if (args[0] === 'symbolic-ref') {
      return { stdout: 'main\n' }
    }
    if (args[0] === 'for-each-ref') {
      return { stdout: `refs/heads/main\0${HEAD_OID}\0\nrefs/tags/v1\0${OTHER_OID}\0\n` }
    }
    if (args[0] === 'branch') {
      return { stdout: 'refs/heads/main\nrefs/remotes/origin/main\n' }
    }
    if (args[0] === 'log') {
      return { stdout: logStdout }
    }
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  return { executor, calls }
}

describe('Git Log scope', () => {
  it('walks every ref, returns refs and reports more pages', async () => {
    const stdout = logRecord(HEAD_OID, [OTHER_OID], 'Merge x') + logRecord(OTHER_OID, [], 'init')
    const { executor, calls } = createExecutor(stdout)
    const result = await loadGitHistoryFromExecutor(executor, '/repo', {
      scope: 'log',
      limit: 1,
      includeRefs: true,
      filters: { author: 'Ada' }
    })
    const logCall = calls.find((args) => args[0] === 'log')!
    expect(logCall).toEqual(
      expect.arrayContaining(['-n2', '--author=Ada', '--branches', 'HEAD', '--'])
    )
    expect(result.items.map((item) => item.id)).toEqual([HEAD_OID])
    expect(result.hasMore).toBe(true)
    expect(result.refs?.map((ref) => ref.shortName)).toEqual(['main', 'v1'])
    expect(result.currentRef?.name).toBe('main')
  })

  it('jumps straight to a commit when the text filter is a resolvable hash', async () => {
    const { executor, calls } = createExecutor(logRecord(OTHER_OID, [], 'init'))
    const result = await loadGitHistoryFromExecutor(executor, '/repo', {
      scope: 'log',
      filters: { text: 'bbbb' }
    })
    const logCall = calls.find((args) => args[0] === 'log')!
    expect(logCall).toEqual(expect.arrayContaining(['-n1', OTHER_OID, '--']))
    expect(logCall.some((arg) => arg.startsWith('--grep'))).toBe(false)
    expect(result.items.map((item) => item.id)).toEqual([OTHER_OID])
  })

  it('falls back to a message search when hex text is not a commit', async () => {
    const { executor, calls } = createExecutor('')
    await loadGitHistoryFromExecutor(executor, '/repo', { scope: 'log', filters: { text: 'cafe' } })
    expect(calls.find((args) => args[0] === 'log')).toContain('--grep=cafe')
  })

  it('lists branches containing a commit without running git log', async () => {
    const { executor, calls } = createExecutor('')
    const result = await loadGitHistoryFromExecutor(executor, '/repo', {
      scope: 'log',
      branchesContaining: HEAD_OID
    })
    expect(result.containingBranches).toEqual(['main', 'origin/main'])
    expect(calls.some((args) => args[0] === 'log')).toBe(false)
  })

  it('keeps the sidebar HEAD-only history unchanged when scope is absent', async () => {
    const { executor, calls } = createExecutor(logRecord(HEAD_OID, [], 'init'))
    await loadGitHistoryFromExecutor(executor, '/repo', { limit: 5 })
    const logCall = calls.find((args) => args[0] === 'log')!
    expect(logCall.at(-1)).toBe(HEAD_OID)
    expect(logCall).not.toContain('--branches')
  })
})

describe('normalizeGitHistoryOptions', () => {
  it('keeps only well-formed Git Log fields from untyped params', () => {
    expect(
      normalizeGitHistoryOptions({
        limit: 50,
        baseRef: 'origin/main',
        scope: 'log',
        skip: -3,
        includeRefs: 'yes',
        branchesContaining: 'not-an-oid',
        filters: { text: ' fix ', revisions: ['--all'] }
      })
    ).toEqual({
      limit: 50,
      baseRef: 'origin/main',
      scope: 'log',
      skip: 0,
      filters: { text: 'fix' }
    })
    expect(normalizeGitHistoryOptions({ branchesContaining: HEAD_OID }).branchesContaining).toBe(
      HEAD_OID
    )
  })
})
