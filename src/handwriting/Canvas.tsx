import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'

type Point = { x: number; y: number; p: number }
type Stroke = Point[]

export interface CanvasHandle {
  canvas(): HTMLCanvasElement | null
  hasInk(): boolean
}

const INK = '#1D2A8C'

export function Canvas({ ref, onChange, height = 420 }: { ref?: Ref<CanvasHandle>; onChange?: (hasInk: boolean) => void; height?: number }) {
  const el = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const penSeen = useRef(false)

  useImperativeHandle(ref, () => ({ canvas: () => el.current, hasInk: () => strokes.current.length > 0 }))

  function redraw() {
    const c = el.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.strokeStyle = INK
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      for (let i = 1; i < s.length; i++) {
        ctx.lineWidth = 1.2 + 2.4 * s[i].p
        ctx.beginPath()
        ctx.moveTo(s[i - 1].x, s[i - 1].y)
        ctx.lineTo(s[i].x, s[i].y)
        ctx.stroke()
      }
    }
  }

  useEffect(() => {
    const c = el.current
    if (!c) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const r = c.getBoundingClientRect()
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      redraw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5 }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'pen') penSeen.current = true
    if (e.pointerType === 'touch' && penSeen.current) return // palm rejection once a pen is in use
    e.currentTarget.setPointerCapture?.(e.pointerId)
    current.current = [point(e)]
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return
    current.current.push(point(e))
    redraw()
  }
  function up() {
    if (!current.current) return
    if (current.current.length > 1) strokes.current.push(current.current)
    current.current = null
    redraw()
    onChange?.(strokes.current.length > 0)
  }

  const undo = () => {
    strokes.current.pop()
    redraw()
    onChange?.(strokes.current.length > 0)
  }
  const clear = () => {
    strokes.current = []
    redraw()
    onChange?.(false)
  }

  return (
    <div className="pen-area" style={{ height }}>
      <canvas
        ref={el}
        aria-label="Rityta för handskrivet svar"
        style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="pen-tools">
        <button className="btn" aria-label="Ångra" onClick={undo}>Ångra</button>
        <button className="btn" aria-label="Rensa" onClick={clear}>Rensa</button>
      </div>
    </div>
  )
}
