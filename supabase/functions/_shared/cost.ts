// USD per million tokens [input, output]
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
}
export const USD_TO_SEK = 11

export function estimateCostSek(model: string, usage: { input_tokens: number; output_tokens: number }): number {
  const p = PRICES[model]
  if (!p) return 0
  return ((usage.input_tokens * p[0] + usage.output_tokens * p[1]) / 1e6) * USD_TO_SEK
}
