import React, { useEffect, useMemo, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, RefreshCw, Search, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitLogFilters, GitLogRef } from '../../../../shared/git-log-query'
import { GitLogFilterChip, GitLogPickerList, type GitLogPickerOption } from './git-log-filter-chip'
import { GitLogDatePanel, GitLogPathsPanel } from './git-log-filter-panels'
import { shortRevisionName } from './git-log-tabs-model'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'

const TEXT_DEBOUNCE_MS = 350

function ToggleButton({
  pressed,
  label,
  title,
  onToggle
}: {
  pressed: boolean
  label: string
  title: string
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      className={cn(
        'h-5 shrink-0 rounded px-1 font-mono text-[11px]',
        pressed ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
      )}
      onClick={onToggle}
    >
      {label}
    </button>
  )
}

function authorOptions(items: GitHistoryItem[]): GitLogPickerOption[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (item.author) {
      counts.set(item.author, (counts.get(item.author) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([author, count]) => ({ value: author, label: author, hint: String(count) }))
}

function branchOptions(refs: GitLogRef[]): GitLogPickerOption[] {
  const order = { local: 0, remote: 1, tag: 2 } as const
  return [...refs]
    .sort((a, b) => order[a.category] - order[b.category] || a.shortName.localeCompare(b.shortName))
    .map((ref) => ({
      value: ref.fullName,
      label: ref.shortName,
      hint:
        ref.category === 'local'
          ? translate('gitLog.filters.branch.local', 'local')
          : ref.category === 'remote'
            ? translate('gitLog.filters.branch.remote', 'remote')
            : translate('gitLog.filters.branch.tag', 'tag')
    }))
}

export function GitLogFilterBar({
  filters,
  refs,
  items,
  loading,
  onChange,
  onRefresh,
  onCollapseAll,
  onExpandAll
}: {
  filters: GitLogFilters
  refs: GitLogRef[]
  items: GitHistoryItem[]
  loading: boolean
  onChange: (patch: Partial<GitLogFilters>) => void
  onRefresh: () => void
  onCollapseAll: () => void
  onExpandAll: () => void
}): React.JSX.Element {
  const [draftText, setDraftText] = useState(filters.text ?? '')
  useEffect(() => setDraftText(filters.text ?? ''), [filters.text])
  useEffect(() => {
    if (draftText === (filters.text ?? '')) {
      return
    }
    const timer = setTimeout(() => onChange({ text: draftText }), TEXT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draftText, filters.text, onChange])

  const branchList = useMemo(() => branchOptions(refs), [refs])
  const authorList = useMemo(() => authorOptions(items), [items])
  const revisions = filters.revisions ?? []
  const paths = filters.paths ?? []
  const dateValue =
    filters.since || filters.until ? [filters.since ?? '…', filters.until ?? '…'].join(' – ') : null

  return (
    <div
      className="flex h-9 min-w-0 shrink-0 items-center gap-1 border-b border-border px-2"
      data-testid="git-log-filter-bar"
    >
      <label className="flex h-6 w-64 min-w-40 items-center gap-1 rounded border border-border px-1.5 text-xs focus-within:border-ring">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          data-testid="git-log-text-filter"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder={translate('gitLog.filters.text', 'Text or hash')}
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !isImeOwnedKeyboardEvent(event)) {
              onChange({ text: draftText })
            }
          }}
        />
        {draftText ? (
          <button
            type="button"
            aria-label={translate('gitLog.filters.clearText', 'Clear text filter')}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setDraftText('')
              onChange({ text: '' })
            }}
          >
            <X className="size-3" />
          </button>
        ) : null}
        <ToggleButton
          pressed={filters.textRegex === true}
          label=".*"
          title={translate('gitLog.filters.regex', 'Regex')}
          onToggle={() => onChange({ textRegex: !filters.textRegex })}
        />
        <ToggleButton
          pressed={filters.textMatchCase === true}
          label={translate('gitLog.filters.matchCaseShort', 'Cc')}
          title={translate('gitLog.filters.matchCase', 'Match case')}
          onToggle={() => onChange({ textMatchCase: !filters.textMatchCase })}
        />
      </label>
      <GitLogFilterChip
        label={translate('gitLog.filters.branchLabel', 'Branch')}
        value={revisions.length > 0 ? revisions.map(shortRevisionName).join(', ') : null}
        testId="git-log-branch-filter"
        onClear={() => onChange({ revisions: [] })}
      >
        {(close) => (
          <GitLogPickerList
            options={branchList}
            placeholder={translate('gitLog.filters.branch.search', 'Search branches and tags')}
            allowCustom
            onPick={(value) => {
              onChange({ revisions: [value] })
              close()
            }}
          />
        )}
      </GitLogFilterChip>
      <GitLogFilterChip
        label={translate('gitLog.filters.userLabel', 'User')}
        value={filters.author ?? null}
        testId="git-log-user-filter"
        onClear={() => onChange({ author: '' })}
      >
        {(close) => (
          <GitLogPickerList
            options={authorList}
            placeholder={translate('gitLog.filters.user.search', 'Author name or email')}
            allowCustom
            onPick={(value) => {
              onChange({ author: value })
              close()
            }}
          />
        )}
      </GitLogFilterChip>
      <GitLogFilterChip
        label={translate('gitLog.filters.dateLabel', 'Date')}
        value={dateValue}
        testId="git-log-date-filter"
        onClear={() => onChange({ since: '', until: '' })}
      >
        {(close) => (
          <GitLogDatePanel
            since={filters.since}
            until={filters.until}
            onApply={(range) => {
              onChange({ since: range.since ?? '', until: range.until ?? '' })
              close()
            }}
          />
        )}
      </GitLogFilterChip>
      <GitLogFilterChip
        label={translate('gitLog.filters.pathsLabel', 'Paths')}
        value={paths.length > 0 ? paths.join(', ') : null}
        testId="git-log-paths-filter"
        onClear={() => onChange({ paths: [] })}
      >
        {() => <GitLogPathsPanel paths={paths} onChange={(next) => onChange({ paths: next })} />}
      </GitLogFilterChip>
      <button
        type="button"
        data-testid="git-log-collapse-all"
        aria-label={translate('gitLog.collapseAll', 'Collapse all linear branches')}
        title={translate('gitLog.collapseAll', 'Collapse all linear branches')}
        className="ml-auto flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        onClick={onCollapseAll}
      >
        <ChevronsDownUp className="size-3.5" />
      </button>
      <button
        type="button"
        data-testid="git-log-expand-all"
        aria-label={translate('gitLog.expandAll', 'Expand all')}
        title={translate('gitLog.expandAll', 'Expand all')}
        className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        onClick={onExpandAll}
      >
        <ChevronsUpDown className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={translate('gitLog.refresh', 'Refresh log')}
        title={translate('gitLog.refresh', 'Refresh log')}
        className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        onClick={onRefresh}
      >
        <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
      </button>
    </div>
  )
}
