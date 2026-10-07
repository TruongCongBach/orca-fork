// Pure helpers for the Git Log tab: `git log` argument building for the multi-ref log view, plus
// parsing of `for-each-ref` / `branch --contains` output. Kept executor-free so main and the SSH
// relay build byte-identical git invocations.

export type GitLogFilters = {
  /** Commit message text (or a hash prefix, resolved separately by the loader). */
  text?: string
  textRegex?: boolean
  textMatchCase?: boolean
  /** Revisions to walk. Empty/absent means every local branch, remote branch, tag and HEAD. */
  revisions?: string[]
  author?: string
  /** Any date string `git log --since` accepts (ISO 8601 recommended). */
  since?: string
  until?: string
  /** Repository-relative pathspecs. */
  paths?: string[]
}

export type GitLogRefCategory = 'local' | 'remote' | 'tag'

export type GitLogRef = {
  /** Full ref name, e.g. `refs/heads/main`. Stable id for the ref tree. */
  fullName: string
  /** Short display name, e.g. `main`, `origin/main`, `v1.0`. */
  shortName: string
  category: GitLogRefCategory
  /** Remote name for remote-tracking branches (`origin` for `refs/remotes/origin/main`). */
  remote?: string
  /** Commit the ref points at (annotated tags are peeled). */
  oid: string
}

export const GIT_LOG_MAX_TEXT_LENGTH = 500
export const GIT_LOG_MAX_REVISIONS = 50
export const GIT_LOG_MAX_PATHS = 50

// Why: `--all` would also walk refs/stash and notes, which are not branches the user can pick
// in the ref tree. These three plus HEAD (detached HEAD included) match what the tree shows.
export const GIT_LOG_ALL_REVISION_ARGS = ['--branches', '--remotes', '--tags', 'HEAD'] as const

const HEX_HASH_RE = /^[0-9a-f]{4,40}$/i

export function looksLikeCommitHash(text: string | undefined): boolean {
  return HEX_HASH_RE.test(text?.trim() ?? '')
}

function isSafeRevision(revision: string): boolean {
  // Why: revisions are positional args after options; a leading dash would be parsed as a flag.
  return revision.length > 0 && !revision.startsWith('-') && !/[\0\n\r]/.test(revision)
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || /[\0]/.test(trimmed)) {
    return undefined
  }
  return trimmed.slice(0, GIT_LOG_MAX_TEXT_LENGTH)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Drops empty or unsafe values so every layer (IPC, RPC, relay) sends the same normalized shape. */
export function normalizeGitLogFilters(raw: unknown): GitLogFilters {
  if (!isRecord(raw)) {
    return {}
  }
  const str = (key: string): string | undefined => {
    const value = raw[key]
    return typeof value === 'string' ? cleanText(value) : undefined
  }
  const list = (key: string, max: number): string[] | undefined => {
    const value = raw[key]
    if (!Array.isArray(value)) {
      return undefined
    }
    const cleaned = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(isSafeRevision)
      .slice(0, max)
    return cleaned.length > 0 ? cleaned : undefined
  }
  const filters: GitLogFilters = {}
  const text = str('text')
  if (text) {
    filters.text = text
    if (raw.textRegex === true) {
      filters.textRegex = true
    }
    if (raw.textMatchCase === true) {
      filters.textMatchCase = true
    }
  }
  const revisions = list('revisions', GIT_LOG_MAX_REVISIONS)
  if (revisions) {
    filters.revisions = revisions
  }
  const author = str('author')
  if (author) {
    filters.author = author
  }
  const since = str('since')
  if (since) {
    filters.since = since
  }
  const until = str('until')
  if (until) {
    filters.until = until
  }
  const paths = list('paths', GIT_LOG_MAX_PATHS)
  if (paths) {
    filters.paths = paths
  }
  return filters
}

