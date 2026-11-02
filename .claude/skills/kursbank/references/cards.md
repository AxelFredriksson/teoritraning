# Writing cards (generator guide)

You are generating the cards for **one lecture** of a course, for Axel's Teoriträning app. Axel has no economics background. He learns a concept by seeing it a few times and by using it in a context. His worst case is **learning wrong theory from a card**. A card you are unsure of is worse than no card.

Output: `bank/<kurs>/parts/LNN.json`, as UTF-8 JSON with LF line endings, in the form `{ "concepts": Concept[] }`.

## Rules for existing parts

- Keep **every** existing concept id and card id in the file. Never renumber, rename or delete one. A published id that disappears stops the whole run.
- Only edit an existing card when it is wrong or when a new trusted source gives a better basis. Every edit sends the card back through verification, and possibly back to Axel's review queue.
- To retire a card, keep it and set `"status": "retired"`.
- Add new cards with the next free number (`…-content-3` after `…-content-2`).
- Do not set `status: "flagged"` or `verifyNote`. The verifier and `merge.ts` set them. Leave `status` out, which defaults to `active`, unless you are retiring the card.

## Language and formatting

- **All card content is in Swedish**: prompt, choices, answers, rubrics, steps, titles and concept statements. Use the course's own Swedish terminology, as the lectures and faktakunskaper use it.
- Write math in `$…$` (KaTeX), e.g. `$r_{eff} = (1 + r/m)^m - 1$`. In display text, numbers use a Swedish decimal comma (`3,5 %`); `answer.value` and `check` are JSON and JS, so they use a decimal point.
- Every card gets a `title` (at most 120 characters, Swedish), e.g. `"Vad är en FRA?"`.

## Source hierarchy (the Global Constraint)

- **Trusted, and the only evidence a card may rest on:** the lectures (`kursrum-lisam/Föreläsningar/*`), exams with their solutions (`Tentor/`), `faktakunskaper.xlsx` (the `.tsv` in `extract/`), and the course information (`Kurspresentation…`).
- **Helper:** `inlasning/` was written by Claude and is less reliable. You may use it to find concepts and to phrase a pedagogical explanation, but it is **never evidence**. A card that only `inlasning/` supports will be flagged by the verifier, and that is correct. Write it only if the concept matters, set its `sourceRef` to the inlasning file and page, and add `(hjälpmaterial)`.
- `sourceRef` names a trusted file **and a location** so the verifier can find it, e.g. `"fo4.pdf, bild 12"`, `"faktakunskaper rad 57"`, `"Tenta 2025-01-17 #2b, lösning"`. In the extracted text, PDF pages are separated by form feeds (`\f`). When a card comes from an exam task, also set `examRef: "2025-01-17 #2b"`.
- Never state a fact, formula or convention that no trusted source contains. If two trusted sources disagree, follow the lecture or solution the exam uses, and say so in the reference answer.
- Lectures with no trusted lecture PDF (for TPPE29: Fö 2, 3, 8, 9, 10) still get cards, grounded in faktakunskaper and the exam solutions.

## Concept

```json
{
  "id": "tppe29-6-fra",
  "kind": "begrepp",
  "title": "FRA (Forward Rate Agreement)",
  "statementMd": "En FRA är ett avtal om att låsa en ränta för en framtida period …",
  "sourceRef": "faktakunskaper rad 201; fo6.pdf, bild 14",
  "lecture": 6,
  "examCount": 2,
  "examRefs": ["2024-01-11 #2a", "2025-01-17 #2b"],
  "factRefs": [201, 202],
  "cards": [ … ]
}
```

- `id`: `<kurs>-<lecture>-<slug>`, e.g. `tppe29-6-fra`. The slug is lower-case ASCII with hyphens (å/ä → a, ö → o). It never contains the faktakunskaper row number, because the list may change.
- `kind`: `"sats"` | `"definition"` | `"metod"` | `"begrepp"`. Use `metod` for calculation procedures (e.g. pricing in a binomial tree), `definition` for exact definitions, `sats` for named results (e.g. put-call-paritet), and `begrepp` for everything else.
- `lecture`: a positive integer, taken from the faktakunskaper Föreläsning column or from the lecture where the concept is taught.
- `examCount` / `examRefs` / `factRefs`: from the concept plan (`extract/work/plan-LNN.md`). `examRefs` use the form `"YYYY-MM-DD #<task><subtask>"`.
- `statementMd`: a short, correct statement of the concept in Swedish.
- `cards`: at least one.

## Card fields

