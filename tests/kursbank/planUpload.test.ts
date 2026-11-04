import { expect, test } from 'vitest'
import { cardHash, idsOutsideCoursePrefix, nextPublishedIds, planUpload, splitWrites, type RemoteCard } from '../../scripts/kursbank/plan-upload'
import type { Bank, Card } from '../../src/bank/schema'

const TODAY = '2026-11-02'

const card = (over: Partial<Card> = {}): Card => ({
  id: 'c1', type: 'content', answerMode: 'open', promptMd: 'p', referenceAnswerMd: 'r', rubricMd: 'rb',
  sourceRef: 's', level: 2, status: 'active', ...over,
})

const bankOf = (...cards: Card[]): Bank => ({
  course: { id: 'T', name: 'Test' },
  concepts: [{ id: 'k1', kind: 'sats', title: 't', statementMd: 's', sourceRef: 'x', lecture: 1, examCount: 0, examRefs: [], factRefs: [], cards }],
})

const remoteOf = (c: Card, over: Partial<RemoteCard> = {}): RemoteCard => ({
  id: c.id, status: 'active', content_hash: cardHash('k1', c), reviewed_at: null, ...over,
})

const plan = (bank: Bank, remote: RemoteCard[], reported: string[] = []) => planUpload(bank, remote, new Set(reported), TODAY)

test('new card is inserted with its own status', () => {
  const c = card({ status: 'flagged', verifyNote: 'n' })
  const r = plan(bankOf(c), [])
  expect(r.writes).toHaveLength(1)
  expect(r.writes[0]).toMatchObject({ id: 'c1', kind: 'insert' })
  expect(r.writes[0].row).toMatchObject({ id: 'c1', concept_id: 'k1', course_id: 'T', status: 'flagged', verify_note: 'n', content_hash: cardHash('k1', c) })
  expect(r.summary.inserted).toBe(1)
})

test('unchanged card is skipped even if remote status/content differ', () => {
  const c = card()
  for (const status of ['rejected', 'retired', 'flagged'] as const) {
    const r = plan(bankOf(c), [remoteOf(c, { status, reviewed_at: '2026-01-01' })])
    expect(r.writes).toEqual([])
    expect(r.skipped).toBe(1)
  }
})

test('unchanged verifier-flagged card is released when it now passes', () => {
  const c = card()
  const r = plan(bankOf(c), [remoteOf(c, { status: 'flagged' })])
  expect(r.writes).toEqual([{ id: 'c1', kind: 'release', row: { id: 'c1', status: 'active', verify_note: null } }])
  expect(r.summary.released).toBe(1)
})

test('unchanged flagged card that was reported is not released', () => {
  const c = card()
  expect(plan(bankOf(c), [remoteOf(c, { status: 'flagged' })], ['c1']).writes).toEqual([])
  expect(plan(bankOf(c), [remoteOf(c, { status: 'flagged', reviewed_at: '2026-01-01' })]).writes).toEqual([])
})

test('changed reported card is requeued, not activated', () => {
  const c = card({ promptMd: 'new', verifyNote: 'v' })
  const r = plan(bankOf(c), [remoteOf(card(), { status: 'active' })], ['c1'])
  expect(r.writes[0].kind).toBe('update')
  expect(r.writes[0].row.status).toBe('flagged')
  expect(r.writes[0].row.verify_note).toBe('Ändrad av kursbank-körning 2026-11-02 – granska. v')
  expect(r.summary.requeued).toBe(1)
  expect(r.summary.updated).toBe(0)
})

test('changed rejected card is requeued', () => {
  const c = card({ promptMd: 'new' })
  const r = plan(bankOf(c), [remoteOf(card(), { status: 'rejected' })])
  expect(r.writes[0].row.status).toBe('flagged')
  expect(r.writes[0].row.verify_note).toBe('Ändrad av kursbank-körning 2026-11-02 – granska. ')
  expect(r.summary.requeued).toBe(1)
})

test('approved card rewritten and failing → flagged and counted as requeued', () => {
  const c = card({ promptMd: 'new', status: 'flagged', verifyNote: 'fel' })
  const r = plan(bankOf(c), [remoteOf(card(), { status: 'active', reviewed_at: '2026-01-01' })])
  expect(r.writes[0].row).toMatchObject({ status: 'flagged', verify_note: 'fel' })
  expect(r.summary.requeued).toBe(1)
  // plain change without review: ordinary update
  const r2 = plan(bankOf(card({ promptMd: 'new' })), [remoteOf(card())])
  expect(r2.writes[0]).toMatchObject({ kind: 'update', row: { status: 'active' } })
  expect(r2.summary).toMatchObject({ updated: 1, requeued: 0 })
})

test('remote card missing locally is untouched and listed', () => {
  const c = card()
  const gone = { id: 'old', status: 'active', content_hash: 'x', reviewed_at: null } as RemoteCard
  const r = plan(bankOf(c), [remoteOf(c), gone])
  expect(r.writes).toEqual([])
  expect(r.summary.untouchedMissingLocally).toEqual(['old'])
})

test('cardHash ignores status and verifyNote but changes with promptMd', () => {
  const a = card()
  expect(cardHash('k1', card({ status: 'flagged', verifyNote: 'x' }))).toBe(cardHash('k1', a))
  expect(cardHash('k1', card({ promptMd: 'other' }))).not.toBe(cardHash('k1', a))
  expect(cardHash('k2', a)).not.toBe(cardHash('k1', a))
  const { id, ...rest } = a
  expect(cardHash('k1', { ...rest, id } as Card)).toBe(cardHash('k1', a))
})

