import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { BankSchema, type Bank } from '../src/bank/schema'

const q = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`)
const num = (v: number | null | undefined) => (v == null ? 'null' : String(v))
const json = (v: unknown) => (v == null ? 'null' : `${q(JSON.stringify(v))}::jsonb`)
const textArr = (v: string[]) => `array[${v.map(q).join(',')}]::text[]`

const CARD_COLS = [
  'concept_id', 'course_id', 'type', 'answer_mode', 'prompt_md', 'choices', 'correct',
  'reference_answer_md', 'rubric_md', 'steps', 'error_step', 'source_ref', 'exam_ref', 'status', 'verify_note',
]

export function bankToSql(bank: Bank): string {
  const out: string[] = ['begin;']
  const c = bank.course
  out.push(
    `insert into courses (id, name) values (${q(c.id)}, ${q(c.name)}) on conflict (id) do update set name = excluded.name;`,
  )
  for (const k of bank.concepts) {
    out.push(
      `insert into concepts (id, course_id, kind, title, statement_md, source_ref, lecture, exam_count, exam_refs) values (` +
        [q(k.id), q(c.id), q(k.kind), q(k.title), q(k.statementMd), q(k.sourceRef), num(k.lecture), num(k.examCount), textArr(k.examRefs)].join(', ') +
        `) on conflict (id) do update set kind = excluded.kind, title = excluded.title, statement_md = excluded.statement_md, source_ref = excluded.source_ref, lecture = excluded.lecture, exam_count = excluded.exam_count, exam_refs = excluded.exam_refs;`,
    )
    for (const d of k.cards) {
      const vals = [
        q(k.id), q(c.id), q(d.type), q(d.answerMode), q(d.promptMd), json(d.choices), json(d.correct),
        q(d.referenceAnswerMd), q(d.rubricMd), json(d.steps), num(d.errorStep), q(d.sourceRef), q(d.examRef), q(d.status), q(d.verifyNote),
      ]
      out.push(
        `insert into cards (id, ${CARD_COLS.join(', ')}) values (${q(d.id)}, ${vals.join(', ')}) on conflict (id) do update set ` +
          CARD_COLS.map((col) => `${col} = excluded.${col}`).join(', ') +
          ` where cards.status <> 'rejected';`,
      )
    }
  }
  out.push('commit;')
  return out.join('\n') + '\n'
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const parsed = BankSchema.safeParse(JSON.parse(readFileSync(process.argv[2], 'utf8')))
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }
  process.stdout.write(bankToSql(parsed.data))
}
