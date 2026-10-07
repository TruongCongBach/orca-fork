import { describe, expect, it } from 'vitest'
import {
  GIT_LOG_ALL_REVISION_ARGS,
  buildBranchesContainingArgs,
  buildGitLogArgs,
  buildGitLogRefsArgs,
  looksLikeCommitHash,
  normalizeGitLogFilters,
  parseBranchesContaining,
  parseGitLogRefs
} from './git-log-query'

const BASE = ['log', '--no-show-signature', '--no-color', '--format=FMT', '-z', '--topo-order']

describe('buildGitLogArgs', () => {
  it('walks every branch, remote, tag and HEAD when no revision filter is set', () => {
    expect(buildGitLogArgs({ format: 'FMT', limit: 51 })).toEqual([
      ...BASE,
      '--decorate=full',
      '-n51',
      ...GIT_LOG_ALL_REVISION_ARGS,
      '--'
    ])
  })

  it('omits HEAD for an unborn repository', () => {
    const args = buildGitLogArgs({ format: 'FMT', limit: 5, includeHead: false })
    expect(args.slice(-4)).toEqual(['--branches', '--remotes', '--tags', '--'])
  })

  it('pages with --skip and ignores non-positive skips', () => {
    expect(buildGitLogArgs({ format: 'FMT', limit: 10, skip: 200 })).toContain('--skip=200')
    expect(buildGitLogArgs({ format: 'FMT', limit: 10, skip: 0 })).not.toContain('--skip=0')
    expect(buildGitLogArgs({ format: 'FMT', limit: 10, skip: -5 }).join(' ')).not.toContain(
      '--skip'
    )
  })

  it('matches message text literally and case-insensitively by default', () => {
    const args = buildGitLogArgs({ format: 'FMT', limit: 10, filters: { text: 'fix: a.b' } })
    expect(args).toContain('--regexp-ignore-case')
    expect(args).toContain('--fixed-strings')
    expect(args).toContain('--grep=fix: a.b')
    expect(args).not.toContain('--extended-regexp')
  })

  it('switches to extended regex and case-sensitive matching when toggled', () => {
    const args = buildGitLogArgs({
      format: 'FMT',
      limit: 10,
      filters: { text: '^fix\\b', textRegex: true, textMatchCase: true }
    })
    expect(args).toContain('--extended-regexp')
    expect(args).toContain('--grep=^fix\\b')
    expect(args).not.toContain('--regexp-ignore-case')
    expect(args).not.toContain('--fixed-strings')
  })

  it('adds author and date filters', () => {
    const args = buildGitLogArgs({
      format: 'FMT',
      limit: 10,
      filters: { author: 'Ada', since: '2026-01-01', until: '2026-02-01' }
    })
    expect(args).toEqual(
      expect.arrayContaining([
        '--author=Ada',
        '--since=2026-01-01',
        '--until=2026-02-01',
        '--regexp-ignore-case',
        '--fixed-strings'
      ])
    )
  })

  it('walks only the selected revisions and puts paths after the -- separator', () => {
    const args = buildGitLogArgs({
      format: 'FMT',
      limit: 10,
      filters: { revisions: ['main', 'origin/feature'], paths: ['src/a.ts', 'docs'] }
    })
    expect(args.slice(-5)).toEqual(['main', 'origin/feature', '--', 'src/a.ts', 'docs'])
    expect(args).not.toContain('--branches')
  })

  it('never forwards a revision or path that git would read as an option', () => {
    const args = buildGitLogArgs({
      format: 'FMT',
      limit: 10,
      filters: { revisions: ['--output=/tmp/x'], paths: ['-p'] }
    })
    expect(args).not.toContain('--output=/tmp/x')
    expect(args).not.toContain('-p')
    expect(args).toContain('--branches')
  })
})

describe('normalizeGitLogFilters', () => {
  it('drops empty, unsafe and wrongly-typed values', () => {
    expect(
      normalizeGitLogFilters({
        text: '   ',
        textRegex: true,
        author: 42,
        revisions: ['main', '', '-x', 7],
        paths: [],
        since: ' 2026-01-01 '
      })
    ).toEqual({ revisions: ['main'], since: '2026-01-01' })
  })

  it('keeps regex/case toggles only alongside text', () => {
    expect(normalizeGitLogFilters({ text: 'fix', textRegex: true, textMatchCase: true })).toEqual({
      text: 'fix',
      textRegex: true,
      textMatchCase: true
    })
    expect(normalizeGitLogFilters(null)).toEqual({})
  })
})

describe('looksLikeCommitHash', () => {
  it('accepts 4-40 hex characters only', () => {
    expect(looksLikeCommitHash('1de3')).toBe(true)
    expect(looksLikeCommitHash('1DE3AA405F71')).toBe(true)
    expect(looksLikeCommitHash('1de')).toBe(false)
    expect(looksLikeCommitHash('fix bug')).toBe(false)
    expect(looksLikeCommitHash(undefined)).toBe(false)
  })
})

describe('parseGitLogRefs', () => {
  it('groups local, remote and tag refs, peels annotated tags and skips remote HEAD', () => {
    expect(buildGitLogRefsArgs()[0]).toBe('for-each-ref')
    const stdout = [
      `refs/heads/main\0${'a'.repeat(40)}\0`,
      `refs/heads/feat/log\0${'b'.repeat(40)}\0`,
      `refs/remotes/origin/HEAD\0${'a'.repeat(40)}\0`,
      `refs/remotes/origin/feat/log\0${'b'.repeat(40)}\0`,
      `refs/tags/v1.0\0${'c'.repeat(40)}\0${'d'.repeat(40)}`,
      `refs/tags/light\0${'e'.repeat(40)}\0`,
      `refs/stash\0${'f'.repeat(40)}\0`,
      ''
    ].join('\n')
    expect(parseGitLogRefs(stdout)).toEqual([
      { fullName: 'refs/heads/main', shortName: 'main', category: 'local', oid: 'a'.repeat(40) },
      {
        fullName: 'refs/heads/feat/log',
        shortName: 'feat/log',
        category: 'local',
        oid: 'b'.repeat(40)
      },
      {
        fullName: 'refs/remotes/origin/feat/log',
        shortName: 'origin/feat/log',
        category: 'remote',
        remote: 'origin',
        oid: 'b'.repeat(40)
      },
      { fullName: 'refs/tags/v1.0', shortName: 'v1.0', category: 'tag', oid: 'd'.repeat(40) },
      { fullName: 'refs/tags/light', shortName: 'light', category: 'tag', oid: 'e'.repeat(40) }
    ])
  })
})

describe('branches containing a commit', () => {
  it('builds an all-branches --contains query and returns short names', () => {
    expect(buildBranchesContainingArgs('a'.repeat(40))).toEqual([
      'branch',
      '--all',
      '--format=%(refname)',
      '--contains',
      'a'.repeat(40)
    ])
    expect(
      parseBranchesContaining(
        'refs/heads/main\nrefs/remotes/origin/HEAD\nrefs/remotes/origin/main\n\n'
      )
    ).toEqual(['main', 'origin/main'])
  })
})
