# Teoriträning del 2 (kursbank-generator + räknekort) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A project Claude Code skill `/kursbank <KURS>` that builds and incrementally extends a verified question bank from a local course folder and uploads it automatically, plus a new calc card type in the app. Delivered by running it on TPPE29.

**Architecture:** The deterministic parts are small TypeScript scripts under `scripts/kursbank/`, each with a pure core tested by Vitest:
- source manifest and extraction
- merging parts with verifier verdicts, ID preservation, and calc-answer checks
- the upload planner that encodes the review-decision rules, and the uploader

The judgement parts (concept inventory, card writing, verification) are done by Claude and its subagents, following `.claude/skills/kursbank/`. Each course gets a workspace `bank/<kurs>/`. The app gains:
- a `calc` card type with a local numeric check
- a `reasoning` type
- an AI "find my error" mode on the existing `grade` Edge Function

**Tech Stack:** Existing stack (Vite, React 19, TypeScript, Vitest, zod 4, supabase-js 2, tsx). Text extraction uses `pdftotext -enc UTF-8` (Git Bash), Python 3 + openpyxl for xlsx, and `unzip`. Supabase changes go through MCP `apply_migration` (allowed). The upload script uses the service-role key from a git-ignored file.

**Spec:** `docs/superpowers/specs/2026-11-02-kursbank-generator-design.md` (builds on `2026-10-24-teoritranare-design.md`)

## Global Constraints

- All UI copy and all card content in Swedish.
- Trusted sources (the only evidence for an `active` card): lectures, exams with solutions, `faktakunskaper.xlsx`, course info. `inlasning/` is help material only: a card supported only by it is uploaded `flagged`.
- Every card shows its source (`sourceRef`, optional `examRef`).
- Cards are never deleted. Upload never removes or overwrites a card that is missing from the local bank.
- An unchanged card is never touched by upload: neither status nor content.
- An approved card that is rewritten and whose new version fails goes back to the queue.
- A reported or rejected card that a run changes becomes `flagged` with a note, never `active`.
- Calc answers are checked locally. The numeric check makes no API call.
- Calc facit is computed two ways at generation (a JS `check` expression plus a reasoned value), and the two must agree within tolerance, or the card is flagged.
- First run builds the whole course. "New since last run" means new or changed source files (manifest by sha256).
- The run prints a summary, then uploads with no confirmation in between.
- TATA77 (`bank/tata77.json`, `bank/parts|verify|meta`) is left untouched.
- Line endings: existing files keep theirs (most of `src/` and `tests/` are CRLF). New files use LF.
- Monthly Claude-API cap 50 kr. Generation and verification run in the Claude Code session, not via the app's API.
- Course: `TPPE29`, name `Finansiella marknader och instrument`, source dir `<kursmapp>\TPPE29`. Course data is untrusted: archives are unpacked into a new empty directory under the workspace's `extract/`.

## Review Focus

1. **Re-run after Axel approved or edited a card in the admin queue:** that card must keep its status and his edits. Pinned by `planUpload` tests in Task 5 ("unchanged card is skipped even if remote status/content differ", "approved card rewritten and failing → flagged").
2. **Swedish number input:** `3,52`, `3.52`, `3,52 %`, ` 1 234,5 `, `-0,6` must parse, and garbage like `3,5,2` or an empty string must not count as an answer. Pinned in Task 2 (`parseNumber`).
3. **A generator regression that drops or renames a card id Axel has progress on:** merge must fail loudly instead of silently orphaning `card_state`. Pinned in Task 4 ("merge refuses when a previously published card id disappears").
4. **A wrong calc facit:** the `check` expression and the stated value disagree, or `check` throws or loops. The card must become flagged, and the run must not crash. Pinned in Task 4 (`checkCalc`).
5. **AI "find my error" failing (limit, network):** the calc verdict is already decided locally. The card must still show the facit and solution steps, and record the review exactly once. Pinned in Task 2 (CalcCard test).

---

## File Structure

