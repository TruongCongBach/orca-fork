import { describe, expect, it } from 'vitest'
import { gitLogCheckoutErrorMessage } from './git-log-checkout-error'

const GIT_STDERR =
  'error: Your local changes to the following files would be overwritten by checkout:\n' +
  '\ta.txt\n' +
  'Please commit your changes or stash them before you switch branches.\n' +
  'Aborting'

describe('gitLogCheckoutErrorMessage', () => {
  it('drops the Electron wrapper and the echoed git command', () => {
    expect(
      gitLogCheckoutErrorMessage(
        new Error(
          `Error invoking remote method 'git:checkout': Error: Command failed: git checkout conflict --\n${GIT_STDERR}`
        )
      )
    ).toBe(GIT_STDERR)
  })

  it('keeps a message that has no command echo', () => {
    expect(
      gitLogCheckoutErrorMessage(
        new Error(`Error invoking remote method 'git:checkout': Error: ${GIT_STDERR}`)
      )
    ).toBe(GIT_STDERR)
    expect(gitLogCheckoutErrorMessage(new Error('No git provider for connection "x"'))).toBe(
      'No git provider for connection "x"'
    )
  })

  it('falls back to the command line when git printed nothing', () => {
    expect(gitLogCheckoutErrorMessage(new Error('Command failed: git checkout x --'))).toBe(
      'Command failed: git checkout x --'
    )
  })

  it('stringifies non-Error rejections', () => {
    expect(gitLogCheckoutErrorMessage('boom')).toBe('boom')
  })
})
