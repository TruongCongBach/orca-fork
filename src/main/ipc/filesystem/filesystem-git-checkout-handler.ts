import { ipcMain } from 'electron'
import type { Store } from '../../persistence'
import { checkoutBranch } from '../../git/checkout'
import { requireReachableGitRoute } from '../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../shared/execution-host'
import { resolveRegisteredWorktreePath } from '../registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../local-worktree-runtime-options'

/** `git:checkout` — switch a worktree to an existing (or DWIM-tracked) branch; never forces. */
export function registerFilesystemGitCheckoutHandler(store: Store): void {
  ipcMain.handle(
    'git:checkout',
    async (
      _event,
      args: { worktreePath: string; branch: string; connectionId?: string }
    ): Promise<void> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      await checkoutBranch(worktreePath, args.branch, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )
}
