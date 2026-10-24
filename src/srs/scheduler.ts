import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import type { CardState, Verdict } from '../types'

const f = fsrs()

export function verdictToRating(v: Verdict): Grade {
  return v === 'correct' ? Rating.Good : v === 'partial' ? Rating.Hard : Rating.Again
}

export function schedule(state: CardState | null, v: Verdict, now: Date): CardState {
  const current: Card = state ? (state.fsrs as unknown as Card) : createEmptyCard(now)
  const { card } = f.next(current, now, verdictToRating(v))
  return { fsrs: JSON.parse(JSON.stringify(card)), due: card.due.toISOString() }
}
