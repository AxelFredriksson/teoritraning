import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { zipDest } from '../../scripts/kursbank/extract'

const EX = join('bank', 'x', 'extract')

test('zipDest is a folder named after the zip inside the extract dir', () => {
  expect(zipDest(EX, 'tentor/2024-01.zip')).toBe(resolve(EX, '2024-01'))
})

test('zipDest refuses destinations that are the extract dir itself or outside it', () => {
  expect(() => zipDest(EX, 'a/..zip')).toThrow(/extract/)
  expect(() => zipDest(EX, 'a/...zip')).toThrow(/extract/)
})

test('zipDest allows names that merely start with two dots', () => {
  expect(zipDest(EX, '..gammal.zip')).toBe(resolve(EX, '..gammal'))
})
