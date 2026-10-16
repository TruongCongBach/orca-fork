import { useCallback, useEffect, useRef, useState } from 'react'
import { getRuntimeGitHistory } from '@/runtime/runtime-git-status-client'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import {
  normalizeGitLogFilters,
  type GitLogFilters,
  type GitLogRef
} from '../../../../shared/git-log-query'

export const GIT_LOG_PAGE_SIZE = 200

export type GitLogDataState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: GitHistoryItem[]
  hasMore: boolean
  loadingMore: boolean
  error: string | null
  currentRef?: GitHistoryItemRef
  refs: GitLogRef[]
}

const INITIAL: GitLogDataState = {
  status: 'idle',
  items: [],
  hasMore: false,
  loadingMore: false,
  error: null,
  refs: []
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Pages the multi-ref log for one Log sub-tab. A filter change restarts from offset 0 and discards
 * in-flight pages for the old filters; `loadMore` appends the next page (git `--skip`).
 */
export function useGitLogData(
  context: RuntimeGitContext | null,
  filters: GitLogFilters,
  reloadNonce: number
): GitLogDataState & { loadMore: () => void } {
  const [state, setState] = useState<GitLogDataState>(INITIAL)
  const requestSeqRef = useRef(0)
  const filtersKey = JSON.stringify(filters)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!context) {
      return
    }
    const seq = ++requestSeqRef.current
    setState((prev) => ({ ...prev, status: 'loading', error: null, loadingMore: false }))
    getRuntimeGitHistory(context, {
      scope: 'log',
      limit: GIT_LOG_PAGE_SIZE,
      skip: 0,
      filters: normalizeGitLogFilters(JSON.parse(filtersKey)),
      includeRefs: true
    })
      .then((result) => {
        if (seq !== requestSeqRef.current) {
          return
        }
        setState({
          status: 'ready',
          items: result.items,
          hasMore: result.hasMore,
          loadingMore: false,
          error: null,
          currentRef: result.currentRef,
          refs: result.refs ?? []
        })
      })
      .catch((error: unknown) => {
        if (seq !== requestSeqRef.current) {
          return
        }
        setState((prev) => ({
          ...prev,
          status: 'error',
          items: [],
          hasMore: false,
          error: errorMessage(error)
        }))
      })
  }, [context, filtersKey, reloadNonce])

  const loadMore = useCallback(() => {
    const current = stateRef.current
    if (!context || current.status !== 'ready' || !current.hasMore || current.loadingMore) {
      return
    }
    const seq = requestSeqRef.current
    setState((prev) => ({ ...prev, loadingMore: true }))
    getRuntimeGitHistory(context, {
      scope: 'log',
      limit: GIT_LOG_PAGE_SIZE,
      skip: current.items.length,
      filters: normalizeGitLogFilters(JSON.parse(filtersKey))
    })
      .then((result) => {
        if (seq !== requestSeqRef.current) {
          return
        }
        setState((prev) => {
          const known = new Set(prev.items.map((item) => item.id))
          const appended = result.items.filter((item) => !known.has(item.id))
          return {
            ...prev,
            items: [...prev.items, ...appended],
            hasMore: result.hasMore,
            loadingMore: false
          }
        })
      })
      .catch((error: unknown) => {
        if (seq !== requestSeqRef.current) {
          return
        }
        setState((prev) => ({
          ...prev,
          loadingMore: false,
          hasMore: false,
          error: errorMessage(error)
        }))
      })
  }, [context, filtersKey])

  return { ...state, loadMore }
}

/** Lazily lists the branches containing a commit for the details panel. */
export function useBranchesContaining(
  context: RuntimeGitContext | null,
  commitId: string | null
): { status: 'idle' | 'loading' | 'ready' | 'error'; branches: string[] } {
  const [state, setState] = useState<{
    key: string | null
    status: 'idle' | 'loading' | 'ready' | 'error'
    branches: string[]
  }>({ key: null, status: 'idle', branches: [] })

  useEffect(() => {
    if (!context || !commitId) {
      return
    }
    let cancelled = false
    setState({ key: commitId, status: 'loading', branches: [] })
    getRuntimeGitHistory(context, { scope: 'log', branchesContaining: commitId })
      .then((result) => {
        if (!cancelled) {
          setState({ key: commitId, status: 'ready', branches: result.containingBranches ?? [] })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ key: commitId, status: 'error', branches: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [commitId, context])

  return state.key === commitId ? state : { status: commitId ? 'loading' : 'idle', branches: [] }
}
