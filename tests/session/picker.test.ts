import { expect, test } from 'vitest'
import { pickNext } from '../../src/session/picker'
import type { CardState } from '../../src/types'
import { card, concept } from '../fixtures'

const now = new Date('2026-10-24T12:00:00Z')
const st = (due: string): CardState => ({ fsrs: {}, due })
const concepts = [concept({ id: 'common', exam_count: 5, lecture: 1 }), concept({ id: 'rare', exam_count: 0, lecture: 2 })]

test('pickNext prefers most overdue due card', () => {
  const cards = [card({ id: 'a' }), card({ id: 'b' })]
  const states = new Map([['a', st('2026-10-23T00:00:00Z')], ['b', st('2026-10-20T00:00:00Z')]])
  expect(pickNext(cards, concepts, states, now, {})?.id).toBe('b')
})

test('pickNext returns rare unseen (exam_count 0) before common unseen when nothing due', () => {
  const cards = [card({ id: 'x', concept_id: 'common' }), card({ id: 'y', concept_id: 'rare' })]
  expect(pickNext(cards, concepts, new Map(), now, {})?.id).toBe('y')
})

test('pickNext respects lecture filter', () => {
  const cards = [card({ id: 'x', concept_id: 'common' }), card({ id: 'y', concept_id: 'rare' })]
  expect(pickNext(cards, concepts, new Map(), now, { lecture: 1 })?.id).toBe('x')
})

test('pickNext skips flagged cards', () => {
  const cards = [card({ id: 'x', status: 'flagged' })]
  expect(pickNext(cards, concepts, new Map(), now, {})).toBeNull()
})

test('pickNext unseenOnly ignores due cards', () => {
  const cards = [card({ id: 'a' }), card({ id: 'n' })]
  const states = new Map([['a', st('2026-10-20T00:00:00Z')]])
  expect(pickNext(cards, concepts, states, now, { unseenOnly: true })?.id).toBe('n')
})

test('pickNext returns null when only not-yet-due seen cards remain', () => {
  const cards = [card({ id: 'a' })]
  const states = new Map([['a', st('2026-11-20T00:00:00Z')]])
  expect(pickNext(cards, concepts, states, now, {})).toBeNull()
})

test('pickNext excludes given ids', () => {
  const cards = [card({ id: 'a' }), card({ id: 'b' })]
  expect(pickNext(cards, concepts, new Map(), now, { exclude: new Set(['a']) })?.id).toBe('b')
})
