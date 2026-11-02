import { createHash } from 'node:crypto'
import { globSync, readFileSync } from 'node:fs'

export function diffManifest(prev: Record<string, string>, current: Record<string, string>) {
  const added = Object.keys(current).filter((k) => !(k in prev))
  const changed = Object.keys(current).filter((k) => k in prev && prev[k] !== current[k])
  const removed = Object.keys(prev).filter((k) => !(k in current))
  return { added, changed, removed }
}

// Globs are resolved relative to root; keys use forward slashes.
export function hashFiles(root: string, globs: string[]): Record<string, string> {
  const rels = new Set<string>()
  for (const g of globs) for (const p of globSync(g, { cwd: root })) rels.add(p.replace(/\\/g, '/'))
  const out: Record<string, string> = {}
  for (const rel of [...rels].sort()) {
    out[rel] = createHash('sha256').update(readFileSync(`${root}/${rel}`)).digest('hex')
  }
  return out
}