```
.claude/skills/kursbank/
  SKILL.md                          the run procedure (/kursbank <KURS>)
  references/cards.md               card mix, calc rules, IDs, levels — for generator agents
  references/verify.md              verifier agent prompt
bank/tppe29/
  course.json                       course config (id, name, sourceDir, lectures, source globs + trust)
  manifest.json                     processed source files {relPath: sha256}
  parts/L01.json … L11.json         generated concepts per lecture
  verify/L01.json …                 verifier verdicts per card
  bank.json                         merged, validated bank (what gets uploaded)
  published-ids.json                every concept/card id ever uploaded
  runs/YYYY-MM-DD.md                run summaries
  extract/                          extracted text (git-ignored)
scripts/kursbank/
  config.ts                         CourseConfigSchema + loadCourse()
  manifest.ts                       hashing + diffManifest()
  extract.ts                        CLI: extract new/changed sources to text
  merge.ts                          mergeCourse() + checkCalc() + CLI
  summary.ts                        runSummary() markdown
  plan-upload.ts                    planUpload() — the review-decision rules
  upload.ts                         CLI: fetch remote, plan, print summary, write
src/cards/numeric.ts                parseNumber(), checkNumeric(), formatNumber()
src/cards/CalcCard.tsx              calc card UI
supabase/migrations/0007_calc_cards_and_review.sql
```

---

### Task 1: Data model — calc and reasoning cards, retired status, review tracking

**Files:**
- Create: `supabase/migrations/0007_calc_cards_and_review.sql`
- Modify: `src/bank/schema.ts`, `src/types.ts`, `src/cards/labels.ts`, `src/data/adminApi.ts`, `scripts/bank-to-sql.ts`, `tests/fixtures.ts`, `tests/bank/fixture.ts`
- Test: `tests/bank/schema.test.ts`, `tests/screens/Admin.test.tsx` (or a new `tests/data/adminApi.test.ts`)

**Interfaces:**
- Produces, in the DB `cards` table:
  - `type` check adds `'calc'` and `'reasoning'`.
  - `answer_mode` check adds `'numeric'`.
  - `status` check adds `'retired'`.
  - New columns: `answer_value double precision`, `answer_tolerance double precision`, `answer_unit text`, `content_hash text`, `reviewed_at timestamptz`.
- Produces in `src/types.ts`:
  - `CardType` gains `'calc' | 'reasoning'`.
  - `CardRow.answer_mode: 'mc' | 'open' | 'numeric'`.
  - `CardRow.status` gains `'retired'`.
  - `CardRow` gains `answer_value: number | null`, `answer_tolerance: number | null`, `answer_unit: string | null`.
- Produces in the bank `CardSchema`:
  - `type` enum adds `'calc' | 'reasoning'`.
  - `answerMode` adds `'numeric'`.
  - `status` adds `'retired'`.
  - Optional `answer: { value: number; tolerance: number (>0); unit?: string; check: string }`. `check` is a JS expression and is never uploaded.
- Produces in the bank `ConceptSchema`: optional `factRefs: number[]` (default `[]`), the `nr` values from faktakunskaper.
- Produces in `TYPE_LABEL`: `calc: 'Räkna'`, `reasoning: 'Resonemang'`.
- Produces in `AdminApi`: `setCardStatus` and `updateCard` also write `reviewed_at: new Date().toISOString()`.

- [ ] **Step 1: Write failing tests** in `tests/bank/schema.test.ts`:
  - `schema accepts a calc card with numeric answer, steps and rubric`: type `calc`, answerMode `numeric`, `answer: { value: 3.52, tolerance: 0.01, unit: '%', check: '...' }`, `steps` with 2 items, `rubricMd`. It must parse.
  - `schema rejects calc card without answer`, `… without steps (min 1)`, `… without rubricMd`, `… with answerMode other than numeric`, and `… with tolerance 0`.
  - `schema rejects numeric answerMode on a non-calc card`.
  - Admin test `approve writes reviewed_at`: the fake client records the `cards` update payload, and the payload has `status: 'active'` and a `reviewed_at` string.
- [ ] **Step 2: Run** `npx vitest run tests/bank tests/screens/Admin.test.tsx`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - In the `superRefine`: `calc` ⇔ `numeric`, and calc requires `answer`, `steps` with ≥1 item, and `rubricMd`.
  - Drop the `steps` min(2) for calc only: keep min 2 for `find_error` inside the refine, and make the base `steps` min(1).
  - `bank-to-sql.ts` adds `answer_value`, `answer_tolerance`, `answer_unit` to `CARD_COLS`. It does **not** write `content_hash` or `reviewed_at`.
  - Update both fixtures so the new nullable fields are `null`.
