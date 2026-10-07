import { describe, expect, it } from 'vitest'
import {
  activateGitLogTab,
  addGitLogTab,
  closeGitLogTab,
  createGitLogTabsState,
  getGitLogTabTitle,
  patchGitLogFilters,
  updateGitLogTab
} from './git-log-tabs-model'

describe('getGitLogTabTitle', () => {
  it('names the tab after its branch filter', () => {
    expect(getGitLogTabTitle({})).toBe('Log: all')
    expect(getGitLogTabTitle({ revisions: ['main'] })).toBe('Log: main')
    expect(getGitLogTabTitle({ revisions: ['refs/heads/feat/log'] })).toBe('Log: feat/log')
    expect(getGitLogTabTitle({ revisions: ['refs/remotes/origin/main'] })).toBe('Log: origin/main')
    expect(getGitLogTabTitle({ revisions: ['refs/tags/v1.0'] })).toBe('Log: v1.0')
    expect(getGitLogTabTitle({ revisions: ['main', 'origin/dev', 'v1'] })).toBe('Log: main +2')
  })
})

describe('Log sub-tabs', () => {
  it('opens a new tab focused with its own filters', () => {
    const initial = createGitLogTabsState()
    const next = addGitLogTab(initial, { revisions: ['feat/x'] })
    expect(next.tabs).toHaveLength(2)
    expect(next.activeTabId).toBe(next.tabs[1]!.id)
    expect(next.tabs[1]!.filters).toEqual({ revisions: ['feat/x'] })
    expect(next.tabs[0]!.filters).toEqual({})
  })

  it('keeps at least one tab and focuses the neighbour when closing the active one', () => {
    const one = createGitLogTabsState()
    expect(closeGitLogTab(one, one.activeTabId)).toBe(one)

    const three = addGitLogTab(addGitLogTab(one))
    const [first, second, third] = three.tabs
    const focusedSecond = activateGitLogTab(three, second!.id)
    const afterClose = closeGitLogTab(focusedSecond, second!.id)
    expect(afterClose.tabs.map((tab) => tab.id)).toEqual([first!.id, third!.id])
    expect(afterClose.activeTabId).toBe(third!.id)

    const closeLast = closeGitLogTab(three, third!.id)
    expect(closeLast.activeTabId).toBe(second!.id)
  })

  it('closing an inactive tab keeps the focused one', () => {
    const two = addGitLogTab(createGitLogTabsState())
    const next = closeGitLogTab(two, two.tabs[0]!.id)
    expect(next.activeTabId).toBe(two.activeTabId)
  })

  it('updates only the targeted tab', () => {
    const two = addGitLogTab(createGitLogTabsState())
    const next = updateGitLogTab(two, two.tabs[0]!.id, { selectedCommitId: 'abc' })
    expect(next.tabs[0]!.selectedCommitId).toBe('abc')
    expect(next.tabs[1]!.selectedCommitId).toBeNull()
  })
})

describe('patchGitLogFilters', () => {
  it('drops cleared fields so an empty filter means Log: all', () => {
    const filters = patchGitLogFilters({ revisions: ['main'], author: 'Ada' }, { revisions: [] })
    expect(filters).toEqual({ author: 'Ada' })
    expect(patchGitLogFilters(filters, { author: '' })).toEqual({})
    expect(patchGitLogFilters({}, { textRegex: true })).toEqual({ textRegex: true })
    expect(patchGitLogFilters({ textRegex: true }, { textRegex: false })).toEqual({})
  })
})
