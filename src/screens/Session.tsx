import { useMemo, useState } from 'react'
import { FindErrorCard } from '../cards/FindErrorCard'
import { McCard } from '../cards/McCard'
import { OpenCard } from '../cards/OpenCard'
import { ResultBox } from '../cards/SelfGrade'
import type { Api, CourseData, Stats } from '../data/api'
import { nextStreak, pointsFor } from '../game/points'
import { MathInline, MathText } from '../math/MathText'
import { pickNext, type PickFilter } from '../session/picker'
import { schedule } from '../srs/scheduler'
import type { CardRow, CardState, CardType, Verdict } from '../types'

export type SessionApi = Pick<Api, 'saveReview' | 'reportCard' | 'gradeOpen'>

const TYPE_LABEL: Record<CardType, string> = {
  content: 'Innehåll',
  conditions: 'Villkor',
  recognition: 'Igenkänning',
  find_error: 'Hitta felet',
}

export function Session({ data, filter, api, onExit }: { data: CourseData; filter: PickFilter; api: SessionApi; onExit: () => void }) {
  const [states, setStates] = useState<Map<string, CardState>>(() => new Map(data.states))
  const [stats, setStats] = useState<Stats>(data.stats)
  const [exclude, setExclude] = useState<Set<string>>(() => new Set())
  const [current, setCurrent] = useState<CardRow | null>(() => pickNext(data.cards, data.concepts, data.states, new Date(), filter))
  const [answered, setAnswered] = useState<{ verdict: Verdict; points: number } | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reportNote, setReportNote] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [count, setCount] = useState(0)
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600
  const conceptById = useMemo(() => new Map(data.concepts.map((k) => [k.id, k])), [data.concepts])

  function advance(nextStates = states, nextExclude = exclude) {
    setAnswered(null)
    setShowSource(false)
    setReporting(false)
    setReportNote('')
    setCurrent(pickNext(data.cards, data.concepts, nextStates, new Date(), { ...filter, exclude: nextExclude }))
  }

  function answer(card: CardRow, verdict: Verdict, source: 'ai' | 'mc' | 'self') {
    const now = new Date()
    const state = schedule(states.get(card.id) ?? null, verdict, now)
    const points = pointsFor(verdict, card.type)
    const s = nextStreak({ streak: stats.streak, lastActive: stats.lastActive }, now)
    const newStats = { points: stats.points + points, streak: s.streak, lastActive: s.lastActive }
    const newStates = new Map(states).set(card.id, state)
    setStates(newStates)
    setStats(newStats)
    setAnswered({ verdict, points })
    setCount((c) => c + 1)
    void api.saveReview({ cardId: card.id, verdict, source, state, stats: newStats })
  }

  async function report(card: CardRow) {
    try {
      await api.reportCard(card.id, reportNote)
    } catch {
      // the card is skipped locally even if the report could not be sent
    }
    const ex = new Set(exclude).add(card.id)
    setExclude(ex)
    advance(states, ex)
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

  const concept = conceptById.get(current.concept_id)
  const rare = (concept?.exam_count ?? 0) <= 1
  const onAnswer = (v: Verdict, source: 'ai' | 'mc' | 'self') => answer(current, v, source)

  return (
    <main className="screen">
      {header}
      <div className="row">
        <span className="tag">{TYPE_LABEL[current.type]}</span>
        {rare && <span className="tag rare">Sällsynt · {concept?.exam_count ?? 0} tentor</span>}
        {concept && <span className="tag plain">F{concept.lecture}</span>}
      </div>
      <section className="panel stack" style={{ gap: 6 }}>
        <h2 className="muted" style={{ fontSize: 14, fontWeight: 500 }}><MathInline md={concept?.title ?? ''} /> · {TYPE_LABEL[current.type]}</h2>
        <div style={{ fontSize: 18, fontWeight: 500 }}><MathText md={current.prompt_md} /></div>
      </section>

      <div key={current.id}>
        {current.type === 'find_error' ? (
          <FindErrorCard card={current} gradeOpen={api.gradeOpen} onAnswer={onAnswer} />
        ) : current.answer_mode === 'mc' ? (
          <McCard card={current} onAnswer={(v) => onAnswer(v, 'mc')} />
        ) : (
          <OpenCard card={current} narrow={narrow} gradeOpen={api.gradeOpen} onAnswer={onAnswer} />
        )}
      </div>

      {answered && current.answer_mode === 'mc' && current.type !== 'find_error' && (
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
        {answered && <button className="btn primary" onClick={() => advance()}>Nästa kort</button>}
      </div>
    </main>
  )
}
