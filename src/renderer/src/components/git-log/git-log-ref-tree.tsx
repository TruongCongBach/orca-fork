import React, { useMemo, useState } from 'react'
import { ChevronRight, GitBranch, Search, Tag } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitLogRef } from '../../../../shared/git-log-query'
import type { GitLogRefCheckoutTarget } from './git-log-ref-checkout'
import { buildGitLogRefTree, remoteBranchLabel } from './git-log-ref-tree-model'

// Why: a remote can carry thousands of branches (orca has ~9k); rendering them all un-virtualized
// stalls the tree, and nobody scrolls that far instead of typing in the search box.
const MAX_ROWS_PER_GROUP = 300

function RefRows({
  refs,
  depth,
  label,
  actions
}: {
  refs: GitLogRef[]
  depth: number
  label: (ref: GitLogRef) => string
  actions: RefActions
}): React.JSX.Element {
  const hidden = refs.length - MAX_ROWS_PER_GROUP
  return (
    <>
      {refs.slice(0, MAX_ROWS_PER_GROUP).map((ref) => (
        <RefRow
          key={ref.fullName}
          gitRef={ref}
          label={label(ref)}
          depth={depth}
          actions={actions}
        />
      ))}
      {hidden > 0 ? (
        <div
          className="py-1 pr-2 text-[11px] text-muted-foreground"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {translate('gitLog.refs.more', '{{value0}} more — type to search', { value0: hidden })}
        </div>
      ) : null}
    </>
  )
}

type RefActions = {
  selectedRevision: string | null
  onSelectRef: (revision: string) => void
  onOpenInNewTab: (revision: string) => void
  checkoutTarget: (ref: GitLogRef) => GitLogRefCheckoutTarget
  onCheckout: (branch: string) => void
}

// Rendered inside the open menu only, so the target is resolved on demand, not for every row.
function RefCheckoutItem({
  gitRef,
  actions
}: {
  gitRef: GitLogRef
  actions: RefActions
}): React.JSX.Element | null {
  const target = actions.checkoutTarget(gitRef)
  const label = translate('gitLog.refs.checkout', 'Checkout')
  if (target.kind === 'hidden') {
    return null
  }
  if (target.kind === 'disabled') {
    // Why: a disabled item ignores pointer events, so the wrapper carries the tooltip.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <ContextMenuItem disabled>{label}</ContextMenuItem>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {translate('gitLog.refs.checkoutInUse', 'Checked out in worktree {{value0}}', {
            value0: target.worktreeFolder
          })}
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <ContextMenuItem onSelect={() => actions.onCheckout(target.branch)}>{label}</ContextMenuItem>
  )
}

function RefRow({
  gitRef,
  label,
  depth,
  actions
}: {
  gitRef: GitLogRef
  label: string
  depth: number
  actions: RefActions
}): React.JSX.Element {
  const Icon = gitRef.category === 'tag' ? Tag : GitBranch
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-testid="git-log-ref-row"
          className={cn(
            'flex h-6 w-full min-w-0 items-center gap-1.5 pr-2 text-left text-xs hover:bg-accent/40',
            actions.selectedRevision === gitRef.fullName && 'bg-accent text-accent-foreground'
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
          title={gitRef.fullName}
          onClick={() => actions.onSelectRef(gitRef.fullName)}
        >
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{label}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => actions.onOpenInNewTab(gitRef.fullName)}>
          {translate('gitLog.refs.openInNewTab', 'Open in new Log tab')}
        </ContextMenuItem>
        <RefCheckoutItem gitRef={gitRef} actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Group({
  label,
  depth,
  count,
  defaultOpen,
  forceOpen,
  children
}: {
  label: string
  depth: number
  count?: number
  defaultOpen: boolean
  forceOpen: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const expanded = open || forceOpen
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        className="flex h-6 w-full items-center gap-1 pr-2 text-left text-xs hover:bg-accent/40"
        style={{ paddingLeft: 4 + depth * 14 }}
        onClick={() => setOpen(!expanded)}
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90'
          )}
        />
        <span className="truncate">{label}</span>
        {count !== undefined ? (
          <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
        ) : null}
      </button>
      {expanded ? children : null}
    </div>
  )
}

export function GitLogRefTree({
  refs,
  currentRef,
  ...actions
}: { refs: GitLogRef[]; currentRef?: GitHistoryItemRef } & RefActions): React.JSX.Element {
  const [query, setQuery] = useState('')
  const groups = useMemo(
    () => buildGitLogRefTree(refs, currentRef, query),
    [currentRef, query, refs]
  )
  const searching = query.trim().length > 0
  const [head, local, remote, tags] = groups

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="git-log-ref-tree">
      <label className="m-1.5 flex h-7 items-center gap-1.5 rounded border border-border px-2 text-xs focus-within:border-ring">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder={translate('gitLog.refs.search', 'Branch or tag')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek pb-2">
        {head!.refs.map((ref) => (
          <RefRow
            key="head"
            gitRef={ref}
            label={translate('gitLog.refs.head', 'HEAD (Current Branch)')}
            depth={0}
            actions={actions}
          />
        ))}
        <Group
          label={translate('gitLog.refs.local', 'Local')}
          depth={0}
          count={local!.refs.length}
          defaultOpen
          forceOpen={searching}
        >
          <RefRows refs={local!.refs} depth={1} label={(ref) => ref.shortName} actions={actions} />
        </Group>
        <Group
          label={translate('gitLog.refs.remote', 'Remote')}
          depth={0}
          count={remote!.refs.length}
          defaultOpen={false}
          forceOpen={searching}
        >
          {remote!.remotes!.map((bucket) => (
            <Group
              key={bucket.remote}
              label={bucket.remote}
              depth={1}
              count={bucket.refs.length}
              defaultOpen={false}
              forceOpen={searching}
            >
              <RefRows refs={bucket.refs} depth={2} label={remoteBranchLabel} actions={actions} />
            </Group>
          ))}
        </Group>
        <Group
          label={translate('gitLog.refs.tags', 'Tags')}
          depth={0}
          count={tags!.refs.length}
          defaultOpen={false}
          forceOpen={searching}
        >
          <RefRows refs={tags!.refs} depth={1} label={(ref) => ref.shortName} actions={actions} />
        </Group>
      </div>
    </div>
  )
}
