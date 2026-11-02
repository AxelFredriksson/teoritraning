import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Canvas } from '../../src/handwriting/Canvas'

function setup() {
  const onChange = vi.fn()
  render(<Canvas onChange={onChange} />)
  const canvas = screen.getByLabelText('Rityta för handskrivet svar')
  const drag = (pts: [number, number][], pointerId = 1, pointerType = 'pen') => {
    const [first, ...rest] = pts
    fireEvent.pointerDown(canvas, { clientX: first[0], clientY: first[1], pointerId, pointerType })
    for (const [x, y] of rest) fireEvent.pointerMove(canvas, { clientX: x, clientY: y, pointerId, pointerType })
    fireEvent.pointerUp(canvas, { pointerId, pointerType })
  }
  return { onChange, canvas, drag }
}

test('a single tap leaves ink (dots are kept)', () => {
  const { onChange, drag } = setup()
  drag([[10, 10]])
  expect(onChange).toHaveBeenLastCalledWith(true)
})

test('the eraser removes ink and undo brings it back', async () => {
  const { onChange, drag } = setup()
  drag([[10, 10], [40, 10]])
  expect(onChange).toHaveBeenLastCalledWith(true)
  await userEvent.click(screen.getByRole('button', { name: 'Sudd' }))
  expect(screen.getByRole('button', { name: 'Sudd' })).toHaveAttribute('aria-pressed', 'true')
  drag([[25, 0], [25, 20]])
  expect(onChange).toHaveBeenLastCalledWith(false)
  await userEvent.click(screen.getByRole('button', { name: 'Ångra' }))
  expect(onChange).toHaveBeenLastCalledWith(true)
})

test('moves from another pointer (a resting palm) do not join the pen stroke', async () => {
  const { onChange, canvas, drag } = setup()
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'pen' })
  fireEvent.pointerMove(canvas, { clientX: 300, clientY: 300, pointerId: 2, pointerType: 'touch' })
  fireEvent.pointerMove(canvas, { clientX: 320, clientY: 300, pointerId: 2, pointerType: 'touch' })
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'pen' })
  // erasing at the pen dot clears everything, so no palm point made it into the stroke
  await userEvent.click(screen.getByRole('button', { name: 'Sudd' }))
  drag([[10, 10]])
  expect(onChange).toHaveBeenLastCalledWith(false)
})

test('predicted pen points are only drawn ahead, never kept in the stroke', async () => {
  const { onChange, canvas, drag } = setup()
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'pen' })
  const ev = createEvent.pointerMove(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'pen' })
  const ahead = (x: number) => ({ clientX: x, clientY: 300, pointerId: 1, pointerType: 'pen', pressure: 0.5 })
  Object.defineProperty(ev, 'getPredictedEvents', { value: () => [ahead(300), ahead(320)] })
  fireEvent(canvas, ev)
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'pen' })
  await userEvent.click(screen.getByRole('button', { name: 'Sudd' }))
  drag([[10, 10]])
  expect(onChange).toHaveBeenLastCalledWith(false)
})

test('clear can be undone', async () => {
  const { onChange, drag } = setup()
  drag([[10, 10], [40, 10]])
  await userEvent.click(screen.getByRole('button', { name: 'Rensa' }))
  expect(onChange).toHaveBeenLastCalledWith(false)
  await userEvent.click(screen.getByRole('button', { name: 'Ångra' }))
  expect(onChange).toHaveBeenLastCalledWith(true)
})
