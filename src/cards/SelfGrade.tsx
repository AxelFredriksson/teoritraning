import { MathText } from '../math/MathText'
import type { Verdict } from '../types'

/** Shows the reference answer and lets the user grade themselves. */
export function SelfGrade({ reference, note, onGrade }: { reference: string; note?: string; onGrade: (v: Verdict) => void }) {
  return (
    <div className="stack">
      {note && <p className="muted" role="status">{note}</p>}
      <div className="panel">
        <span className="muted">Referenssvar</span>
        <MathText md={reference} />
      </div>
      <span className="muted">Hur gick det?</span>
      <div className="row">
        <button className="btn" onClick={() => onGrade('correct')}>Rätt</button>
        <button className="btn" onClick={() => onGrade('partial')}>Delvis</button>
        <button className="btn" onClick={() => onGrade('incorrect')}>Fel</button>
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
