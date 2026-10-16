import { useMemo } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { useRepoById, useWorktreeMap } from '@/store/selectors'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'

/**
 * Resolves the git routing context for the worktree that owns a Git Log tab. Mirrors the Source
 * Control panel: git reads go to the repo OWNER host, not whichever host is focused.
 */
export function useGitLogContext(worktreeId: string): RuntimeGitContext | null {
  const worktree = useWorktreeMap().get(worktreeId)
  const repo = useRepoById(worktree?.repoId ?? null)
  const repoId = repo?.id ?? null
  const repoConnectionId = repo?.connectionId ?? null
  const repoExecutionHostId = repo?.executionHostId ?? null
  const worktreePath = worktree?.path ?? null
  return useMemo(() => {
    const target = repoId
      ? ipcOrRuntimeTargetForHostId(
          getRepoExecutionHostId({
            connectionId: repoConnectionId,
            executionHostId: repoExecutionHostId
          })
        )
      : null
    if (!worktreePath || !target) {
      return null
    }
    return {
      target,
      worktreeId,
      worktreePath,
      connectionId: getConnectionId(worktreeId) ?? repoConnectionId ?? undefined
    }
  }, [repoConnectionId, repoExecutionHostId, repoId, worktreeId, worktreePath])
}
