import { z } from 'zod'

export const CardSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['content', 'conditions', 'recognition', 'find_error', 'calc', 'reasoning']),
    answerMode: z.enum(['mc', 'open', 'numeric']),
    promptMd: z.string().min(1),
    choices: z.array(z.string()).min(2).optional(),
    correct: z.array(z.number().int().nonnegative()).min(1).optional(),
    referenceAnswerMd: z.string().min(1),
    rubricMd: z.string().min(1).optional(),
    steps: z.array(z.string()).min(1).optional(),
    answer: z
      .object({ value: z.number(), tolerance: z.number().positive(), unit: z.string().optional(), check: z.string().min(1) })
      .optional(),
    errorStep: z.number().int().nonnegative().optional(),
    sourceRef: z.string().min(1),
    examRef: z.string().optional(),
    title: z.string().min(1).max(120).optional(),
    level: z.number().int().min(1).max(3).default(2),
    status: z.enum(['active', 'flagged', 'retired']).default('active'),
    verifyNote: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message: `${c.id}: ${message}` })
    if (c.answerMode === 'mc') {
      if (!c.choices || !c.correct) fail('mc requires choices and correct')
      else if (c.correct.some((i) => i >= c.choices!.length)) fail('correct index out of range')
    }
    if (c.answerMode === 'open' && !c.rubricMd) fail('open requires rubricMd')
    if ((c.type === 'calc') !== (c.answerMode === 'numeric')) fail('calc requires numeric answerMode and vice versa')
    if (c.type === 'calc') {
      if (!c.answer) fail('calc requires answer')
      if (!c.steps || c.steps.length < 1) fail('calc requires steps')
      if (!c.rubricMd) fail('calc requires rubricMd')
    }
    if (c.type === 'find_error') {
      if (!c.steps || c.errorStep === undefined) fail('find_error requires steps and errorStep')
      else if (c.steps.length < 2) fail('find_error requires at least 2 steps')
      else if (c.errorStep >= c.steps.length) fail('errorStep out of range')
      if (!c.rubricMd) fail('find_error requires rubricMd')
    }
  })

export const ConceptSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['sats', 'definition', 'metod', 'begrepp']),
  title: z.string().min(1),
  statementMd: z.string().min(1),
  sourceRef: z.string().min(1),
  lecture: z.number().int().positive(),
  examCount: z.number().int().nonnegative().default(0),
  examRefs: z.array(z.string()).default([]),
  factRefs: z.array(z.number()).default([]),
  cards: z.array(CardSchema).min(1),
})

export const BankSchema = z.object({
  course: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  concepts: z.array(ConceptSchema),
})

export type Bank = z.infer<typeof BankSchema>
export type Concept = z.infer<typeof ConceptSchema>
export type Card = z.infer<typeof CardSchema>
