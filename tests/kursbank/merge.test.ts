import { expect, test } from 'vitest'
import { checkCalc, mergeCourse } from '../../scripts/kursbank/merge'
import { ConceptSchema, type Card, type Concept } from '../../src/bank/schema'

const course = { id: 'T', name: 'Test', sourceDir: 'x', lectures: [], sources: [] }

const content = (id: string): Card => ({
  id, type: 'content', answerMode: 'open', promptMd: 'p', referenceAnswerMd: 'r', rubricMd: 'rb', sourceRef: 's', level: 2, status: 'active',
})
const calc = (id: string, value: number, check: string): Card => ({
  id, type: 'calc', answerMode: 'numeric', promptMd: 'p', referenceAnswerMd: 'r', rubricMd: 'rb', steps: ['s'], sourceRef: 's', level: 2, status: 'active',
  answer: { value, tolerance: 0.01, check },
})
const concept = (id: string, cards: Card[]): Concept =>
  ConceptSchema.parse({ id, kind: 'begrepp', title: 't', statementMd: 'x', sourceRef: 's', lecture: 1, cards })
const pass = (...ids: string[]) => Object.fromEntries(ids.map((i) => [i, { result: 'PASS' as const }]))

test('checkCalc passes when check evaluates within tolerance of value', () => {
  expect(checkCalc(calc('c', 100 * 1.05, '100 * 1.05'))).toEqual({ ok: true })
  expect(checkCalc(calc('c', 2, 'Math.sqrt(4)'))).toEqual({ ok: true })
})

test('checkCalc flags disagreement with both numbers in the note', () => {
  const r = checkCalc(calc('c', 5, '4'))
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.note).toMatch(/4.*5/)
})

test('checkCalc flags a throwing expression and an infinite loop without throwing', () => {
  expect(checkCalc(calc('c', 1, 'foo.bar')).ok).toBe(false)
  // Non-whitelisted code (loops included) is rejected before evaluation; the vm timeout is only a backstop.
  const loop = checkCalc(calc('c', 1, 'while(true){}'))
  expect(loop.ok).toBe(false)
  if (!loop.ok) expect(loop.note).toContain('otillåtet')
  expect(checkCalc(calc('c', 1, '1/0')).ok).toBe(false)
})

test('mergeCourse sets FLAG → flagged with note, missing verdict → flagged "Ej kontrollerad"', () => {
  const parts = [[concept('k1', [content('a'), content('b'), content('c')])]]
  const { bank, report } = mergeCourse({
    course, parts, publishedIds: [],
    verdicts: { a: { result: 'PASS' }, b: { result: 'FLAG', note: 'fel' } },
  })
  const cards = bank.concepts[0].cards
  expect(cards.map((c) => c.status)).toEqual(['active', 'flagged', 'flagged'])
  expect(cards[1].verifyNote).toBe('fel')
  expect(cards[2].verifyNote).toBe('Ej kontrollerad')
  expect(report.flagged.map((f) => f.id)).toEqual(['b', 'c'])
  expect(report.unverified).toEqual(['c'])
})

test('mergeCourse flags a calc card whose check disagrees even if the verifier said PASS', () => {
  const { bank, report } = mergeCourse({
    course, parts: [[concept('k1', [calc('x', 5, '4')])]], verdicts: pass('x'), publishedIds: [],
  })
  expect(bank.concepts[0].cards[0].status).toBe('flagged')
  expect(report.flagged[0].id).toBe('x')
})

test('mergeCourse refuses when a previously published card id disappears', () => {
  const parts = [[concept('k1', [content('a')])]]
  expect(() => mergeCourse({ course, parts, verdicts: pass('a'), publishedIds: ['a', 'gone'] })).toThrow('published ids missing: gone')
  expect(() => mergeCourse({ course, parts, verdicts: pass('a'), publishedIds: ['k1', 'a'] })).not.toThrow()
})

test('mergeCourse allows a published card that is still present as retired', () => {
  const retired = { ...content('a'), status: 'retired' as const }
  const { bank } = mergeCourse({ course, parts: [[concept('k1', [retired])]], verdicts: {}, publishedIds: ['a'] })
  expect(bank.concepts[0].cards[0].status).toBe('retired')
})

test('mergeCourse rejects duplicate ids across parts', () => {
  const parts = [[concept('k1', [content('a')])], [concept('k2', [content('a')])]]
  expect(() => mergeCourse({ course, parts, verdicts: pass('a'), publishedIds: [] })).toThrow(/duplicate id: a/)
})

test.each([
  "this.constructor.constructor('return typeof process')()",
  'Math.constructor',
  '(()=>1)()',
  'a=1',
  '[1][0]',
])('checkCalc rejects %s without evaluating', (expr) => {
  const r = checkCalc(calc('c', 1, expr))
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.note).toContain('otillåtet uttryck i check')
})

test('checkCalc accepts whitelisted expressions', () => {
  expect(checkCalc(calc('c', 100 * (1 + 0.035 * 144 / 360), '100*(1+0.035*144/360)')).ok).toBe(true)
  expect(checkCalc(calc('c', Math.max(0, 218 * Math.exp(0.1) - 220), 'Math.max(0, 218*Math.exp(0.1) - 220)')).ok).toBe(true)
  expect(checkCalc(calc('c', 1500, '1.5e3 + 0 * Math.PI ** 2')).ok).toBe(true)
})

test('checkCalc provides the standard normal CDF N', () => {
  const near = (v: number, check: string) => {
    const c = calc('c', v, check)
    c.answer!.tolerance = 1e-4
    return checkCalc(c).ok
  }
  expect(near(0.5, 'N(0)')).toBe(true)
  expect(near(0.975, 'N(1.96)')).toBe(true)
  expect(near(0.025, 'N(-1.96)')).toBe(true)
})
