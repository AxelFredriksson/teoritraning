import { expect, test } from 'vitest'
import { BankSchema } from '../../src/bank/schema'
import { bankToSql } from '../../scripts/bank-to-sql'
import { validBank } from './fixture'

const sql = () => bankToSql(BankSchema.parse(validBank()))

test('bankToSql escapes single quotes in LaTeX', () => {
  expect(sql()).toContain("f''(t)")
})

test('bankToSql output contains on conflict for concepts and cards', () => {
  const s = sql()
  expect(s).toMatch(/insert into concepts[\s\S]*on conflict \(id\) do update/)
  expect(s).toMatch(/insert into cards[\s\S]*on conflict \(id\) do update/)
})

test('bankToSql does not resurrect rejected cards', () => {
  expect(sql()).toContain("where cards.status <> 'rejected'")
})
