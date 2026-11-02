import { getStroke } from 'perfect-freehand'

export type Point = { x: number; y: number; p: number }
/** `pen` = the points carry real stylus pressure; otherwise pressure is simulated from speed. */
export type Stroke = { points: Point[]; pen: boolean }
type XY = { x: number; y: number }

const INK = { size: 4.2, thinning: 0.55, smoothing: 0.55, streamline: 0.35 }

/** The filled outline polygon of a stroke (variable width, smoothed). `last` = the stroke is finished. */
export function outline(s: Stroke, last = true): number[][] {
  return getStroke(
    s.points.map((q) => [q.x, q.y, q.p]),
    { ...INK, simulatePressure: !s.pen, last },
  )
}

type PathCtx = Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'quadraticCurveTo' | 'closePath'>

/** Traces a closed polygon with quadratic curves through the edge midpoints, so it has no corners. */
export function tracePath(ctx: PathCtx, pts: number[][]) {
  const n = pts.length
  if (n < 3) return
  const mid = (i: number) => {
    const [x0, y0] = pts[i % n]
    const [x1, y1] = pts[(i + 1) % n]
    return [(x0 + x1) / 2, (y0 + y1) / 2]
  }
  ctx.beginPath()
  const [sx, sy] = mid(n - 1)
  ctx.moveTo(sx, sy)
  for (let i = 0; i < n; i++) {
    const [mx, my] = mid(i)
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
  }
  ctx.closePath()
}

function distToSeg(q: XY, a: XY, b: XY): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2))
  return Math.hypot(q.x - (a.x + t * dx), q.y - (a.y + t * dy))
}

const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

function segDist(p1: XY, p2: XY, a: XY, b: XY): number {
  const d1 = cross(a, b, p1)
  const d2 = cross(a, b, p2)
  const d3 = cross(p1, p2, a)
  const d4 = cross(p1, p2, b)
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0
  return Math.min(distToSeg(p1, a, b), distToSeg(p2, a, b), distToSeg(a, p1, p2), distToSeg(b, p1, p2))
}

/**
 * Erases everything within `r` of the eraser path a→b. Strokes are cut where the eraser passes,
 * so only the touched part disappears. Returns null when nothing was touched.
 */
export function erase(strokes: Stroke[], a: XY, b: XY, r: number): Stroke[] | null {
  let changed = false
  const out: Stroke[] = []
  for (const s of strokes) {
    const pts = s.points
    const runs: Point[][] = []
    let run: Point[] = []
    let cut = false
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i]
      if (distToSeg(q, a, b) <= r) {
        cut = true
        if (run.length) runs.push(run)
        run = []
        continue
      }
      if (run.length && segDist(pts[i - 1], q, a, b) <= r) {
        cut = true
        runs.push(run)
        run = []
      }
      run.push(q)
    }
    if (run.length) runs.push(run)
    if (!cut) {
      out.push(s)
      continue
    }
    changed = true
    // a lone point left over from a cut would show up as a speck
    for (const part of runs) if (part.length > 1) out.push({ ...s, points: part })
  }
  return changed ? out : null
}
