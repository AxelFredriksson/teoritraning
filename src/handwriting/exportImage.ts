const MAX_SIDE = 1600
const QUALITIES = [0.92, 0.8, 0.7, 0.6, 0.5, 0.4]

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', q))

async function toBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Downscales the drawing to ≤1600 px on a white background and compresses it to JPEG under maxBytes. */
export async function exportImage(
  source: HTMLCanvasElement,
  maxBytes = 1_500_000,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): Promise<string> {
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height))
  const out = makeCanvas()
  out.width = Math.round(source.width * scale)
  out.height = Math.round(source.height * scale)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(source, 0, 0, out.width, out.height)
  for (const q of QUALITIES) {
    const blob = await toBlob(out, q)
    if (blob.size <= maxBytes) return toBase64(blob)
  }
  throw new Error('Bilden är för stor')
}
