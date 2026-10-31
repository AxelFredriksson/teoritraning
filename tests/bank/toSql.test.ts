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

test('bankToSqlChunks never splits a statement and keeps multi-line text intact', async () => {
  const { bankToSqlChunks } = await import('../../scripts/bank-to-sql')
  const b = validBank()
  b.concepts[0].statementMd = 'Rad ett\n\nRad tre efter tom rad'
  const bank = BankSchema.parse(b)
  const chunks = bankToSqlChunks(bank, 300)
  expect(chunks.length).toBeGreaterThan(1)
  for (const c of chunks) {
    expect(c.startsWith('begin;\n')).toBe(true)
    expect(c.trimEnd().endsWith('commit;')).toBe(true)
    // every chunk has balanced single quotes (escaped '' counts as two)
    expect((c.match(/'/g) ?? []).length % 2).toBe(0)
  }
  expect(chunks.join('\n')).toContain('Rad ett\n\nRad tre efter tom rad')
})
