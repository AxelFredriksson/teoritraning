// Merges <course>/parts/*.json with verdicts in <course>/verify/*.json into <course>/bank.json.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { BankSchema, type Bank, type Card, type Concept } from '../../src/bank/schema'
import { loadCourse, type CourseConfig } from './config'
import { runSummary } from './summary'

type Verdicts = Record<string, { result: 'PASS' | 'FLAG'; note?: string }>

// node:vm is not a security boundary, so `check` is only evaluated when every token is on this whitelist.
const ALLOWED_IDENTS = new Set([
  'Math.exp', 'Math.log', 'Math.sqrt', 'Math.pow', 'Math.max', 'Math.min', 'Math.abs', 'Math.round', 'Math.floor', 'Math.ceil',
  'Math.E', 'Math.PI', 'N',
])
const TOKEN = /\s+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\*\*|[-+*/%(),]/y

function firstDisallowedToken(expr: string): string | null {
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < expr.length) {
    const start = TOKEN.lastIndex
    const m = TOKEN.exec(expr)
    if (!m) return expr[start]
    if (/^[A-Za-z_$]/.test(m[0]) && !ALLOWED_IDENTS.has(m[0])) return m[0]
  }
  return null
}

// Standard normal CDF (Abramowitz-Stegun 7.1.26 erf, error < 1.5e-7), defined inside the evaluation context.
const PRELUDE = `function N(x){var z=Math.abs(x)/Math.SQRT2,t=1/(1+0.3275911*z),
y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-z*z);
return 0.5*(1+(x<0?-y:y))}`

export function checkCalc(card: Card): { ok: true } | { ok: false; note: string } {
  if (card.type !== 'calc' || !card.answer) return { ok: true }
  const { value, tolerance, check } = card.answer
  const bad = firstDisallowedToken(check)
  if (bad !== null) return { ok: false, note: `otillåtet uttryck i check: ${bad}` }
  let got: unknown
  try {
    const ctx = createContext(Object.create(null))
    runInContext(PRELUDE, ctx)
    got = runInContext(check, ctx, { timeout: 100 })
  } catch (e) {
    return { ok: false, note: `Kontrolluttrycket kunde inte beräknas: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (typeof got !== 'number' || !Number.isFinite(got)) return { ok: false, note: `Kontrolluttrycket gav inget tal: ${String(got)}` }
  if (Math.abs(got - value) <= tolerance) return { ok: true }
  return { ok: false, note: `Kontrollen ger ${got} men facit är ${value} (tolerans ${tolerance})` }
}

export function mergeCourse(input: {
  course: CourseConfig
  parts: Concept[][]
  verdicts: Verdicts
  publishedIds: string[]
}): { bank: Bank; report: { flagged: { id: string; note: string }[]; unverified: string[] } } {
  const concepts = structuredClone(input.parts.flat())
  const seen = new Set<string>()
  for (const k of concepts) {
    for (const id of [k.id, ...k.cards.map((c) => c.id)]) {
      if (seen.has(id)) throw new Error(`duplicate id: ${id}`)
      seen.add(id)
    }
  }
  const missing = input.publishedIds.filter((id) => !seen.has(id))
  if (missing.length) throw new Error(`published ids missing: ${missing.join(', ')}`)

  const flagged: { id: string; note: string }[] = []
  const unverified: string[] = []
  for (const k of concepts) {
    for (const c of k.cards) {
      if (c.status === 'retired') continue
      const v = input.verdicts[c.id]
      const notes: string[] = []
      if (!v) {
        unverified.push(c.id)
        notes.push('Ej kontrollerad')
      } else if (v.result === 'FLAG') notes.push(v.note ?? 'Flaggad av kontrollen')
      const calc = checkCalc(c)
      if (!calc.ok) notes.push(calc.note)
      if (notes.length) {
        const note = notes.join('; ')
        c.status = 'flagged'
        c.verifyNote = note
        flagged.push({ id: c.id, note })
      }
    }
  }
  const bank = BankSchema.parse({ course: { id: input.course.id, name: input.course.name }, concepts })
  return { bank, report: { flagged, unverified } }
}

const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)

function main(dir: string) {
  const course = loadCourse(dir)
  const names = existsSync(join(dir, 'parts')) ? readdirSync(join(dir, 'parts')).filter((f) => f.endsWith('.json')).sort() : []
  const parts = names.map((f) => readJson<{ concepts: Concept[] }>(join(dir, 'parts', f), { concepts: [] }).concepts)
  const verdicts: Verdicts = {}
  for (const f of names) Object.assign(verdicts, readJson<Verdicts>(join(dir, 'verify', f), {}))
  const publishedIds = readJson<string[]>(join(dir, 'published-ids.json'), [])
  const prevBank = existsSync(join(dir, 'bank.json')) ? BankSchema.parse(readJson(join(dir, 'bank.json'), null)) : null
  try {
    const { bank, report } = mergeCourse({ course, parts, verdicts, publishedIds })
    writeFileSync(join(dir, 'bank.json'), JSON.stringify(bank, null, 1))
    console.log(runSummary(prevBank, bank, report))
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2])
