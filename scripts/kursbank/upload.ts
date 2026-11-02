// Usage: npx tsx scripts/kursbank/upload.ts bank/<kurs> [--dry-run]
// Thin I/O wrapper around planUpload. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.kursbank.
// published-ids.json: sorted, de-duplicated list of every concept id and card id that has been inserted.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { BankSchema } from '../../src/bank/schema'
import { idsOutsideCoursePrefix, nextPublishedIds, planUpload, type RemoteCard } from './plan-upload'

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return out
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

async function main() {
  const dir = process.argv[2]
  const dry = process.argv.includes('--dry-run')
  if (!dir) fail('Usage: npx tsx scripts/kursbank/upload.ts bank/<kurs> [--dry-run]')

  if (!existsSync('.env.kursbank')) fail('.env.kursbank saknas. Kopiera .env.kursbank.example och fyll i SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY.')
  const env = parseEnv(readFileSync('.env.kursbank', 'utf8'))
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) fail('.env.kursbank måste innehålla SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY.')

  const parsed = BankSchema.safeParse(JSON.parse(readFileSync(join(dir, 'bank.json'), 'utf8')))
  if (!parsed.success) fail(JSON.stringify(parsed.error.issues, null, 2))
  const bank = parsed.data
  const courseId = bank.course.id
  const foreign = idsOutsideCoursePrefix(bank)
  if (foreign.length) fail(`Id utan kursprefix ${courseId.toLowerCase()}- (kan skriva över annan kurs):\n${foreign.join('\n')}`)

  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const ok = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) fail(`${what}: ${r.error.message}`)
    return (r.data ?? []) as T
  }

  // PostgREST caps responses (default 1000 rows), so page through everything.
  const fetchAll = async <T>(what: string, q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
    const all: T[] = []
    for (let from = 0; ; from += 1000) {
      const page = ok(await q(from, from + 999), what)
      all.push(...page)
      if (page.length < 1000) return all
    }
  }
  const remote = await fetchAll<RemoteCard>('Hämta kort', (a, b) =>
    sb.from('cards').select('id, status, content_hash, reviewed_at').eq('course_id', courseId).order('id').range(a, b))
  const reported = await fetchAll<{ card_id: string }>('Hämta rapporter', (a, b) =>
    sb.from('card_reports').select('card_id').order('id').range(a, b))
  const plan = planUpload(bank, remote, new Set(reported.map((r) => r.card_id)), new Date().toISOString().slice(0, 10))

  console.log(JSON.stringify({ course: courseId, skipped: plan.skipped, ...plan.summary }, null, 2))
  if (dry) return console.log('--dry-run: inga skrivningar.')

  ok(await sb.from('courses').upsert({ id: courseId, name: bank.course.name }), 'Skriv kurs')
  ok(
    await sb.from('concepts').upsert(
      bank.concepts.map((k) => ({
        id: k.id, course_id: courseId, kind: k.kind, title: k.title, statement_md: k.statementMd,
        source_ref: k.sourceRef, lecture: k.lecture, exam_count: k.examCount, exam_refs: k.examRefs,
      })),
    ),
    'Skriv begrepp',
  )

  const full = plan.writes.filter((w) => w.kind !== 'release')
  for (let i = 0; i < full.length; i += 100) {
    ok(await sb.from('cards').upsert(full.slice(i, i + 100).map((w) => w.row)), 'Skriv kort')
  }
  for (const w of plan.writes.filter((x) => x.kind === 'release')) {
    const { id, ...patch } = w.row
    ok(await sb.from('cards').update(patch).eq('id', id as string), 'Släpp kort')
  }

  const file = join(dir, 'published-ids.json')
  const prev: string[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  const written = [...bank.concepts.map((k) => k.id), ...plan.writes.map((w) => w.id)]
  const next = nextPublishedIds(prev, bank, new Set(remote.map((r) => r.id)), written)
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
  console.log('Klart.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main()
