import { beforeEach, expect, test, vi } from 'vitest'
import { createApi } from '../../src/data/api'

type Res = { data?: unknown; error: { message: string } | null }

function fakeClient(opts: { upsertError?: boolean; failFirst?: number; invoke?: (name: string, o: { timeout?: number }) => Promise<unknown> } = {}) {
  const calls: { table: string; op: string; payload: unknown; opts?: unknown }[] = []
  let failures = opts.failFirst ?? 0
  const from = (table: string) => {
    const res = (op: string, payload?: unknown, o?: unknown): Res => {
      calls.push({ table, op, payload, opts: o })
      if (failures > 0) { failures--; return { data: null, error: { message: 'network' } } }
      return { data: null, error: opts.upsertError && op !== 'select' ? { message: 'network' } : null }
    }
    return {
      upsert: (p: unknown, o?: unknown) => Promise.resolve(res('upsert', p, o)),
      insert: (p: unknown) => Promise.resolve(res('insert', p)),
    }
  }
  const functions = { invoke: opts.invoke ?? (async () => ({ data: null, error: null })) }
  return { client: { from, functions, auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }, calls }
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

test('a later review never lands before an earlier queued one', async () => {
  // first write attempt fails (3 table calls), everything after succeeds
  const { client, calls } = fakeClient({ failFirst: 3 })
  const api = createApi(client as never)
  await api.saveReview({ ...review, cardId: 'A', stats: { ...review.stats, points: 10 } })
  await api.saveReview({ ...review, cardId: 'B', stats: { ...review.stats, points: 20 } })
  const statsWrites = calls.filter((c) => c.table === 'user_stats').map((c) => (c.payload as { points: number }).points)
  expect(statsWrites[statsWrites.length - 1]).toBe(20)
  const states = calls.filter((c) => c.table === 'card_state').map((c) => (c.payload as { card_id: string }).card_id)
  expect(states.lastIndexOf('A')).toBeLessThan(states.lastIndexOf('B'))
  expect(localStorage.getItem('pendingReviews')).toBeNull()
})

test('review_log writes are idempotent via client id', async () => {
  const { client, calls } = fakeClient()
  await createApi(client as never).saveReview(review)
  const log = calls.find((c) => c.table === 'review_log')!
  expect(log.op).toBe('upsert')
  expect((log.payload as { client_id: string }).client_id).toMatch(/[0-9a-f-]{36}/)
  expect(log.opts).toEqual({ onConflict: 'client_id', ignoreDuplicates: true })
})

test('gradeOpen passes a timeout to invoke', async () => {
  const invoke = vi.fn(async () => ({ data: { verdict: 'correct', feedback: '', missing: [] }, error: null }))
  const { client } = fakeClient({ invoke })
  await createApi(client as never).gradeOpen('c1', { text: 'x' })
  expect(invoke).toHaveBeenCalledWith('grade', expect.objectContaining({ timeout: 30000 }))
})

test('a review queued during a failing flush is kept', async () => {
  localStorage.setItem('pendingReviews', JSON.stringify([review]))
  const { client } = fakeClient({ upsertError: true })
  const api = createApi(client as never)
  await Promise.all([api.flushPending(), api.saveReview({ ...review, cardId: 'late' })])
  const ids = JSON.parse(localStorage.getItem('pendingReviews')!).map((r: { cardId: string }) => r.cardId)
  expect(ids).toEqual(['c1', 'late'])
})
