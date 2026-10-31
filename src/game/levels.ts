import type { Level } from '../types'

export const LEVEL_LABEL: Record<Level, string> = { 1: 'Grund', 2: 'Fördjupning', 3: 'Avancerat' }

/** Practice scopes offered on the start screen: everything up to and including the level. */
export const LEVEL_SCOPES: { max: Level; label: string; hint: string }[] = [
  { max: 1, label: 'Grund', hint: 'Det centrala som tentorna bygger på' },
  { max: 2, label: 'Grund + fördjupning', hint: 'Även teori som dyker upp ibland' },
  { max: 3, label: 'Allt', hint: 'Inklusive avancerade och sällsynta satser' },
]

const KEY = 'maxLevel'

export function readMaxLevel(): Level {
  try {
    const v = Number(localStorage.getItem(KEY))
    return v === 1 || v === 2 || v === 3 ? v : 3
  } catch {
    return 3
  }
}

export function saveMaxLevel(v: Level) {
  try {
    localStorage.setItem(KEY, String(v))
  } catch {
    // per-device preference; fine to lose
  }
}
