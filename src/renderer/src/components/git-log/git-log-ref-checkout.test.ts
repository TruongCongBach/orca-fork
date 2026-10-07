import { describe, expect, it } from 'vitest'
import type { GitLogRef } from '../../../../shared/git-log-query'
import { gitLogRefCheckoutTarget, type GitLogRefCheckoutContext } from './git-log-ref-checkout'

const local = (name: string): GitLogRef => ({
  fullName: `refs/heads/${name}`,
  shortName: name,
  category: 'local',
  oid: 'a'
})
const remote = (remoteName: string, name: string): GitLogRef => ({
  fullName: `refs/remotes/${remoteName}/${name}`,
  shortName: `${remoteName}/${name}`,
  category: 'remote',
  remote: remoteName,
  oid: 'b'
})

const context: GitLogRefCheckoutContext = {
  currentBranch: 'main',
  otherWorktreeBranches: [
    { branch: 'refs/heads/busy', worktreeFolder: 'wt-busy' },
    { branch: 'feat/other', worktreeFolder: 'wt-other' }
  ]
}

describe('gitLogRefCheckoutTarget', () => {
  it('checks out a local branch by its short name, never the full ref', () => {
    expect(gitLogRefCheckoutTarget(local('feat/x'), context)).toEqual({
      kind: 'enabled',
      branch: 'feat/x'
    })
  })

  it('checks out a remote branch by its remote-relative name so git creates a tracking branch', () => {
    expect(gitLogRefCheckoutTarget(remote('origin', 'feat/y'), context)).toEqual({
      kind: 'enabled',
      branch: 'feat/y'
    })
    expect(gitLogRefCheckoutTarget(remote('upstream', 'release'), context)).toEqual({
      kind: 'enabled',
      branch: 'release'
    })
  })

  it('hides checkout for tags', () => {
    const tag: GitLogRef = {
      fullName: 'refs/tags/v1',
      shortName: 'v1',
      category: 'tag',
      oid: 'c'
    }
    expect(gitLogRefCheckoutTarget(tag, context)).toEqual({ kind: 'hidden' })
  })

  it('hides checkout for the current branch, local or via its remote', () => {
    expect(gitLogRefCheckoutTarget(local('main'), context)).toEqual({
      kind: 'hidden'
    })
    expect(gitLogRefCheckoutTarget(remote('origin', 'main'), context)).toEqual({
      kind: 'hidden'
    })
  })

  it('hides checkout for the detached HEAD row', () => {
    const head: GitLogRef = {
      fullName: 'HEAD',
      shortName: 'HEAD',
      category: 'local',
      oid: 'd'
    }
    expect(gitLogRefCheckoutTarget(head, { ...context, currentBranch: null })).toEqual({
      kind: 'hidden'
    })
  })

  it('disables checkout for a branch another worktree holds, naming that worktree', () => {
    expect(gitLogRefCheckoutTarget(local('busy'), context)).toEqual({
      kind: 'disabled',
      worktreeFolder: 'wt-busy'
    })
    expect(gitLogRefCheckoutTarget(remote('origin', 'feat/other'), context)).toEqual({
      kind: 'disabled',
      worktreeFolder: 'wt-other'
    })
  })

  it('hides names git would parse as an option', () => {
    expect(gitLogRefCheckoutTarget(local('-x'), context)).toEqual({
      kind: 'hidden'
    })
  })
})
