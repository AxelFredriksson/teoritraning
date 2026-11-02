import { expect, test } from 'vitest'
import { runSummary } from '../../scripts/kursbank/summary'
import { BankSchema } from '../../src/bank/schema'

const card = (id: string, type: string, extra = {}) => ({
  id, type, answerMode: 'open', promptMd: 'p', referenceAnswerMd: 'r', rubricMd: 'rb', sourceRef: 's', ...extra,
})
const concept = (id: string, lecture: number, cards: unknown[]) => ({
  id, kind: 'begrepp', title: 't', statementMd: 'x', sourceRef: 's', lecture, cards,
})

test('runSummary reports new concepts and cards per lecture and type, flagged with reasons, and content-only concepts', () => {
  const prev = BankSchema.parse({ course: { id: 'T', name: 'T' }, concepts: [concept('old', 1, [card('o1', 'content')])] })
  const bank = BankSchema.parse({
    course: { id: 'T', name: 'T' },
    concepts: [
      concept('old', 1, [card('o1', 'content')]),
      concept('n1', 2, [card('n1a', 'content'), card('n1b', 'recognition')]),
      concept('n2', 2, [card('n2a', 'content')]),
    ],
  })
  const s = runSummary(prev, bank, { flagged: [{ id: 'n1b', note: 'fel facit' }], unverified: [] })
  expect(s).toContain('Nya begrepp: 2')
  expect(s).toContain('Nya kort: 3')
  expect(s).toMatch(/Föreläsning 2: 3 kort \(content 2, recognition 1\)/)
  expect(s).not.toMatch(/Föreläsning 1/)
  expect(s).toContain('n1b: fel facit')
  expect(s).toContain('Begrepp med bara innehållskort: 2')
})

test('runSummary treats everything as new without a previous bank', () => {
  const bank = BankSchema.parse({ course: { id: 'T', name: 'T' }, concepts: [concept('a', 1, [card('a1', 'content')])] })
  expect(runSummary(null, bank, { flagged: [], unverified: [] })).toContain('Nya kort: 1')
})
