import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { McCard } from '../../src/cards/McCard'
import { card } from '../fixtures'

const mc = card({ id: 'm1', answer_mode: 'mc', choices: ['Första', 'Andra', 'Tredje'], correct: [0], rubric_md: null })

// Fisher–Yates over 3 items: i=2 takes j=0 (swap ends), i=1 takes j=1 (stay) -> reversed
const reverseRandom = () => {
  const seq = [0, 0.99]
  let n = 0
  return vi.spyOn(Math, 'random').mockImplementation(() => seq[n++ % seq.length])
}

afterEach(() => vi.restoreAllMocks())

test('choices are shown in shuffled order', () => {
  reverseRandom()
  render(<McCard card={mc} onAnswer={() => {}} />)
  const buttons = screen.getAllByRole('button').filter((b) => b.textContent !== 'Svara')
  expect(buttons.map((b) => b.textContent)).toEqual(['Tredje', 'Andra', 'Första'])
})

test('picking the correct choice by its text grades correct after shuffling', async () => {
  reverseRandom()
  const onAnswer = vi.fn()
  render(<McCard card={mc} onAnswer={onAnswer} />)
  await userEvent.click(screen.getByRole('button', { name: 'Första' }))
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(onAnswer).toHaveBeenCalledWith('correct')
  expect(screen.getByRole('button', { name: 'Första' })).toHaveClass('right')
})
