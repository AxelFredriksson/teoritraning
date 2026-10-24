import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { ConceptSchema } from '../src/bank/schema'

const r = z.object({ concepts: z.array(ConceptSchema) }).safeParse(JSON.parse(readFileSync(process.argv[2], 'utf8')))
if (!r.success) {
  console.error(JSON.stringify(r.error.issues, null, 2))
  process.exit(1)
}
const cards = r.data.concepts.flatMap((c) => c.cards)
const ids = new Set<string>()
for (const id of [...r.data.concepts.map((c) => c.id), ...cards.map((c) => c.id)]) {
  if (ids.has(id)) { console.error('duplicate id ' + id); process.exit(1) }
  ids.add(id)
}
const byType = cards.reduce<Record<string, number>>((a, c) => ((a[c.type] = (a[c.type] ?? 0) + 1), a), {})
console.log(`OK: ${r.data.concepts.length} concepts, ${cards.length} cards`, byType)
