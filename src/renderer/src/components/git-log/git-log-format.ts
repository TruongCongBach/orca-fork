import { translate } from '@/i18n/i18n'

const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'short'
})
const fullFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long' })

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** IDE-style row date: `Today 12:32 PM`, `Yesterday 9:27 AM`, otherwise `10/1/26, 8:55 PM`. */
export function formatGitLogRowDate(timestamp: number | undefined, now = new Date()): string {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return ''
  }
  const date = new Date(timestamp)
  const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (dayDelta === 0) {
    return translate('gitLog.date.today', 'Today {{value0}}', {
      value0: timeFormatter.format(date)
    })
  }
  if (dayDelta === 1) {
    return translate('gitLog.date.yesterday', 'Yesterday {{value0}}', {
      value0: timeFormatter.format(date)
    })
  }
  return dateTimeFormatter.format(date)
}

export function formatGitLogFullDate(timestamp: number | undefined): string {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return ''
  }
  return fullFormatter.format(new Date(timestamp))
}

/** `YYYY-MM-DD` in local time, the format `git log --since/--until` and `<input type=date>` share. */
export function toGitDateInput(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
