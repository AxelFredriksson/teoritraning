import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { CourseData } from '../../src/data/api'
import { Session, type SessionApi } from '../../src/screens/Session'
import type { CardRow } from '../../src/types'
import { card, concept } from '../fixtures'

function data(cards: CardRow[]): CourseData {
  return { concepts: [concept()], cards, states: new Map(), stats: { points: 0, streak: 0, lastActive: null } }
}

function fakeApi(over: Partial<SessionApi> = {}): SessionApi {
  return {
    saveReview: vi.fn(async () => {}),
    reportCard: vi.fn(async () => {}),
    gradeOpen: vi.fn(async () => ({ verdict: 'correct' as const, feedback: 'Bra', missing: [] })),
    ...over,
  }
}

const mc = card({ id: 'm1', answer_mode: 'mc', type: 'conditions', prompt_md: 'Vilka villkor?', choices: ['A', 'B', 'C'], correct: [0, 2], rubric_md: null })
const open = card({ id: 'o1', prompt_md: 'Vad säger satsen?', reference_answer_md: 'Referenssvaret' })
const fe = card({ id: 'f1', type: 'find_error', prompt_md: 'Hitta felet', steps: ['Steg ett', 'Steg två', 'Steg tre'], error_step: 1 })

const originalWidth = window.innerWidth
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
})
const wide = () => Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })

test('mc exact match saves verdict correct with source mc', async () => {
  const api = fakeApi()
  render(<Session data={data([mc])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await userEvent.click(screen.getByRole('button', { name: 'C' }))
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(api.saveReview).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'm1', verdict: 'correct', source: 'mc' }))
})

test('mc partial overlap saves partial', async () => {
  const api = fakeApi()
  render(<Session data={data([mc])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(api.saveReview).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'partial' }))
})

test('open card falls back to self-grade with reference answer when gradeOpen rejects', async () => {
  wide()
  const api = fakeApi({ gradeOpen: vi.fn(async () => { throw new Error('429') }) })
  render(<Session data={data([open])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.type(screen.getByLabelText('Ditt svar'), 'Mitt svar')
  await userEvent.click(screen.getByRole('button', { name: 'Rätta' }))
  expect(await screen.findByText(/Rättning ej tillgänglig/)).toBeInTheDocument()
  expect(screen.getByText('Referenssvaret')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Delvis' }))
  expect(api.saveReview).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'partial', source: 'self' }))
})

test('typed answer is still visible after fallback', async () => {
  wide()
  const api = fakeApi({ gradeOpen: vi.fn(async () => { throw new Error('502') }) })
  render(<Session data={data([open])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.type(screen.getByLabelText('Ditt svar'), 'Mitt svar')
  await userEvent.click(screen.getByRole('button', { name: 'Rätta' }))
  await screen.findByText(/Rättning ej tillgänglig/)
  expect(screen.getByText('Mitt svar')).toBeInTheDocument()
})

test('open card saves ai verdict', async () => {
  wide()
  const api = fakeApi()
  render(<Session data={data([open])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.type(screen.getByLabelText('Ditt svar'), 'svar')
  await userEvent.click(screen.getByRole('button', { name: 'Rätta' }))
  expect(await screen.findByText('Bra')).toBeInTheDocument()
  expect(api.saveReview).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'correct', source: 'ai' }))
})

test('find_error tapping wrong step saves incorrect', async () => {
  const api = fakeApi()
  render(<Session data={data([fe])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /Steg tre/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(api.saveReview).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'incorrect', source: 'mc' }))
  expect(api.gradeOpen).not.toHaveBeenCalled()
})

test('report removes card from rotation', async () => {
  const api = fakeApi()
  render(<Session data={data([open, mc])} filter={{}} api={api} onExit={() => {}} />)
  const first = screen.getByRole('heading', { level: 2 }).textContent
  await userEvent.click(screen.getByRole('button', { name: 'Rapportera fel' }))
  await userEvent.click(screen.getByRole('button', { name: 'Skicka rapport' }))
  expect(api.reportCard).toHaveBeenCalled()
  expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(first)
})

