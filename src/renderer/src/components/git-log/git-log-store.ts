import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { GitLogFilters } from '../../../../shared/git-log-query'
import {
  activateGitLogTab,
  addGitLogTab,
  closeGitLogTab,
  createGitLogTabsState,
  updateGitLogTab,
  type GitLogTab,
  type GitLogTabsState
} from './git-log-tabs-model'
import {
  defaultGitLogColumns,
  moveGitLogColumn,
  resizeGitLogColumn,
  type GitLogColumn,
  type GitLogColumnId
} from './git-log-columns-model'

// Why a module store and not the app store: Log sub-tabs are view state of a transient editor tab
// (never persisted, never mirrored to mobile), and they must survive the editor unmounting the
// Git Log view while another tab in the group is focused.
type GitLogStoreState = { byWorktree: Record<string, GitLogTabsState> }

const gitLogStore = createStore<GitLogStoreState>(() => ({ byWorktree: {} }))

function mutate(worktreeId: string, fn: (state: GitLogTabsState) => GitLogTabsState): void {
  gitLogStore.setState((store) => {
    const current = store.byWorktree[worktreeId] ?? createGitLogTabsState()
    const next = fn(current)
    return next === current && store.byWorktree[worktreeId]
      ? store
      : { byWorktree: { ...store.byWorktree, [worktreeId]: next } }
  })
}

export const gitLogTabActions = {
  ensure: (worktreeId: string): void => mutate(worktreeId, (state) => state),
  add: (worktreeId: string, filters?: GitLogFilters): void =>
    mutate(worktreeId, (state) => addGitLogTab(state, filters)),
  close: (worktreeId: string, tabId: string): void =>
    mutate(worktreeId, (state) => closeGitLogTab(state, tabId)),
  activate: (worktreeId: string, tabId: string): void =>
    mutate(worktreeId, (state) => activateGitLogTab(state, tabId)),
  update: (worktreeId: string, tabId: string, patch: Partial<Omit<GitLogTab, 'id'>>): void =>
    mutate(worktreeId, (state) => updateGitLogTab(state, tabId, patch)),
  /** Drops a worktree's Log tabs when its Git Log editor tab closes. */
  dispose: (worktreeId: string): void =>
    gitLogStore.setState((store) => {
      if (!store.byWorktree[worktreeId]) {
        return store
      }
      const byWorktree = { ...store.byWorktree }
      delete byWorktree[worktreeId]
      return { byWorktree }
    })
}

export function useGitLogTabs(worktreeId: string): GitLogTabsState | undefined {
  return useStore(gitLogStore, (store) => store.byWorktree[worktreeId])
}

// Column layout is shared by every Log tab and worktree; like the Log tabs it lives for the session.
const gitLogColumnsStore = createStore<{ columns: GitLogColumn[] }>(() => ({
  columns: defaultGitLogColumns()
}))

export const gitLogColumnActions = {
  resize: (id: GitLogColumnId, width: number): void =>
    gitLogColumnsStore.setState((state) => ({
      columns: resizeGitLogColumn(state.columns, id, width)
    })),
  move: (id: GitLogColumnId, targetId: GitLogColumnId): void =>
    gitLogColumnsStore.setState((state) => ({
      columns: moveGitLogColumn(state.columns, id, targetId)
    })),
  reset: (): void => gitLogColumnsStore.setState({ columns: defaultGitLogColumns() })
}

export function useGitLogColumns(): GitLogColumn[] {
  return useStore(gitLogColumnsStore, (state) => state.columns)
}
