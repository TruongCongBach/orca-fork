import { GIT_HISTORY_COMMIT_FORMAT, parseGitHistoryLog } from './git-history-log-parser'
import { clampHistoryLimit, resolveCommit, resolveCurrentRef } from './git-history-resolve'
import type { GitHistoryExecutor, GitHistoryOptions, GitHistoryResult } from './git-history-types'
import {
  buildBranchesContainingArgs,
  buildGitLogArgs,
  buildGitLogRefsArgs,
  looksLikeCommitHash,
  normalizeGitLogFilters,
  parseBranchesContaining,
  parseGitLogRefs,
  type GitLogRef
} from './git-log-query'

const FULL_OID_RE = /^[0-9a-f]{40}([0-9a-f]{24})?$/i
export const GIT_LOG_MAX_SKIP = 1_000_000

function emptyResult(limit: number): GitHistoryResult {
  return { items: [], hasIncomingChanges: false, hasOutgoingChanges: false, hasMore: false, limit }
}

/**
 * Normalizes untyped history options from IPC / relay params so the sidebar's HEAD-only fields and
 * the Git Log tab's query fields arrive in the same shape regardless of transport.
 */
export function normalizeGitHistoryOptions(raw: Record<string, unknown>): GitHistoryOptions {
  const options: GitHistoryOptions = {
    limit: typeof raw.limit === 'number' ? raw.limit : undefined,
    baseRef: typeof raw.baseRef === 'string' ? raw.baseRef : null
  }
  if (raw.scope === 'log') {
    options.scope = 'log'
  }
  if (typeof raw.skip === 'number' && Number.isFinite(raw.skip)) {
    options.skip = Math.min(GIT_LOG_MAX_SKIP, Math.max(0, Math.trunc(raw.skip)))
  }
  if (raw.filters !== undefined) {
    options.filters = normalizeGitLogFilters(raw.filters)
  }
  if (raw.includeRefs === true) {
    options.includeRefs = true
  }
  if (typeof raw.branchesContaining === 'string' && FULL_OID_RE.test(raw.branchesContaining)) {
    options.branchesContaining = raw.branchesContaining
  }
  return options
}

async function loadRefs(git: GitHistoryExecutor, cwd: string): Promise<GitLogRef[]> {
  const { stdout } = await git(buildGitLogRefsArgs(), cwd)
  return parseGitLogRefs(stdout)
}

/**
 * The Git Log tab's query: every ref (or the selected revisions) with message/author/date/path
 * filters and offset paging. Unlike the sidebar history it is not scoped to the workspace HEAD.
 */
export async function loadGitLogFromExecutor(
  git: GitHistoryExecutor,
  cwd: string,
  options: GitHistoryOptions
): Promise<GitHistoryResult> {
  const limit = clampHistoryLimit(options.limit)
  if (options.branchesContaining) {
    if (!FULL_OID_RE.test(options.branchesContaining)) {
      return { ...emptyResult(limit), containingBranches: [] }
    }
    const { stdout } = await git(buildBranchesContainingArgs(options.branchesContaining), cwd)
    return { ...emptyResult(limit), containingBranches: parseBranchesContaining(stdout) }
  }

  const filters = normalizeGitLogFilters(options.filters)
  const skip = Math.min(GIT_LOG_MAX_SKIP, Math.max(0, Math.trunc(options.skip ?? 0)))
  const [headOid, refs] = await Promise.all([
    resolveCommit(git, cwd, 'HEAD'),
    options.includeRefs ? loadRefs(git, cwd) : Promise.resolve(undefined)
  ])
  const currentRef = headOid ? (await resolveCurrentRef(git, cwd, headOid)).currentRef : undefined
  const base = { ...emptyResult(limit), currentRef, ...(refs ? { refs } : {}) }
  if (!headOid && (refs?.length ?? 0) === 0) {
    // Unborn repository: nothing to walk.
    return base
  }

  if (filters.text && looksLikeCommitHash(filters.text) && skip === 0) {
    const oid = await resolveCommit(git, cwd, filters.text)
    if (oid) {
      const { stdout } = await git(
        buildGitLogArgs({
          format: GIT_HISTORY_COMMIT_FORMAT,
          limit: 1,
          filters: { revisions: [oid] }
        }),
        cwd
      )
      return { ...base, items: parseGitHistoryLog(stdout) }
    }
  }

  const { stdout } = await git(
    buildGitLogArgs({
      format: GIT_HISTORY_COMMIT_FORMAT,
      limit: limit + 1,
      skip,
      filters,
      includeHead: Boolean(headOid)
    }),
    cwd
  )
  const parsed = parseGitHistoryLog(stdout)
  return { ...base, items: parsed.slice(0, limit), hasMore: parsed.length > limit }
}
