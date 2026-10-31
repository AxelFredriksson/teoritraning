import type { CardRow, ConceptRow } from '../src/types'

export const concept = (over: Partial<ConceptRow> = {}): ConceptRow => ({
  id: 'k1', course_id: 'TATA77', kind: 'sats', title: 'T', statement_md: 's', source_ref: 'r',
  lecture: 1, exam_count: 3, exam_refs: [], ...over,
})

export const card = (over: Partial<CardRow> = {}): CardRow => ({
  id: 'c1', concept_id: 'k1', course_id: 'TATA77', type: 'content', answer_mode: 'open',
  prompt_md: 'p', choices: null, correct: null, reference_answer_md: 'a', rubric_md: 'r',
  steps: null, error_step: null, source_ref: 'r', exam_ref: null, status: 'active', verify_note: null, title: null, level: 2, ...over,
})
