import { expect, test, vi } from 'vitest'
import { startUpdates } from '../../src/lib/pwaUpdate'

test('registers the service worker immediately and checks for a new version when the app comes back to the foreground', () => {
  const update = vi.fn(async () => {})
  const register = vi.fn((opts: { immediate?: boolean; onRegisteredSW?: (url: string, r: { update: () => Promise<void> } | undefined) => void }) => {
    opts.onRegisteredSW?.('/sw.js', { update })
    return async () => {}
  })
  startUpdates(register)
  expect(register).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }))
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(update).toHaveBeenCalledTimes(1)
})

test('does not check for updates when the app goes to the background', () => {
  const update = vi.fn(async () => {})
  startUpdates((opts) => {
    opts.onRegisteredSW?.('/sw.js', { update })
    return async () => {}
  })
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(update).not.toHaveBeenCalled()
})
