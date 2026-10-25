import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { CourseSelect } from '../../src/screens/CourseSelect'

const courses = [
  { id: 'TATA77', name: 'Fourieranalys', archived: false },
  { id: 'TAMS24', name: 'Statistik', archived: true },
]

test('course select hides archived courses until toggled', async () => {
  const onPick = vi.fn()
  render(<CourseSelect listCourses={async () => courses} onPick={onPick} />)
  expect(await screen.findByRole('button', { name: /TATA77/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /TAMS24/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Visa arkiverade' }))
  await userEvent.click(screen.getByRole('button', { name: /TAMS24/ }))
  expect(onPick).toHaveBeenCalledWith('TAMS24')
})
