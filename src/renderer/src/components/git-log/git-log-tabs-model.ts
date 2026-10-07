import type { GitLogFilters } from '../../../../shared/git-log-query'

// Pure model for the Log sub-tabs inside one worktree's Git Log tab. Kept free of React and the
// store so the tab rules (title, keep-one, close-neighbour focus) are unit-testable.

export type GitLogTab = {
  id: string
  filters: GitLogFilters
  selectedCommitId: string | null
  /** Top commit ids of collapsed linear branch fragments. */
  collapsedFragments: string[]
}

export type GitLogTabsState = {
  tabs: GitLogTab[]
  activeTabId: string
}

let nextTabSeq = 0

export function createGitLogTab(filters: GitLogFilters = {}): GitLogTab {
  nextTabSeq += 1
  return {
    id: `git-log-tab-${Date.now().toString(36)}-${nextTabSeq}`,
    filters,
    selectedCommitId: null,
    collapsedFragments: []
  }
}

export function createGitLogTabsState(filters?: GitLogFilters): GitLogTabsState {
  const tab = createGitLogTab(filters)
  return { tabs: [tab], activeTabId: tab.id }
}

const REF_PREFIXES = ['refs/heads/', 'refs/remotes/', 'refs/tags/']

/** Display name for a revision filter value (`refs/remotes/origin/main` -> `origin/main`). */
export function shortRevisionName(revision: string): string {
  const prefix = REF_PREFIXES.find((candidate) => revision.startsWith(candidate))
  return prefix ? revision.slice(prefix.length) : revision
}

/** `Log: <branch>` for a single-revision filter, `Log: all` when every ref is walked. */
export function getGitLogTabTitle(filters: GitLogFilters): string {
  const revisions = (filters.revisions ?? []).map(shortRevisionName)
  if (revisions.length === 0) {
    return 'Log: all'
  }
  if (revisions.length === 1) {
    return `Log: ${revisions[0]}`
  }
  return `Log: ${revisions[0]} +${revisions.length - 1}`
}

export function addGitLogTab(state: GitLogTabsState, filters?: GitLogFilters): GitLogTabsState {
  const tab = createGitLogTab(filters)
  return { tabs: [...state.tabs, tab], activeTabId: tab.id }
}

/** Closing the last tab is refused: the Git Log window always shows at least one Log. */
export function closeGitLogTab(state: GitLogTabsState, tabId: string): GitLogTabsState {
  if (state.tabs.length <= 1) {
    return state
  }
  const index = state.tabs.findIndex((tab) => tab.id === tabId)
  if (index === -1) {
    return state
  }
  const tabs = state.tabs.filter((tab) => tab.id !== tabId)
  if (state.activeTabId !== tabId) {
    return { ...state, tabs }
  }
  const neighbour = tabs[Math.min(index, tabs.length - 1)]!
  return { tabs, activeTabId: neighbour.id }
}

export function activateGitLogTab(state: GitLogTabsState, tabId: string): GitLogTabsState {
  return state.tabs.some((tab) => tab.id === tabId) ? { ...state, activeTabId: tabId } : state
}

export function updateGitLogTab(
  state: GitLogTabsState,
  tabId: string,
  patch: Partial<Omit<GitLogTab, 'id'>>
): GitLogTabsState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab))
  }
}

/** Removes empty filter fields so `Log: all` and "no filter" stay one state. */
export function patchGitLogFilters(
  filters: GitLogFilters,
  patch: Partial<GitLogFilters>
): GitLogFilters {
  const merged: GitLogFilters = { ...filters, ...patch }
  const next: GitLogFilters = {}
  if (merged.text) {
    next.text = merged.text
  }
  if (merged.textRegex) {
    next.textRegex = true
  }
  if (merged.textMatchCase) {
    next.textMatchCase = true
  }
  if (merged.revisions && merged.revisions.length > 0) {
    next.revisions = merged.revisions
  }
  if (merged.author) {
    next.author = merged.author
  }
  if (merged.since) {
    next.since = merged.since
  }
  if (merged.until) {
    next.until = merged.until
  }
  if (merged.paths && merged.paths.length > 0) {
    next.paths = merged.paths
  }
  return next
}
