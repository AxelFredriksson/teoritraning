import { expect, test } from 'vitest'
import { createAdminApi } from '../../src/data/adminApi'

function fakeClient() {
  const calls: { table: string; payload: Record<string, unknown>; id: unknown }[] = []
  const from = (table: string) => ({
    update: (payload: Record<string, unknown>) => ({
      eq: (_col: string, id: unknown) => {
        calls.push({ table, payload, id })
        return Promise.resolve({ error: null })
      },
    }),
  })
  return { client: { from }, calls }
}

test('approve writes reviewed_at', async () => {
  const { client, calls } = fakeClient()
  await createAdminApi(client as never).setCardStatus('c1', 'active')
  expect(calls).toHaveLength(1)
  expect(calls[0].table).toBe('cards')
  expect(calls[0].id).toBe('c1')
  expect(calls[0].payload.status).toBe('active')
  expect(typeof calls[0].payload.reviewed_at).toBe('string')
})

test('updateCard writes reviewed_at alongside the patch', async () => {
  const { client, calls } = fakeClient()
  await createAdminApi(client as never).updateCard('c1', { prompt_md: 'p', reference_answer_md: 'a', rubric_md: 'r' })
  expect(calls[0].payload.prompt_md).toBe('p')
  expect(typeof calls[0].payload.reviewed_at).toBe('string')
})

test('updateCard marks the card admin-edited so the uploader never overwrites the edit', async () => {
  const { client, calls } = fakeClient()
  await createAdminApi(client as never).updateCard('c1', { prompt_md: 'p', reference_answer_md: 'a', rubric_md: 'r' })
  expect(calls[0].payload.content_hash).toBe('admin-edited')
  expect(typeof calls[0].payload.reviewed_at).toBe('string')
})
