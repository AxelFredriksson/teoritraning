export const LIMITS = { perHour: 60, perDay: 300, imagesPerDay: 40, textChars: 4000, imageBytes: 1_500_000 } as const

export type LimitResult = { ok: true } | { ok: false; reason: 'hour' | 'day' | 'image_day' | 'too_large' }

export function checkLimits(
  counts: { hour: number; day: number; imageDay: number },
  kind: 'text' | 'image',
  size: { chars?: number; bytes?: number },
): LimitResult {
  if ((size.chars ?? 0) > LIMITS.textChars || (size.bytes ?? 0) > LIMITS.imageBytes) return { ok: false, reason: 'too_large' }
  if (counts.hour >= LIMITS.perHour) return { ok: false, reason: 'hour' }
  if (counts.day >= LIMITS.perDay) return { ok: false, reason: 'day' }
  if (kind === 'image' && counts.imageDay >= LIMITS.imagesPerDay) return { ok: false, reason: 'image_day' }
  return { ok: true }
}