- [ ] **Step 4: Write the migration** (drop and re-add the three check constraints by name, add the five columns) and apply it with MCP `apply_migration` (project `your-project-ref`, name `0007_calc_cards_and_review`). Verify with `execute_sql`:
  - `select column_name from information_schema.columns where table_name='cards' and column_name in ('answer_value','answer_tolerance','answer_unit','content_hash','reviewed_at')` returns 5 rows.
  - `select count(*) from cards where content_hash is null` = 380.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: all pass. `tsc` will point at every `Record<CardType, …>` that needs the new keys, and `src/game/points.ts` keeps working because it takes `CardType`.
- [ ] **Step 6: Commit** `feat: calc and reasoning card types, retired status, review tracking`

### Task 2: Calc card in the app

**Files:**
- Create: `src/cards/numeric.ts`, `src/cards/CalcCard.tsx`
- Modify: `src/screens/Session.tsx` (render branch, and the "Förklaring" panel condition), `src/data/api.ts` (`gradeOpen` gains `mode`), `src/screens/Admin.tsx` (calc facit in `FlaggedItem`)
- Test: `tests/cards/numeric.test.ts`, `tests/screens/CalcCard.test.tsx`, `tests/screens/Admin.test.tsx`

**Interfaces:**
- Consumes: `CardRow` fields from Task 1, `Canvas`/`CanvasHandle` from `src/handwriting/Canvas`, `exportImage`, `MathText`.
- Produces:
  - `parseNumber(input: string): number | null`
  - `checkNumeric(input: string, value: number, tolerance: number): boolean`
  - `formatNumber(n: number): string` (Swedish decimal comma, up to 4 significant decimals, trailing zeros trimmed)
  - `gradeOpen(cardId, input: { text?: string; imageBase64?: string; mode?: 'find_calc_error' })`, which sends `mode` in the body
  - `CalcCard({ card, narrow, gradeOpen, onAnswer, exportDrawing? })`, where `onAnswer: (v: Verdict, source: 'mc' | 'self') => void`. Auto-checked calc reviews use source `'mc'`, so the DB check on `review_log.source` stays unchanged.

- [ ] **Step 1: Write failing tests.**
  - `parseNumber`:
    - `'3,52'`, `'3.52'`, `'3,52 %'` and `' 3,52% '` → 3.52
    - `'1 234,5'` → 1234.5
    - `'-0,6'` and `'−0,6'` (Unicode minus) → -0.6
    - `'0,5e-2'` → 0.005
    - `''`, `'3,5,2'`, `'abc'` and `'1,2kr3'` → null
    - a trailing unit word such as `'101 kr'` → 101
  - `checkNumeric('3,53', 3.52, 0.01)` is true, and `checkNumeric('3,54', 3.52, 0.01)` is false.
  - CalcCard:
    - `typing the right number marks correct and shows facit and steps`: `onAnswer` is called once with `('correct','mc')`, and the steps text is visible.
    - `wrong number marks incorrect and offers "Hitta mitt fel" only when there is ink`: inject `exportDrawing` and simulate ink via the Canvas `onInk` callback used in `OpenCardHand.test.tsx`.
    - `"Hitta mitt fel" calls gradeOpen with mode find_calc_error and shows feedback, without a second onAnswer`.
    - `when gradeOpen rejects, facit and steps stay visible and the error text "Felsökningen är inte tillgänglig just nu." shows; onAnswer still called exactly once` (Review Focus 5).
    - `Svara is disabled until the input parses`.
  - `"Visa facit" without answering falls back to self-grade`: it reuses `SelfGrade`, and the self verdict calls `onAnswer(v,'self')`. This is the spec's vändkort reserve, so `onAnswer`'s source type is `'mc' | 'self'`.
  - Admin: `flagged calc card shows facit and solution steps`. `FlaggedItem` renders "Facit: {formatNumber(answer_value)} {answer_unit}" and `steps` when `type === 'calc'`.
- [ ] **Step 2: Run** `npx vitest run tests/cards/numeric.test.ts tests/screens/CalcCard.test.tsx`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `numeric.ts`.**
  - Strip whitespace including NBSP and thin space, map `−` to `-`, and strip a trailing `%` or a trailing alphabetic unit.
  - Then require the whole string to match `^-?\d+([.,]\d+)?(e-?\d+)?$`.
