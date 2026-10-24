import { beforeEach, expect, test, vi } from 'vitest'
import { createApi } from '../../src/data/api'

type Res = { data?: unknown; error: { message: string } | null }

function fakeClient(opts: { upsertError?: boolean } = {}) {
  const calls: { table: string; op: string; payload: unknown }[] = []
  const from = (table: string) => {
    const res = (op: string, payload?: unknown): Res => {
      calls.push({ table, op, payload })
      return { data: null, error: opts.upsertError && op !== 'select' ? { message: 'network' } : null }
    }
    return {
      upsert: (p: unknown) => Promise.resolve(res('upsert', p)),
      insert: (p: unknown) => Promise.resolve(res('insert', p)),
    }
  }
  return { client: { from, auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }, calls }
}

const review = {
  cardId: 'c1',
  verdict: 'correct' as const,
  source: 'mc' as const,
  state: { fsrs: {}, due: '2026-10-25T00:00:00Z' },
  stats: { points: 10, streak: 1, lastActive: '2026-10-24' },
}

beforeEach(() => localStorage.clear())

test('saveReview queues to pendingReviews when upsert rejects', async () => {
  const { client } = fakeClient({ upsertError: true })
  const api = createApi(client as never)
  await expect(api.saveReview(review)).resolves.toBeUndefined()
  expect(JSON.parse(localStorage.getItem('pendingReviews')!)).toHaveLength(1)
})

test('saveReview writes card_state, review_log and user_stats', async () => {
  const { client, calls } = fakeClient()
  await createApi(client as never).saveReview(review)
  expect(calls.map((c) => c.table).sort()).toEqual(['card_state', 'review_log', 'user_stats'])
  expect(localStorage.getItem('pendingReviews')).toBeNull()
})

test('flushPending replays queued reviews and clears queue', async () => {
  localStorage.setItem('pendingReviews', JSON.stringify([review, { ...review, cardId: 'c2' }]))
  const { client, calls } = fakeClient()
  const n = await createApi(client as never).flushPending()
  expect(n).toBe(2)
  expect(calls.filter((c) => c.table === 'review_log')).toHaveLength(2)
  expect(JSON.parse(localStorage.getItem('pendingReviews') ?? '[]')).toHaveLength(0)
})

test('flushPending keeps reviews that fail again', async () => {
  localStorage.setItem('pendingReviews', JSON.stringify([review]))
  const { client } = fakeClient({ upsertError: true })
  expect(await createApi(client as never).flushPending()).toBe(0)
  expect(JSON.parse(localStorage.getItem('pendingReviews')!)).toHaveLength(1)
  vi.restoreAllMocks()
})
