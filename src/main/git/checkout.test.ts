import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runProcess } from '@orca/process-host'
import { checkoutBranch } from './checkout'

let root = ''
let origin = ''
let repo = ''
let env: NodeJS.ProcessEnv = {}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runProcess({ program: 'git', args, cwd, env })
  if (result.code !== 0) {
    throw new Error(result.stderr)
  }
  return result.stdout.trim()
}

async function commit(cwd: string, file: string, content: string): Promise<void> {
  await writeFile(join(cwd, file), content)
  await git(cwd, ['add', file])
  await git(cwd, ['commit', '-q', '-m', file])
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-checkout-'))
  origin = join(root, 'origin')
  repo = join(root, 'repo')
  const globalConfig = join(root, 'global.gitconfig')
  await writeFile(
    globalConfig,
    '[user]\n\tname = Orca Test\n\temail = test@example.invalid\n[init]\n\tdefaultBranch = main\n'
  )
  env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1'
  }
  vi.stubEnv('GIT_CONFIG_GLOBAL', globalConfig)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  await git(root, ['init', '-q', origin])
  await commit(origin, 'a.txt', 'a')
  await git(origin, ['branch', 'remote-only'])
  await git(root, ['clone', '-q', origin, repo])
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('checkoutBranch (real git)', () => {
  it('creates a local tracking branch from a remote-relative name', async () => {
    await checkoutBranch(repo, 'remote-only')

    expect(await git(repo, ['symbolic-ref', '--short', 'HEAD'])).toBe('remote-only')
    expect(await git(repo, ['rev-parse', '--abbrev-ref', 'remote-only@{upstream}'])).toBe(
      'origin/remote-only'
    )
  })

  it('switches to an existing local branch', async () => {
    await git(repo, ['branch', 'local-x'])

    await checkoutBranch(repo, 'local-x')

    expect(await git(repo, ['symbolic-ref', '--short', 'HEAD'])).toBe('local-x')
  })

  it('detaches HEAD for a full ref, which is why callers pass short names', async () => {
    await git(repo, ['branch', 'local-x'])

    await checkoutBranch(repo, 'refs/heads/local-x')

    await expect(git(repo, ['symbolic-ref', '-q', 'HEAD'])).rejects.toThrow()
  })

  it('refuses when uncommitted changes would be overwritten, leaving the tree untouched', async () => {
    await git(repo, ['checkout', '-q', '-b', 'other'])
    await commit(repo, 'a.txt', 'changed on other')
    await git(repo, ['checkout', '-q', 'main'])
    await writeFile(join(repo, 'a.txt'), 'dirty')

    await expect(checkoutBranch(repo, 'other')).rejects.toThrow(/would be overwritten by checkout/)
    expect(await git(repo, ['symbolic-ref', '--short', 'HEAD'])).toBe('main')
    expect(await git(repo, ['status', '--porcelain'])).toBe('M a.txt')
  })

  it('refuses a branch already checked out in another worktree', async () => {
    await git(repo, ['worktree', 'add', '-q', '-b', 'busy', join(root, 'busy-wt')])

    await expect(checkoutBranch(repo, 'busy')).rejects.toThrow(
      /already used by worktree|checked out/
    )
  })

  it('rejects option-like names before running git', async () => {
    await expect(checkoutBranch(repo, '-f')).rejects.toThrow('invalid_branch_name')
  })
})
