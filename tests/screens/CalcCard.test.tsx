import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { CalcCard } from '../../src/cards/CalcCard'
import { card } from '../fixtures'

const calc = () => card({
  type: 'calc', answer_mode: 'numeric', answer_value: 3.52, answer_tolerance: 0.01, answer_unit: '%',
  steps: ['Första steget', 'Andra steget'], rubric_md: 'rubrik', reference_answer_md: 'Referens här',
})

function draw() {
  const canvas = screen.getByLabelText('Rityta för handskrivet svar')
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'pen' })
  fireEvent.pointerMove(canvas, { clientX: 40, clientY: 30, pointerId: 1, pointerType: 'pen' })
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'pen' })
}

function setup(gradeOpen = vi.fn(async () => ({ verdict: 'partial' as const, feedback: 'Du glömde procenten', missing: ['Steg 2'] }))) {
  const onAnswer = vi.fn()
  render(<CalcCard card={calc()} narrow={false} gradeOpen={gradeOpen} onAnswer={onAnswer} exportDrawing={async () => 'IMG'} />)
  return { gradeOpen, onAnswer }
}

test('typing the right number marks correct and shows facit and steps', async () => {
  const { onAnswer } = setup()
  await userEvent.type(screen.getByLabelText('Ditt svar'), '3,52')
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith('correct', 'mc')
  expect(screen.getByText(/Facit: 3,52/)).toBeInTheDocument()
  expect(screen.getByText(/Första steget/)).toBeInTheDocument()
  expect(screen.getByText(/Andra steget/)).toBeInTheDocument()
})

test('wrong number marks incorrect and offers "Hitta mitt fel" only when there is ink', async () => {
  const { onAnswer } = setup()
  draw()
  await userEvent.type(screen.getByLabelText('Ditt svar'), '9')
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(onAnswer).toHaveBeenCalledWith('incorrect', 'mc')
  expect(screen.getByRole('button', { name: 'Hitta mitt fel' })).toBeInTheDocument()
})

test('no "Hitta mitt fel" without ink', async () => {
  setup()
  await userEvent.type(screen.getByLabelText('Ditt svar'), '9')
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(screen.queryByRole('button', { name: 'Hitta mitt fel' })).not.toBeInTheDocument()
})

test('"Hitta mitt fel" calls gradeOpen with mode find_calc_error and shows feedback, without a second onAnswer', async () => {
  const { gradeOpen, onAnswer } = setup()
  draw()
  await userEvent.type(screen.getByLabelText('Ditt svar'), '9')
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  await userEvent.click(screen.getByRole('button', { name: 'Hitta mitt fel' }))
  expect(gradeOpen).toHaveBeenCalledWith('c1', { imageBase64: 'IMG', mode: 'find_calc_error' })
  expect(await screen.findByText('Du glömde procenten')).toBeInTheDocument()
  expect(screen.getByText('Steg 2')).toBeInTheDocument()
  expect(onAnswer).toHaveBeenCalledTimes(1)
})

test('when gradeOpen rejects, facit and steps stay visible and the error text shows', async () => {
  const { onAnswer } = setup(vi.fn(async () => { throw new Error('429') }))
  draw()
  await userEvent.type(screen.getByLabelText('Ditt svar'), '9')
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  await userEvent.click(screen.getByRole('button', { name: 'Hitta mitt fel' }))
  expect(await screen.findByText('Felsökningen är inte tillgänglig just nu.')).toBeInTheDocument()
  expect(screen.getByText(/Facit: 3,52/)).toBeInTheDocument()
  expect(screen.getByText(/Första steget/)).toBeInTheDocument()
  expect(onAnswer).toHaveBeenCalledTimes(1)
})

test('Svara is disabled until the input parses', async () => {
  setup()
  const btn = screen.getByRole('button', { name: 'Svara' })
  expect(btn).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Ditt svar'), 'abc')
  expect(btn).toBeDisabled()
  await userEvent.clear(screen.getByLabelText('Ditt svar'))
  await userEvent.type(screen.getByLabelText('Ditt svar'), '3,5')
  expect(btn).toBeEnabled()
})

test('"Visa facit" without answering falls back to self-grade', async () => {
  const { onAnswer } = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Visa facit' }))
  expect(screen.getByText(/Referens här/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Delvis' }))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith('partial', 'self')
})
