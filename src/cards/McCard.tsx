import { useState } from 'react'
import { MathText } from '../math/MathText'
import type { CardRow, Verdict } from '../types'

export function gradeChoices(picked: number[], correct: number[]): Verdict {
  const want = new Set(correct)
  const hits = picked.filter((i) => want.has(i)).length
  if (hits === want.size && picked.length === want.size) return 'correct'
  return hits > 0 ? 'partial' : 'incorrect'
}

/** Fisher–Yates permutation of 0..n-1. */
function shuffledIndices(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function McCard({ card, onAnswer }: { card: CardRow; onAnswer: (v: Verdict) => void }) {
  const [picked, setPicked] = useState<number[]>([])
  const [done, setDone] = useState(false)
  // display order, fixed for this mount; picked/correct stay in original indices
  const [order] = useState(() => shuffledIndices(card.choices?.length ?? 0))
  const correct = new Set(card.correct ?? [])
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))

  return (
    <div className="stack">
      {(card.correct?.length ?? 0) > 1 && <span className="muted">Välj alla som gäller.</span>}
      {order.map((i) => {
        const choice = (card.choices ?? [])[i]
        const cls = done ? (correct.has(i) ? 'choice right' : picked.includes(i) ? 'choice wrong' : 'choice') : 'choice'
        return (
          <button key={i} className={cls} aria-pressed={picked.includes(i)} disabled={done} onClick={() => toggle(i)}>
            <MathText md={choice} />
          </button>
        )
      })}
      {!done && (
        <button
          className="btn primary"
          disabled={picked.length === 0}
          onClick={() => {
            setDone(true)
            onAnswer(gradeChoices(picked, card.correct ?? []))
          }}
        >
          Svara
        </button>
      )}
    </div>
  )
}
