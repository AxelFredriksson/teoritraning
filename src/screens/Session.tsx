import { useMemo, useState } from 'react'
import { CalcCard } from '../cards/CalcCard'
import { FindErrorCard } from '../cards/FindErrorCard'
import { TYPE_LABEL } from '../cards/labels'
import { McCard } from '../cards/McCard'
import { OpenCard } from '../cards/OpenCard'
import { ResultBox } from '../cards/SelfGrade'
import type { Api, CourseData, Stats } from '../data/api'
import { LEVEL_LABEL } from '../game/levels'
import { nextStreak, pointsFor } from '../game/points'
import { MathInline, MathText } from '../math/MathText'
import { pickNext, type PickFilter } from '../session/picker'
import { schedule } from '../srs/scheduler'
import type { CardRow, CardState, Verdict } from '../types'

export type SessionApi = Pick<Api, 'saveReview' | 'reportCard' | 'gradeOpen'>


export function Session({ data, filter, api, onExit }: { data: CourseData; filter: PickFilter; api: SessionApi; onExit: () => void }) {
  const [states, setStates] = useState<Map<string, CardState>>(() => new Map(data.states))
  const [stats, setStats] = useState<Stats>(data.stats)
  // Cards shown this session in order; pos points at the one on screen. Lets the user step back and forth.
  const [trail, setTrail] = useState<string[]>(() => {
    const first = pickNext(data.cards, data.concepts, data.states, new Date(), filter)
    return first ? [first.id] : []
  })
  const [pos, setPos] = useState(0)
  const [results, setResults] = useState<Map<number, { verdict: Verdict; points: number }>>(() => new Map())
  const [removed, setRemoved] = useState<Set<string>>(() => new Set())
  const [reporting, setReporting] = useState(false)
  const [reportNote, setReportNote] = useState('')
  const [showSource, setShowSource] = useState(false)
  // position answered during the current visit (card UI stays as the card left it); revisits show a summary
  const [answeredHere, setAnsweredHere] = useState<number | null>(null)
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600
  const conceptById = useMemo(() => new Map(data.concepts.map((k) => [k.id, k])), [data.concepts])
  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards])

  const current: CardRow | null = trail[pos] !== undefined ? (cardById.get(trail[pos]) ?? null) : null
  const answered = results.get(pos) ?? null
  const count = results.size

  function resetPanels() {
    setAnsweredHere(null)
    setShowSource(false)
    setReporting(false)
    setReportNote('')
  }

  /** Forward: along the trail if we stepped back, otherwise a fresh card. */
  function next(nextStates = states, nextRemoved = removed, nextTrail = trail, from = pos, nextResults = results) {
    resetPanels()
    if (from + 1 < nextTrail.length) {
      setPos(from + 1)
      return
    }
    // cards already on the trail and unanswered (skipped) are not picked again
    const answeredIds = new Set([...nextResults.keys()].map((i) => nextTrail[i]))
    const exclude = new Set([...nextRemoved, ...nextTrail.filter((id) => !answeredIds.has(id))])
    const card = pickNext(data.cards, data.concepts, nextStates, new Date(), { ...filter, exclude })
    if (card) {
      setTrail([...nextTrail, card.id])
      setPos(nextTrail.length)
    } else {
      setTrail(nextTrail)
      setPos(nextTrail.length) // past the end: "no more cards"
    }
  }

  function previous() {
    resetPanels()
    setPos((p) => Math.max(0, p - 1))
  }

  function answer(card: CardRow, verdict: Verdict, source: 'ai' | 'mc' | 'self') {
    const now = new Date()
    const state = schedule(states.get(card.id) ?? null, verdict, now)
    const points = pointsFor(verdict, card.type)
    const s = nextStreak({ streak: stats.streak, lastActive: stats.lastActive }, now)
    const newStats = { points: stats.points + points, streak: s.streak, lastActive: s.lastActive }
    setStates(new Map(states).set(card.id, state))
    setStats(newStats)
    setResults(new Map(results).set(pos, { verdict, points }))
    setAnsweredHere(pos)
    void api.saveReview({ cardId: card.id, verdict, source, state, stats: newStats })
  }

  async function report(card: CardRow) {
    try {
      await api.reportCard(card.id, reportNote)
    } catch {
      // the card is skipped locally even if the report could not be sent
    }
    const rem = new Set(removed).add(card.id)
    setRemoved(rem)
    // drop the reported card from the trail and continue from where it was
    const t = trail.filter((_, i) => i !== pos)
    const r = new Map([...results].filter(([i]) => i !== pos).map(([i, v]) => [i > pos ? i - 1 : i, v] as const))
    setResults(r)
    next(states, rem, t, pos - 1, r)
  }

  const header = (
    <div className="row">
      <button className="btn" onClick={onExit}>‹ Avsluta</button>
      <span className="spacer" />
      <span className="mono streak">{stats.streak} dgr</span>
      <span className="mono points">{stats.points} p</span>
    </div>
  )

  if (!current) {
    return (
      <main className="screen">
        {header}
        <div className="panel stack">
          <h2>Inga fler kort just nu</h2>
          <p className="muted">Du svarade på {count} kort det här passet. Nya repetitioner dyker upp när de är dags.</p>
          <button className="btn primary" onClick={onExit}>Tillbaka</button>
        </div>
      </main>
    )
  }

  const justAnswered = answeredHere === pos
  const revisit = answered !== null
  const concept = conceptById.get(current.concept_id)
  const rare = (concept?.exam_count ?? 0) <= 1
  const onAnswer = (v: Verdict, source: 'ai' | 'mc' | 'self') => answer(current, v, source)

  return (
    <main className="screen">
      {header}
      <div className="row">
        <span className="tag">{TYPE_LABEL[current.type]}</span>
        <span className="tag plain">{LEVEL_LABEL[current.level ?? 2]}</span>
        {rare && <span className="tag rare">Sällsynt · {concept?.exam_count ?? 0} tentor</span>}
        {concept && <span className="tag plain">F{concept.lecture}</span>}
      </div>
      <section className="panel stack" style={{ gap: 6 }}>
        <h2 className="muted" style={{ fontSize: 14, fontWeight: 500 }}><MathInline md={concept?.title ?? ''} /> · {TYPE_LABEL[current.type]}</h2>
        <div style={{ fontSize: 18, fontWeight: 500 }}><MathText md={current.prompt_md} /></div>
      </section>

      <div key={`${pos}-${current.id}`}>
        {revisit && !justAnswered ? (
          <div className="stack">
            <p className="muted">Redan besvarad i det här passet.</p>
            <div className="panel"><span className="muted">Referenssvar</span><MathText md={current.reference_answer_md} /></div>
          </div>
        ) : current.type === 'calc' ? (
          <CalcCard card={current} narrow={narrow} gradeOpen={api.gradeOpen} onAnswer={onAnswer} />
        ) : current.type === 'find_error' ? (
          <FindErrorCard card={current} gradeOpen={api.gradeOpen} onAnswer={onAnswer} />
        ) : current.answer_mode === 'mc' ? (
          <McCard card={current} onAnswer={(v) => onAnswer(v, 'mc')} />
        ) : (
          <OpenCard card={current} narrow={narrow} gradeOpen={api.gradeOpen} onAnswer={onAnswer} />
        )}
      </div>

      {answered && justAnswered && current.answer_mode === 'mc' && current.type !== 'find_error' && current.type !== 'calc' && (
        <div className="panel"><span className="muted">Förklaring</span><MathText md={current.reference_answer_md} /></div>
      )}
      {answered && <ResultBox verdict={answered.verdict} points={answered.points} />}

      {showSource && (
        <p className="muted">Källa: {current.source_ref}{current.exam_ref ? ` · Tenta ${current.exam_ref}` : ''}</p>
      )}

      {reporting && (
        <div className="panel stack">
          <label htmlFor="report-note">Vad är fel?</label>
          <textarea id="report-note" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
          <div className="row">
            <button className="btn" onClick={() => report(current)}>Skicka rapport</button>
            <button className="btn ghost" onClick={() => setReporting(false)}>Avbryt</button>
          </div>
        </div>
      )}

      <div className="spacer" />
      <div className="row">
        <button className="btn ghost" onClick={() => setShowSource((v) => !v)}>Visa källa</button>
        <button className="btn ghost" onClick={() => setReporting(true)}>Rapportera fel</button>
        <span className="spacer" />
        {pos > 0 && <button className="btn" onClick={previous}>‹ Föregående</button>}
        {!answered && <button className="btn" onClick={() => next()}>Hoppa över ›</button>}
        {answered && <button className="btn primary" onClick={() => next()}>Nästa kort ›</button>}
      </div>
    </main>
  )
}
