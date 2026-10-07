import { translate } from '@/i18n/i18n'
import type { EditorGet, EditorSet } from '../types/editor-set-get'
import type { EditorSlice } from '../types/editor-slice'
import type { OpenFile } from '../types/open-file'
import { openWorkspaceEditorItem } from '../tabs/workspace-editor-item'

const GIT_LOG_TAB_ID_SUFFIX = '::git-log'

/** One Git Log tab per worktree; the id is synthetic like check-details tabs, never a disk path. */
export function buildGitLogTabId(worktreeId: string): string {
  return `${worktreeId}${GIT_LOG_TAB_ID_SUFFIX}`
}

export function worktreeIdFromGitLogTabId(tabId: string): string | null {
  return tabId.endsWith(GIT_LOG_TAB_ID_SUFFIX)
    ? tabId.slice(0, -GIT_LOG_TAB_ID_SUFFIX.length)
    : null
}

export function createOpenGitLog(set: EditorSet, get: EditorGet): Pick<EditorSlice, 'openGitLog'> {
  return {
    openGitLog: (worktreeId) => {
      const id = buildGitLogTabId(worktreeId)
      const label = translate('gitLog.tabLabel', 'Git Log')
      set((s) => {
        const exists = s.openFiles.some((file) => file.id === id)
        const newFile: OpenFile = {
          id,
          filePath: id,
          relativePath: label,
          worktreeId,
          language: 'plaintext',
          isDirty: false,
          mode: 'git-log'
        }
        return {
          openFiles: exists ? s.openFiles : [...s.openFiles, newFile],
          activeFileId: id,
          activeTabType: 'editor',
          activeFileIdByWorktree: { ...s.activeFileIdByWorktree, [worktreeId]: id },
          activeTabTypeByWorktree: { ...s.activeTabTypeByWorktree, [worktreeId]: 'editor' }
        }
      })
      // Why: the Git Log is a per-worktree singleton, so reuse its tab in whichever group holds
      // it instead of opening a second copy in the focused group.
      const state = get()
      const existingTab = (state.unifiedTabsByWorktree?.[worktreeId] ?? []).find(
        (tab) => tab.entityId === id && tab.contentType === 'git-log'
      )
      if (existingTab) {
        state.activateTab?.(existingTab.id)
        return
      }
      void openWorkspaceEditorItem(state, id, worktreeId, label, 'git-log')
    }
  }
}
