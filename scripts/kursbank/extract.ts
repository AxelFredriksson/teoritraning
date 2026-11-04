// Extracts text from the course sources into <course>/extract/ and prints the manifest diff as JSON.
// With --write-manifest it records in manifest.json the hashes captured by the last extract run (extract/manifest.pending.json).
// Source files are untrusted data: only read, never executed. All tools run via execFileSync with arg arrays.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadCourse } from './config'
import { diffManifest, hashFiles } from './manifest'

const XLSX_TO_TSV = [
  'import sys, openpyxl',
  'wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)',
  "with open(sys.argv[2], 'w', encoding='utf-8', newline='') as out:",
  '    for ws in wb.worksheets:',
  '        for row in ws.iter_rows(values_only=True):',
  "            cells = ['' if v is None else str(v).replace('\\t', ' ').replace('\\n', ' ').replace('\\r', ' ') for v in row]",
  "            out.write('\\t'.join(cells) + '\\n')",
].join('\n')

function pdfToText(pdf: string, txt: string) {
  mkdirSync(dirname(txt), { recursive: true })
  execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, txt])
}

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

/** Where a zip is unpacked; this folder is deleted first, so it must be a strict child of the extract dir. */
export function zipDest(extractDir: string, rel: string): string {
  const root = resolve(extractDir)
  const dest = resolve(root, basename(rel, '.zip'))
  const r = relative(root, dest)
  if (!r || r === '..' || r.startsWith('..' + sep) || isAbsolute(r)) {
    throw new Error(`Zip-mål ${dest} för ${rel} ligger inte i extract-mappen ${root}; vägrar radera det.`)
  }
  return dest
}

function extractOne(sourceDir: string, extractDir: string, rel: string) {
  const src = join(sourceDir, rel)
  if (rel.endsWith('.pdf')) pdfToText(src, join(extractDir, `${rel}.txt`))
  else if (rel.endsWith('.zip')) {
    const dest = zipDest(extractDir, rel)
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    execFileSync('unzip', ['-o', '-q', src, '-d', dest])
    for (const f of [...walk(dest)]) if (f.toLowerCase().endsWith('.pdf')) pdfToText(f, `${f}.txt`)
  } else if (rel.endsWith('.xlsx')) {
    mkdirSync(extractDir, { recursive: true })
    execFileSync('python', ['-I', '-c', XLSX_TO_TSV, src, join(extractDir, `${basename(rel, '.xlsx')}.tsv`)])
  }
}

const pendingPath = (dir: string) => join(dir, 'extract', 'manifest.pending.json')

/** Records the hashes captured by the last extract run, so files added to the course folder mid-run stay "new". */
export function writeManifestFromPending(dir: string) {
  if (!existsSync(pendingPath(dir))) throw new Error(`Ingen ${pendingPath(dir)}: kör extract (utan --write-manifest) först.`)
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(JSON.parse(readFileSync(pendingPath(dir), 'utf8')), null, 1))
}

function main(dir: string, writeManifest: boolean) {
  if (writeManifest) return writeManifestFromPending(dir)
  const course = loadCourse(dir)
  const current = hashFiles(course.sourceDir, course.sources.map((s) => s.glob))
  const manifestPath = join(dir, 'manifest.json')
  const prev: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const extractDir = join(dir, 'extract')
  for (const rel of Object.keys(current)) extractOne(course.sourceDir, extractDir, rel)
  writeFileSync(pendingPath(dir), JSON.stringify(current, null, 1))
  console.log(JSON.stringify(diffManifest(prev, current), null, 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv.includes('--write-manifest'))
}
