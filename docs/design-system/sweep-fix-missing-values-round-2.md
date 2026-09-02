# Missing values, round 2 — two new phrases (29 Aug 2026)

Round 1 (`sweep-fix-missing-values.md`) changed four call sites and left nineteen alone. Its
closing section named two situations that occur in this codebase and that SPEC §11 had no
phrase for, and it declined to invent one. The service owner has since approved adding both.

This round adds the phrases and applies them to **seven call sites**. Four more that the brief
did not name are left alone with a reason, and two _new_ defects found while verifying are
reported rather than fixed, because fixing them changes what a value **is** rather than how an
absent one is described.

## 1 · The wording, and what it beat

### `not_yet_calculated` → **"Not yet calculated"**

The value is derived, and the user has not finished supplying what it is derived from, so it
does not exist yet.

_Rejected: `Awaiting answers`._ It is warmer and more instructive, and it is wrong at one of the
seven sites: `ward-management-console.tsx` is waiting for a **destination to be selected**, not
for answers. One phrase has to cover both, or the vocabulary grows a phrase per surface.

_Rejected: `Awaiting input`._ "Input" is computing jargon that collides with a clinical meaning —
fluid input. Not a word to put on a psychiatry surface as a bare noun.

_Rejected: `Not yet available`._ Reads as a system failure or a permission problem. Both false.

_Why "Not yet"._ It carries the whole distinction from the existing four in two words. `Not
recorded` asserts an omission from the record; `Not yet calculated` asserts nothing about the
record at all, which is the point — nothing was omitted, the clinician simply has not finished.
The residual risk is that it could be read as "the system is still working on it", i.e. a
loading state. That risk is small and bounded here: `Skeleton` owns loading in this system, no
spinner is adjacent, and every site pairs it with an existing progress statement
(`0 of 9 answered`, `Not started`, `No destination selected`).

### `withheld_until_complete` → **"Withheld until complete"**

The surface **can** produce a value from what has been entered and is deliberately not
publishing it, because a partial reading would be clinically misleading.

_Rejected: `Withheld`._ This is the wording the brief warned about, and the objection is
concrete rather than stylistic. A bare "Withheld" tells a clinician that the system knows
something it is not saying, and gives them nowhere to go with that — so they go looking for a
number the system is deliberately not showing them, which is exactly the failure mode to avoid.
It also reads as a permissions or redaction message, and this product has neither.

_Rejected: `Not shown until complete`._ Very nearly chosen. It is gentler, and it is slightly
_less_ honest: it is evasive about whether a value exists, and the whole reason this phrase is
not `Not yet calculated` is that one **does**.

_Why the condition is inside the phrase._ The other five phrases are bare, and this one is not,
deliberately. The brief asked whether a withholding phrase should point at where the reasoning
is stated. At every site reachable today the reasoning reduces to one fact — the screen is
incomplete — so the phrase names the release condition inline instead of pointing at a note that
would have to exist on every future surface. It converts "we are hiding something from you" into
"finish the screen and you will have it", which is the difference between a phrase that starts a
search and one that ends it.

_Why the key is narrow._ `withheld_until_complete`, not `withheld`. SPEC §11's standing
assumption is that "Withheld" is excluded because there is no redaction pipeline. That
assumption is **kept**. What was added is suppression pending completion, which is a different
thing, and the narrow key is what stops the next person reaching for this phrase when they mean
redaction.

Both phrases are distinct from the existing four and from each other on the one axis that
matters clinically — whether a value exists. `Not yet calculated`: none exists. `Withheld until
complete`: one exists and is being held. Misreading the second as the first is harmless.
Misreading the first as the second is the hunting failure, and "Not yet" is doing that work.

## 2 · Where they were applied, and the proof

`missing-value.tsx` gained the two reasons and phrases; `SPEC.md` §11 and `COMPONENTS.md` §3
were updated in place, following the existing structure — no parallel mechanism.

### `not_yet_calculated` — five calculator score slots

