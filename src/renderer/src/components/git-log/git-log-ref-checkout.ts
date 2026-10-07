import { isBranchCheckedOutInWorktrees } from '../../../../shared/composer-branch-selection'
import type { GitLogRef } from '../../../../shared/git-log-query'
import { remoteBranchLabel } from './git-log-ref-tree-model'

export type GitLogRefCheckoutTarget =
  | { kind: 'hidden' }
  | { kind: 'disabled'; worktreeFolder: string }
  | { kind: 'enabled'; branch: string }

export type GitLogRefCheckoutContext = {
  /** Short name of the branch checked out here; null when HEAD is detached. */
  currentBranch: string | null
  /** Branches held by the repo's other worktrees (short or `refs/heads/` form). */
  otherWorktreeBranches: readonly { branch: string; worktreeFolder: string }[]
}

/**
 * What "Checkout" in the ref tree does for `ref`. Always yields a short branch name: passing a
 * full ref (`refs/heads/x`, `origin/x`) makes `git checkout` detach HEAD instead of switching.
 */
export function gitLogRefCheckoutTarget(
  ref: GitLogRef,
  context: GitLogRefCheckoutContext
): GitLogRefCheckoutTarget {
  if (ref.category === 'tag' || ref.fullName === 'HEAD') {
    return { kind: 'hidden' }
  }
  // Why: a remote-relative name makes git DWIM — it checks out the same-named local branch if one
  // exists, else creates it tracking this remote branch.
  const branch = ref.category === 'remote' ? remoteBranchLabel(ref) : ref.shortName
  if (!branch || branch === 'HEAD' || branch.startsWith('-') || branch === context.currentBranch) {
    return { kind: 'hidden' }
  }
  const holder = context.otherWorktreeBranches.find((worktree) =>
    isBranchCheckedOutInWorktrees(branch, [worktree.branch])
  )
  return holder
    ? { kind: 'disabled', worktreeFolder: holder.worktreeFolder }
    : { kind: 'enabled', branch }
}
