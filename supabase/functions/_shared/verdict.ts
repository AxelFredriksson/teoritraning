export type Verdict = 'correct' | 'partial' | 'incorrect'
export interface GradeResult {
  verdict: Verdict
  feedback: string
  missing: string[]
}

export const VERDICT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['correct', 'partial', 'incorrect'] },
    feedback: { type: 'string' },
    missing: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'feedback', 'missing'],
  additionalProperties: false,
} as const

const VERDICTS = new Set(['correct', 'partial', 'incorrect'])

export function parseVerdict(x: unknown): GradeResult | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.verdict !== 'string' || !VERDICTS.has(o.verdict)) return null
  if (typeof o.feedback !== 'string' || !Array.isArray(o.missing)) return null
  return {
    verdict: o.verdict as Verdict,
    feedback: o.feedback.slice(0, 600),
    missing: o.missing.filter((m): m is string => typeof m === 'string').slice(0, 10),
  }
}
