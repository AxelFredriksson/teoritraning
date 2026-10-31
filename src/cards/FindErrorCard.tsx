import { useState } from 'react'
import { MathText } from '../math/MathText'
import type { CardRow, GradeResult, Verdict } from '../types'

export function FindErrorCard({
  card,
  gradeOpen,
  onAnswer,
}: {
  card: CardRow
  gradeOpen: (cardId: string, input: { text?: string }) => Promise<GradeResult>
  onAnswer: (v: Verdict, source: 'ai' | 'mc') => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [why, setWhy] = useState('')
  const [done, setDone] = useState<null | { verdict: Verdict; feedback?: string }>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (picked === null) return
    if (picked !== card.error_step) {
      setDone({ verdict: 'incorrect' })
      onAnswer('incorrect', 'mc')
      return
    }
    if (!why.trim()) {
      setDone({ verdict: 'correct' })
      onAnswer('correct', 'mc')
      return
    }
    setBusy(true)
    try {
      const r = await gradeOpen(card.id, { text: `Felaktigt steg: ${picked + 1}. Förklaring: ${why}` })
      // The step itself was right, so never grade below partial.
      const verdict: Verdict = r.verdict === 'incorrect' ? 'partial' : r.verdict
      setDone({ verdict, feedback: r.feedback })
      onAnswer(verdict, 'ai')
    } catch {
      setDone({ verdict: 'correct', feedback: 'Rätt steg. Förklaringen kunde inte rättas just nu.' })
      onAnswer('correct', 'mc')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <span className="muted">Tryck på steget som innehåller felet.</span>
      {(card.steps ?? []).map((s, i) => {
        const cls = done ? (i === card.error_step ? 'choice right' : i === picked ? 'choice wrong' : 'choice') : 'choice'
        return (
          <button key={i} className={cls} aria-pressed={picked === i} disabled={!!done} onClick={() => setPicked(i)}>
            <span className="mono muted">{i + 1}.</span>
            <MathText md={s} />
          </button>
        )
      })}
      {!done ? (
        <>
          <label htmlFor={`why-${card.id}`}>Förklara felet (valfritt)</label>
          <textarea id={`why-${card.id}`} value={why} maxLength={4000} onChange={(e) => setWhy(e.target.value)} />
          <button className="btn primary" disabled={picked === null || busy} onClick={submit}>{busy ? 'Rättar…' : 'Svara'}</button>
        </>
      ) : (
        <>
          {done.feedback && <div className="feedback muted"><MathText md={done.feedback} /></div>}
          <div className="panel"><span className="muted">Förklaring</span><MathText md={card.reference_answer_md} /></div>
        </>
      )}
    </div>
  )
}
