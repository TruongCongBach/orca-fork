import React, { useState } from 'react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { toGitDateInput } from './git-log-format'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'

const DATE_PRESET_DAYS = [1, 7, 30, 365] as const

function presetLabel(days: number): string {
  switch (days) {
    case 1:
      return translate('gitLog.filters.date.last24h', 'Last 24 hours')
    case 7:
      return translate('gitLog.filters.date.last7d', 'Last 7 days')
    case 30:
      return translate('gitLog.filters.date.last30d', 'Last 30 days')
    default:
      return translate('gitLog.filters.date.lastYear', 'Last year')
  }
}

export function GitLogDatePanel({
  since,
  until,
  onApply
}: {
  since?: string
  until?: string
  onApply: (range: { since?: string; until?: string }) => void
}): React.JSX.Element {
  const [draftSince, setDraftSince] = useState(since ?? '')
  const [draftUntil, setDraftUntil] = useState(until ?? '')
  return (
    <div className="flex flex-col gap-1 text-xs">
      {DATE_PRESET_DAYS.map((days) => (
        <button
          key={days}
          type="button"
          className="flex h-6 items-center rounded px-2 text-left hover:bg-accent/50"
          onClick={() => {
            const from = new Date()
            from.setDate(from.getDate() - days)
            onApply({ since: toGitDateInput(from) })
          }}
        >
          {presetLabel(days)}
        </button>
      ))}
      <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 border-t border-border px-1 pt-2">
        <span className="text-muted-foreground">
          {translate('gitLog.filters.date.since', 'Since')}
        </span>
        <input
          type="date"
          className="h-6 rounded border border-border bg-transparent px-1 outline-none"
          value={draftSince}
          onChange={(event) => setDraftSince(event.target.value)}
        />
        <span className="text-muted-foreground">
          {translate('gitLog.filters.date.until', 'Until')}
        </span>
        <input
          type="date"
          className="h-6 rounded border border-border bg-transparent px-1 outline-none"
          value={draftUntil}
          onChange={(event) => setDraftUntil(event.target.value)}
        />
      </div>
      <button
        type="button"
        className="mt-1 h-6 self-end rounded bg-primary px-2 text-primary-foreground hover:bg-primary/90"
        onClick={() => onApply({ since: draftSince || undefined, until: draftUntil || undefined })}
      >
        {translate('gitLog.filters.apply', 'Apply')}
      </button>
    </div>
  )
}

export function GitLogPathsPanel({
  paths,
  onChange
}: {
  paths: string[]
  onChange: (paths: string[]) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const add = (): void => {
    const value = draft.trim().replace(/^\.\//, '')
    if (value && !paths.includes(value)) {
      onChange([...paths, value])
    }
    setDraft('')
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex gap-1">
        <input
          autoFocus
          className="h-7 min-w-0 flex-1 rounded border border-border bg-transparent px-2 outline-none focus:border-ring"
          placeholder={translate('gitLog.filters.paths.placeholder', 'Repository-relative path')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !isImeOwnedKeyboardEvent(event)) {
              add()
            }
          }}
        />
        <button
          type="button"
          className="h-7 rounded bg-primary px-2 text-primary-foreground hover:bg-primary/90"
          onClick={add}
        >
          {translate('gitLog.filters.paths.add', 'Add')}
        </button>
      </div>
      {paths.map((path) => (
        <div key={path} className="flex h-6 items-center gap-1 rounded px-2 hover:bg-accent/40">
          <span className="min-w-0 flex-1 truncate" title={path}>
            {path}
          </span>
          <button
            type="button"
            aria-label={translate('gitLog.filters.paths.remove', 'Remove {{value0}}', {
              value0: path
            })}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(paths.filter((candidate) => candidate !== path))}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