- [ ] **Step 4: Implement `CalcCard.tsx`.**
  - Layout:
    - The scratch `Canvas` is shown when `!narrow`. It is optional and is used for the AI help.
    - Below it, a labelled input "Ditt svar" with `inputMode="decimal"` and the unit shown after it.
    - Then the "Svara" button.
  - After answering:
    - A `ResultBox`-style line "Facit: {formatNumber(value)} {unit}".
    - An ordered list of `steps` rendered with `MathText`.
    - `reference_answer_md`.
    - If the answer was wrong and there is ink: a "Hitta mitt fel" button. It exports the image, calls `gradeOpen(card.id, { imageBase64, mode: 'find_calc_error' })`, and shows `feedback` and `missing` like OpenCard does.
  - In `Session.tsx`, branch `current.type === 'calc'` before the mc/open branches, and pass `onAnswer={(v) => onAnswer(v, 'mc')}`.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: all pass.
- [ ] **Step 6: Commit** `feat: calc cards with local numeric check and AI error finding`

### Task 3: Grading function — course-neutral prompt and calc error mode

**Files:**
- Modify: `supabase/functions/_shared/prompt.ts`, `supabase/functions/grade/index.ts`
- Test: `tests/grade/shared.test.ts`

**Interfaces:**
- Produces: `buildGradingPrompt(card, answer: { text?: string; hasImage: boolean; mode?: 'find_calc_error' })`.
  - The grade body accepts `mode`. Any value other than `'find_calc_error'` is ignored.
  - The card select adds `steps`, so that the solution steps reach the prompt in calc mode.

- [ ] **Step 1: Write failing tests.**
  - `system prompt is not math-only`: it must not contain `"i matematik"`, and it must contain `"universitetskurs"`.
  - `find_calc_error mode includes solution steps and asks for the first deviating step`: the userText contains each step and the phrase `"första steget"`.
  - `default mode output is unchanged apart from the system line`: the existing tests still pass.
- [ ] **Step 2: Run** `npx vitest run tests/grade`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - System line: `Du rättar svar på frågor i en universitetskurs (t.ex. matematik eller finans).`
  - In calc mode, append this block before `<student_answer>`:
    - a `Lösning steg för steg:` list
    - the instruction: `Studentens slutsvar var fel. Hitta det första steget där studentens uträkning avviker från lösningen och förklara kort vad som gick fel. Sätt verdict till "incorrect".`
  - `GradableCard` gains `steps?: string[] | null`.
  - In `index.ts`, select `prompt_md, reference_answer_md, rubric_md, steps` and pass `mode`.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Deploy** the `grade` function with MCP `deploy_edge_function`, sending `grade/index.ts` and all four `_shared/*.ts` files. If the call is refused, ask Axel to deploy it from the dashboard or allow the tool. Verify that an unauthenticated POST returns 401: `curl -s -o /dev/null -w "%{http_code}" -X POST https://your-project-ref.supabase.co/functions/v1/grade`.
- [ ] **Step 6: Commit** `feat: course-neutral grading prompt and calc error-finding mode`

### Task 4: Course workspace — config, manifest, extraction, merge

**Files:**
- Create: `scripts/kursbank/config.ts`, `manifest.ts`, `extract.ts`, `merge.ts`, `summary.ts`, `bank/tppe29/course.json`
- Modify: `.gitignore` (add `bank/*/extract/`)
- Test: `tests/kursbank/manifest.test.ts`, `tests/kursbank/merge.test.ts`, `tests/kursbank/summary.test.ts`

**Interfaces:**
- Consumes: `BankSchema`, `ConceptSchema`, `CardSchema` (Task 1).
- Produces:
  - `CourseConfigSchema`, for the shape `{ id: string; name: string; sourceDir: string; lectures: { n: number; title: string }[]; sources: { glob: string; trust: 'trusted' | 'helper' }[] }`
  - `loadCourse(dir: string): CourseConfig`
  - `diffManifest(prev: Record<string,string>, current: Record<string,string>): { added: string[]; changed: string[]; removed: string[] }`
  - `hashFiles(root: string, globs: string[]): Record<string,string>`, mapping each relative path with forward slashes to its sha256 hex
  - `checkCalc(card: Card): { ok: true } | { ok: false; note: string }`
  - `mergeCourse(input: { course: CourseConfig; parts: Concept[][]; verdicts: Record<string, { result: 'PASS' | 'FLAG'; note?: string }>; publishedIds: string[] }): { bank: Bank; report: { flagged: { id: string; note: string }[]; unverified: string[] } }`, which throws `Error('published ids missing: …')`
  - `runSummary(prevBank: Bank | null, bank: Bank, report): string` (markdown)
  - CLIs:
    - `npx tsx scripts/kursbank/extract.ts bank/tppe29` writes text to `extract/` and prints the diff as JSON, but does not update the manifest.
    - `npx tsx scripts/kursbank/extract.ts bank/tppe29 --write-manifest` only writes the current hashes to `manifest.json`.
    - `npx tsx scripts/kursbank/merge.ts bank/tppe29` writes `bank.json` and prints the summary.

