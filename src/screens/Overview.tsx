import type { CourseData } from '../data/api'
import { MathInline } from '../math/MathText'
import type { PickFilter } from '../session/picker'
import type { CardRow, CardState } from '../types'

export type Mastery = 'new' | 'learning' | 'mastered'

const REVIEW_STATE = 2 // ts-fsrs State.Review
const STABLE_DAYS = 7

const isStable = (s: CardState | undefined) =>
  !!s && (s.fsrs as { state?: number }).state === REVIEW_STATE && Number((s.fsrs as { stability?: number }).stability ?? 0) >= STABLE_DAYS

export function conceptMastery(cards: CardRow[], states: Map<string, CardState>): Mastery {
  const active = cards.filter((c) => c.status === 'active')
  if (active.length === 0 || active.every((c) => !states.has(c.id))) return 'new'
  return active.every((c) => isStable(states.get(c.id))) ? 'mastered' : 'learning'
}

const LABEL: Record<Mastery, string> = { new: 'Ny', learning: 'På gång', mastered: 'Sitter' }
const DOT: Record<Mastery, string> = { new: 'var(--line)', learning: 'var(--learning)', mastered: 'var(--mastered)' }

export function Overview({ data, onBack, onPractice }: { data: CourseData; onBack: () => void; onPractice: (f: PickFilter) => void }) {
  const byConcept = new Map<string, CardRow[]>()
  for (const c of data.cards) byConcept.set(c.concept_id, [...(byConcept.get(c.concept_id) ?? []), c])
  const rows = data.concepts
    .map((k) => ({ k, cards: byConcept.get(k.id) ?? [], m: conceptMastery(byConcept.get(k.id) ?? [], data.states) }))
    .sort((a, b) => a.k.lecture - b.k.lecture || a.k.title.localeCompare(b.k.title, 'sv', { numeric: true }))
  const totals = { new: 0, learning: 0, mastered: 0 }
  rows.forEach((r) => totals[r.m]++)
  const pct = (n: number) => `${rows.length ? (100 * n) / rows.length : 0}%`
  const lectures = [...new Set(rows.map((r) => r.k.lecture))]

  return (
    <main className="screen">
      <div className="row">
        <button className="btn" onClick={onBack} aria-label="Tillbaka">Tillbaka</button>
        <h1>Översikt</h1>
      </div>
      <div className="panel stack" style={{ padding: 16 }}>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: DOT.new }}>
          <span style={{ width: pct(totals.mastered), background: DOT.mastered }} />
          <span style={{ width: pct(totals.learning), background: DOT.learning }} />
        </div>
        <div className="row muted">
          <span><b>{totals.mastered}</b> sitter</span>
          <span><b>{totals.learning}</b> på gång</span>
          <span><b>{totals.new}</b> nya</span>
        </div>
      </div>
      {lectures.map((l) => (
        <section key={l} className="stack">
          <h2 className="muted" style={{ fontSize: 14 }}>Föreläsning {l}</h2>
          {rows.filter((r) => r.k.lecture === l).map(({ k, cards, m }) => (
            <button key={k.id} className="row-btn" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onClick={() => onPractice({ conceptId: k.id })}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: DOT[m], flex: '0 0 auto' }} />
              <span className="stack" style={{ gap: 2, flex: '1 1 auto' }}>
                <span className="row-title"><MathInline md={k.title} /></span>
                <span className="muted">{LABEL[m]} · {cards.length} kort</span>
              </span>
              {k.exam_count <= 1 ? <span className="tag rare">Sällsynt</span> : <span className="mono muted">{k.exam_count} tentor</span>}
            </button>
          ))}
        </section>
      ))}
    </main>
  )
}
