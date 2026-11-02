import { expect, test, vi } from 'vitest'
import { erase, outline, tracePath, type Stroke } from '../../src/handwriting/ink'

const line = (x0: number, x1: number, y = 0, step = 2): Stroke => {
  const points = []
  for (let x = x0; x <= x1; x += step) points.push({ x, y, p: 0.5 })
  return { points, pen: true }
}
const dot = (x: number, y: number): Stroke => ({ points: [{ x, y, p: 0.5 }], pen: true })

test('returns null when the eraser touches nothing', () => {
  const s = [line(0, 100)]
  expect(erase(s, { x: 50, y: 40 }, { x: 60, y: 40 }, 10)).toBeNull()
})

test('erasing the middle of a line splits it in two', () => {
  const out = erase([line(0, 100)], { x: 50, y: 0 }, { x: 50, y: 0 }, 5)!
  expect(out).toHaveLength(2)
  expect(Math.max(...out[0].points.map((q) => q.x))).toBeLessThan(45)
  expect(Math.min(...out[1].points.map((q) => q.x))).toBeGreaterThan(55)
})

test('a dot can be erased', () => {
  expect(erase([dot(10, 10)], { x: 12, y: 11 }, { x: 12, y: 11 }, 5)).toEqual([])
})

test('the eraser sweeps the whole path between two samples', () => {
  const out = erase([dot(50, 0)], { x: 0, y: 0 }, { x: 100, y: 0 }, 3)
  expect(out).toEqual([])
})

test('cuts a sparse segment that passes under the eraser without a point nearby', () => {
  const sparse: Stroke = { points: [{ x: 0, y: 0, p: 0.5 }, { x: 100, y: 0, p: 0.5 }], pen: true }
  // both endpoints survive but alone they are specks, so the stroke disappears
  expect(erase([sparse], { x: 50, y: -2 }, { x: 50, y: 2 }, 3)).toEqual([])
})

test('untouched strokes are kept as the same objects', () => {
  const keep = line(0, 20, 200)
  const out = erase([keep, line(0, 100)], { x: 50, y: 0 }, { x: 50, y: 0 }, 5)!
  expect(out[0]).toBe(keep)
})

test('a single-point stroke still gets an outline (dots are visible)', () => {
  expect(outline(dot(10, 10)).length).toBeGreaterThan(3)
})

test('tracePath draws a closed smooth shape', () => {
  const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn() }
  tracePath(ctx, [[0, 0], [10, 0], [10, 10], [0, 10]])
  expect(ctx.beginPath).toHaveBeenCalledOnce()
  expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4)
  expect(ctx.closePath).toHaveBeenCalledOnce()
})
