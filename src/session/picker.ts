import type { CardRow, CardState, ConceptRow } from '../types'

export interface PickFilter {
  lecture?: number
  conceptId?: string
  unseenOnly?: boolean
  exclude?: Set<string>
  /** Cards answered earlier in this session; skipped by the wrong-answers-first tier. */
  answered?: Set<string>
  /** Only cards at or below this level (1 Grund … 3 Avancerat). */
  maxLevel?: number
}

export function pickNext(
  cards: CardRow[],
  concepts: ConceptRow[],
  states: Map<string, CardState>,
  now: Date,
  filter: PickFilter,
): CardRow | null {
  const byId = new Map(concepts.map((c) => [c.id, c]))
  const pool = cards.filter((c) => {
    if (c.status !== 'active' || filter.exclude?.has(c.id)) return false
    if (filter.conceptId && c.concept_id !== filter.conceptId) return false
    if (filter.maxLevel !== undefined && (c.level ?? 2) > filter.maxLevel) return false
    if (filter.lecture !== undefined && byId.get(c.concept_id)?.lecture !== filter.lecture) return false
    return true
  })
  if (!filter.unseenOnly && (filter.lecture !== undefined || filter.conceptId)) {
    // practising a lecture or concept: earlier wrong answers first, regardless of due time
    const rank = (c: CardRow) => (states.get(c.id)?.lastVerdict === 'incorrect' ? 0 : 1)
    const wrong = pool
      .filter((c) => {
        const v = states.get(c.id)?.lastVerdict
        return (v === 'incorrect' || v === 'partial') && !filter.answered?.has(c.id)
      })
      .sort((a, b) => rank(a) - rank(b) || states.get(a.id)!.due.localeCompare(states.get(b.id)!.due))
    if (wrong.length) return wrong[0]
  }
  if (!filter.unseenOnly) {
    const due = pool
      .filter((c) => states.has(c.id) && new Date(states.get(c.id)!.due) <= now)
      .sort((a, b) => states.get(a.id)!.due.localeCompare(states.get(b.id)!.due))
    if (due.length) return due[0]
  }
  const unseen = pool
    .filter((c) => !states.has(c.id))
    .sort((a, b) => {
      const ka = byId.get(a.concept_id), kb = byId.get(b.concept_id)
      return (ka?.exam_count ?? 0) - (kb?.exam_count ?? 0) || (ka?.lecture ?? 0) - (kb?.lecture ?? 0)
    })
  return unseen[0] ?? null
}
