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

const calcCard = () => ({
  id: 'c9',
  type: 'calc',
  answerMode: 'numeric',
  promptMd: 'Beräkna ...',
  referenceAnswerMd: '3.52 %',
  rubricMd: 'Rätt metod',
  steps: ['steg 1', 'steg 2'],
  answer: { value: 3.52, tolerance: 0.01, unit: '%', check: '3.52' },
  sourceRef: 'F3',
})
const withCard = (card: Record<string, unknown>) => {
  const b = validBank()
  ;(b.concepts[0].cards as unknown[]).push(card)
  return b
}

test('schema accepts a calc card with numeric answer, steps and rubric', () => {
  expect(BankSchema.safeParse(withCard(calcCard())).success).toBe(true)
})

test('schema rejects calc card without answer', () => {
  const c: Record<string, unknown> = calcCard()
  delete c.answer
  expect(BankSchema.safeParse(withCard(c)).success).toBe(false)
})

test('schema rejects calc card without steps', () => {
  const c: Record<string, unknown> = calcCard()
  delete c.steps
  expect(BankSchema.safeParse(withCard(c)).success).toBe(false)
})

test('schema rejects calc card without rubricMd', () => {
  const c: Record<string, unknown> = calcCard()
  delete c.rubricMd
  expect(BankSchema.safeParse(withCard(c)).success).toBe(false)
})

test('schema rejects calc card with answerMode other than numeric', () => {
  expect(BankSchema.safeParse(withCard({ ...calcCard(), answerMode: 'open' })).success).toBe(false)
})

test('schema rejects calc card with tolerance 0', () => {
  const c = calcCard()
  c.answer.tolerance = 0
  expect(BankSchema.safeParse(withCard(c)).success).toBe(false)
})

test('schema rejects numeric answerMode on a non-calc card', () => {
  expect(BankSchema.safeParse(withCard({ ...calcCard(), type: 'content' })).success).toBe(false)
})

test('schema still requires 2 steps for find_error', () => {
  const b = validBank()
  Object.assign(b.concepts[0].cards[2], { steps: ['bara ett'], errorStep: 0 })
  expect(BankSchema.safeParse(b).success).toBe(false)
})
