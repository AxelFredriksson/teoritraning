import { expect, test } from 'vitest'
import { BankSchema } from '../../src/bank/schema'
import { validBank } from './fixture'

test('schema accepts minimal valid bank fixture', () => {
  expect(BankSchema.safeParse(validBank()).success).toBe(true)
})

test('schema rejects mc card without correct', () => {
  const b = validBank()
  delete (b.concepts[0].cards[1] as { correct?: number[] }).correct
  expect(BankSchema.safeParse(b).success).toBe(false)
})

test('schema rejects mc correct index out of range', () => {
  const b = validBank()
  b.concepts[0].cards[1].correct = [5]
  expect(BankSchema.safeParse(b).success).toBe(false)
})

test('schema rejects find_error with error_step out of range', () => {
  const b = validBank()
  b.concepts[0].cards[2].errorStep = 3
  expect(BankSchema.safeParse(b).success).toBe(false)
})

test('schema rejects open card without rubric', () => {
  const b = validBank()
  delete (b.concepts[0].cards[0] as { rubricMd?: string }).rubricMd
  expect(BankSchema.safeParse(b).success).toBe(false)
})

test('schema accepts card title and level 1-3, rejects level 4', () => {
  const b = validBank()
  Object.assign(b.concepts[0].cards[0], { title: 'Formulera satsen', level: 1 })
  expect(BankSchema.safeParse(b).success).toBe(true)
  Object.assign(b.concepts[0].cards[0], { level: 4 })
  expect(BankSchema.safeParse(b).success).toBe(false)
})
