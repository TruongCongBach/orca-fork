import { useMemo } from 'react'
import type { WindowsTerminalCapabilities } from '@/lib/windows-terminal-capabilities'
import { useAppStore } from '@/store'
import { useRepoById, useWorktreeMap } from '@/store/selectors'
import { isFolderRepo } from '../../../../shared/repo-kind'
import { buildTabCreateMenuOptions, type TabCreateMenuOption } from './tab-create-menu-options'
import {
  buildWindowsShellMenuEntries,
  type WindowsShellMenuEntry
} from './tab-bar-windows-shell-options'
import type { getProjectRuntimeShellMenuMode } from './use-tab-bar-runtime-model'

/** Git Log needs a Git repository; folder projects have no history to show. */
export function useGitLogTabAvailable(worktreeId: string): boolean {
  const repoId = useWorktreeMap().get(worktreeId)?.repoId ?? null
  const repo = useRepoById(repoId)
  return repo ? !isFolderRepo(repo) : false
}

export function openGitLogTab(worktreeId: string): void {
  useAppStore.getState().openGitLog(worktreeId)
}

export function useTabCreateMenuOptions({
  worktreeId,
  terminalOnly,
  mobileEmulatorEnabled,
  managedBrowserCreationEnabled,
  mobileEmulatorCreationEnabled,
  workspaceHasSimulatorTab,
  showWindowsShellMenu,
  projectRuntimeShellMenuMode,
  defaultWindowsShell,
  windowsTerminalCapabilities,
  hasShellLauncher,
  hasNewFileTab,
  hasOpenFileTab,
  hasNewSimulatorTab
}: {
  worktreeId: string
  terminalOnly: boolean
  mobileEmulatorEnabled: boolean
  managedBrowserCreationEnabled: boolean
  mobileEmulatorCreationEnabled: boolean
  workspaceHasSimulatorTab: boolean
  showWindowsShellMenu: boolean
  projectRuntimeShellMenuMode: ReturnType<typeof getProjectRuntimeShellMenuMode>
  defaultWindowsShell: string
  windowsTerminalCapabilities: WindowsTerminalCapabilities
  hasShellLauncher: boolean
  hasNewFileTab: boolean
  hasOpenFileTab: boolean
  hasNewSimulatorTab: boolean
}): {
  windowsShellEntries: WindowsShellMenuEntry[] | undefined
  createMenuOptions: TabCreateMenuOption[]
} {
  const gitLogAvailable = useGitLogTabAvailable(worktreeId)
  const { gitBashAvailable, wslAvailable } = windowsTerminalCapabilities
  const windowsShellEntries = useMemo(
    () =>
      buildWindowsShellMenuEntries({
        showWindowsShellMenu,
        hasShellLauncher,
        projectRuntimeShellMenuMode,
        defaultWindowsShell,
        gitBashAvailable,
        wslAvailable
      }),
    [
      defaultWindowsShell,
      gitBashAvailable,
      hasShellLauncher,
      projectRuntimeShellMenuMode,
      showWindowsShellMenu,
      wslAvailable
    ]
  )
  const createMenuOptions = useMemo(
    () =>
      buildTabCreateMenuOptions({
        terminalOnly,
        windowsShellEntries,
        hasNewBrowser: !terminalOnly && managedBrowserCreationEnabled,
        hasNewMarkdown: !terminalOnly && hasNewFileTab,
        hasOpenMarkdown: !terminalOnly && hasOpenFileTab,
        hasGitLog: !terminalOnly && gitLogAvailable,
        hasSimulator:
          !terminalOnly &&
          mobileEmulatorEnabled &&
          mobileEmulatorCreationEnabled &&
          hasNewSimulatorTab,
        simulatorIsGoTo: workspaceHasSimulatorTab
      }),
    [
      gitLogAvailable,
      hasNewFileTab,
      hasNewSimulatorTab,
      hasOpenFileTab,
      managedBrowserCreationEnabled,
      mobileEmulatorCreationEnabled,
      mobileEmulatorEnabled,
      terminalOnly,
      windowsShellEntries,
      workspaceHasSimulatorTab
    ]
  )
  return { windowsShellEntries, createMenuOptions }
}
