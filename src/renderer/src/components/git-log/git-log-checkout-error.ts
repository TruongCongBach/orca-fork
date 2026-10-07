import { readIpcErrorDetail } from '@/lib/ipc-error'

// Node's execFile prefixes stderr with the command line it ran; the user only needs git's words.
const COMMAND_FAILED_LINE = /^Command failed: git\b[^\n]*(?:\n|$)/

/** Git's own message for a failed checkout, without the IPC wrapper or the command echo. */
export function gitLogCheckoutErrorMessage(error: unknown): string {
  const detail = readIpcErrorDetail(error) ?? (error instanceof Error ? '' : String(error))
  return detail.replace(COMMAND_FAILED_LINE, '').trim() || detail
}
