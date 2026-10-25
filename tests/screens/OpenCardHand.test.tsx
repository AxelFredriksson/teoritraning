import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { OpenCard } from '../../src/cards/OpenCard'
import { card } from '../fixtures'

test('handwriting submits exported image via gradeOpen', async () => {
  const gradeOpen = vi.fn(async () => ({ verdict: 'partial' as const, feedback: 'Saknar villkor', missing: [] }))
  const onAnswer = vi.fn()
  render(<OpenCard card={card()} narrow={false} gradeOpen={gradeOpen} onAnswer={onAnswer} exportDrawing={async () => 'IMG'} />)
  await userEvent.click(screen.getByRole('tab', { name: 'Skriv för hand' }))
  const canvas = screen.getByLabelText('Rityta för handskrivet svar')
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'pen' })
  fireEvent.pointerMove(canvas, { clientX: 40, clientY: 30, pointerId: 1, pointerType: 'pen' })
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'pen' })
  await userEvent.click(screen.getByRole('button', { name: 'Rätta' }))
  expect(gradeOpen).toHaveBeenCalledWith('c1', { imageBase64: 'IMG' })
  expect(await screen.findByText('Saknar villkor')).toBeInTheDocument()
  expect(onAnswer).toHaveBeenCalledWith('partial', 'ai', expect.anything())
})
