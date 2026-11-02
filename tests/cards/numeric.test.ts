import { expect, test } from 'vitest'
import { checkNumeric, formatNumber, parseNumber } from '../../src/cards/numeric'

test.each([
  ['3,52', 3.52], ['3.52', 3.52], ['3,52 %', 3.52], [' 3,52% ', 3.52],
  ['1 234,5', 1234.5], ['-0,6', -0.6], ['−0,6', -0.6], ['0,5e-2', 0.005], ['101 kr', 101],
])('parseNumber(%j) = %d', (input, expected) => {
  expect(parseNumber(input)).toBeCloseTo(expected as number, 10)
})

test.each(['', '3,5,2', 'abc', '1,2kr3'])('parseNumber(%j) is null', (input) => {
  expect(parseNumber(input)).toBeNull()
})

test('checkNumeric uses tolerance', () => {
  expect(checkNumeric('3,53', 3.52, 0.01)).toBe(true)
  expect(checkNumeric('3,54', 3.52, 0.01)).toBe(false)
  expect(checkNumeric('abc', 3.52, 0.01)).toBe(false)
})

test('formatNumber uses decimal comma and trims zeros', () => {
  expect(formatNumber(3.52)).toBe('3,52')
  expect(formatNumber(3)).toBe('3')
  expect(formatNumber(1.23456789)).toBe('1,2346')
  expect(formatNumber(2.5)).toBe('2,5')
})
