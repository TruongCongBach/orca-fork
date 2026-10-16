import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import { cn } from '@/lib/utils'
import { checkoutRuntimeGitBranch } from '@/runtime/runtime-git-sync-client'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { useWorktreeMap } from '@/store/selectors'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitLogFilters, GitLogRef } from '../../../../shared/git-log-query'
import { useGitHistoryCommitActions } from '../right-sidebar/source-control/sync/use-git-history-commit-actions'
import { GitLogCommitList } from './git-log-commit-list'
import { GitLogDetailsPanel } from './git-log-details-panel'
import { GitLogFilterBar } from './git-log-filter-bar'
import { gitLogRefCheckoutTarget, type GitLogRefCheckoutTarget } from './git-log-ref-checkout'
import { gitLogCheckoutErrorMessage } from './git-log-checkout-error'
import { GitLogRefTree } from './git-log-ref-tree'
import { gitLogTabActions, useGitLogTabs } from './git-log-store'
import { getGitLogTabTitle, patchGitLogFilters, type GitLogTab } from './git-log-tabs-model'
import { useGitLogContext } from './use-git-log-context'
import { useBranchesContaining, useGitLogData } from './use-git-log-data'
import { useGitLogGraphModel } from './use-git-log-graph-model'
import { fragmentHidingCommit } from '../../../../shared/git-log-graph-collapse'

const NO_SPLIT_TARGET = (): undefined => undefined

