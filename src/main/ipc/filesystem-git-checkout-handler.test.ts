import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Store } from '../persistence'
import {
  handlers,
  store,
  REPO_PATH,
  WORKTREE_FEATURE_PATH,
  resetFilesystemIpcMocks
} from './filesystem-test-harness'

const checkoutBranchMock = vi.fn()
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers only read getRepos/getSettings, which the harness store implements.
const testStore: Store = store as never

vi.mock('electron', async () => (await import('./filesystem-test-harness')).electronMock)
vi.mock('fs/promises', async () => (await import('./filesystem-test-harness')).fsPromisesMock)
vi.mock('../git/worktree', async () => (await import('./filesystem-test-harness')).gitWorktreeMock)
vi.mock('../git/checkout', () => ({
  checkoutBranch: (...args: unknown[]) => checkoutBranchMock(...args)
}))

import { registerFilesystemGitCheckoutHandler } from './filesystem/filesystem-git-checkout-handler'
import {
  invalidateAuthorizedRootsCache,
  registerWorktreeRootsForRepo
} from './registered-worktree-roots-cache'

describe('git:checkout IPC', () => {
  beforeEach(() => {
    resetFilesystemIpcMocks()
    invalidateAuthorizedRootsCache()
    checkoutBranchMock.mockReset()
  })

  it('checks out locally with interactive admission', async () => {
    registerWorktreeRootsForRepo(testStore, 'repo-1', [REPO_PATH, WORKTREE_FEATURE_PATH])
    checkoutBranchMock.mockResolvedValue(undefined)

    registerFilesystemGitCheckoutHandler(testStore)

    await handlers.get('git:checkout')!(null, {
      worktreePath: WORKTREE_FEATURE_PATH,
      branch: 'feat/x'
    })

    expect(checkoutBranchMock).toHaveBeenCalledWith(WORKTREE_FEATURE_PATH, 'feat/x', {
      admissionTier: 'interactive'
    })
  })

  it('propagates the git error verbatim instead of forcing', async () => {
    registerWorktreeRootsForRepo(testStore, 'repo-1', [REPO_PATH, WORKTREE_FEATURE_PATH])
    const gitError = new Error(
      'error: Your local changes to the following files would be overwritten by checkout'
    )
    checkoutBranchMock.mockRejectedValue(gitError)

    registerFilesystemGitCheckoutHandler(testStore)

    await expect(
      handlers.get('git:checkout')!(null, {
        worktreePath: WORKTREE_FEATURE_PATH,
        branch: 'x'
      })
    ).rejects.toBe(gitError)
  })

  it('refuses ssh checkout as not served instead of running a local checkout', async () => {
    registerFilesystemGitCheckoutHandler(testStore)

    await expect(
      handlers.get('git:checkout')!(null, {
        worktreePath: '/remote/repo',
        branch: 'x',
        connectionId: 'ssh-gone'
      })
    ).rejects.toThrow(
      'Remote connection dropped. Click Reconnect on the SSH target before retrying.'
    )
    expect(checkoutBranchMock).not.toHaveBeenCalled()
  })

  it('rejects worktree paths that are not registered', async () => {
    registerFilesystemGitCheckoutHandler(testStore)

    await expect(
      handlers.get('git:checkout')!(null, {
        worktreePath: '/elsewhere/repo',
        branch: 'x'
      })
    ).rejects.toThrow()
    expect(checkoutBranchMock).not.toHaveBeenCalled()
  })
})
