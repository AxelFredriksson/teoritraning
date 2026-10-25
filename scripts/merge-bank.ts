// Merges bank/parts/*.json with verifier verdicts in bank/verify/*.json into bank/tata77.json.
// A part is only included when its verify file exists. FLAG → status "flagged" with the note.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BankSchema } from '../src/bank/schema'

type Verdicts = Record<string, { result: 'PASS' | 'FLAG'; note?: string }>

const concepts: unknown[] = []
const report: string[] = []
for (const f of readdirSync('bank/parts').filter((f) => f.endsWith('.json')).sort()) {
  const vpath = `bank/verify/${f}`
  if (!existsSync(vpath)) { report.push(`${f}: skipped (not verified)`); continue }
  const part = JSON.parse(readFileSync(`bank/parts/${f}`, 'utf8'))
  const v: Verdicts = JSON.parse(readFileSync(vpath, 'utf8'))
  let flagged = 0, missing = 0
  for (const k of part.concepts) {
    for (const c of k.cards) {
      const r = v[c.id]
      if (!r) { missing++; c.status = 'flagged'; c.verifyNote = 'Ej kontrollerad'; continue }
      if (r.result === 'FLAG') { flagged++; c.status = 'flagged'; c.verifyNote = r.note }
    }
    concepts.push(k)
  }
  report.push(`${f}: ${part.concepts.length} concepts, flagged ${flagged}, unverified ${missing}`)
}
const bank = BankSchema.parse({ course: { id: 'TATA77', name: 'Fourieranalys' }, concepts })
writeFileSync('bank/tata77.json', JSON.stringify(bank, null, 1))
console.log(report.join('\n'))
console.log(`total cards: ${bank.concepts.reduce((n, k) => n + k.cards.length, 0)}`)