- [ ] **Step 1: Write failing tests.**
  - `diffManifest classifies added, changed, removed`.
  - `checkCalc passes when check evaluates within tolerance of value`.
  - `checkCalc flags disagreement with both numbers in the note`.
  - `checkCalc flags a throwing expression and an infinite loop (vm timeout 100 ms) without throwing` (Review Focus 4).
  - `mergeCourse sets FLAG → flagged with note, missing verdict → flagged "Ej kontrollerad"`.
  - `mergeCourse flags a calc card whose check disagrees even if the verifier said PASS`.
  - `mergeCourse refuses when a previously published card id disappears` (Review Focus 3). A card that is still present with status `retired` is fine.
  - `mergeCourse rejects duplicate ids across parts`.
  - `runSummary reports new concepts and cards per lecture and type, flagged with reasons, and the count of concepts with only content cards`.
- [ ] **Step 2: Run** `npx vitest run tests/kursbank`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `checkCalc` evaluates `answer.check` using `node:vm` `runInNewContext(expr, { Math }, { timeout: 100 })` and compares with `|got - value| <= tolerance`.
  - `extract.ts`:
    - PDF: `pdftotext -enc UTF-8 -layout <f> extract/<rel>.txt`.
    - zip: `unzip -o` into `extract/<zipname>/`, then extract each PDF inside the same way.
    - xlsx: `python -I -c` with openpyxl, writing a TSV.
    - Run all of these with `execFileSync` and argument arrays, never through a shell string.
  - `course.json` for TPPE29:
    - `lectures`: the 11 from `Kurspresentation2026.pdf`, i.e. 1 Intro/det finansiella systemet, 2–4 Kreditmarknader, 5 Excel/VBA/Reuters, 6 Derivat – terminer & swaps, 7 Aktiemarknader, 8–9 Derivat – optioner I/II, 10 Derivat – ränte- & valutainstrument, 11 Banking.
    - `sources`:
      - `kursrum-lisam/**/*.pdf` trusted
      - `kursrum-lisam/faktakunskaper.xlsx` trusted
      - `Tentor/*.zip` trusted
      - `inlasning/*.pdf` helper
- [ ] **Step 4: Run** `npm test`. Then run `npx tsx scripts/kursbank/extract.ts bank/tppe29`. Expected:
  - The diff lists all source files as `added`.
  - `extract/` holds about 24 text files, among them 7 exam and 7 solution texts and `faktakunskaper.tsv` with 414 data rows. Check with `wc -l`.
- [ ] **Step 5: Commit** `feat: course workspace tooling — config, manifest, extraction, merge`. Do not commit `extract/`.

### Task 5: Upload planner and uploader

**Files:**
- Create: `scripts/kursbank/plan-upload.ts`, `scripts/kursbank/upload.ts`, `.env.kursbank.example`
- Test: `tests/kursbank/planUpload.test.ts`