Common to every card:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<conceptId>-<type>-<n>`, e.g. `tppe29-6-fra-content-1` |
| `type` | yes | `content` \| `conditions` \| `recognition` \| `find_error` \| `calc` \| `reasoning` |
| `answerMode` | yes | `mc` \| `open` \| `numeric` |
| `promptMd` | yes | The question |
| `referenceAnswerMd` | yes | The full, correct answer, shown after answering |
| `sourceRef` | yes | A trusted file and location, or an exam ref |
| `examRef` | no | `"2025-01-17 #2b"` when the card comes from an exam task |
| `title` | yes (by rule) | At most 120 characters |
| `level` | no (default 2) | 1, 2 or 3, see below |
| `choices`, `correct` | `mc` | At least 2 choices; `correct` holds 0-based indices (one or more) |
| `rubricMd` | `open`, `find_error`, `calc` | The grading template used by the AI grader |
| `steps` | `find_error` (≥2), `calc` (≥1) | Markdown strings |
| `errorStep` | `find_error` | The 0-based index into `steps` of the one wrong step |
| `answer` | `calc` | `{ "value", "tolerance" (> 0), "unit"?, "check" }` |

Schema rules (`merge.ts` rejects anything else): `mc` needs `choices` and `correct`, with every index in range. `open` needs `rubricMd`. `calc` ⇔ `answerMode: "numeric"`. `calc` needs `answer`, `steps` with at least one entry, and `rubricMd`. `find_error` needs at least two `steps`, an `errorStep` in range, and `rubricMd`.

## Card mix

The app shows the types as Innehåll, Villkor, Igenkänning, Hitta felet, Räkna and Resonemang.

| Design name | `type` | Use |
|---|---|---|
| Begreppskort | `content` (Innehåll) | The definition itself: "Vad är en FRA?" Every concept gets at least one. Use `mc` or `open`. |
| Sammanhangskort | `recognition` (Igenkänning) | The concept in a situation: "En bank vill låsa räntan på ett lån som startar om tre månader – vilket instrument, och hur?" It must be grounded in an exam task or a lecture example. Set `examRef` when it comes from an exam. |
| Räknekort | `calc` (Räkna) | A short computation with a numeric answer. See the calc rules below. |
| Resonemangskort | `reasoning` (Resonemang) | The exam's discussion questions (e.g. Baselpelarna, the bank's risk in housing loans). `answerMode: "open"`, with `rubricMd`. |
| — | `conditions` (Villkor) | Assumptions and conditions, e.g. what a model assumes or when a formula applies. Preferably `mc` with several correct choices. |
| — | `find_error` (Hitta felet) | A worked solution with exactly one planted error, such as the wrong day-count convention, using the wrong rate, or discounting the wrong way. Use it where an exam solution gives the correct procedure. |

**Context cards:** write a `recognition` or `calc` card only where a trusted source gives the situation (an exam task or a lecture example). **Never invent a context.** An invented context with no evidence is exactly the kind of card that teaches wrong theory. It is fine for a concept to have only a definition card; the summary reports how many concepts do.

For an exam-heavy concept, aim for one `content` card, plus a `recognition` or `calc` card for each distinct way the exams use it, plus a `reasoning` card if the exams discuss it.

`mc` choices: make the distractors plausible mistakes a student would make, never jokes. Each choice is self-contained. `referenceAnswerMd` explains why each choice is right or wrong.

`rubricMd` (for open, reasoning, calc and find_error cards): list what a full answer must contain, as points, plus common mistakes. For calc cards the AI uses it to find the error in Axel's handwritten work, so describe the method and the typical slips.

## Levels

- **1 Grund:** prerequisites (faktakunskaper rows marked `TPPE17` or `Gymnasiet`) and core definitions
- **2 Fördjupning:** the standard course content, and most exam use
- **3 Avancerat:** multi-step reasoning, rare edge cases, and the harder exam tasks

## Calc rules

The app shows the prompt. Axel computes with a calculator and pen, then types **one number**. The app checks it locally against `answer.value ± tolerance` and then shows `steps` as the solution.

- **One to three steps per card.** Break a large exam problem into several cards: e.g. u/d and the risk-neutral probability; one backward step in the tree; how a dividend changes the tree; the final price.
- The prompt states every input and exactly what to compute. If an intermediate result from an earlier step is needed, give it. Say how to round, and in what unit (e.g. "Svara i procent med två decimaler").
- **Day-count conventions** (Act/360, 30E/360, Act/365, …) are stated in the prompt **exactly as on the exam**. Never leave the convention implicit.
- `answer.value` is **your reasoned result**: work it out step by step, and the `steps` show that work.
- `answer.check` is an **independent** JS expression that recomputes the result from the raw inputs. Do not copy the rounded intermediate values from your steps. `merge.ts` evaluates it, and if it disagrees with `value` beyond `tolerance` the card is flagged. The two computations are the guard against a wrong facit.
- `tolerance`: half the last displayed decimal (answer to 2 decimals → `0.005`). When the computation involves table lookups (`N(x)`), use at least 0.5 % of |value|.
- `unit` is shown separately next to the input field (`"kr"`, `"%"`, `"år"`). If `unit` is `"%"`, then `value` is in percent (3.52, not 0.0352).

### The `check` whitelist

`merge.ts` checks every token before evaluating anything, and flags the card if it finds a disallowed token. Allowed:

- numeric literals, including decimals and exponents (`1.5e-3`)
- the operators `+ - * / %` and `**`, parentheses, commas and whitespace
- `Math.exp Math.log Math.sqrt Math.pow Math.max Math.min Math.abs Math.round Math.floor Math.ceil Math.E Math.PI`
- `N(x)`, the standard normal CDF

Nothing else: no variables, no `let`/`const`/`=>`, no loops, no `;`, and no other `Math.*`. Write the inputs as literals and repeat sub-expressions. Write binomial trees as nested `Math.max` closed forms.

### Worked example: a two-step American put

$S_0 = 100$, $K = 100$, $u = 1{,}1$, $d = 0{,}9$, and the discount factor per step is $1/1{,}02$. Then $q = (1{,}02 - 0{,}9)/(1{,}1 - 0{,}9) = 0{,}6$.

- The leaves are $0$, $1$ and $19$.
- Node $u$: $\max(100-110,\ (0{,}6\cdot 0 + 0{,}4\cdot 1)/1{,}02) = 0{,}3922$.
- Node $d$: $\max(100-90,\ (0{,}6\cdot 1 + 0{,}4\cdot 19)/1{,}02) = \max(10;\ 8{,}0392) = 10$. Early exercise is optimal here.
- Root: $(0{,}6\cdot 0{,}3922 + 0{,}4\cdot 10)/1{,}02 = 4{,}1522$.

```json
{
  "id": "tppe29-9-binomialtrad-amerikansk-calc-1",
  "type": "calc",
  "answerMode": "numeric",
  "title": "Amerikansk sälj i tvåstegs binomialträd",
  "promptMd": "En amerikansk säljoption med $K = 100$ på en aktie med $S_0 = 100$. Binomialträd med två steg, $u = 1{,}1$, $d = 0{,}9$ och diskonteringsfaktor $1/1{,}02$ per steg. Beräkna optionens pris idag. Svara med två decimaler.",
  "answer": {
    "value": 4.15,
    "tolerance": 0.005,
    "unit": "kr",
    "check": "Math.max(100-100, ((1.02-0.9)/(1.1-0.9)*Math.max(100-100*1.1, ((1.02-0.9)/(1.1-0.9)*Math.max(100-100*1.1*1.1,0) + (1-(1.02-0.9)/(1.1-0.9))*Math.max(100-100*1.1*0.9,0))/1.02) + (1-(1.02-0.9)/(1.1-0.9))*Math.max(100-100*0.9, ((1.02-0.9)/(1.1-0.9)*Math.max(100-100*1.1*0.9,0) + (1-(1.02-0.9)/(1.1-0.9))*Math.max(100-100*0.9*0.9,0))/1.02))/1.02)"
  },
  "steps": [
    "Riskneutral sannolikhet: $q = (1{,}02 - 0{,}9)/(1{,}1 - 0{,}9) = 0{,}6$. Löv: $S_{uu} = 121 \\Rightarrow 0$, $S_{ud} = 99 \\Rightarrow 1$, $S_{dd} = 81 \\Rightarrow 19$.",
    "Nod $u$ ($S = 110$): $\\max(0;\\ (0{,}6\\cdot 0 + 0{,}4\\cdot 1)/1{,}02) = 0{,}3922$. Nod $d$ ($S = 90$): $\\max(10;\\ (0{,}6\\cdot 1 + 0{,}4\\cdot 19)/1{,}02) = \\max(10;\\ 8{,}0392) = 10$ (lös in tidigt).",
    "Roten: $(0{,}6\\cdot 0{,}3922 + 0{,}4\\cdot 10)/1{,}02 = 4{,}1522 \\approx 4{,}15$."
  ],
  "referenceAnswerMd": "$4{,}15$ kr. Tidig inlösen är optimal i nod $d$ (inlösenvärde $10 > 8{,}04$).",
  "rubricMd": "- Rätt $q$ ur $u$, $d$ och diskonteringen\n- Rätt lövvärden $\\max(K - S, 0)$\n- I varje nod: jämför inlösenvärde med diskonterat förväntat värde\n- Vanliga fel: glömmer tidig inlösen i nod $d$ (ger $3{,}38$), diskonterar inte, eller byter plats på $q$ och $1-q$",
  "sourceRef": "<verklig källa, t.ex. Tenta ÅÅÅÅ-MM-DD #3, lösning>",
  "level": 2
}
```

(The example's numbers are illustrative. A real card uses the inputs from its cited source.) Other `check` forms: a simple interest amount, `100*(1+0.035*144/360)`. A Black–Scholes call, `100*N((Math.log(100/95)+(0.03+0.2**2/2)*0.5)/(0.2*Math.sqrt(0.5))) - 95*Math.exp(-0.03*0.5)*N((Math.log(100/95)+(0.03-0.2**2/2)*0.5)/(0.2*Math.sqrt(0.5)))`, which gives ≈ 9,25 and therefore a tolerance of at least 0.05 because it uses `N`.

## Before you finish

- The file parses as JSON and follows the schema above. Every id is unique, and every existing id is still present.
- Every card has a `sourceRef` that points to a trusted location, or to an `inlasning/` location marked `(hjälpmaterial)`.
- Every calc card's `check` uses only whitelisted tokens and recomputes the result independently from the raw inputs.
- Report back: the number of concepts and cards by type, the faktakunskaper rows from the plan that you did not cover (and why), and any card you suspect is weak.
