import { describe, expect, it } from 'vitest'
import type { GitLogRef } from '../../../../shared/git-log-query'
import { buildGitLogRefTree, remoteBranchLabel } from './git-log-ref-tree-model'

const OID = 'a'.repeat(40)
const refs: GitLogRef[] = [
  { fullName: 'refs/heads/main', shortName: 'main', category: 'local', oid: OID },
  { fullName: 'refs/heads/feat/log', shortName: 'feat/log', category: 'local', oid: OID },
  {
    fullName: 'refs/remotes/upstream/main',
    shortName: 'upstream/main',
    category: 'remote',
    remote: 'upstream',
    oid: OID
  },
  {
    fullName: 'refs/remotes/origin/feat/log',
    shortName: 'origin/feat/log',
    category: 'remote',
    remote: 'origin',
    oid: OID
  },
  { fullName: 'refs/tags/v1.0', shortName: 'v1.0', category: 'tag', oid: OID }
]
const currentRef = {
  id: 'refs/heads/main',
  name: 'main',
  revision: OID,
  category: 'branches' as const
}

describe('buildGitLogRefTree', () => {
  it('builds HEAD / Local / Remote (per remote) / Tags groups in name order', () => {
    const groups = buildGitLogRefTree(refs, currentRef, '')
    expect(groups.map((group) => group.id)).toEqual(['head', 'local', 'remote', 'tags'])
    expect(groups[0]!.refs.map((ref) => ref.shortName)).toEqual(['main'])
    expect(groups[1]!.refs.map((ref) => ref.shortName)).toEqual(['feat/log', 'main'])
    expect(groups[2]!.remotes!.map((bucket) => bucket.remote)).toEqual(['origin', 'upstream'])
    expect(groups[3]!.refs.map((ref) => ref.shortName)).toEqual(['v1.0'])
  })

  it('filters every group by the branch-or-tag search', () => {
    const groups = buildGitLogRefTree(refs, currentRef, 'LOG')
    expect(groups[0]!.refs).toEqual([])
    expect(groups[1]!.refs.map((ref) => ref.shortName)).toEqual(['feat/log'])
    expect(groups[2]!.refs.map((ref) => ref.shortName)).toEqual(['origin/feat/log'])
    expect(groups[3]!.refs).toEqual([])
  })

  it('shows a detached HEAD as HEAD', () => {
    const detached = { id: OID, name: 'aaaaaaa', revision: OID, category: 'commits' as const }
    expect(buildGitLogRefTree([], detached, '')[0]!.refs[0]!.shortName).toBe('HEAD')
  })
})

describe('remoteBranchLabel', () => {
  it('strips the remote prefix', () => {
    expect(remoteBranchLabel(refs[3]!)).toBe('feat/log')
    expect(remoteBranchLabel(refs[0]!)).toBe('main')
  })
})
