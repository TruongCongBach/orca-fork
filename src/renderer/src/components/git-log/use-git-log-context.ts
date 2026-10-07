import { useMemo } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client'
import { useAppStore } from '@/store'
import { useRepoById, useWorktreeMap } from '@/store/selectors'

/**
 * Resolves the git routing context for the worktree that owns a Git Log tab. Mirrors the Source
 * Control panel: git reads go to the repo OWNER host, not whichever host is focused.
 */
export function useGitLogContext(worktreeId: string): RuntimeGitContext | null {
  const worktree = useWorktreeMap().get(worktreeId)
  const repo = useRepoById(worktree?.repoId ?? null)
  const settings = useAppStore((s) => s.settings)
  const repoId = repo?.id ?? null
  const repoConnectionId = repo?.connectionId ?? null
  const repoExecutionHostId = repo?.executionHostId ?? null
  const worktreePath = worktree?.path ?? null
  return useMemo(() => {
    if (!worktreePath) {
      return null
    }
    return {
      settings: getRepoOwnerRoutedSettings(
        settings,
        repoId
          ? { id: repoId, connectionId: repoConnectionId, executionHostId: repoExecutionHostId }
          : null
      ),
      worktreeId,
      worktreePath,
      connectionId: getConnectionId(worktreeId) ?? repoConnectionId ?? undefined
    }
  }, [repoConnectionId, repoExecutionHostId, repoId, settings, worktreeId, worktreePath])
}
