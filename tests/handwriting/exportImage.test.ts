import { expect, test } from 'vitest'
import { exportImage } from '../../src/handwriting/exportImage'

function fakeCanvas(sizes: (q: number) => number, w = 3200, h = 2000) {
  const qualities: number[] = []
  const target = {
    width: 0,
    height: 0,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
    toBlob(cb: (b: Blob | null) => void, _type: string, q: number) {
      qualities.push(q)
      cb(new Blob([new Uint8Array(sizes(q))]))
    },
  }
  const source = { width: w, height: h } as HTMLCanvasElement
  return { source, target: target as unknown as HTMLCanvasElement, qualities }
}

test('exportImage reduces quality until under maxBytes', async () => {
  const { source, target, qualities } = fakeCanvas((q) => Math.round(q * 2_000_000))
  const b64 = await exportImage(source, 1_500_000, () => target)
  expect(typeof b64).toBe('string')
  expect(qualities[0]).toBeGreaterThan(qualities[qualities.length - 1])
  expect(qualities[qualities.length - 1] * 2_000_000).toBeLessThanOrEqual(1_500_000)
})

test('exportImage downscales longest side to 1600', async () => {
  const { source, target } = fakeCanvas(() => 1000)
  await exportImage(source, 1_500_000, () => target)
  expect(target.width).toBe(1600)
  expect(target.height).toBe(1000)
})

test('exportImage throws when still too large at 0.4', async () => {
  const { source, target } = fakeCanvas(() => 2_000_000)
  await expect(exportImage(source, 1_500_000, () => target)).rejects.toThrow()
})