export function buildGitLogArgs(input: {
  format: string
  limit: number
  skip?: number
  filters?: GitLogFilters
  /** False for an unborn HEAD, where naming HEAD would make git fail. Defaults to true. */
  includeHead?: boolean
}): string[] {
  const filters = input.filters ?? {}
  const args = [
    'log',
    '--no-show-signature',
    '--no-color',
    `--format=${input.format}`,
    '-z',
    '--topo-order',
    '--decorate=full',
    `-n${input.limit}`
  ]
  const skip = Math.max(0, Math.trunc(input.skip ?? 0))
  if (skip > 0) {
    args.push(`--skip=${skip}`)
  }
  const hasPattern = Boolean(filters.text || filters.author)
  if (hasPattern && !filters.textMatchCase) {
    // Why: one flag covers both --grep and --author; git has no per-pattern case switch.
    args.push('--regexp-ignore-case')
  }
  if (hasPattern) {
    args.push(filters.textRegex ? '--extended-regexp' : '--fixed-strings')
  }
  if (filters.text) {
    args.push(`--grep=${filters.text}`)
  }
  if (filters.author) {
    args.push(`--author=${filters.author}`)
  }
  if (filters.since) {
    args.push(`--since=${filters.since}`)
  }
  if (filters.until) {
    args.push(`--until=${filters.until}`)
  }
  const revisions = (filters.revisions ?? []).filter(isSafeRevision)
  if (revisions.length > 0) {
    args.push(...revisions)
  } else if (input.includeHead === false) {
    args.push(...GIT_LOG_ALL_REVISION_ARGS.filter((arg) => arg !== 'HEAD'))
  } else {
    args.push(...GIT_LOG_ALL_REVISION_ARGS)
  }
  // Why: always terminate revisions so a ref that shares a name with a file is never read as a path.
  args.push('--')
  for (const path of filters.paths ?? []) {
    if (isSafeRevision(path)) {
      args.push(path)
    }
  }
  return args
}

// `%(*objectname)` is the peeled commit for annotated tags and empty for everything else.
export const GIT_LOG_REFS_FORMAT = '%(refname)%00%(objectname)%00%(*objectname)'

export function buildGitLogRefsArgs(): string[] {
  return [
    'for-each-ref',
    `--format=${GIT_LOG_REFS_FORMAT}`,
    'refs/heads',
    'refs/remotes',
    'refs/tags'
  ]
}

export function parseGitLogRefs(stdout: string): GitLogRef[] {
  const refs: GitLogRef[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) {
      continue
    }
    const [fullName = '', objectName = '', peeled = ''] = line.split('\0')
    const oid = peeled || objectName
    if (!fullName || !oid) {
      continue
    }
    if (fullName.startsWith('refs/heads/')) {
      refs.push({
        fullName,
        shortName: fullName.slice('refs/heads/'.length),
        category: 'local',
        oid
      })
    } else if (fullName.startsWith('refs/remotes/')) {
      const shortName = fullName.slice('refs/remotes/'.length)
      const slash = shortName.indexOf('/')
      // Why: `origin/HEAD` is a symbolic pointer, not a branch; the ref tree would list it twice.
      if (slash <= 0 || shortName.endsWith('/HEAD')) {
        continue
      }
      refs.push({
        fullName,
        shortName,
        category: 'remote',
        remote: shortName.slice(0, slash),
        oid
      })
    } else if (fullName.startsWith('refs/tags/')) {
      refs.push({ fullName, shortName: fullName.slice('refs/tags/'.length), category: 'tag', oid })
    }
  }
  return refs
}

export function buildBranchesContainingArgs(commitOid: string): string[] {
  return ['branch', '--all', '--format=%(refname)', '--contains', commitOid]
}

/** Returns short branch names (`main`, `origin/main`) from `branch --all --format=%(refname)`. */
export function parseBranchesContaining(stdout: string): string[] {
  const names: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const fullName = line.trim()
    if (fullName.startsWith('refs/heads/')) {
      names.push(fullName.slice('refs/heads/'.length))
    } else if (fullName.startsWith('refs/remotes/') && !fullName.endsWith('/HEAD')) {
      names.push(fullName.slice('refs/remotes/'.length))
    }
  }
  return names
}
