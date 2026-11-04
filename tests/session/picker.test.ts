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

test('pickNext respects conceptId filter', () => {
  const cards = [card({ id: 'x', concept_id: 'common' }), card({ id: 'y', concept_id: 'rare' })]
  expect(pickNext(cards, concepts, new Map(), now, { conceptId: 'common' })?.id).toBe('x')
})

test('pickNext respects maxLevel', () => {
  const cards = [card({ id: 'adv', concept_id: 'rare', level: 3 }), card({ id: 'base', concept_id: 'common', level: 1 })]
  expect(pickNext(cards, concepts, new Map(), now, { maxLevel: 2 })?.id).toBe('base')
  expect(pickNext([cards[0]], concepts, new Map(), now, { maxLevel: 1 })).toBeNull()
})

const sv = (due: string, lastVerdict: CardState['lastVerdict']): CardState => ({ fsrs: {}, due, lastVerdict })

test('lecture filter picks an earlier-wrong card that is not yet due before an unseen card', () => {
  const cards = [card({ id: 'unseen', concept_id: 'common' }), card({ id: 'wrong', concept_id: 'common' })]
  const states = new Map([['wrong', sv('2026-11-20T00:00:00Z', 'incorrect')]])
  expect(pickNext(cards, concepts, states, now, { lecture: 1 })?.id).toBe('wrong')
})

test('concept filter picks incorrect before partial, then oldest due first', () => {
  const cards = [card({ id: 'p', concept_id: 'common' }), card({ id: 'i2', concept_id: 'common' }), card({ id: 'i1', concept_id: 'common' })]
  const states = new Map([
    ['p', sv('2026-11-01T00:00:00Z', 'partial')],
    ['i2', sv('2026-11-20T00:00:00Z', 'incorrect')],
    ['i1', sv('2026-11-10T00:00:00Z', 'incorrect')],
  ])
  expect(pickNext(cards, concepts, states, now, { conceptId: 'common' })?.id).toBe('i1')
  expect(pickNext(cards.filter((c) => c.id === 'p'), concepts, states, now, { conceptId: 'common' })?.id).toBe('p')
})

test('a card answered this session is skipped in the wrong-answers tier', () => {
  const cards = [card({ id: 'wrong', concept_id: 'common' }), card({ id: 'unseen', concept_id: 'common' })]
  const states = new Map([['wrong', sv('2026-11-20T00:00:00Z', 'incorrect')]])
  expect(pickNext(cards, concepts, states, now, { lecture: 1, answered: new Set(['wrong']) })?.id).toBe('unseen')
})

test('without lecture or concept filter, earlier-wrong cards that are not due are not preferred', () => {
  const cards = [card({ id: 'wrong', concept_id: 'common' }), card({ id: 'unseen', concept_id: 'common' })]
  const states = new Map([['wrong', sv('2026-11-20T00:00:00Z', 'incorrect')]])
  expect(pickNext(cards, concepts, states, now, {})?.id).toBe('unseen')
})