test('answer.check is never part of the hash or row', () => {
  const a = card({ type: 'calc', answerMode: 'numeric', steps: ['s'], answer: { value: 1, tolerance: 0.1, unit: 'm', check: 'N' } })
  const b = card({ type: 'calc', answerMode: 'numeric', steps: ['s'], answer: { value: 1, tolerance: 0.1, unit: 'm', check: 'N+1' } })
  expect(cardHash('k1', a)).toBe(cardHash('k1', b))
  const row = plan(bankOf(a), []).writes[0].row
  expect(row).toMatchObject({ answer_value: 1, answer_tolerance: 0.1, answer_unit: 'm' })
  expect(JSON.stringify(row)).not.toContain('"check"')
})

test('idsOutsideCoursePrefix lists ids lacking the course prefix', () => {
  const ok = card({ id: 't-c1' })
  const bad = card({ id: 'other-c2' })
  const bank = bankOf(ok, bad)
  bank.course.id = 'T'
  bank.concepts[0].id = 'k1'
  expect(idsOutsideCoursePrefix(bank)).toEqual(['k1', 'other-c2'])
  bank.concepts[0].id = 't-k1'
  bank.concepts[0].cards[1].id = 't-c2'
  expect(idsOutsideCoursePrefix(bank)).toEqual([])
})

test('nextPublishedIds heals after a crashed run: batch-1 inserts are recorded on re-run', () => {
  const bank = bankOf(card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' }))
  // first run inserted a and b remotely, then crashed before published-ids was written; c never landed
  const rerun = nextPublishedIds([], bank, new Set(['a', 'b', 'unrelated']), ['k1', 'c'])
  expect(rerun).toEqual(['a', 'b', 'c', 'k1'].sort())
  // zero writes still heals; existing entries are kept, no duplicates
  expect(nextPublishedIds(['z', 'a'], bank, new Set(['a', 'k1']), [])).toEqual(['a', 'k1', 'z'])
})

test('unchanged card retired locally is retired remotely (even if reported/approved)', () => {
  const c = card({ status: 'retired' })
  const r = plan(bankOf(c), [remoteOf(c, { status: 'active', reviewed_at: '2026-01-01' })], ['c1'])
  expect(r.writes).toEqual([{ id: 'c1', kind: 'retire', row: { id: 'c1', status: 'retired' } }])
  expect(r.summary.retired).toBe(1)
  expect(plan(bankOf(c), [remoteOf(c, { status: 'flagged' })]).writes[0].kind).toBe('retire')
})

test('already-retired remote card is skipped', () => {
  const c = card({ status: 'retired' })
  const r = plan(bankOf(c), [remoteOf(c, { status: 'retired' })])
  expect(r.writes).toEqual([])
  expect(r.skipped).toBe(1)
})

test('splitWrites sends release and retire as status-only, not full rows', () => {
  const w = [
    { id: 'a', kind: 'insert', row: {} }, { id: 'b', kind: 'update', row: {} },
    { id: 'c', kind: 'release', row: {} }, { id: 'd', kind: 'retire', row: {} },
  ] as const
  const { full, statusOnly } = splitWrites([...w])
  expect(full.map((x) => x.id)).toEqual(['a', 'b'])
  expect(statusOnly.map((x) => x.id)).toEqual(['c', 'd'])
})

test('unchanged card newly flagged locally is demoted remotely (status-only)', () => {
  const c = card({ status: 'flagged', verifyNote: 'begreppet ändrat' })
  const r = plan(bankOf(c), [remoteOf(c, { status: 'active' })])
  expect(r.writes).toEqual([{ id: 'c1', kind: 'demote', row: { id: 'c1', status: 'flagged', verify_note: 'begreppet ändrat' } }])
  expect(r.summary.demoted).toBe(1)
})

test('reviewed card is never demoted', () => {
  const c = card({ status: 'flagged', verifyNote: 'x' })
  const r = plan(bankOf(c), [remoteOf(c, { status: 'active', reviewed_at: '2026-01-01' })])
  expect(r.writes).toEqual([])
  expect(r.summary.demoted).toBe(0)
  expect(r.skipped).toBe(1)
})

test('splitWrites sends demote as status-only', () => {
  const { full, statusOnly } = splitWrites([{ id: 'a', kind: 'demote', row: {} }])
  expect(full).toEqual([])
  expect(statusOnly.map((x) => x.id)).toEqual(['a'])
})

test('admin-edited card is never overwritten on content change and is listed', () => {
  const c = card({ promptMd: 'ny lokal text' })
  const r = plan(bankOf(c), [remoteOf(card(), { content_hash: 'admin-edited', reviewed_at: '2026-01-01' })], ['c1'])
  expect(r.writes).toEqual([])
  expect(r.skipped).toBe(1)
  expect(r.summary.adminEditedSkipped).toEqual(['c1'])
  expect(r.summary).toMatchObject({ updated: 0, requeued: 0 })
})

test('admin-edited card can still be retired (status-only)', () => {
  const c = card({ status: 'retired' })
  const r = plan(bankOf(c), [remoteOf(c, { content_hash: 'admin-edited', reviewed_at: '2026-01-01' })])
  expect(r.writes).toEqual([{ id: 'c1', kind: 'retire', row: { id: 'c1', status: 'retired' } }])
  expect(r.summary.adminEditedSkipped).toEqual([])
  expect(plan(bankOf(c), [remoteOf(c, { content_hash: 'admin-edited', status: 'retired' })]).writes).toEqual([])
})
