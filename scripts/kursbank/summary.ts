import type { Bank } from '../../src/bank/schema'

type Report = { flagged: { id: string; note: string }[]; unverified: string[] }

const countBy = <T>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return m
}

export function runSummary(prevBank: Bank | null, bank: Bank, report: Report): string {
  const prevConcepts = new Set(prevBank?.concepts.map((k) => k.id) ?? [])
  const prevCards = new Set(prevBank?.concepts.flatMap((k) => k.cards.map((c) => c.id)) ?? [])
  const newConcepts = bank.concepts.filter((k) => !prevConcepts.has(k.id))
  const newCards = bank.concepts.flatMap((k) =>
    k.cards.filter((c) => !prevCards.has(c.id)).map((c) => ({ lecture: k.lecture, type: c.type })),
  )
  const onlyContent = bank.concepts.filter((k) => k.cards.every((c) => c.type === 'content')).length

  const lines = [`# Sammanfattning ${bank.course.id}`, '', `Nya begrepp: ${newConcepts.length}`, `Nya kort: ${newCards.length}`]
  const byLecture = countBy(newCards, (c) => String(c.lecture))
  for (const l of [...byLecture.keys()].sort((a, b) => Number(a) - Number(b))) {
    const types = countBy(newCards.filter((c) => String(c.lecture) === l), (c) => c.type)
    lines.push(`- Föreläsning ${l}: ${byLecture.get(l)} kort (${[...types].map(([t, n]) => `${t} ${n}`).join(', ')})`)
  }
  lines.push('', `Begrepp med bara innehållskort: ${onlyContent}`, '', `Flaggade kort: ${report.flagged.length}`)
  for (const f of report.flagged) lines.push(`- ${f.id}: ${f.note}`)
  lines.push('', `Ej kontrollerade kort: ${report.unverified.length}`)
  return lines.join('\n')
}
