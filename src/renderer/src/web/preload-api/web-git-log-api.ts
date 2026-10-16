import type { PreloadApi } from '../../../../preload/api-types'
import { toRuntimeWorktreeSelector } from '../../runtime/runtime-worktree-selector'
import { callRuntimeResult } from './web-runtime-calls'
import { resolveRuntimeWorktreeByPath } from './web-runtime-worktree-catalog'

type GitApi = NonNullable<PreloadApi['git']>

/** Git Log tab reads (filtered history) and ref checkout over the web runtime. */
export function createGitLogApi(): Pick<GitApi, 'history' | 'checkout'> {
  return {
    history: async ({ worktreePath, connectionId: _connectionId, ...options }) => {
      const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
      return callRuntimeResult('git.history', {
        worktree: toRuntimeWorktreeSelector(worktree.id),
        ...options
      })
    },
    checkout: async ({ worktreePath, branch }) => {
      const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
      await callRuntimeResult('git.checkout', {
        worktree: toRuntimeWorktreeSelector(worktree.id),
        branch
      })
    }
  }
}
