import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { erase, outline, tracePath, type Point, type Stroke } from './ink'

export interface CanvasHandle {
  canvas(): HTMLCanvasElement | null
  hasInk(): boolean
}

const INK = '#1D2A8C'
const ERASER_R = 12
const MAX_HISTORY = 200

type Tool = 'pen' | 'eraser'
type Active = {
  id: number
  touch: boolean
  rect: DOMRect
  stroke?: Stroke // pen gesture
  before?: Stroke[] // eraser gesture: strokes when it started
  last?: Point // eraser gesture: previous position
}

const raf = (cb: () => void) =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : window.setTimeout(cb, 16)

export function Canvas({ ref, onChange, height = 420 }: { ref?: Ref<CanvasHandle>; onChange?: (hasInk: boolean) => void; height?: number }) {
  const el = useRef<HTMLCanvasElement>(null)
  const base = useRef<HTMLCanvasElement | null>(null) // finished strokes, rendered once
  const strokes = useRef<Stroke[]>([])
  const history = useRef<Stroke[][]>([])
  const active = useRef<Active | null>(null)
  const penSeen = useRef(false)
  const frame = useRef(0)
  const [tool, setTool] = useState<Tool>('pen')

  useImperativeHandle(ref, () => ({
    canvas: () => {
      if (frame.current) draw()
      return el.current
    },
    hasInk: () => strokes.current.length > 0,
  }))

  const dpr = () => window.devicePixelRatio || 1

  function paint(ctx: CanvasRenderingContext2D, list: Stroke[], last: boolean) {
    ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0)
    ctx.fillStyle = INK
    for (const s of list) {
      tracePath(ctx, outline(s, last))
      ctx.fill()
    }
  }

  function renderBase() {
    const c = el.current
    if (!c) return
    const b = (base.current ??= document.createElement('canvas'))
    if (b.width !== c.width || b.height !== c.height) {
      b.width = c.width
      b.height = c.height
    }
    const ctx = b.getContext('2d')
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, b.width, b.height)
      paint(ctx, strokes.current, true)
    }
    schedule()
  }

  function draw() {
    frame.current = 0
    const c = el.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    if (base.current) ctx.drawImage(base.current, 0, 0)
    const a = active.current
    if (a?.stroke) paint(ctx, [a.stroke], false)
    if (a?.last) {
      ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0)
      ctx.beginPath()
      ctx.arc(a.last.x, a.last.y, ERASER_R, 0, Math.PI * 2)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(60, 64, 80, 0.45)'
      ctx.stroke()
    }
  }

  function schedule() {
    if (!frame.current) frame.current = raf(draw)
  }

  useEffect(() => {
    const c = el.current
    if (!c) return
    const resize = () => {
      const r = c.getBoundingClientRect()
      c.width = Math.round(r.width * dpr())
      c.height = Math.round(r.height * dpr())
      renderBase()
      draw()
    }
    resize()
    // iPadOS starts text selection, the magnifier or Scribble on long presses unless touches are cancelled
    const block = (e: Event) => e.preventDefault()
    const noSelect = (e: Event) => {
      if (active.current) e.preventDefault()
    }
    c.addEventListener('touchstart', block, { passive: false })
    c.addEventListener('touchmove', block, { passive: false })
    c.addEventListener('contextmenu', block)
    document.addEventListener('selectstart', noSelect)
    window.addEventListener('resize', resize)
    return () => {
      c.removeEventListener('touchstart', block)
      c.removeEventListener('touchmove', block)
      c.removeEventListener('contextmenu', block)
      document.removeEventListener('selectstart', noSelect)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const notify = () => onChange?.(strokes.current.length > 0)
  const remember = (prev: Stroke[]) => {
    history.current.push(prev)
    if (history.current.length > MAX_HISTORY) history.current.shift()
  }

  const pos = (a: Active, e: PointerEvent): Point => ({
    x: e.clientX - a.rect.left,
    y: e.clientY - a.rect.top,
    p: e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5,
  })

  /** Pencil delivers ~240 samples/s but the browser only dispatches one event per frame. */
  const samples = (e: PointerEvent): PointerEvent[] => {
    const list = e.getCoalescedEvents?.()
    return list && list.length ? list : [e]
  }

  function eraseTo(a: Active, pt: Point): boolean {
    const next = erase(strokes.current, a.last ?? pt, pt, ERASER_R)
    a.last = pt
    if (!next) return false
    strokes.current = next
    return true
  }

  function cancelActive() {
    const a = active.current
    active.current = null
    if (a?.before && strokes.current !== a.before) {
      strokes.current = a.before
      renderBase()
    }
    schedule()
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const isPen = e.pointerType === 'pen'
    if (isPen) {
      penSeen.current = true
      if (active.current?.touch) cancelActive() // the palm landed before the pen
    } else if (e.pointerType === 'touch' && penSeen.current) {
      return // palm rejection once a pen is in use
    }
    if (active.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const a: Active = { id: e.pointerId, touch: e.pointerType === 'touch', rect: e.currentTarget.getBoundingClientRect() }
    active.current = a
    const pt = pos(a, e.nativeEvent)
    if (tool === 'pen') {
      a.stroke = { points: [pt], pen: isPen }
      schedule()
    } else {
      a.before = strokes.current
      if (eraseTo(a, pt)) renderBase()
      else schedule()
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const a = active.current
    if (!a || e.pointerId !== a.id) return
    let erased = false
    for (const ev of samples(e.nativeEvent)) {
      const pt = pos(a, ev)
      if (a.stroke) a.stroke.points.push(pt)
      else erased = eraseTo(a, pt) || erased
    }
    if (erased) renderBase()
    else schedule()
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    const a = active.current
    if (!a || e.pointerId !== a.id) return
    active.current = null
    if (a.stroke) {
      remember(strokes.current)
      strokes.current = [...strokes.current, a.stroke]
      renderBase()
    } else {
      if (a.before && strokes.current !== a.before) remember(a.before)
      schedule()
    }
    notify()
  }

  const undo = () => {
    const prev = history.current.pop()
    if (!prev) return
    strokes.current = prev
    renderBase()
    notify()
  }
  const clear = () => {
    if (!strokes.current.length) return
    remember(strokes.current)
    strokes.current = []
    renderBase()
    notify()
  }

  return (
    <div className="pen-area" style={{ height }}>
      <canvas
        ref={el}
        aria-label="Rityta för handskrivet svar"
        className={tool === 'eraser' ? 'erasing' : undefined}
        style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="pen-tools">
        <button className="btn" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>Penna</button>
        <button className="btn" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>Sudd</button>
        <button className="btn" onClick={undo}>Ångra</button>
        <button className="btn" onClick={clear}>Rensa</button>
      </div>
    </div>
  )
}