**Interfaces:**
- Consumes: `Bank` (Task 1), `bank/<kurs>/published-ids.json` (string[]).
- Produces:
  - `cardHash(conceptId: string, c: Card): string`, the sha256 of a stable JSON of every uploaded card field except `status` and `verifyNote`
  - `RemoteCard = { id: string; status: 'active'|'flagged'|'rejected'|'retired'; content_hash: string | null; reviewed_at: string | null }`
  - `planUpload(bank: Bank, remote: RemoteCard[], reportedIds: Set<string>, today: string): { writes: CardWrite[]; skipped: number; summary: { inserted: number; updated: number; requeued: number; released: number; untouchedMissingLocally: string[] } }`
    - `CardWrite = { id: string; row: Record<string, unknown>; kind: 'insert' | 'update' | 'release' }`
    - `row` is snake_case DB columns including `content_hash`
  - CLI: `npx tsx scripts/kursbank/upload.ts bank/tppe29 [--dry-run]`
    - It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.kursbank`.
    - It upserts the course and all concepts.
    - It fetches the remote cards (`id, status, content_hash, reviewed_at`) and reported card ids.
    - It prints the plan summary, applies the writes in batches of 100, and appends the newly written ids to `published-ids.json`.

**Rules, in this order** (L is the local card, R the remote one, Lh = `cardHash(L)`):
1. No R → insert with L's status, kind `insert`.
2. `R.content_hash === Lh`:
   - If `R.status === 'flagged'` and L is `active` and the id is not reported and `R.reviewed_at` is null, write a status-only update to `active`, kind `release`.
   - Otherwise skip.
3. Hash differs and (the id is reported or `R.status === 'rejected'`) → update the content, set `status: 'flagged'` and `verify_note: 'Ändrad av kursbank-körning ' + today + ' – granska. ' + (L.verifyNote ?? '')`. Counts as `requeued`.
4. Hash differs otherwise → update with L's status and verifyNote. If `R.reviewed_at` is set and L is `flagged`, count it as `requeued`.
5. Remote card ids for this course that are missing from the bank are never written; list them in `untouchedMissingLocally`.

- [ ] **Step 1: Write failing tests**, one per rule:
  - `new card is inserted with its own status`
  - `unchanged card is skipped even if remote status/content differ` (Review Focus 1; covers Axel's admin edits)
  - `unchanged verifier-flagged card is released when it now passes`
  - `unchanged flagged card that was reported is not released`
  - `changed reported card is requeued, not activated`
  - `changed rejected card is requeued`
  - `approved card rewritten and failing → flagged and counted as requeued`
  - `remote card missing locally is untouched and listed`
  - `cardHash ignores status and verifyNote but changes with promptMd`
- [ ] **Step 2: Run** `npx vitest run tests/kursbank/planUpload.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `plan-upload.ts`. Then implement `upload.ts` as a thin wrapper with no logic beyond I/O. With `--dry-run` it prints the summary and makes no writes.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** `feat: upload planner that respects review decisions, and uploader`
- [ ] **Step 6: Manual step for Axel.**
  - Copy `.env.kursbank.example` to `.env.kursbank` and fill in the URL and the service-role key (Supabase dashboard → Project Settings → API keys → `service_role` / secret key). The file is ignored by `.env*`.
  - Add the allow rule `Bash(npx tsx scripts/kursbank/upload.ts:*)` via `/permissions` so that the skill can upload without being blocked.

### Task 6: The skill

**Files:**
- Create: `.claude/skills/kursbank/SKILL.md`, `.claude/skills/kursbank/references/cards.md`, `.claude/skills/kursbank/references/verify.md`

**Interfaces:**
- Consumes: the CLIs from Tasks 4–5 and the schema from Task 1.
- Produces: `/kursbank <KURS>`, which uses `bank/<kurs lowercase>/`. If `course.json` is missing, the skill stops and says what to create; it does not invent a config.

- [ ] **Step 1: Write `SKILL.md`.** The frontmatter `description` triggers on "kursbank", "bygg frågebank", "nya kort för <kurs>" and "kör generatorn". The body is the run procedure, in order:
  1. Run `extract.ts`. If the diff is empty and no flagged cards exist, say "inget nytt" and stop.
  2. **Inventory and exam frequency.**
     - Base the concepts on faktakunskaper: every row, including the TPPE17/Gymnasiet prerequisite rows (level 1). Neighbouring rows may merge into one concept, and `factRefs` records which rows a concept covers.
     - Lectures and exams may add concepts that the list lacks.
     - `examCount` and `examRefs` come from scanning every exam and its solution, with refs in the form `"2025-01-17 #2b"`.
     - On later runs, match new material against existing concepts via `factRefs` and titles before creating any new concept.
  3. **Generate, one subagent per lecture**, using `references/cards.md`. A subagent writes `parts/LNN.json` and must keep every existing id in that part.
  4. **Verify, one fresh subagent per lecture**, using `references/verify.md`. It writes `verify/LNN.json`. Re-verify only new or changed cards, plus flagged cards when a new trusted source was added.
  5. Run `merge.ts`. If it throws on missing published ids, stop and report; never work around it.
  6. Print the summary from `merge.ts` and `upload.ts --dry-run`, and save it to `runs/<date>.md`.
  7. Run `upload.ts`. Then run `extract.ts bank/<kurs> --write-manifest`. Do this only after a successful upload, so a failed run is redone.
  8. Commit `bank/<kurs>` (except `extract/`) with `content: <KURS> kursbank-körning <date>`.
