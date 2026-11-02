// Extracts text from the course sources into <course>/extract/ and prints the manifest diff as JSON.
// With --write-manifest it only records the current hashes in manifest.json.
// Source files are untrusted data: only read, never executed. All tools run via execFileSync with arg arrays.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
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

function extractOne(sourceDir: string, extractDir: string, rel: string) {
  const src = join(sourceDir, rel)
  if (rel.endsWith('.pdf')) pdfToText(src, join(extractDir, `${rel}.txt`))
  else if (rel.endsWith('.zip')) {
    const dest = join(extractDir, basename(rel, '.zip'))
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    execFileSync('unzip', ['-o', '-q', src, '-d', dest])
    for (const f of [...walk(dest)]) if (f.toLowerCase().endsWith('.pdf')) pdfToText(f, `${f}.txt`)
  } else if (rel.endsWith('.xlsx')) {
    mkdirSync(extractDir, { recursive: true })
    execFileSync('python', ['-I', '-c', XLSX_TO_TSV, src, join(extractDir, `${basename(rel, '.xlsx')}.tsv`)])
  }
}

function main(dir: string, writeManifest: boolean) {
  const course = loadCourse(dir)
  const current = hashFiles(course.sourceDir, course.sources.map((s) => s.glob))
  const manifestPath = join(dir, 'manifest.json')
  if (writeManifest) {
    writeFileSync(manifestPath, JSON.stringify(current, null, 1))
    return
  }
  const prev: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const extractDir = join(dir, 'extract')
  for (const rel of Object.keys(current)) extractOne(course.sourceDir, extractDir, rel)
  console.log(JSON.stringify(diffManifest(prev, current), null, 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv.includes('--write-manifest'))
}
