import { expect, test } from 'vitest'
import { schedule } from '../../src/srs/scheduler'

const now = new Date('2026-10-24T12:00:00Z')
const DAY = 86_400_000

test('incorrect schedules due within 1 day', () => {
  const s = schedule(null, 'incorrect', now)
  expect(new Date(s.due).getTime() - now.getTime()).toBeLessThanOrEqual(DAY)
})

test('correct on new card schedules due later than incorrect', () => {
  const good = new Date(schedule(null, 'correct', now).due).getTime()
  const bad = new Date(schedule(null, 'incorrect', now).due).getTime()
  expect(good).toBeGreaterThan(bad)
})

test('state round-trips through JSON', () => {
  const s1 = JSON.parse(JSON.stringify(schedule(null, 'correct', now)))
  const later = new Date(new Date(s1.due).getTime() + DAY)
  const s2 = schedule(s1, 'correct', later)
  expect(new Date(s2.due).getTime()).toBeGreaterThan(later.getTime())
})
