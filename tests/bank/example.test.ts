import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { BankSchema } from '../../src/bank/schema'

test('the committed example bank follows the bank schema', () => {
  const raw = JSON.parse(readFileSync('bank/example/example.json', 'utf8'))
  const result = BankSchema.safeParse(raw)
  expect(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2)).toBe(true)
})
