import React, { useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

/** Filter-bar button (`Branch: main ▾  ×`) that opens arbitrary picker content in a popover. */
export function GitLogFilterChip({
  label,
  value,
  testId,
  onClear,
  children
}: {
  label: string
  value: string | null
  testId: string
  onClear: () => void
  children: (close: () => void) => React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex shrink-0 items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={testId}
            className={cn(
              'flex h-6 max-w-[16rem] items-center gap-1 rounded px-1.5 text-xs hover:bg-accent/50',
              value ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <span className="shrink-0">{value ? `${label}:` : label}</span>
            {value ? <span className="min-w-0 truncate font-medium">{value}</span> : null}
            <ChevronDown className="size-3 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <div className="p-1.5">{children(() => setOpen(false))}</div>
        </PopoverContent>
      </Popover>
      {value ? (
        <button
          type="button"
          aria-label={translate('gitLog.filters.clearOne', 'Clear {{value0}} filter', {
            value0: label
          })}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          onClick={onClear}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

export type GitLogPickerOption = { value: string; label: string; hint?: string }

/** Searchable single-select list used by the Branch and User filters. */
export function GitLogPickerList({
  options,
  placeholder,
  allowCustom,
  onPick
}: {
  options: GitLogPickerOption[]
  placeholder: string
  allowCustom: boolean
  onPick: (value: string) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      (needle
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options
      ).slice(0, 200),
    [needle, options]
  )
  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        className="h-7 rounded border border-border bg-transparent px-2 text-xs outline-none focus:border-ring"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && allowCustom && query.trim()) {
            onPick(query.trim())
          }
        }}
      />
      <div className="max-h-64 overflow-auto scrollbar-sleek">
        {allowCustom && query.trim() ? (
          <button
            type="button"
            className="flex h-6 w-full items-center rounded px-2 text-left text-xs hover:bg-accent/50"
            onClick={() => onPick(query.trim())}
          >
            {translate('gitLog.filters.useCustom', 'Use “{{value0}}”', { value0: query.trim() })}
          </button>
        ) : null}
        {visible.map((option) => (
          <button
            key={option.value}
            type="button"
            className="flex h-6 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-xs hover:bg-accent/50"
            title={option.value}
            onClick={() => onPick(option.value)}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.hint ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">{option.hint}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
