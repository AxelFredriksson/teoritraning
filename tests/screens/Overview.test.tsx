import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { CourseData } from '../../src/data/api'
import { conceptMastery, Overview } from '../../src/screens/Overview'
import { card, concept } from '../fixtures'

const stable = { fsrs: { state: 2, stability: 10 }, due: '2026-12-01T00:00:00Z' }
const learning = { fsrs: { state: 1, stability: 1 }, due: '2026-10-25T00:00:00Z' }

function data(): CourseData {
  return {
    concepts: [concept({ id: 'rare', title: 'Startvärdessatsen', exam_count: 0, lecture: 10 }), concept({ id: 'done', title: 'Derivering', exam_count: 9, lecture: 10 })],
    cards: [card({ id: 'r1', concept_id: 'rare' }), card({ id: 'd1', concept_id: 'done' }), card({ id: 'd2', concept_id: 'done' })],
    states: new Map([['d1', stable], ['d2', stable]]),
    stats: { points: 0, streak: 0, lastActive: null },
  }
}

test('overview marks exam_count 0 concept as Sällsynt', () => {
  render(<Overview data={data()} onBack={() => {}} onPractice={() => {}} />)
  const row = screen.getByRole('button', { name: /Startvärdessatsen/ })
  expect(within(row).getByText('Sällsynt')).toBeInTheDocument()
})

test('concept with all cards stable≥7 shows Sitter', () => {
  render(<Overview data={data()} onBack={() => {}} onPractice={() => {}} />)
  expect(within(screen.getByRole('button', { name: /Derivering/ })).getByText(/Sitter/)).toBeInTheDocument()
})

test('conceptMastery classifies new, learning and mastered', () => {
  const d = data()
  expect(conceptMastery(d.cards.filter((c) => c.concept_id === 'rare'), d.states)).toBe('new')
  expect(conceptMastery(d.cards.filter((c) => c.concept_id === 'done'), d.states)).toBe('mastered')
  expect(conceptMastery(d.cards.filter((c) => c.concept_id === 'done'), new Map([['d1', stable], ['d2', learning]]))).toBe('learning')
})

test('expanding a concept lists its cards with title and type, and can start practice', async () => {
  const onPractice = vi.fn()
  const d = data()
  d.cards[0] = { ...d.cards[0], title: 'Formulera startvärdessatsen', type: 'content', level: 1 }
  render(<Overview data={d} onBack={() => {}} onPractice={onPractice} />)
  const row = screen.getByRole('button', { name: /Startvärdessatsen/ })
  expect(row).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(row)
  expect(row).toHaveAttribute('aria-expanded', 'true')
  const list = screen.getByRole('list', { name: /Kort i Startvärdessatsen/ })
  expect(within(list).getByText('Formulera startvärdessatsen')).toBeInTheDocument()
  expect(within(list).getByText('Innehåll')).toBeInTheDocument()
  expect(within(list).getByText('Grund')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Öva på det här begreppet' }))
  expect(onPractice).toHaveBeenCalledWith({ conceptId: 'rare' })
})

test('overview renders math in concept titles', () => {
  const d = data()
  d.concepts[0].title = 'Sats 3.6 ($L^1*L^\infty$)'
  const { container } = render(<Overview data={d} onBack={() => {}} onPractice={() => {}} />)
  expect(container.querySelector('.row-title .katex')).not.toBeNull()
})

test('reset progress needs a confirmation step', async () => {
  const onReset = vi.fn(async () => {})
  render(<Overview data={data()} onBack={() => {}} onPractice={() => {}} onReset={onReset} />)
  await userEvent.click(screen.getByRole('button', { name: 'Återställ framsteg' }))
  expect(onReset).not.toHaveBeenCalled()
  expect(screen.getByText(/går inte att ångra/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ja, återställ' }))
  expect(onReset).toHaveBeenCalledTimes(1)
})

test('reset can be cancelled', async () => {
  const onReset = vi.fn(async () => {})
  render(<Overview data={data()} onBack={() => {}} onPractice={() => {}} onReset={onReset} />)
  await userEvent.click(screen.getByRole('button', { name: 'Återställ framsteg' }))
  await userEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
  expect(screen.queryByRole('button', { name: 'Ja, återställ' })).toBeNull()
  expect(onReset).not.toHaveBeenCalled()
})
