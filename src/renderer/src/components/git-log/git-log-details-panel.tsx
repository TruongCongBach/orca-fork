import React, { createElement, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Folder, RefreshCw } from 'lucide-react'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import type { GitFileStatus } from '../../../../shared/git-status-types'
import { STATUS_COLORS, STATUS_LABELS } from '../right-sidebar/status-display'
import {
  toSourceControlRowOpenEvent,
  type SourceControlRowOpenEvent
} from '../right-sidebar/source-control/listing/split-open'
import { buildGitLogFileTree, type GitLogFileTreeNode } from './git-log-file-tree'
import { formatGitLogFullDate } from './git-log-format'

const BRANCHES_PREVIEW_COUNT = 3

type FilesState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; entries: GitBranchChangeEntry[] }

const LOADING_FILES: FilesState = { status: 'loading' }

function TreeNode({
  node,
  depth,
  onOpenFile
}: {
  node: GitLogFileTreeNode
  depth: number
  onOpenFile: (entry: GitBranchChangeEntry, event: SourceControlRowOpenEvent) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  if (node.kind === 'file') {
    const status: GitFileStatus = node.entry.status
    return (
      <button
        type="button"
        data-testid="git-log-detail-file"
        className="flex h-6 w-full min-w-0 items-center gap-1.5 pr-2 text-left text-xs hover:bg-accent/40"
        style={{ paddingLeft: 22 + depth * 14 }}
        title={node.path}
        onClick={(event) => onOpenFile(node.entry, toSourceControlRowOpenEvent(event))}
      >
        {createElement(getFileTypeIcon(node.path), { className: 'size-3.5 shrink-0' })}
        <span className="min-w-0 truncate" style={{ color: STATUS_COLORS[status] }}>
          {node.name}
        </span>
        <span
          className="ml-auto w-4 shrink-0 text-center text-[10px] font-bold"
          style={{ color: STATUS_COLORS[status] }}
        >
          {STATUS_LABELS[status]}
        </span>
      </button>
    )
  }
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        className="flex h-6 w-full min-w-0 items-center gap-1 pr-2 text-left text-xs hover:bg-accent/40"
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
        />
        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{node.name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {translate('gitLog.details.fileCount', '{{value0}} files', { value0: node.fileCount })}
        </span>
      </button>
      {open
        ? node.children.map((child) => (
            <TreeNode
              key={`${child.kind}:${child.path}`}
              node={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
            />
          ))
        : null}
    </div>
  )
}

function CommitFiles({
  item,
  loadCommitFiles,
  onOpenFile
}: {
  item: GitHistoryItem
  loadCommitFiles: (item: GitHistoryItem) => Promise<GitBranchChangeEntry[]>
  onOpenFile: (entry: GitBranchChangeEntry, event: SourceControlRowOpenEvent) => void
}): React.JSX.Element {
  const [state, setState] = useState<{ id: string; files: FilesState } | null>(null)
  useEffect(() => {
    let cancelled = false
    setState({ id: item.id, files: { status: 'loading' } })
    loadCommitFiles(item)
      .then(
        (entries) => !cancelled && setState({ id: item.id, files: { status: 'ready', entries } })
      )
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            id: item.id,
            files: {
              status: 'error',
              error: error instanceof Error ? error.message : String(error)
            }
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [item, loadCommitFiles])
  const files = state?.id === item.id ? state.files : LOADING_FILES
  const tree = useMemo(
    () => (files.status === 'ready' ? buildGitLogFileTree(files.entries) : []),
    [files]
  )

  if (files.status === 'loading') {
    return (
      <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" />
        {translate('gitLog.details.loadingFiles', 'Loading files…')}
      </div>
    )
  }
  if (files.status === 'error') {
    return <div className="p-2 text-xs text-destructive">{files.error}</div>
  }
  return (
    <div data-testid="git-log-detail-files">
      <div className="flex h-6 items-center gap-1 px-2 text-xs text-muted-foreground">
        <Folder className="size-3.5" />
        {translate('gitLog.details.fileCount', '{{value0}} files', {
          value0: files.entries.length
        })}
      </div>
      {tree.map((node) => (
        <TreeNode key={`${node.kind}:${node.path}`} node={node} depth={0} onOpenFile={onOpenFile} />
      ))}
    </div>
  )
}

export function GitLogDetailsPanel({
  item,
  branches,
  loadCommitFiles,
  onOpenFile
}: {
  item: GitHistoryItem | null
  branches: { status: 'idle' | 'loading' | 'ready' | 'error'; branches: string[] }
  loadCommitFiles: (item: GitHistoryItem) => Promise<GitBranchChangeEntry[]>
  onOpenFile: (
    item: GitHistoryItem,
    entry: GitBranchChangeEntry,
    event: SourceControlRowOpenEvent
  ) => void
}): React.JSX.Element {
  if (!item) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        {translate('gitLog.details.empty', 'Select a commit to see its changes')}
      </div>
    )
  }
  // Why: keying by commit id resets the "Show all" branches expansion per commit.
  return (
    <GitLogCommitDetails
      key={item.id}
      item={item}
      branches={branches}
      loadCommitFiles={loadCommitFiles}
      onOpenFile={onOpenFile}
    />
  )
}

function GitLogCommitDetails({
  item,
  branches,
  loadCommitFiles,
  onOpenFile
}: {
  item: GitHistoryItem
  branches: { status: 'idle' | 'loading' | 'ready' | 'error'; branches: string[] }
  loadCommitFiles: (item: GitHistoryItem) => Promise<GitBranchChangeEntry[]>
  onOpenFile: (
    item: GitHistoryItem,
    entry: GitBranchChangeEntry,
    event: SourceControlRowOpenEvent
  ) => void
}): React.JSX.Element {
  const [showAllBranches, setShowAllBranches] = useState(false)
  // Why: subject, hash, author and branches stay above the fold; long bodies scroll below them.
  const body = (item.message || '').startsWith(item.subject)
    ? item.message.slice(item.subject.length).trim()
    : (item.message || '').trim()
  const visibleBranches = showAllBranches
    ? branches.branches
    : branches.branches.slice(0, BRANCHES_PREVIEW_COUNT)
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="git-log-details">
      <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek border-b border-border">
        <CommitFiles
          item={item}
          loadCommitFiles={loadCommitFiles}
          onOpenFile={(entry, event) => onOpenFile(item, entry, event)}
        />
      </div>
      <div
        className="max-h-[50%] min-h-0 overflow-auto scrollbar-sleek p-3 text-xs"
        data-testid="git-log-commit-meta"
      >
        <pre className="mb-2 font-mono text-[12px] font-semibold break-words whitespace-pre-wrap text-foreground">
          {item.subject}
        </pre>
        <div className="mb-1 break-all text-muted-foreground">
          <span className="font-mono text-foreground select-all">{item.id}</span> {item.author}
          {item.authorEmail ? (
            <span className="text-primary">{` <${item.authorEmail}>`}</span>
          ) : null}
        </div>
        <div className="mb-2 text-muted-foreground">{formatGitLogFullDate(item.timestamp)}</div>
        <div className="text-muted-foreground">
          {branches.status === 'loading'
            ? translate('gitLog.details.branchesLoading', 'Finding branches…')
            : branches.status === 'error'
              ? translate('gitLog.details.branchesError', 'Could not list branches')
              : translate('gitLog.details.inBranches', 'In {{value0}} branches:', {
                  value0: branches.branches.length
                })}
          {visibleBranches.length > 0 ? (
            <span className="text-foreground"> {visibleBranches.join(', ')}</span>
          ) : null}
          {!showAllBranches && branches.branches.length > BRANCHES_PREVIEW_COUNT ? (
            <button
              type="button"
              className="ml-1 text-primary hover:underline"
              onClick={() => setShowAllBranches(true)}
            >
              {translate('gitLog.details.showAll', 'Show all')}
            </button>
          ) : null}
        </div>
        {body ? (
          <pre className="mt-3 font-mono text-[12px] break-words whitespace-pre-wrap text-foreground">
            {body}
          </pre>
        ) : null}
      </div>
    </div>
  )
}