function GitLogTabStrip({
  worktreeId,
  tabs,
  activeTabId
}: {
  worktreeId: string
  tabs: GitLogTab[]
  activeTabId: string
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-1"
      data-testid="git-log-tabs"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId
        const title = getGitLogTabTitle(tab.filters)
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            data-testid="git-log-tab"
            className={cn(
              'group flex h-6 max-w-[18rem] shrink-0 cursor-pointer items-center gap-1 rounded px-2 text-xs',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/40'
            )}
            title={title}
            onMouseDown={() => gitLogTabActions.activate(worktreeId, tab.id)}
          >
            <span className="min-w-0 truncate">{title}</span>
            {tabs.length > 1 ? (
              <button
                type="button"
                aria-label={translate('gitLog.tabs.close', 'Close {{value0}}', { value0: title })}
                className="flex size-4 items-center justify-center rounded opacity-60 hover:bg-background/60 hover:opacity-100"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => gitLogTabActions.close(worktreeId, tab.id)}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        aria-label={translate('gitLog.tabs.new', 'New Log tab')}
        title={translate('gitLog.tabs.new', 'New Log tab')}
        data-testid="git-log-new-tab"
        className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        onClick={() => gitLogTabActions.add(worktreeId)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

/** Ref-tree "Checkout": switches this worktree's branch; git's own refusal is shown verbatim. */
function useGitLogRefCheckout(
  worktreeId: string,
  context: RuntimeGitContext | null,
  currentRef: GitHistoryItemRef | undefined,
  onCheckedOut: () => void
): { target: (ref: GitLogRef) => GitLogRefCheckoutTarget; run: (branch: string) => void } {
  const worktreeMap = useWorktreeMap()
  const repoId = worktreeMap.get(worktreeId)?.repoId
  const currentBranch = currentRef?.category === 'branches' ? currentRef.name : null
  const otherWorktreeBranches = useMemo(
    () =>
      [...worktreeMap.values()]
        .filter((worktree) => worktree.repoId === repoId && worktree.id !== worktreeId)
        .map((worktree) => ({ branch: worktree.branch, worktreeFolder: basename(worktree.path) })),
    [repoId, worktreeId, worktreeMap]
  )
  const target = useCallback(
    (ref: GitLogRef) => gitLogRefCheckoutTarget(ref, { currentBranch, otherWorktreeBranches }),
    [currentBranch, otherWorktreeBranches]
  )
  const run = useCallback(
    (branch: string) => {
      if (!context) {
        return
      }
      void checkoutRuntimeGitBranch(context, branch).then(
        () => {
          toast.success(
            translate('gitLog.refs.checkoutSucceeded', 'Checked out {{value0}}', { value0: branch })
          )
          onCheckedOut()
        },
        (error: unknown) => {
          toast.error(
            translate('gitLog.refs.checkoutFailed', 'Checkout {{value0}} failed', {
              value0: branch
            }),
            { description: gitLogCheckoutErrorMessage(error) }
          )
        }
      )
    },
    [context, onCheckedOut]
  )
  return { target, run }
}

function GitLogTabBody({
  worktreeId,
  tab
}: {
  worktreeId: string
  tab: GitLogTab
}): React.JSX.Element {
  const context = useGitLogContext(worktreeId)
  const [reloadNonce, setReloadNonce] = useState(0)
  const data = useGitLogData(context, tab.filters, reloadNonce)
  const selectedItem = useMemo(
    () => data.items.find((item) => item.id === tab.selectedCommitId) ?? null,
    [data.items, tab.selectedCommitId]
  )
  const branches = useBranchesContaining(context, selectedItem?.id ?? null)
  const commitActions = useGitHistoryCommitActions({
    activeWorktreeId: worktreeId,
    worktreePath: context?.worktreePath ?? null,
    activeRepoTarget: context?.target ?? null,
    resolveSplitTargetGroupId: NO_SPLIT_TARGET
  })

  const updateFilters = useCallback(
    (patch: Partial<GitLogFilters>) =>
      gitLogTabActions.update(worktreeId, tab.id, {
        filters: patchGitLogFilters(tab.filters, patch),
        selectedCommitId: null
      }),
    [tab.filters, tab.id, worktreeId]
  )
  const selectCommit = useCallback(
    (item: GitHistoryItem) =>
      gitLogTabActions.update(worktreeId, tab.id, { selectedCommitId: item.id }),
    [tab.id, worktreeId]
  )

  const hasContentFilter = Boolean(
    tab.filters.text ||
    tab.filters.author ||
    tab.filters.since ||
    tab.filters.until ||
    tab.filters.paths?.length
  )
  const graphModel = useGitLogGraphModel(
    data.items,
    hasContentFilter,
    data.currentRef?.revision,
    tab.collapsedFragments
  )
  const setCollapsed = useCallback(
    (next: string[]) => gitLogTabActions.update(worktreeId, tab.id, { collapsedFragments: next }),
    [tab.id, worktreeId]
  )
  const toggleFragment = useCallback(
    (fragmentId: string, collapse: boolean) => {
      const rest = tab.collapsedFragments.filter((id) => id !== fragmentId)
      setCollapsed(collapse ? [...rest, fragmentId] : rest)
    },
    [setCollapsed, tab.collapsedFragments]
  )
  // A selected commit never stays hidden inside a collapsed branch.
  useEffect(() => {
    const hiding = tab.selectedCommitId
      ? fragmentHidingCommit(graphModel.fragments, graphModel.collapsed, tab.selectedCommitId)
      : null
    if (hiding) {
      toggleFragment(hiding, false)
    }
  }, [graphModel.collapsed, graphModel.fragments, tab.selectedCommitId, toggleFragment])

  // Auto-select the newest commit so the details panel is never blank after a load.
  useEffect(() => {
    if (data.status === 'ready' && !selectedItem && data.items[0]) {
      selectCommit(data.items[0])
    }
  }, [data.items, data.status, selectCommit, selectedItem])

  const selectedRevision = tab.filters.revisions?.length === 1 ? tab.filters.revisions[0]! : null
  const reload = useCallback(() => setReloadNonce((nonce) => nonce + 1), [])
  const checkout = useGitLogRefCheckout(worktreeId, context, data.currentRef, reload)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)_22rem]">
      <aside className="min-h-0 border-r border-border">
        <GitLogRefTree
          refs={data.refs}
          currentRef={data.currentRef}
          selectedRevision={selectedRevision}
          onSelectRef={(revision) => updateFilters({ revisions: [revision] })}
          onOpenInNewTab={(revision) => gitLogTabActions.add(worktreeId, { revisions: [revision] })}
          checkoutTarget={checkout.target}
          onCheckout={checkout.run}
        />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col">
        <GitLogFilterBar
          key={tab.id}
          filters={tab.filters}
          refs={data.refs}
          items={data.items}
          loading={data.status === 'loading'}
          onChange={updateFilters}
          onRefresh={() => setReloadNonce((nonce) => nonce + 1)}
          onCollapseAll={() => setCollapsed(graphModel.fragments.map((fragment) => fragment.id))}
          onExpandAll={() => setCollapsed([])}
        />
        <div className="min-h-0 flex-1">
          <GitLogCommitList
            items={data.items}
            model={graphModel}
            onToggleFragment={toggleFragment}
            currentRef={data.currentRef}
            status={data.status}
            error={data.error}
            hasMore={data.hasMore}
            loadingMore={data.loadingMore}
            selectedCommitId={tab.selectedCommitId}
            onLoadMore={data.loadMore}
            onSelect={selectCommit}
            onAction={commitActions.handleCommitAction}
          />
        </div>
      </section>
      <aside className="min-h-0 border-l border-border">
        <GitLogDetailsPanel
          item={selectedItem}
          branches={branches}
          loadCommitFiles={commitActions.loadCommitFiles}
          onOpenFile={commitActions.openCommitFile}
        />
      </aside>
    </div>
  )
}

/** Body of the per-worktree "Git Log" editor tab: Log sub-tabs, ref tree, filters, graph, details. */
export default function GitLogView({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  const state = useGitLogTabs(worktreeId)
  useEffect(() => {
    gitLogTabActions.ensure(worktreeId)
  }, [worktreeId])
  const activeTab = state?.tabs.find((tab) => tab.id === state.activeTabId)
  if (!state || !activeTab) {
    return <div className="h-full" />
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="git-log-view">
      <GitLogTabStrip worktreeId={worktreeId} tabs={state.tabs} activeTabId={state.activeTabId} />
      <GitLogTabBody key={activeTab.id} worktreeId={worktreeId} tab={activeTab} />
    </div>
  )
}
