import type { CardType, Verdict } from '../types'

const BASE: Record<Verdict, number> = { correct: 10, partial: 5, incorrect: 1 }
const FIND_ERROR_BONUS = 5

export function pointsFor(v: Verdict, type: CardType): number {
  return BASE[v] + (type === 'find_error' && v === 'correct' ? FIND_ERROR_BONUS : 0)
}

/** Calendar date (YYYY-MM-DD) in Europe/Stockholm. */
export function stockholmDate(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(d)
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export function nextStreak(prev: { streak: number; lastActive: string | null }, now: Date): { streak: number; lastActive: string } {
  const today = stockholmDate(now)
  if (!prev.lastActive) return { streak: 1, lastActive: today }
  const gap = dayDiff(prev.lastActive, today)
  if (gap <= 0) return { streak: prev.streak, lastActive: prev.lastActive }
  return { streak: gap === 1 ? prev.streak + 1 : 1, lastActive: today }
}
