import { useRef, useState } from 'react'
import { Canvas, type CanvasHandle } from '../handwriting/Canvas'
import { exportImage } from '../handwriting/exportImage'
import { MathText } from '../math/MathText'
import type { CardRow, GradeResult, Verdict } from '../types'
import { SelfGrade } from './SelfGrade'

export const MAX_CHARS = 4000

type Mode = 'text' | 'hand' | 'flip'
type Phase = { name: 'answering' } | { name: 'grading' } | { name: 'graded'; result: GradeResult } | { name: 'self'; note?: string }

export function OpenCard({
  card,
  narrow,
  gradeOpen,
  onAnswer,
  exportDrawing,
}: {
  card: CardRow
  narrow: boolean
  exportDrawing?: (c: HTMLCanvasElement) => Promise<string>
  gradeOpen: (cardId: string, input: { text?: string; imageBase64?: string }) => Promise<GradeResult>
  onAnswer: (v: Verdict, source: 'ai' | 'self', feedback?: GradeResult) => void
}) {
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const [mode, setMode] = useState<Mode>(narrow ? 'flip' : coarse ? 'hand' : 'text')
  const [hasInk, setHasInk] = useState(false)
  const pad = useRef<CanvasHandle>(null)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ name: 'answering' })

  async function submit() {
    setPhase({ name: 'grading' })
    try {
      let input: { text?: string; imageBase64?: string } = { text }
      if (mode === 'hand') {
        const c = pad.current?.canvas()
        if (!c) throw new Error('no canvas')
        input = { imageBase64: await (exportDrawing ?? exportImage)(c) }
      }
      const result = await gradeOpen(card.id, input)
      setPhase({ name: 'graded', result })
      onAnswer(result.verdict, 'ai', result)
    } catch {
      setPhase({ name: 'self', note: 'Rättning ej tillgänglig – bedöm själv.' })
    }
  }

  const selfGrade = (v: Verdict) => onAnswer(v, 'self')

  if (phase.name === 'graded') {
    return (
      <div className="stack">
        {text && <div className="panel"><span className="muted">Ditt svar</span><MathText md={text} /></div>}
        <p className="muted">{phase.result.feedback}</p>
        {phase.result.missing.length > 0 && (
          <ul className="muted">{phase.result.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
        )}
        <div className="panel"><span className="muted">Referenssvar</span><MathText md={card.reference_answer_md} /></div>
      </div>
    )
  }

  if (phase.name === 'self') {
    return (
      <div className="stack">
        {text && <div className="panel"><span className="muted">Ditt svar</span><MathText md={text} /></div>}
        <SelfGrade reference={card.reference_answer_md} note={phase.note} onGrade={selfGrade} />
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row" role="tablist">
        {!narrow && (
          <button className={mode === 'hand' ? 'chip on' : 'chip'} role="tab" aria-selected={mode === 'hand'} onClick={() => setMode('hand')}>Skriv för hand</button>
        )}
        <button className={mode === 'text' ? 'chip on' : 'chip'} role="tab" aria-selected={mode === 'text'} onClick={() => setMode('text')}>Skriv text</button>
        <button className={mode === 'flip' ? 'chip on' : 'chip'} role="tab" aria-selected={mode === 'flip'} onClick={() => setMode('flip')}>Vänd kort</button>
      </div>
      {mode === 'flip' ? (
        <button className="btn primary" onClick={() => setPhase({ name: 'self' })}>Visa svar</button>
      ) : mode === 'hand' ? (
        <>
          <Canvas ref={pad} onChange={setHasInk} />
          <button className="btn primary" disabled={!hasInk || phase.name === 'grading'} onClick={submit}>
            {phase.name === 'grading' ? 'Rättar…' : 'Rätta'}
          </button>
        </>
      ) : (
        <>
          <label htmlFor={`ans-${card.id}`}>Ditt svar</label>
          <textarea id={`ans-${card.id}`} maxLength={MAX_CHARS} value={text} onChange={(e) => setText(e.target.value)} placeholder="Skriv med egna ord. Matte som $\int_0^\infty f(t)\,dt$." />
          <div className="row">
            <span className="muted">{text.length} / {MAX_CHARS}</span>
          </div>
          {text.trim() && <div className="panel"><span className="muted">Förhandsvisning</span><MathText md={text} /></div>}
          <button className="btn primary" disabled={!text.trim() || phase.name === 'grading'} onClick={submit}>
            {phase.name === 'grading' ? 'Rättar…' : 'Rätta'}
          </button>
        </>
      )}
    </div>
  )
}
