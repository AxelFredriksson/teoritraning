import { useRef, useState } from 'react'
import { Canvas, type CanvasHandle } from '../handwriting/Canvas'
import { exportImage } from '../handwriting/exportImage'
import { MathInline, MathText } from '../math/MathText'
import type { CardRow, GradeResult, Verdict } from '../types'
import { checkNumeric, formatNumber, parseNumber } from './numeric'
import { SelfGrade } from './SelfGrade'

type Help = { name: 'idle' } | { name: 'busy' } | { name: 'done'; result: GradeResult } | { name: 'failed' }

export function CalcCard({
  card,
  narrow,
  gradeOpen,
  onAnswer,
  exportDrawing,
}: {
  card: CardRow
  narrow: boolean
  exportDrawing?: (c: HTMLCanvasElement) => Promise<string>
  gradeOpen: (cardId: string, input: { imageBase64?: string; mode?: 'find_calc_error' }) => Promise<GradeResult>
  onAnswer: (v: Verdict, source: 'mc' | 'self') => void
}) {
  const [text, setText] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const pad = useRef<CanvasHandle>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [help, setHelp] = useState<Help>({ name: 'idle' })

  const value = card.answer_value ?? 0
  const unit = card.answer_unit ?? ''
  const parses = parseNumber(text) !== null

  function submit() {
    if (!parses) return
    const v: Verdict = checkNumeric(text, value, card.answer_tolerance ?? 0) ? 'correct' : 'incorrect'
    setVerdict(v)
    onAnswer(v, 'mc')
  }

  async function findError() {
    setHelp({ name: 'busy' })
    try {
      const c = pad.current?.canvas()
      if (!c) throw new Error('no canvas')
      const imageBase64 = await (exportDrawing ?? exportImage)(c)
      const result = await gradeOpen(card.id, { imageBase64, mode: 'find_calc_error' })
      setHelp({ name: 'done', result })
    } catch {
      setHelp({ name: 'failed' })
    }
  }

  if (flipped) {
    return <SelfGrade reference={card.reference_answer_md} onGrade={(v) => onAnswer(v, 'self')} />
  }

  // The canvas stays mounted (hidden) after answering so "Hitta mitt fel" can still export it.
  const canvas = !narrow && <div hidden={!!verdict}><Canvas ref={pad} onChange={setHasInk} /></div>

  if (verdict) {
    return (
      <div className="stack">
        {canvas}
        <div className="panel"><strong>Facit: {formatNumber(value)} {unit}</strong></div>
        {card.steps && (
          <ol>{card.steps.map((s, i) => <li key={i}><MathText md={s} /></li>)}</ol>
        )}
        <div className="panel"><span className="muted">Referenssvar</span><MathText md={card.reference_answer_md} /></div>
        {verdict === 'incorrect' && hasInk && help.name !== 'done' && (
          <button className="btn" disabled={help.name === 'busy'} onClick={findError}>
            {help.name === 'busy' ? 'Letar…' : 'Hitta mitt fel'}
          </button>
        )}
        {help.name === 'failed' && <p className="muted" role="status">Felsökningen är inte tillgänglig just nu.</p>}
        {help.name === 'done' && (
          <div className="feedback muted">
            <MathText md={help.result.feedback} />
            {help.result.missing.length > 0 && (
              <ul>{help.result.missing.map((m, i) => <li key={i}><MathInline md={m} /></li>)}</ul>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="stack">
      {canvas}
      <label htmlFor={`num-${card.id}`}>Ditt svar</label>
      <div className="row">
        <input
          id={`num-${card.id}`}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        {unit && <span className="muted">{unit}</span>}
      </div>
      <div className="row">
        <button className="btn primary" disabled={!parses} onClick={submit}>Svara</button>
        <button className="btn ghost" onClick={() => setFlipped(true)}>Visa facit</button>
      </div>
    </div>
  )
}