`calculator-sheet.tsx:151`, `search-detail.tsx:544` (`ScorePanel`), `search-detail.tsx:646`
(`CalculatorDetail`'s phone ticker), `clinical-console.tsx:204`, `directory-grid.tsx:57`.

All five are the same expression: `derived.started ? derived.score : "—"` followed by
`/ {calc.maxScore}`. `started` is `Object.values(answers).some((v) => v !== undefined)` and
`answers` is `{}` on open, so the fallback is reached **only** when no item has been answered.
The score is therefore not missing; it has not been calculated.

**The fraction had to go, and nothing was lost.** Round 1 rejected these sites because a phrase
lands inside a fraction — "Not recorded / 27". A true phrase does not fix that: "Not yet
calculated / 27" is not false, but the denominator is the scale, not part of an absent score.
So the whole element is now conditional: started renders exactly the markup it always did;
unstarted renders the phrase alone. The scale is **not** lost — `ScoreBandBar` renders directly
beneath all five and prints `{calc.minScore}` and `{calc.maxScore}` as visible text under the
bar (`calculator-ui.tsx:247–250`), which is where the browser check below reads `0` and `27`.

### `withheld_until_complete` — `calculator-ui.tsx:141`

`label: band?.label ?? "—"`, on a `CalculatorResult.label` typed `string`. This is the
plain-string case the brief flagged: the field also feeds `formatResultSummary`'s clipboard
line, so a component here would export `[object Object]`. It uses `missingValuePhrase(...)`,
the primitive's string form — same vocabulary, not a second one.

**One correction to the brief's framing.** The fallback is reachable two ways, and only one of
them is a withholding:

- `showBand === false` — a band could be read off the answers so far and the file deliberately
  does not publish it (its own comment: a half-ticked screen "must never read negative"). That
  is the withholding.
- `showBand === true` but `bandForScore` returns nothing — the fixture's band table has a gap at
  this score. Nothing is being held back; we cannot name the band. Calling that "withheld" would
  assert the system knows a band it is hiding, which is false.

So the reason is chosen from `showBand` rather than hardcoded, and the second branch renders
`Unknown`. `tests/calculator-scoring.test.ts` pins every fixture's bands as contiguous across
its full range, so that branch is unreachable today; it exists so a future fixture edit cannot
turn a table gap into a false claim that a result is being withheld from the clinician.

### `not_yet_calculated` — `ward-management-console.tsx:223`

`verdict ? candidateReason(verdict) : "—"` under an "Eligibility" heading.
`const verdict = destination ? eligibility(patient, destination, now) : undefined` (line 169),
so undefined means **no destination has been selected** — nothing to compute eligibility
against. `Not applicable` (round 1's near-miss) would assert that this patient's eligibility
does not apply, which is false. The `<h2>` directly above already reads "No destination
selected".

### One committed test updated

`tests/calculator-scoring.test.ts:246` asserted `expect(partial.result.label).toBe("—")` inside
`it("withholds a K10 band until every item is answered")`. The test's named subject is the
withholding, which the line above it pins directly (`expect(partial.band).toBeUndefined()`); the
dash was the incidental rendering of it. The assertion now reads the phrase from the primitive
so the two cannot drift. A comment at line 112 that described a band-table gap as rendering a
dash was corrected to describe the gap itself.

`docs/design-system/adoption-manifest.json` was regenerated with
`npm run design-system:adoption:update`, never hand-edited.

## 3 · Left alone, and what would settle each

**`therapy-compass/screens/compare-screen.tsx` and `brief-screen.tsx`** — round 1 left these
because a `get: (t: Therapy) => string` accessor cannot take a component (line 103 diffs the
return values through a `Set`; line 113 exports them to the clipboard). `missingValuePhrase`
now removes that obstacle — but not the reason round 1 gave second, which still stands: the
accessors chain two fields (`t.bestUsedFor || t.targetSymptoms`), so any phrase asserts
something about **both** at once, and neither new phrase applies. _What would settle it:_ an
owner ruling on whether an empty chained accessor means "neither field is recorded" — if yes it
is `Not recorded` via `missingValuePhrase`, and it is a copy change to a clinical comparison
table that deserves its own review, not a silent fix inside a phrase sweep.

**`therapy-compass/ui.tsx:188`** — unchanged from round 1 and unaffected by the new phrases.
Still needs the catalogue decision (`index` vs `full`) recorded there.

**`calculators/guided-flow.tsx:282`** — `item.options?.[value ?? -1]?.label ?? "—"` for a
skipped item in the answer-review list. The truthful phrase is `Not recorded` (the user
finished; this answer was not given), not either new one. Still blocked on the same thing as
round 1: the row renders at `text-2xs`, below `MissingValue`'s smallest density (`text-xs`), so
adopting the primitive makes every _un_answered row larger than the answered ones. _What would
settle it:_ either a smaller density on the primitive, or an owner decision to leave it.

**`clinical-dashboard/answer-source-rows.ts:133`** — still not a missing value; it is the
deliberate absence of a citation badge number on an uncited source.

**The twelve `"n/a"` page-number sites** — unchanged. Still a genuine gap: §11 has no compact
citation form, and "p. Not recorded" is not one.

**`src/components/calculator-mockups/`** — a full parallel copy of these calculator surfaces
exists there (`directory-grid-mockup.tsx`, `popup-sheet-mockup.tsx`, its own `calculator-ui.tsx`,
and more), carrying the same dashes. It is design scratch behind `/mockups/`, it was outside
round 1's count and outside this brief, and converging it would double the diff for no clinical
surface. Deliberately skipped, not missed.

## 4 · Two new defects found while verifying — reported, not fixed

Both are in `calculators/guided-flow.tsx`, both are the same class §11 exists for, and both are
**worse than a dash**, because they display a fabricated value rather than an absent one. Fixing
either changes what a value **is**, which this brief explicitly excludes.

1. **`guided-flow.tsx:120`** — `{derived.started ? derived.score : 0}` renders a literal **0**
   in the score chip when nothing has been answered. An unstarted PHQ-9 asserts a score of zero,
   which for a depression scale reads as "no symptoms". This is the negative-result misreading
   §11 was written to prevent, in its strongest form.
2. **`guided-flow.tsx:282`** — the checkbox branch of the same answer-review list,
   `value === 1 ? "Yes" : "No"`, renders **"No"** for an item that was never answered. An
   unanswered CAGE item is recorded as an explicit negative in the review list.

Both need an owner decision, and (1) needs one before `guided-flow` is routed anywhere.

## 5 · Where the spec and honesty pulled apart

One place, and the spec lost:

**A bare "Withheld" would have matched §11's terse style and been less honest.** Every other
phrase in §11 is a bare state, and `Withheld until complete` breaks that pattern by carrying a
condition. The pattern was broken on purpose: see §1. If the style rule is later enforced
mechanically, this phrase is the exception it must permit, not the defect it must fix.

Two places the spec is still the defect, both carried over from round 1 and unresolved by this
change: no compact form for a citation ("p. n/a"), and no density below `text-xs`, which is what
keeps `guided-flow.tsx:282` on the untouched list.

And one thing this round did **not** do: it did not weaken the §11 assumption that excludes a
general redaction phrase. That assumption is intact and restated in both documents.

## 6 · Verification

**Tests** — run set discovered by grepping `tests/` for the changed component names, the
primitive, and the calculator helpers, then filtering out Playwright specs. Not hand-picked:

```
$ npx vitest run $(grep -rlEi "missing-?value|calculator-sheet|clinical-console|directory-grid|search-detail|calculator-ui|ward-management-console|SeverityPill|deriveCalculator|formatResultSummary|progressLabel|Not started|design-system-adoption" tests/ | grep -v '.spec.ts$' | sort)

 Test Files  27 passed (27)
      Tests  742 passed (742)
```

The first run of that set was **2 failed | 740 passed**, both correctly:
`tests/calculator-scoring.test.ts` on the pinned dash (see §2), and
`tests/design-system-adoption.test.ts` on the unregenerated manifest.

**Lint / types:**

```
npx eslint <8 changed files> --max-warnings 0     → exit 0, no output
npx tsc --noEmit                                  → exit 0
```

**Design-system contract:**

```
Design-system contract passed (1079 production files; raw colors 0; literal shadows 0;
legacy tap classes 0; sub-floor interactive min-heights 2; edge conflicts 5; 1px shadow spreads 0).
design-system adoption checked: 55 components, 84 roots
design-sync contract checked: 55 components and 7 guidelines
```

Two earlier runs of that gate failed on `interactiveTapFloorDeclarations` in
`bedside-sheet.tsx`, `directory-grid.tsx` and `answer-content.tsx`. That was another agent's
in-flight edit to `scripts/design-system-contract-utils.mjs` (its detector prefilter was being
widened mid-run), not this change: my diff contains **zero** `min-h` tokens, and running that
detector over `directory-grid.tsx` at `HEAD` and at my content returned `[]` for both. The
passing run above is bookended by identical `md5sum` values for that script.

### Rendered result

The dev server had to be restarted. The instance already listening on `:3350` — verified as
this worktree's own (`start-server.js` under
`.claude/worktrees/browser-test-gate-handoff-d5c1db`) — had a dead file watcher: it kept
serving the old dash after the edit, after a forced reload, and after `touch`ing the source with
no recompile logged. I killed that process tree and re-ran `npm run ensure`, which returned
`http://localhost:3350`. It is left running.

**`/calculators/search` → PHQ-9 sheet** (production route:
`search-page.tsx` → `CalculatorSheet` → `ScorePanel`), read from the live DOM:

```
SCORE | Not yet calculated | Not started | 0 | 27 | 0 of 9 answered
     | 0–4 Minimal | 5–9 Mild | 10–14 Moderate | 15–19 Moderately severe | 20–27 Severe

MissingValue ×2 (live strip + ScorePanel), data-reason="not_yet_calculated"
  fontSize 13px · fontWeight 400 · rgb(85, 98, 122) · geistSans
bare em-dash elements in the dialog: 0
```

The `0` and `27` on that line are `ScoreBandBar`'s visible endpoints — the scale survived the
loss of the denominator, as designed. The phrase renders at 13px regular sans where the score
rendered at 24px extrabold mono, so the missing value is quieter than the present one.

**Same route → K10, one item answered** (the withheld case; K10 floors at 10, so `showBand` is
false until every item is answered):

```
K10 | Kessler Psychological Distress Scale | General distress · 10 items · 2–3 min
3 | Withheld until complete | 3 / 50 | 1 of 10 answered | Withheld until complete
```

The severity pill previously read a bare dash. The score itself (`3 / 50`) is untouched — only
the band label changed. `formatResultSummary` composes the same string into the clipboard export
(`K10 3/50 — Withheld until complete (1 of 10 answered)`); that line is read from the code path,
not from the clipboard, which the browser check could not exercise.

**`/mockups/ward-flow/patients/WF-009`:**

```
h2: "No destination selected"
Eligibility | Not yet calculated | Tier 1 leads
MissingValue data-reason="not_yet_calculated" · fontSize 11px · rgb(85, 98, 122)
bare em-dash elements: 0
```

Note the 11px: `ward-management.module.css`'s `.workspaceScore span` (specificity 0-1-1) wins
over the primitive's utility class (0-1-0), which is this repo's documented unlayered-CSS
behaviour, not a defect. It resolves to the same muted colour, and a present verdict renders at
`--text-2xl` in the heading colour — so the missing value stays smaller and quieter.

Screen-reader text equals visible text at every changed site: the phrase is the element's only
text content, and no `aria-label` overrides it.

### What was not seen in a browser, and why

**`directory-grid.tsx:57`, `clinical-console.tsx:204`, and `search-detail.tsx:646`.** These
three are in `src/components/calculators/` and are compiled, typechecked and contract-checked
like any production source — but **no route renders them**. `src/app/mockups/` imports a
separate parallel tree, `src/components/calculator-mockups/`, and the only app route reaching
`@/components/calculators` is `/calculators/search` → `CalculatorsSearchPage` → `CalculatorSheet`
→ `ScorePanel`. `search-detail.tsx:646` sits in the module-private `CalculatorDetail`, reached
only from the unrouted `CalculatorsSearchDetailMockup` export.

Their evidence is therefore compilation plus the unit suite, not a rendered page. The three are
the same edit as the two sites that _were_ rendered, but that is an argument, not an
observation, and it is recorded as one. **Stated as an observation, not a conclusion:** the
duplicate unreached components in the production tree look like drift worth a separate look —
they are not deleted here, and nothing in this change depends on that judgement.
