import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Store } from '../persistence'
import {
  handlers,
  store,
  REPO_PATH,
  WORKTREE_FEATURE_PATH,
  getSshGitProviderMock,
  resetFilesystemIpcMocks
} from './filesystem-test-harness'

const checkoutBranchMock = vi.fn()
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers only read getRepos/getSettings, which the harness store implements.
const testStore: Store = store as never

vi.mock('electron', async () => (await import('./filesystem-test-harness')).electronMock)
vi.mock('fs/promises', async () => (await import('./filesystem-test-harness')).fsPromisesMock)
vi.mock('../git/worktree', async () => (await import('./filesystem-test-harness')).gitWorktreeMock)
vi.mock(
  '../providers/ssh-git-dispatch',
  async () => (await import('./filesystem-test-harness')).sshGitDispatchMock
)
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

  it('checks out locally with interactive admission and through the SSH provider', async () => {
    registerWorktreeRootsForRepo(testStore, 'repo-1', [REPO_PATH, WORKTREE_FEATURE_PATH])
    checkoutBranchMock.mockResolvedValue(undefined)
    const sshProvider = {
      checkoutBranch: vi.fn().mockResolvedValue(undefined)
    }
    getSshGitProviderMock.mockReturnValue(sshProvider)

    registerFilesystemGitCheckoutHandler(testStore)

    await handlers.get('git:checkout')!(null, {
      worktreePath: WORKTREE_FEATURE_PATH,
      branch: 'feat/x'
    })
    await handlers.get('git:checkout')!(null, {
      worktreePath: '/remote/repo',
      branch: 'feat/y',
      connectionId: 'ssh-1'
    })

    expect(checkoutBranchMock).toHaveBeenCalledWith(WORKTREE_FEATURE_PATH, 'feat/x', {
      admissionTier: 'interactive'
    })
    expect(getSshGitProviderMock).toHaveBeenCalledWith('ssh-1')
    expect(sshProvider.checkoutBranch).toHaveBeenCalledWith('/remote/repo', 'feat/y')
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

  it('fails when the SSH connection has no git provider', async () => {
    getSshGitProviderMock.mockReturnValue(undefined)

    registerFilesystemGitCheckoutHandler(testStore)

    await expect(
      handlers.get('git:checkout')!(null, {
        worktreePath: '/remote/repo',
        branch: 'x',
        connectionId: 'ssh-gone'
      })
    ).rejects.toThrow('No git provider for connection "ssh-gone"')
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
