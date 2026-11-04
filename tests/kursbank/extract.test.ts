import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { zipDest } from '../../scripts/kursbank/extract'

const EX = join('bank', 'x', 'extract')

test('zipDest is a folder named after the zip inside the extract dir', () => {
  expect(zipDest(EX, 'tentor/2024-01.zip')).toBe(resolve(EX, '2024-01'))
})

test('zipDest refuses destinations that are the extract dir itself or outside it', () => {
  expect(() => zipDest(EX, 'a/..zip')).toThrow(/extract/)
  expect(() => zipDest(EX, 'a/...zip')).toThrow(/extract/)
})

test('zipDest allows names that merely start with two dots', () => {
  expect(zipDest(EX, '..gammal.zip')).toBe(resolve(EX, '..gammal'))
})

test('writeManifestFromPending records the hashes seen at extract time, not the current folder', async () => {
  const { mkdtempSync, writeFileSync, readFileSync, mkdirSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { writeManifestFromPending } = await import('../../scripts/kursbank/extract')
  const dir = mkdtempSync(join(tmpdir(), 'kb-'))
  mkdirSync(join(dir, 'extract'))
  writeFileSync(join(dir, 'extract', 'manifest.pending.json'), JSON.stringify({ 'a.pdf': 'h1' }))
  writeManifestFromPending(dir)
  expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).toEqual({ 'a.pdf': 'h1' })
})

test('writeManifestFromPending refuses when extract has not run', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { writeManifestFromPending } = await import('../../scripts/kursbank/extract')
  const dir = mkdtempSync(join(tmpdir(), 'kb-'))
  expect(() => writeManifestFromPending(dir)).toThrow(/extract/)
})
