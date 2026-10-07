import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'

// Builds the directory tree shown in the Git Log details panel ("N files", grouped by folder).
// Single-child folder chains are compacted (`src/main/git`) the way IDE change trees show them.

export type GitLogFileTreeNode =
  | { kind: 'dir'; path: string; name: string; fileCount: number; children: GitLogFileTreeNode[] }
  | { kind: 'file'; path: string; name: string; entry: GitBranchChangeEntry }

type GitLogFileTreeDir = Extract<GitLogFileTreeNode, { kind: 'dir' }>

type MutableDir = {
  name: string
  path: string
  dirs: Map<string, MutableDir>
  files: GitBranchChangeEntry[]
}

function newDir(name: string, path: string): MutableDir {
  return { name, path, dirs: new Map(), files: [] }
}

function toNode(dir: MutableDir): GitLogFileTreeDir {
  const dirs = [...dir.dirs.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((child) => compact(toNode(child)))
  const files = [...dir.files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((entry): GitLogFileTreeNode => ({
      kind: 'file',
      path: entry.path,
      name: entry.path.split('/').pop() ?? entry.path,
      entry
    }))
  const fileCount =
    dir.files.length +
    dirs.reduce((sum, child) => sum + (child.kind === 'dir' ? child.fileCount : 0), 0)
  return { kind: 'dir', path: dir.path, name: dir.name, fileCount, children: [...dirs, ...files] }
}

function compact(node: GitLogFileTreeDir): GitLogFileTreeDir {
  let current = node
  for (;;) {
    const only = current.children.length === 1 ? current.children[0] : undefined
    if (!only || only.kind !== 'dir') {
      return current
    }
    current = { ...only, name: `${current.name}/${only.name}` }
  }
}

/** Returns top-level nodes: root-level files sit beside the top folders. */
export function buildGitLogFileTree(
  entries: readonly GitBranchChangeEntry[]
): GitLogFileTreeNode[] {
  const root = newDir('', '')
  for (const entry of entries) {
    const segments = entry.path.split('/')
    segments.pop()
    let dir = root
    let path = ''
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment
      let child = dir.dirs.get(segment)
      if (!child) {
        child = newDir(segment, path)
        dir.dirs.set(segment, child)
      }
      dir = child
    }
    dir.files.push(entry)
  }
  return toNode(root).children
}
