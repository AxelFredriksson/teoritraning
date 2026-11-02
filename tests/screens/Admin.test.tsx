import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Admin, sumThisMonth, type AdminApi } from '../../src/screens/Admin'
import { card } from '../fixtures'

function fakeAdmin(over: Partial<AdminApi> = {}): AdminApi {
  return {
    listFlagged: vi.fn(async () => [{ ...card({ id: 'f1', status: 'flagged', verify_note: 'Fel villkor' }), reports: ['Stämmer inte'] }]),
    setCardStatus: vi.fn(async () => {}),
    updateCard: vi.fn(async () => {}),
    getSettings: vi.fn(async () => ({ provider: 'claude', claude_text_model: 'claude-haiku-5-5', claude_image_model: 'claude-sonnet-5-5', gemini_model: null })),
    setSetting: vi.fn(async () => {}),
    gradingLog: vi.fn(async () => []),
    ...over,
  }
}

test('approve sets card status active', async () => {
  const api = fakeAdmin()
  render(<Admin api={api} onBack={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Godkänn' }))
  expect(api.setCardStatus).toHaveBeenCalledWith('f1', 'active')
})

test('reject sets card status rejected', async () => {
  const api = fakeAdmin()
  render(<Admin api={api} onBack={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Stryk' }))
  expect(api.setCardStatus).toHaveBeenCalledWith('f1', 'rejected')
})

test('provider toggle writes settings.provider', async () => {
  const api = fakeAdmin()
  render(<Admin api={api} onBack={() => {}} />)
  await userEvent.click(await screen.findByRole('radio', { name: 'Gemini' }))
  expect(api.setSetting).toHaveBeenCalledWith('provider', 'gemini')
})

test('cost section sums this month only', () => {
  const now = new Date('2026-10-25T12:00:00Z')
  const rows = [
    { est_cost_sek: 1.5, created_at: '2026-10-02T10:00:00Z', kind: 'text' as const },
    { est_cost_sek: 2, created_at: '2026-10-25T08:00:00Z', kind: 'image' as const },
    { est_cost_sek: 10, created_at: '2026-09-30T10:00:00Z', kind: 'text' as const },
  ]
  expect(sumThisMonth(rows, now)).toBeCloseTo(3.5)
})

test('flagged calc card shows facit and solution steps', async () => {
  const api = fakeAdmin({
    listFlagged: vi.fn(async () => [{
      ...card({ id: 'f2', type: 'calc', answer_mode: 'numeric', answer_value: 3.52, answer_tolerance: 0.01, answer_unit: '%', steps: ['Räkna ut ränta', 'Dela med kapital'], status: 'flagged' }),
      reports: [],
    }]),
  })
  render(<Admin api={api} onBack={() => {}} />)
  expect(await screen.findByText(/Facit: 3,52 %/)).toBeInTheDocument()
  expect(screen.getByText(/Räkna ut ränta/)).toBeInTheDocument()
  expect(screen.getByText(/Dela med kapital/)).toBeInTheDocument()
})