test('narrow viewport shows flip mode for open cards', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  render(<Session data={data([open])} filter={{}} api={fakeApi()} onExit={() => {}} />)
  expect(screen.getByRole('button', { name: 'Visa svar' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Ditt svar')).toBeNull()
})

test('session shows done message when no cards left', () => {
  render(<Session data={data([])} filter={{}} api={fakeApi()} onExit={() => {}} />)
  expect(screen.getByText(/Inga fler kort/)).toBeInTheDocument()
})

test('self-grade can only be submitted once per card', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  const api = fakeApi()
  render(<Session data={data([open])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Visa svar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Rätt' }))
  await userEvent.click(screen.getByRole('button', { name: 'Rätt' }))
  await userEvent.click(screen.getByRole('button', { name: 'Fel' }))
  expect(api.saveReview).toHaveBeenCalledTimes(1)
})

test('concept title math is rendered in the card heading', () => {
  const d = data([open])
  d.concepts = [concept({ title: 'Distribution $\mathcal D\'(I)$' })]
  const { container } = render(<Session data={d} filter={{}} api={fakeApi()} onExit={() => {}} />)
  expect(container.querySelector('h2 .katex')).not.toBeNull()
})

test('ai feedback and missing points render math', async () => {
  wide()
  const api = fakeApi({ gradeOpen: vi.fn(async () => ({ verdict: 'partial' as const, feedback: 'Saknar $u_n(t)$', missing: ['Villkoret $\sigma\in\Sigma_u$'] })) })
  const { container } = render(<Session data={data([open])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.type(screen.getByLabelText('Ditt svar'), 'svar')
  await userEvent.click(screen.getByRole('button', { name: 'Rätta' }))
  await screen.findByText(/Saknar/)
  expect(container.querySelectorAll('.feedback .katex').length).toBeGreaterThanOrEqual(2)
})

test('skip moves to the next card without saving a review', async () => {
  const api = fakeApi()
  render(<Session data={data([open, mc])} filter={{}} api={api} onExit={() => {}} />)
  const first = screen.getByRole('heading', { level: 2 }).textContent
  await userEvent.click(screen.getByRole('button', { name: /Hoppa över/ }))
  expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(first)
  expect(api.saveReview).not.toHaveBeenCalled()
})

const mc2 = card({ id: 'm2', answer_mode: 'mc', type: 'conditions', prompt_md: 'Andra frågan', choices: ['X', 'Y'], correct: [1], rubric_md: null })

test('previous returns to a skipped card and it can still be answered', async () => {
  const api = fakeApi()
  render(<Session data={data([mc, mc2])} filter={{}} api={api} onExit={() => {}} />)
  const firstPrompt = screen.getByRole('heading', { level: 2 }).parentElement!.textContent
  expect(screen.queryByRole('button', { name: /Föregående/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Hoppa över/ }))
  await userEvent.click(screen.getByRole('button', { name: /Föregående/ }))
  expect(screen.getByRole('heading', { level: 2 }).parentElement!.textContent).toBe(firstPrompt)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await userEvent.click(screen.getByRole('button', { name: 'C' }))
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  expect(api.saveReview).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'm1', verdict: 'correct' }))
})

test('going back to an answered card shows its result without answering again', async () => {
  const api = fakeApi()
  render(<Session data={data([mc, mc2])} filter={{}} api={api} onExit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'A' }))
  await userEvent.click(screen.getByRole('button', { name: 'Svara' }))
  await userEvent.click(screen.getByRole('button', { name: /Nästa kort/ }))
  await userEvent.click(screen.getByRole('button', { name: /Föregående/ }))
  expect(screen.getByText(/Redan besvarad/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Svara' })).toBeNull()
  expect(screen.getByText(/Delvis rätt/)).toBeInTheDocument()
  expect(api.saveReview).toHaveBeenCalledTimes(1)
})

test('next after going back walks forward through the same cards', async () => {
  render(<Session data={data([mc, mc2])} filter={{}} api={fakeApi()} onExit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /Hoppa över/ }))
  const secondPrompt = screen.getByRole('heading', { level: 2 }).parentElement!.textContent
  await userEvent.click(screen.getByRole('button', { name: /Föregående/ }))
  await userEvent.click(screen.getByRole('button', { name: /Hoppa över/ }))
  expect(screen.getByRole('heading', { level: 2 }).parentElement!.textContent).toBe(secondPrompt)
})

test('avsluta exits the session directly after skipping', async () => {
  const onExit = vi.fn()
  render(<Session data={data([mc, mc2])} filter={{}} api={fakeApi()} onExit={onExit} />)
  await userEvent.click(screen.getByRole('button', { name: /Hoppa över/ }))
  await userEvent.click(screen.getByRole('button', { name: /Avsluta/ }))
  expect(onExit).toHaveBeenCalledTimes(1)
})
