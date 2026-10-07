import { ipcMain } from 'electron'
import type { Store } from '../../persistence'
import { checkoutBranch } from '../../git/checkout'
import { getSshGitProvider } from '../../providers/ssh-git-dispatch'
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
      if (args.connectionId) {
        const provider = getSshGitProvider(args.connectionId)
        if (!provider) {
          throw new Error(`No git provider for connection "${args.connectionId}"`)
        }
        return provider.checkoutBranch(args.worktreePath, args.branch)
      }
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
