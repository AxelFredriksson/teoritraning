import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { CourseData } from '../../src/data/api'
import { Home } from '../../src/screens/Home'
import { card, concept } from '../fixtures'

const d = (): CourseData => ({
  concepts: [concept()],
  cards: [card({ id: 'a', level: 1 }), card({ id: 'b', level: 3 })],
  states: new Map(),
  stats: { points: 0, streak: 0, lastActive: null },
})

const props = { courseId: 'TATA77', isAdmin: false, onOverview: vi.fn(), onAdmin: vi.fn(), onSwitchCourse: vi.fn(), onSignOut: vi.fn() }

beforeEach(() => localStorage.clear())

test('chosen level is passed to practice and remembered', async () => {
  const onStart = vi.fn()
  const { unmount } = render(<Home {...props} data={d()} onStart={onStart} />)
  await userEvent.click(screen.getByRole('radio', { name: 'Grund' }))
  expect(screen.getByText(/1 nya/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fortsätt öva' }))
  expect(onStart).toHaveBeenCalledWith({ maxLevel: 1 })
  unmount()
  render(<Home {...props} data={d()} onStart={onStart} />)
  expect(screen.getByRole('radio', { name: 'Grund' })).toBeChecked()
})

test('default level is all cards', async () => {
  const onStart = vi.fn()
  render(<Home {...props} data={d()} onStart={onStart} />)
  expect(screen.getByRole('radio', { name: 'Allt' })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Fortsätt öva' }))
  expect(onStart).toHaveBeenCalledWith({ maxLevel: 3 })
})

test('sign out button calls onSignOut', async () => {
  const onSignOut = vi.fn()
  render(<Home {...props} onSignOut={onSignOut} data={d()} onStart={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Logga ut' }))
  expect(onSignOut).toHaveBeenCalledTimes(1)
})

test('start screen shows which app version is running', () => {
  render(<Home {...props} data={d()} onStart={vi.fn()} />)
  expect(screen.getByText(/^Version /)).toBeInTheDocument()
})
