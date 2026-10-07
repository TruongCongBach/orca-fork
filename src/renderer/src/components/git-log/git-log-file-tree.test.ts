import { describe, expect, it } from 'vitest'
import { buildGitLogFileTree, type GitLogFileTreeNode } from './git-log-file-tree'

function outline(nodes: GitLogFileTreeNode[], depth = 0): string[] {
  return nodes.flatMap((node) =>
    node.kind === 'dir'
      ? [
          `${'  '.repeat(depth)}${node.name}/ (${node.fileCount})`,
          ...outline(node.children, depth + 1)
        ]
      : [`${'  '.repeat(depth)}${node.name}`]
  )
}

describe('buildGitLogFileTree', () => {
  it('groups files by folder, compacts single-child chains and counts files', () => {
    const tree = buildGitLogFileTree([
      { path: 'android/app/build.gradle', status: 'modified' },
      { path: 'scripts/patch.sh', status: 'added' },
      { path: '.gitignore', status: 'modified' },
      { path: 'src/main/git/a.ts', status: 'modified' },
      { path: 'src/main/git/b.ts', status: 'deleted' },
      { path: 'src/shared/c.ts', status: 'modified' }
    ])
    expect(outline(tree)).toEqual([
      'android/app/ (1)',
      '  build.gradle',
      'scripts/ (1)',
      '  patch.sh',
      'src/ (3)',
      '  main/git/ (2)',
      '    a.ts',
      '    b.ts',
      '  shared/ (1)',
      '    c.ts',
      '.gitignore'
    ])
  })

  it('returns an empty tree for a commit without file changes', () => {
    expect(buildGitLogFileTree([])).toEqual([])
  })
})
