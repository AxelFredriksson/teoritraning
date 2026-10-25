import { useState } from 'react'
import { MathText } from '../math/MathText'
import type { Verdict } from '../types'

/** Shows the reference answer and lets the user grade themselves. */
export function SelfGrade({ reference, note, onGrade }: { reference: string; note?: string; onGrade: (v: Verdict) => void }) {
  const [picked, setPicked] = useState<Verdict | null>(null)
  const grade = (v: Verdict) => {
    if (picked) return
    setPicked(v)
    onGrade(v)
  }
  return (
    <div className="stack">
      {note && <p className="muted" role="status">{note}</p>}
      <div className="panel">
        <span className="muted">Referenssvar</span>
        <MathText md={reference} />
      </div>
      <span className="muted">Hur gick det?</span>
      <div className="row">
        <button className="btn" disabled={!!picked} aria-pressed={picked === 'correct'} onClick={() => grade('correct')}>Rätt</button>
        <button className="btn" disabled={!!picked} aria-pressed={picked === 'partial'} onClick={() => grade('partial')}>Delvis</button>
        <button className="btn" disabled={!!picked} aria-pressed={picked === 'incorrect'} onClick={() => grade('incorrect')}>Fel</button>
      </div>
    </div>
  )
}

const LABEL: Record<Verdict, string> = { correct: 'Rätt', partial: 'Delvis rätt', incorrect: 'Fel' }

export function ResultBox({ verdict, points, children }: { verdict: Verdict; points: number; children?: React.ReactNode }) {
  return (
    <div className={`result ${verdict}`} role="status">
      <strong>{LABEL[verdict]} · +{points} p</strong>
      {children}
    </div>
  )
}
