import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from './runtime-compatibility-test-fixture'
import { checkoutRuntimeGitBranch } from './runtime-git-client'
import { clearRuntimeCompatibilityCacheForTests } from './runtime-rpc-client'

const gitCheckout = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  gitCheckout.mockReset()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      git: { checkout: gitCheckout },
      runtime: { call: vi.fn() },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('checkoutRuntimeGitBranch', () => {
  it('uses local git IPC (with the SSH connection) when no remote runtime is active', async () => {
    gitCheckout.mockResolvedValue(undefined)

    await checkoutRuntimeGitBranch(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1'
      },
      'feat/x'
    )

    expect(gitCheckout).toHaveBeenCalledWith({
      worktreePath: '/repo',
      branch: 'feat/x',
      connectionId: 'ssh-1'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('routes through the existing git.checkout runtime RPC', async () => {
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-1',
      ok: true,
      result: undefined,
      _meta: { runtimeId: 'remote-runtime' }
    })

    await checkoutRuntimeGitBranch(
      {
        settings: { activeRuntimeEnvironmentId: 'env-1' },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      'feat/x'
    )

    expect(runtimeEnvironmentCall).toHaveBeenCalledWith({
      selector: 'env-1',
      method: 'git.checkout',
      params: { worktree: 'id:wt-1', branch: 'feat/x' },
      timeoutMs: 30_000
    })
    expect(gitCheckout).not.toHaveBeenCalled()
  })

  it('surfaces the runtime error message', async () => {
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-1',
      ok: false,
      error: {
        code: 'runtime_error',
        message: "fatal: 'x' is already used by worktree at '/w'"
      },
      _meta: { runtimeId: 'remote-runtime' }
    })

    await expect(
      checkoutRuntimeGitBranch(
        {
          settings: { activeRuntimeEnvironmentId: 'env-1' },
          worktreeId: 'wt-1',
          worktreePath: '/repo'
        },
        'x'
      )
    ).rejects.toThrow("fatal: 'x' is already used by worktree at '/w'")
  })
})
