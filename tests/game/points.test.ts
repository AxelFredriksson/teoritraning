import { expect, test } from 'vitest'
import { nextStreak, pointsFor } from '../../src/game/points'

test('points defaults', () => {
  expect(pointsFor('correct', 'content')).toBe(10)
  expect(pointsFor('partial', 'content')).toBe(5)
  expect(pointsFor('incorrect', 'content')).toBe(1)
  expect(pointsFor('correct', 'find_error')).toBe(15)
})

test('nextStreak first ever answer starts at 1', () => {
  expect(nextStreak({ streak: 0, lastActive: null }, new Date('2026-10-24T10:00:00Z'))).toEqual({ streak: 1, lastActive: '2026-10-24' })
})

test('nextStreak same Stockholm day keeps streak', () => {
  expect(nextStreak({ streak: 4, lastActive: '2026-10-24' }, new Date('2026-10-24T18:00:00Z')).streak).toBe(4)
})

test('nextStreak next day increments', () => {
  expect(nextStreak({ streak: 4, lastActive: '2026-10-23' }, new Date('2026-10-24T08:00:00Z')).streak).toBe(5)
})

test('nextStreak gap of 2 days resets to 1', () => {
  expect(nextStreak({ streak: 4, lastActive: '2026-10-21' }, new Date('2026-10-24T08:00:00Z')).streak).toBe(1)
})

test('nextStreak 23:30 UTC on 2026-10-24 counts as 2026-10-25 in Stockholm', () => {
  expect(nextStreak({ streak: 1, lastActive: '2026-10-24' }, new Date('2026-10-24T23:30:00Z'))).toEqual({ streak: 2, lastActive: '2026-10-25' })
})
