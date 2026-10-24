export type Verdict = 'correct' | 'partial' | 'incorrect'
export type CardType = 'content' | 'conditions' | 'recognition' | 'find_error'

export interface ConceptRow {
  id: string
  course_id: string
  kind: 'sats' | 'definition' | 'metod' | 'begrepp'
  title: string
  statement_md: string
  source_ref: string
  lecture: number
  exam_count: number
  exam_refs: string[]
}

export interface CardRow {
  id: string
  concept_id: string
  course_id: string
  type: CardType
  answer_mode: 'mc' | 'open'
  prompt_md: string
  choices: string[] | null
  correct: number[] | null
  reference_answer_md: string
  rubric_md: string | null
  steps: string[] | null
  error_step: number | null
  source_ref: string
  exam_ref: string | null
  status: 'active' | 'flagged' | 'rejected'
  verify_note: string | null
}

/** Serialised ts-fsrs card plus its due time (ISO). */
export interface CardState {
  fsrs: Record<string, unknown>
  due: string
}

export interface GradeResult {
  verdict: Verdict
  feedback: string
  missing: string[]
}