- [ ] **Step 2: Write `references/cards.md`.** It covers:
  - **Card mix.** The type mapping is:
    - begreppskort → `content`
    - sammanhangskort → `recognition`, grounded in an exam task or lecture example, with `examRef` when it comes from an exam
    - räknekort → `calc`
    - resonemangskort → `reasoning` (open, with rubric)
    - The existing `conditions` and `find_error` types are used where they fit.
  - **Context cards.** Write one only where a trusted source gives a situation. Never invent a context.
  - **Calc rules.**
    - One to three steps per card. A large exam problem is decomposed into several cards.
    - `answer.value` is the reasoned result.
    - `answer.check` is an independent JS expression using only `Math`.
    - `tolerance` is half the last displayed decimal, but at least 0.5 % of |value| when the computation involves table lookups (N(x)).
    - `unit` is shown separately.
    - Day-count conventions (Act/360, 30E/360) are stated in the prompt exactly as on the exam.
  - **IDs.**
    - Concept ids use the form `tppe29-<lecture>-<slug>`.
    - Card ids use the form `<conceptId>-<type>-<n>`.
    - Never renumber. To retire a card, keep it and set `status: "retired"`.
  - **Source hierarchy.** This is the Global Constraint rule, and `sourceRef` must name a trusted file and page/slide or an exam ref.
  - **Levels.** 1 Grund (prerequisites and core definitions), 2 Fördjupning, 3 Avancerat. Every card gets a `title`.
  - **Language and formatting.** Swedish throughout, and math in `$…$`.
- [ ] **Step 3: Write `references/verify.md`.** It holds the verifier prompt, which:
  - checks each card against the cited **trusted** source
  - FLAGs any card that only `inlasning/` supports
  - recomputes every calc card by hand, independently of `check`
  - FLAGs ambiguous wording
  - outputs JSON `{ [cardId]: { result: 'PASS'|'FLAG', note } }`, where the note always names the source it checked
- [ ] **Step 4: Verify** that the skill shows up in a fresh Claude Code session. Ask Axel to start one and check that `/kursbank` is listed. If it is not, check the frontmatter `name: kursbank`.
- [ ] **Step 5: Commit** `feat: kursbank skill`

### Task 7: First TPPE29 run and release

**Files:**
- Create: `bank/tppe29/parts/*.json`, `verify/*.json`, `bank.json`, `published-ids.json`, `manifest.json`, `runs/2026-11-0X.md`

- [ ] **Step 1: Run `/kursbank TPPE29`** following the skill exactly. This is the skill's acceptance test: any deviation from the procedure that the run needs is fixed in `SKILL.md` and committed.
- [ ] **Step 2: Check coverage.** All 414 faktakunskaper rows appear in some concept's `factRefs`. Report any rows that are deliberately left out, with the reason. There are calc cards for at least day-count/effective rate, bond price/duration, forward/arbitrage, minimum-variance portfolio and the binomial tree, and every one passes `checkCalc`.
- [ ] **Step 3: Upload and verify the DB.**
  - `select type, status, count(*) from cards where course_id='TPPE29' group by 1,2` matches `bank.json`.
  - `select count(*) from cards where course_id='TPPE29' and content_hash is null` = 0.
  - Spot-check one calc card's `answer_value` against `bank.json`.
- [ ] **Step 4: Idempotency check.** Run `upload.ts bank/tppe29 --dry-run` again. Expected: `inserted 0, updated 0, requeued 0, released 0`, and every card skipped.
- [ ] **Step 5: Release the app.** Run `npm test && npm run build`, then `npx --no-install vercel --prod --yes`, and check that `curl` on https://teoritraning.vercel.app returns 200. Axel then picks TPPE29 on the iPad, runs a few F1 cards and one calc card, and tries "Hitta mitt fel".
- [ ] **Step 6: Commit** `content: TPPE29 kursbank-körning <date>`, then update the ledger and the memory note.
