import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useNavigation } from '../../src/lib/navigation'

type S = { name: 'home' } | { name: 'overview' } | { name: 'session'; filter: { lecture?: number } }

beforeEach(() => window.history.replaceState(null, ''))

test('navigate pushes and back returns to the previous screen', async () => {
  const { result } = renderHook(() => useNavigation<S>({ name: 'home' }))
  expect(result.current.canGoBack).toBe(false)
  act(() => result.current.navigate({ name: 'overview' }))
  act(() => result.current.navigate({ name: 'session', filter: { lecture: 3 } }))
  expect(result.current.screen).toEqual({ name: 'session', filter: { lecture: 3 } })
  expect(result.current.canGoBack).toBe(true)
  act(() => result.current.back())
  await waitFor(() => expect(result.current.screen).toEqual({ name: 'overview' }))
  act(() => result.current.back())
  await waitFor(() => expect(result.current.screen).toEqual({ name: 'home' }))
  expect(result.current.canGoBack).toBe(false)
})

test('reset replaces the stack', () => {
  const { result } = renderHook(() => useNavigation<S>({ name: 'home' }))
  act(() => result.current.navigate({ name: 'overview' }))
  act(() => result.current.reset({ name: 'home' }))
  expect(result.current.screen).toEqual({ name: 'home' })
  expect(result.current.canGoBack).toBe(false)
})
