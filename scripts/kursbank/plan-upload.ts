// Pure upload planner: decides per card what to write, so review decisions in the DB are never overwritten.
import { createHash } from 'node:crypto'
import type { Bank, Card } from '../../src/bank/schema'

export type RemoteCard = {
  id: string
  status: 'active' | 'flagged' | 'rejected' | 'retired'
  content_hash: string | null
  reviewed_at: string | null
}
export type CardWrite = { id: string; row: Record<string, unknown>; kind: 'insert' | 'update' | 'release' | 'retire' | 'demote' }
export type UploadPlan = {
  writes: CardWrite[]
  skipped: number
  summary: {
    inserted: number; updated: number; requeued: number; released: number; retired: number; demoted: number
    untouchedMissingLocally: string[]
  }
}

/** Every uploaded content field (snake_case DB columns) except status/verify_note/content_hash. `answer.check` is never uploaded. */
function contentRow(conceptId: string, courseId: string, c: Card): Record<string, unknown> {
  return {
    id: c.id,
    concept_id: conceptId,
    course_id: courseId,
    type: c.type,
    answer_mode: c.answerMode,
    prompt_md: c.promptMd,
    choices: c.choices ?? null,
    correct: c.correct ?? null,
    reference_answer_md: c.referenceAnswerMd,
    rubric_md: c.rubricMd ?? null,
    steps: c.steps ?? null,
    error_step: c.errorStep ?? null,
    source_ref: c.sourceRef,
    exam_ref: c.examRef ?? null,
    title: c.title ?? null,
    level: c.level,
    answer_value: c.answer?.value ?? null,
    answer_tolerance: c.answer?.tolerance ?? null,
    answer_unit: c.answer?.unit ?? null,
  }
}

function stableJson(v: unknown): string {
  if (v === undefined || v === null) return 'null'
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

// course_id is deliberately not hashed: concept_id already scopes the card.
export function cardHash(conceptId: string, c: Card): string {
  const row = contentRow(conceptId, '', c)
  delete row.course_id
  return createHash('sha256').update(stableJson(row)).digest('hex')
}

export function planUpload(bank: Bank, remote: RemoteCard[], reportedIds: Set<string>, today: string): UploadPlan {
  const byId = new Map(remote.map((r) => [r.id, r]))
  const writes: CardWrite[] = []
  const summary = { inserted: 0, updated: 0, requeued: 0, released: 0, retired: 0, demoted: 0, untouchedMissingLocally: [] as string[] }
  let skipped = 0
  const localIds = new Set<string>()

  for (const k of bank.concepts) {
    for (const c of k.cards) {
      localIds.add(c.id)
      const hash = cardHash(k.id, c)
      const full = (status: string, verifyNote: string | null) => ({
        ...contentRow(k.id, bank.course.id, c), status, verify_note: verifyNote, content_hash: hash,
      })
      const r = byId.get(c.id)

      if (!r) {
        writes.push({ id: c.id, kind: 'insert', row: full(c.status, c.verifyNote ?? null) })
        summary.inserted++
      } else if (r.content_hash === hash) {
        if (c.status === 'retired' && r.status !== 'retired') {
          writes.push({ id: c.id, kind: 'retire', row: { id: c.id, status: 'retired' } })
          summary.retired++
        } else if (r.status === 'flagged' && c.status === 'active' && !reportedIds.has(c.id) && r.reviewed_at == null) {
          writes.push({ id: c.id, kind: 'release', row: { id: c.id, status: 'active', verify_note: c.verifyNote ?? null } })
          summary.released++
        } else if (c.status === 'flagged' && r.status === 'active' && r.reviewed_at == null) {
          // e.g. its concept changed and the re-verification failed; a card Axel approved is never re-flagged
          writes.push({ id: c.id, kind: 'demote', row: { id: c.id, status: 'flagged', verify_note: c.verifyNote ?? null } })
          summary.demoted++
        } else skipped++
      } else if (reportedIds.has(c.id) || r.status === 'rejected') {
        writes.push({
          id: c.id,
          kind: 'update',
          row: full('flagged', 'Ändrad av kursbank-körning ' + today + ' – granska. ' + (c.verifyNote ?? '')),
        })
        summary.requeued++
      } else {
        writes.push({ id: c.id, kind: 'update', row: full(c.status, c.verifyNote ?? null) })
        if (r.reviewed_at != null && c.status === 'flagged') summary.requeued++
        else summary.updated++
      }
    }
  }
  summary.untouchedMissingLocally = remote.filter((r) => !localIds.has(r.id)).map((r) => r.id)
  return { writes, skipped, summary }
}

/** Ids are global primary keys, so every bank id must carry the course prefix or it could overwrite another course's row. */
export function idsOutsideCoursePrefix(bank: Bank): string[] {
  const prefix = `${bank.course.id.toLowerCase()}-`
  const ids = bank.concepts.flatMap((k) => [k.id, ...k.cards.map((c) => c.id)])
  return ids.filter((id) => !id.startsWith(prefix))
}

/**
 * published-ids.json after a run: existing ∪ local ids already present remotely (heals a crashed earlier run)
 * ∪ ids written now. Sorted and de-duplicated.
 */
export function nextPublishedIds(existing: string[], bank: Bank, remoteIds: Set<string>, writtenIds: string[]): string[] {
  const local = bank.concepts.flatMap((k) => [k.id, ...k.cards.map((c) => c.id)])
  return [...new Set([...existing, ...local.filter((id) => remoteIds.has(id)), ...writtenIds])].sort()
}

/** Splits writes into full-row upserts and status-only updates (release/retire/demote), which must not overwrite content. */
export function splitWrites(writes: CardWrite[]): { full: CardWrite[]; statusOnly: CardWrite[] } {
  const isStatusOnly = (w: CardWrite) => w.kind === 'release' || w.kind === 'retire' || w.kind === 'demote'
  return { full: writes.filter((w) => !isStatusOnly(w)), statusOnly: writes.filter(isStatusOnly) }
}
