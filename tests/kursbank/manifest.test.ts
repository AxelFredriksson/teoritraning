import { expect, test } from 'vitest'
import { diffManifest } from '../../scripts/kursbank/manifest'

test('diffManifest classifies added, changed, removed', () => {
  const d = diffManifest({ 'a.pdf': '1', 'b.pdf': '2', 'c.pdf': '3' }, { 'a.pdf': '1', 'b.pdf': 'X', 'd.pdf': '4' })
  expect(d).toEqual({ added: ['d.pdf'], changed: ['b.pdf'], removed: ['c.pdf'] })
})
