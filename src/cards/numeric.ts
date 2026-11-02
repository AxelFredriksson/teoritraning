/** Parses a user-typed number: Swedish or English decimal, optional unit/percent suffix. */
export function parseNumber(input: string): number | null {
  let s = input.replace(/[\s   ]/g, '').replace(/−/g, '-')
  s = s.replace(/[%a-zA-ZåäöÅÄÖ]+$/, '')
  if (!/^-?\d+([.,]\d+)?(e-?\d+)?$/i.test(s)) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function checkNumeric(input: string, value: number, tolerance: number): boolean {
  const n = parseNumber(input)
  return n !== null && Math.abs(n - value) <= tolerance + 1e-12
}

/** Swedish decimal comma, at most 4 decimals, trailing zeros trimmed. */
export function formatNumber(n: number): string {
  return String(Number(n.toFixed(4))).replace('.', ',')
}
