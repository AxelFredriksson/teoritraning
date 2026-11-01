import { useState } from 'react'
import { TYPE_LABEL } from '../cards/labels'
import type { CourseData } from '../data/api'
import { LEVEL_LABEL } from '../game/levels'
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

export function Overview({
  data,
  onBack,
  onPractice,
  onReset,
}: {
  data: CourseData
  onBack: () => void
  onPractice: (f: PickFilter) => void
  onReset?: () => Promise<void>
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetState, setResetState] = useState<'idle' | 'busy' | 'error'>('idle')
  const byConcept = new Map<string, CardRow[]>()
  for (const c of data.cards) byConcept.set(c.concept_id, [...(byConcept.get(c.concept_id) ?? []), c])
  const rows = data.concepts
    .map((k) => ({ k, cards: byConcept.get(k.id) ?? [], m: conceptMastery(byConcept.get(k.id) ?? [], data.states) }))
    .sort((a, b) => a.k.lecture - b.k.lecture || a.k.title.localeCompare(b.k.title, 'sv', { numeric: true }))
  const totals = { new: 0, learning: 0, mastered: 0 }
  rows.forEach((r) => totals[r.m]++)
  const pct = (n: number) => `${rows.length ? (100 * n) / rows.length : 0}%`
  const lectures = [...new Set(rows.map((r) => r.k.lecture))]
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const cardMastery = (c: CardRow): Mastery => (!data.states.has(c.id) ? 'new' : isStable(data.states.get(c.id)) ? 'mastered' : 'learning')

  return (
    <main className="screen">
      <div className="row">
        <button className="btn" onClick={onBack} >‹ Tillbaka</button>
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
            <div key={k.id} className="concept">
              <button
                className="row-btn"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}
                aria-expanded={open.has(k.id)}
                aria-controls={`cards-${k.id}`}
                onClick={() => toggle(k.id)}
              >
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: DOT[m], flex: '0 0 auto' }} />
                <span className="stack" style={{ gap: 2, flex: '1 1 auto' }}>
                  <span className="row-title"><MathInline md={k.title} /></span>
                  <span className="muted">{LABEL[m]} · {cards.length} kort</span>
                </span>
                {k.exam_count <= 1 ? <span className="tag rare">Sällsynt</span> : <span className="mono muted">{k.exam_count} tentor</span>}
                <span aria-hidden="true" className="chevron">{open.has(k.id) ? '▾' : '▸'}</span>
              </button>
              {open.has(k.id) && (
                <div className="concept-cards" id={`cards-${k.id}`}>
                  <ul aria-label={`Kort i ${k.title}`}>
                    {cards.map((c) => (
                      <li key={c.id}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: DOT[cardMastery(c)], flex: '0 0 auto' }} />
                        <span className="card-title">
                          <MathInline md={c.title ?? c.prompt_md.slice(0, 80)} />
                          {c.status !== 'active' && <span className="muted"> (avstängt)</span>}
                        </span>
                        <span className="tag">{TYPE_LABEL[c.type]}</span>
                        <span className="tag plain">{LEVEL_LABEL[c.level ?? 2]}</span>
                      </li>
                    ))}
                  </ul>
                  <button className="btn" onClick={() => onPractice({ conceptId: k.id })}>Öva på det här begreppet</button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
      {onReset && (
        <section className="panel stack danger-zone">
          <h2 style={{ fontSize: 16 }}>Börja om</h2>
          {!confirmReset ? (
            <>
              <span className="muted">Nollställer alla repetitioner och svar för kursen. Poäng och streak behålls.</span>
              <button className="btn" onClick={() => setConfirmReset(true)}>Återställ framsteg</button>
            </>
          ) : (
            <>
              <p role="alert" className="alert">Alla kort i kursen blir nya igen. Det går inte att ångra.</p>
              <div className="row">
                <button
                  className="btn danger"
                  disabled={resetState === 'busy'}
                  onClick={async () => {
                    setResetState('busy')
                    try {
                      await onReset()
                      setConfirmReset(false)
                      setResetState('idle')
                    } catch {
                      setResetState('error')
                    }
                  }}
                >
                  {resetState === 'busy' ? 'Återställer…' : 'Ja, återställ'}
                </button>
                <button className="btn ghost" onClick={() => { setConfirmReset(false); setResetState('idle') }}>Avbryt</button>
              </div>
              {resetState === 'error' && <p className="alert">Kunde inte återställa. Försök igen.</p>}
            </>
          )}
        </section>
      )}
    </main>
  )
}
