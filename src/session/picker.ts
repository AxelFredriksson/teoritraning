import type { CardRow, CardState, ConceptRow } from '../types'

export interface PickFilter {
  lecture?: number
  conceptId?: string
  unseenOnly?: boolean
  exclude?: Set<string>
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
    if (filter.lecture !== undefined && byId.get(c.concept_id)?.lecture !== filter.lecture) return false
    return true
  })
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
