<!-- PRESERVED FROM GIT-IGNORED SCRATCH, 2026-09-02. Read this banner before any line below. -->

> ⚠️ **NOT ONE FINDING IN THIS FILE HAS HAD A MUTATION RUN AGAINST IT.**
> Every verdict here — MIS-ATTRIBUTED, GENUINELY UNGUARDED, PARTIALLY GUARDED, STALE-CLOSED — was
> reached by **reading the cited code at HEAD `5c1dc6080` and tracing execution paths**. That is
> reasoning, and reasoning about whether a guard exists is precisely what a mutation is for.
> **These are leads, not verdicts. Do not quote a count from this file as a rate.**
>
> ⚠️ **Batch B's own title says "mutation-verified at HEAD". That is false** — no mutation was run
> for any batch. The title is left as written rather than edited, because a document that quietly
> corrects itself hides that the claim was ever made.
>
> **Also void:** the "11 source files changed since `b5205b45a`" staleness figure quoted in these
> files. `b5205b45a` is **not an ancestor** of this branch's HEAD, so that number is a diff between
> divergent tips, not a record of change along a line of history. Per-finding staleness verdicts were
> re-derived from HEAD and stand; the aggregate does not.
>
> Preserved because `.superpowers/` is git-ignored (`.gitignore:175`) and this work would otherwise
> not survive a clean. Provenance: three read-only analyses, Sonnet 5, dispatched 2026-09-02.

---

# Triage batch C — staleness check + executable specs

Read against `claude/ward-builder-two` HEAD `5c1dc6080`. The sweep (`.superpowers/sdd/ts-sweep-copy.md`)
was read at `b5205b45a`, which is **not an ancestor** of this HEAD (`git merge-base --is-ancestor
b5205b45a HEAD` → not an ancestor; the two lines diverged). Every finding below was verified by
reading the cited production file and test file directly at HEAD, not by trusting the sweep's line
numbers or by diffing against `b5205b45a`.

Method note: `git diff --name-only b5205b45a HEAD -- src/components/ward-management/` lists 9 changed
files (`coordinator/shortlist-panel.tsx`, `ed/ed-screen.tsx`, `referrals/referral-board.tsx`,
`referrals/referral-match.tsx`, `ward-eligibility.ts`, `ward-management-modes.tsx`,
`ward-referral-visibility.ts`, `ward-referrals.ts`, `ward-sites.ts`) plus
`tests/ward-referral-visibility.test.ts`. `ward-admissions.ts`, `ward-derivations.ts`,
`ward-flow-reducer.ts` and `ward/ward-screen.tsx` show **no diff** between the two — they were named
in the brief as changed but are byte-identical between `b5205b45a` and this HEAD, so findings touching
them were re-verified directly against HEAD content rather than assumed changed.

---

## 8.5 — `ward-change-reasons.test.ts` · "one list has no order pin"

**Verdict: CURRENT.**

Verified in `src/components/ward-management/ward-change-reasons.ts`: `URGENT_MARK_REASONS` (6 entries)
has no dedicated `toEqual([...])` order pin in `tests/ward-change-reasons.test.ts`, unlike
`URGENCY_CHANGE_REASONS`, `LEGAL_STATUS_CHANGE_REASONS`, `RELEASE_PULL_REASONS`,
`CANCEL_TRANSPORT_REASONS` and `ESCALATION_CONTACTS`, each of which has its own `it("holds exactly
the … reasons, in this order", …)` test. `URGENT_MARK_REASONS` is only (a) spread into `allReasons`
for a `toContain` membership check, and (b) reached via `Object.keys(changeReasonLabels).sort()`
compared against a **sorted** literal — sorting destroys order information on both sides.

Grepped `URGENT_MARK_REASONS` and its six member strings (`cannot_be_observed_safely_here`, etc.)
across `tests/*.dom.test.tsx` and `tests/ui-*.spec.ts` — zero hits outside
`ward-change-reasons.ts`/`ward-change-reasons.test.ts`. No component renders a picker keyed on this
list's order in a way any test observes.

### Exact edit

File: `src/components/ward-management/ward-change-reasons.ts`

Before:

```ts
export const URGENT_MARK_REASONS = [
  "cannot_safely_prevent_leaving",
  "cannot_be_observed_safely_here",
  "safety_of_others_in_this_setting",
  "no_psychiatric_cover_at_this_site",
  "needs_medical_care_unavailable_here",
  "escort_in_place_and_unsustainable",
] as const;
```

After (swap first two entries):

```ts
export const URGENT_MARK_REASONS = [
  "cannot_be_observed_safely_here",
  "cannot_safely_prevent_leaving",
  "safety_of_others_in_this_setting",
  "no_psychiatric_cover_at_this_site",
  "needs_medical_care_unavailable_here",
  "escort_in_place_and_unsustainable",
] as const;
```

### Prediction

**Nothing goes red.** `tests/ward-change-reasons.test.ts` passes unchanged (membership and sorted-key
checks are order-insensitive). No other test file references `URGENT_MARK_REASONS` or its member
strings. Typecheck is unaffected (array literal reorder, `as const` unaffected).

### Classification

**GENUINELY UNGUARDED.** No test anywhere pins this list's order.

### Safety of the edit

Safe — a pure reorder, no exception thrown, nothing to unfairly pre-empt an assertion.

---

## 9.6 — `ward-referrals-print.test.ts` · "inside `@media print` is never actually established"

**Verdict: CURRENT.**

Verified `src/components/ward-management/referrals/referrals.module.css`: 1251 lines total,
`@media print {` opens at line 1040 (exact match to the sweep's "line 1040 of 1251"). Confirmed the
print block is genuinely the last top-level rule today — counted `^}` occurrences from line 1040
onward: exactly 1, which is the file's final closing brace. `printBlock()` in the test
(`tests/ward-referrals-print.test.ts:24-31`) slices from `css.indexOf("@media print {")` to
**end of file**, with an explicit comment admitting this is deliberate rather than brace-matched.

### Exact edit

File: `src/components/ward-management/referrals/referrals.module.css`

Append, after the file's current final `}` (end of the `@media print` block, currently the last
line):

```css
@media (prefers-contrast: more) {
  .card {
    border-width: 0.125rem;
  }
}
```

And, inside the existing `@media print { … }` block, delete the `.card` rule (one of the entries in
the array at `tests/ward-referrals-print.test.ts:136-148`, e.g. remove `.card`'s
`background: none; border-color: CanvasText;` declaration or the whole rule for `.card`).

### Prediction

**Nothing goes red.** `printBlock()` still finds `@media print {` and slices from there to end of
file — which now includes the new `@media (prefers-contrast: more)` block, appended text that is not
itself inside a print rule but is textually captured by the slice. The single assertion this defeats:
`tests/ward-referrals-print.test.ts:150` (`expect(rule, \`${selector} must reset its background for
print\`).toContain("background: none")`) for `selector = ".card"` — but per the falsifier `.card`'s
rule is simply **absent** from the sliced text now (deleted from inside the print block), so
`ruleDeclarationsFor` returns `null` and the **actual** assertion that fires is the earlier
`expect(rule, \`no print-scoped rule for ${selector}…\`).not.toBeNull()`at line 150-153 — **this one
WOULD go red**, because deleting the`.card`rule from inside the print block is directly visible to
the text slice (the slice still runs to true end-of-file, and`.card`'s rule inside the block is just
gone).

Correcting the prediction to isolate the specific structural defect the finding names (block-end
mismatch, not rule presence): the falsifying edit must **keep every currently-guarded rule inside the
`@media print { … }` text** while proving the slice extends past the block's real closing brace.
Revised exact edit — insert a new rule _between_ the print block's closing brace and end of file
without touching any existing rule:

File: `src/components/ward-management/referrals/referrals.module.css`, append after the current final
`}`:

```css
@media (forced-colors: active) {
  .fieldCard {
    forced-color-adjust: none;
  }
}
```

Nothing inside the real `@media print { … }` block is touched. **Nothing goes red** —
`printBlockWithoutComments()`/`printBlock()` still finds every currently-pinned selector because all
of them are still textually present in the (over-wide) slice; the new block outside `@media print`
is invisible to every assertion because none of them test block boundaries, only substring/selector
presence within the slice. The print block's actual closing brace (which now sits mid-file, before
the appended `@media (forced-colors: active)` rule) is never located or checked by any assertion.

### Classification

**GENUINELY UNGUARDED.** No assertion in the file locates or verifies the print block's own closing
brace; the slice-to-EOF approach is unconditionally correct today only because no later top-level rule
exists, which is the exact fact the finding says is "only a fact about today."

### Safety of the edit

Safe. The revised edit adds a new, syntactically valid CSS rule after the file's current end and
touches nothing inside the print block, so no assertion throws before running; the prediction is
clean.

---

## 11.5 — `ward-referral-model.test.ts` · "orders the real fixture's decided referrals most-recently-decided first"

**Verdict: CURRENT.**

Verified `src/components/ward-management/ward-referrals.ts`:

- `referralDecidedAt` (line 77-81) returns `Math.max(...times)` over each destination's `decidedAt`
  — explicitly "LATEST rather than earliest" per its own doc comment.
- `recentlyDecidedReferrals` (line 338-341) sorts by
  `(referralDecidedAt(b) ?? -Infinity) - (referralDecidedAt(a) ?? -Infinity)` — descending by that
  same key.

The test (`tests/ward-referral-model.test.ts:1052-1058`) calls `recentlyDecidedReferrals(referrals)`,
then re-derives `decidedAts` by mapping **the same** `referralDecidedAt` over the result, sorts a copy
with an equivalent descending comparator, and compares. The comparator's sign is genuinely exercised;
the key (`Math.max` vs `Math.min`, i.e. latest vs earliest) is not, because both sides of the
comparison are built from the identical key function.

**Sharper than the sweep's own text records:** every seeded referral in
`src/components/ward-management/ward-movements.ts` that has a `decidedAt` (RF-002, RF-003, RF-004,
RF-006, RF-007, RF-008, RF-010 — confirmed via `awk` scan) has **exactly one** destination carrying a
`decidedAt`. `Math.max` of a one-element array equals `Math.min` of the same array, so this specific
falsifier does not even move any fixture referral's computed key — meaning the DOM positive control at
`tests/ward-referral-screens.dom.test.tsx:1165` ("renders the real fixture's seven decided referrals,
most recently decided first", pinning `["RF-006","RF-007","RF-002","RF-003","RF-004","RF-008","RF-010"]`
literally) **also cannot distinguish** this falsifier, because it runs on the same single-destination
fixture.

### Exact edit

File: `src/components/ward-management/ward-referrals.ts`

Before:

```ts
export function referralDecidedAt(referral: Referral): Instant | undefined {
  const times = referral.destinations
    .map((addressing) => addressing.decidedAt)
    .filter((at): at is Instant => at !== undefined);
  return times.length > 0 ? Math.max(...times) : undefined;
}
```

After:

```ts
export function referralDecidedAt(referral: Referral): Instant | undefined {
  const times = referral.destinations
    .map((addressing) => addressing.decidedAt)
    .filter((at): at is Instant => at !== undefined);
  return times.length > 0 ? Math.min(...times) : undefined;
}
```

### Prediction

**Nothing goes red anywhere in the repo.** Confirmed by grep: `referralDecidedAt` is referenced in
exactly one test file (`tests/ward-referral-model.test.ts`), at exactly the one call site above, and
by no `.dom.test.tsx` or `ui-*.spec.ts` file. Because every fixture referral has at most one decided
destination, `Math.max` → `Math.min` changes no fixture referral's computed value, so:

- `tests/ward-referral-model.test.ts:1052` ("orders the real fixture's decided referrals
  most-recently-decided first") stays green — unchanged input, unchanged (self-referential) expected
  value.
- `tests/ward-referral-screens.dom.test.tsx:1165` (same fixture, independently-computed literal order)
  also stays green, because the literal order was correct for `Math.max` and remains correct for
  `Math.min` on this single-destination fixture.

This is the strongest form of the finding: not merely "the test cannot tell the key apart from a
correct one," but "no fixture in the repository currently exercises a referral with two differently-
timed decided destinations at all," so the semantic meaning of "most recently decided" (latest vs.
earliest) is entirely unverified end-to-end.

### Classification

**GENUINELY UNGUARDED.**

### Safety of the edit

Safe — pure function change, no exceptions, both sides of every comparison stay defined.

---

## 12.7 — `ward-referral-clocks.test.ts` · the clock terms are pinned only negatively

**Verdict: CURRENT.**

Verified `REFERRAL_CLOCK_TERMS` in `src/components/ward-management/ward-referrals.ts:410-419`:
`notInDepartment: "not in department yet"`. Verified the test
(`tests/ward-referral-clocks.test.ts:121-138`) asserts, for every term: not containing "arriv", length

> 0, not containing ".", and for `notInDepartment` specifically: `not.toMatch(/\d/)` and
> `not.toBe("—")`. No assertion anywhere pins any term's exact text. Grepped the literal string
> `"not in department yet"` and the symbol `notInDepartment` across `tests/*.dom.test.tsx` and
> `tests/ui-*.spec.ts` — zero hits outside the one test file.

### Exact edit

File: `src/components/ward-management/ward-referrals.ts`

Before:

```ts
  notInDepartment: "not in department yet",
```

After:

```ts
  notInDepartment: "in department",
```

### Prediction

**Nothing goes red.** "in department" contains no digit, no "arriv", no ".", is non-empty, and is not
"—" — every existing negative/structural assertion in `tests/ward-referral-clocks.test.ts:121-138`
passes. No other test file references this term. The rendered clock now asserts the opposite of what
`P9-D7` requires (a not-yet-arrived expect reading as though already in department) with the whole
suite green.

### Classification

**GENUINELY UNGUARDED.**

### Safety of the edit

Safe — string literal swap, no exceptions.

---

## 13.5 — `ward-referral-screen-boundary.test.ts` · three sub-findings

**Verdict: CURRENT** for all three. Verified in
`tests/ward-referral-screen-boundary.test.ts`:

- `importStatementsOf` (line 333-335): `withoutComments(source).match(/import\s+[\s\S]*?;/g)` —
  requires `\s+` immediately after `import`, so `import(` (dynamic import, no whitespace before the
  paren) is never captured, confirmed by inspection; this is what the graph-building traversal walks.
- `contextBindingsOf` (line 439-446): splits the `{ … }` content on `,`, then `.split(":")[0].trim()`
  per entry — a rest element like `...flow` becomes the literal string `"...flow"`, never `"referrals"`.
- The "keeps the one exemption bounded" test (line 595-607) uses
  `/:\s*Referral(\[\])?\s*[,)]/` against `BUILDS_BUT_NEVER_RECEIVES` (resolved at line 223 to
  `src/components/ward-management/ward-board-derivations.ts`) — requires a literal `,` or `)`
  immediately (after optional whitespace) following `Referral`/`Referral[]`; a union type
  (`Referral | undefined`) has `|` there instead and evades the pattern.

Confirmed both consuming checks for the rest-element gap: "lets no ward-ONLY module take referral
data from the shared provider" (line 608-640, checks `bindings.some(list => list.includes("referrals"))`)
and "lets no ward-only module read the provider without destructuring it" (line 651-665, checks
`calls !== bindings.length`) — a single `const { movements, units, ...flow } = useWardFlow();` produces
one call and one binding list (`["movements","units","...flow"]`), so `calls === bindings.length` and
`"referrals"` is not a member of any binding list. Both checks pass.

Confirmed the exempted module `src/components/ward-management/ward-board-derivations.ts` currently
constructs `const probe: Referral = {...}` (line 95) and has no existing function parameter typed
`Referral`.

Also checked whether `tests/ward-screen-fd23-leaks.dom.test.tsx` (an FD-23 DOM test the original
sweep did not read) mitigates any of the three. It does not: that file asserts rendered **text
content** on `WardScreen` for specific seeded co-addressed-referral scenarios; it has no dependency on
import structure, destructuring shape, or type-level parameter checks, so none of the three
sub-falsifiers below (none of which changes any rendered text) can be observed by it.

### Exact edits and predictions

**(a) Dynamic-import blind spot.**

New file: `src/components/ward-management/ward/ward-referral-dynamic-leak.ts`

```ts
import type { Referral } from "../ward-model";

export function describeReferral(referral: Referral): string {
  return `${referral.destinations.length} destinations`;
}
```

Edit `src/components/ward-management/ward/ward-screen.tsx` — add, at module scope:

```ts
void import("./ward-referral-dynamic-leak");
```

**Prediction: nothing goes red.** `importStatementsOf` never captures `import(...)` (no whitespace
before `(`), so `ward-referral-dynamic-leak.ts` is never enqueued by `reachableModules`/`wardGraph`/
`wardOnlyModules()`, and no assertion in the file inspects it. `tests/ward-screen-fd23-leaks.dom.test.tsx`
is unaffected because nothing renders differently (the dynamic import is never awaited or used in
render).

**(b) Rest-element destructuring.**

Edit any one ward-only module inside `wardOnlyModules()` (e.g. a component under
`src/components/ward-management/ward/`) that currently calls `useWardFlow()` with a plain
destructure — change:

```ts
const { movements, units } = useWardFlow();
```

to:

```ts
const { movements, units, ...flow } = useWardFlow();
```

and use `flow.referrals` somewhere in the module (type-checks fine since `flow` retains the full
context type minus the two destructured keys).

**Prediction: nothing goes red.** Confirmed above: `contextBindingsOf` returns `"...flow"`, not
`"referrals"`, defeating both the name-based check and the call-count/destructure-count check.

**(c) Union-typed exemption evasion.**

Edit `src/components/ward-management/ward-board-derivations.ts` — add a new exported function:

```ts
export function describeIncomingReferral(referral: Referral | undefined): string {
  return referral ? `${referral.destinations.length} destinations` : "none";
}
```

**Prediction: nothing goes red.** `/:\s*Referral(\[\])?\s*[,)]/.test(source)` is false against
`referral: Referral | undefined` (the character after `Referral` is a space then `|`, not `,`/`)`), so
`tests/ward-referral-screen-boundary.test.ts:602`'s `not.toMatch(regex)` assertion still passes even
though the module now genuinely **receives** a `Referral` from outside — directly contradicting the
exemption's stated reason ("that module builds a referral and never receives one").

### Classification

All three: **GENUINELY UNGUARDED.**

### Safety of the edits

All three are additive, syntactically and type-valid, throw nothing, and do not pre-empt any
assertion before it runs.

---

## 13.7 — `ward-event-permissions.test.ts` · "gives every role a decision label"

**Verdict: CURRENT, but PARTIALLY GUARDED — narrower than the sweep states.**

Verified `tests/ward-event-permissions.test.ts:220-226`: `toBeTruthy()` only, over
`roles = new Set(Object.values(PERMISSIONS).flat())`. Verified `WARD_FLOW_ROLE_LABELS` in
`src/components/ward-management/ward-flow-events.ts:55-62` has 6 entries: `coordinator`, `ed`, `ward`,
`officer`, `demo`, `community`. Confirmed all 6 appear as granted roles somewhere in `PERMISSIONS`
(`officer` via `PATIENT_ARRIVED`/`PATIENT_COLLECTED`/`TRANSPORT_ACCEPTED`/`TRANSPORT_EN_ROUTE`/
`RECORD_MOVEMENT_BLOCKER`/`CLEAR_MOVEMENT_BLOCKER`; `demo` via `ADVANCE_CLOCK`/`RESET_SCENARIO`/
`SET_SCENARIO`; `community` via `ADD_PATIENT`/`BOOK_TRANSPORT`/`RAISE_REFERRAL`/`RECEIVE_REFERRAL`/
`WITHDRAW_REFERRAL`), so `roles` genuinely contains all 6.

**Correction to the sweep: 3 of the 6 role labels ARE independently pinned verbatim elsewhere**,
found by grepping each label string for a literal `toBe`/`toHaveTextContent` assertion:

- `"Flow coordinator"` (coordinator) — `tests/ward-override-register.test.ts:97`,
  `tests/ward-override-register-render.dom.test.tsx:150,180`,
  `tests/ward-referral-reducer.test.ts:289,338,453`.
- `"Ward manager"` (ward) — `tests/ward-referral-reducer.test.ts:326,874`.
- `"ED mental health"` (ed) — `tests/ward-ed-psychiatry-hub.dom.test.tsx:925`
  (`expect(after.decidedBy, …).toBe("ED mental health")`).

**The other 3 have no verbatim pin anywhere** — grepped `"Authorised officer"`, `"Demonstration
control"`, `"Community service"` across `tests/*.ts`, `tests/*.tsx`: zero literal-assertion hits for
`officer` and `demo`; `"Community service"` appears once as a fixture literal
(`src/components/ward-management/ward-movements.ts:1571`) but is never read back by any assertion.
Confirmed `officer`'s four permitted events (`PATIENT_ARRIVED`, `PATIENT_COLLECTED`,
`TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`) write timestamps in the reducer
(`src/components/ward-management/ward-flow-reducer.ts:1091-1200`), not
`WARD_FLOW_ROLE_LABELS[event.role]`, so the officer label may not even be rendered via that map for
those events — reinforcing that it is unobserved.

### Exact edit

File: `src/components/ward-management/ward-flow-events.ts`

Before:

```ts
  officer: "Authorised officer",
```

After:

```ts
  officer: " ",
```

### Prediction

**Nothing goes red.** `" "` is truthy in JavaScript, so
`tests/ward-event-permissions.test.ts:226` (`toBeTruthy()`) passes. No other test references
`"Authorised officer"` as a literal. A decision recorded against role `officer` would render/print a
blank wherever `WARD_FLOW_ROLE_LABELS.officer` is read.

### Classification

**PARTIALLY GUARDED** — `coordinator`, `ward` and `ed` are genuinely protected by independent literal
pins in other files; `officer`, `demo` and `community` are **GENUINELY UNGUARDED** for exact label
text.

### Safety of the edit

Safe — string literal swap, no exceptions.

---

## 14.4 — `ward-referral-suburb.test.ts` · derivation ban has no probe; label pin is circular

**Verdict: CURRENT** for both halves.

**Half A — derivation ban.** Verified `tests/ward-referral-suburb.test.ts:157-171`
(`"⚠️ DOES NOT DERIVE homeRegion FROM IT…"`): reads `seedWardFlowState().referrals` and asserts only
(a) every referral's `homeRegion` is non-empty and (b) at least one referral has both a named suburb
and a non-empty `homeRegion`. Verified `seedWardFlowState()`
(`src/components/ward-management/ward-flow-reducer.ts:269-286`) returns
`structuredClone(referrals)` — the static fixture import from `ward-movements.ts` — never passed
through the reducer. Verified the reducer's `RECEIVE_REFERRAL` branch
(`src/components/ward-management/ward-flow-reducer.ts:2055-2061`) writes
`homeRegion: event.homeRegion` and `suburb: event.suburb` independently, straight from the incoming
event.

**Half B — circular label pin.** Verified `referralSuburbLabel`
(`src/components/ward-management/ward-referrals.ts:474-475`): for the unknown case, returns
`suburbUnknownLabels[suburb.reason]` — literally the same lookup table. Verified the test
(`tests/ward-referral-suburb.test.ts:127-133`) asserts
`referralSuburbLabel({kind:"unknown", reason}).toBe(suburbUnknownLabels[reason])` — comparing the
function's output to itself.

**Checked the DOM sibling not read by the original sweep**, `tests/ward-referral-suburb-pin.test.ts`
("half 3", line 214-252): asserts the intake form's rendered `<select>` markup
`.toContain(\`>${suburbUnknownLabels[reason]}<\`)`. This looks like an independent, rendered-text
check, but is not: confirmed via `renderToStaticMarkup` (no inter-element whitespace) and the
production markup at
`src/components/ward-management/referrals/referral-intake.tsx:829-843` that adjacent `<option>`
elements from `.map()` are concatenated with **no whitespace** — `</option><option …>` — so the
literal substring `"><"` (which is what `\`>${label}<\``degrades to when`label === ""`) is already
present between every pair of sibling options regardless of any single option's own label. This
sibling test is defeated by the same falsifier for the same structural reason.

### Exact edits

**Half A.** File: `src/components/ward-management/ward-flow-reducer.ts`, inside the `RECEIVE_REFERRAL`
case (~line 2058-2061):

Before:

```ts
        homeRegion: event.homeRegion,
        suburb: event.suburb,
```

After (a plausible, not-obviously-wrong derivation — replaces the direct field with one keyed off the
suburb answer):

```ts
        homeRegion: event.suburb.kind === "named" ? deriveRegionFromSuburb(event.suburb.name) : event.homeRegion,
        suburb: event.suburb,
```

(with a new local helper `deriveRegionFromSuburb` added to the same file, returning `"Perth
Metropolitan"` for known Perth-metro suburb names and falling back to `event.homeRegion` otherwise —
exactly the "administrative fiction" `CM-4`'s comment forbids).

**Half B.** File: `src/components/ward-management/ward-model.ts`, in `suburbUnknownLabels`:

Before:

```ts
  no_fixed_abode: "No fixed abode",
```

(or whatever text is currently at that key — set it to:)
After:

```ts
  no_fixed_abode: "",
```

### Prediction

**Half A: nothing goes red.** `tests/ward-referral-suburb.test.ts`'s "DOES NOT DERIVE" test never
calls the reducer — it reads `seedWardFlowState().referrals`, an untouched static fixture — so it is
structurally incapable of observing this edit, regardless of what the derivation computes.

Caveat, stated plainly rather than hedged: `tests/ward-referral-reducer.test.ts:98`
(`expect(created.homeRegion).toBe("Perth Metropolitan")`) DOES dispatch `RECEIVE_REFERRAL` through the
real reducer, with `suburb: { kind: "named", name: "Armadale" }` and `homeRegion: "Perth
Metropolitan"` (`tests/ward-referral-reducer.test.ts:58-76`). Armadale is genuinely a Perth
metropolitan suburb, so the falsifier above — which derives `"Perth Metropolitan"` for known Perth-metro
suburbs — produces the **same** value this assertion expects. **My prediction is that this assertion
also stays green**, not because the test is structurally blind (it is not — it is a real, independent
runtime pin) but because the specific input pair the test happens to use cannot distinguish "value
came from the event" from "value was correctly re-derived from a Perth-metro suburb." A stricter
positive control would dispatch with a suburb whose derived region provably differs from the
event-supplied `homeRegion` (e.g. a rural suburb paired with a deliberately mismatched
`homeRegion`); no such case exists in the current suite (grepped every `RECEIVE_REFERRAL` dispatch
across `tests/*.ts`, `tests/ui-*.spec.ts` — all use `homeRegion: "Perth Metropolitan"` with either no
suburb given to a named-Perth-metro suburb, or bypass the reducer entirely as hand-built `Referral`
literals).

**Half B: nothing goes red.** Confirmed both `tests/ward-referral-suburb.test.ts`'s "names every
unknown answer" test and `tests/ward-referral-suburb-pin.test.ts`'s "half 3" test are defeated by an
emptied label, for the two independent structural reasons above (tautological comparison; markup
substring coincidence). No other file references `suburbUnknownLabels`.

### Classification

**Half A: GENUINELY UNGUARDED** (with the stated caveat about the one coincidentally-agreeing sibling
assertion — a stricter falsifier using a rural suburb would separate them cleanly, and that stricter
form remains unguarded by anything in the current suite).

**Half B: GENUINELY UNGUARDED** — two independent-looking tests, both structurally defeated by the
same falsifier.

### Safety of the edits

Half A: safe, no exception paths added. Half B: safe, empty string is a valid `string`.

---

## Staleness recheck on `tests/ward-referral-visibility.test.ts` — what still applies at HEAD `5c1dc6080`

Per instruction, §14.1 (CLOSED on the requester's own mutation evidence) is **not re-derived**. The
other three items were checked directly against HEAD content (this branch has changed this file and
its production counterpart heavily tonight, so the master-line recheck's conclusions needed
independent confirmation rather than being assumed to travel forward):

- **§14.1 — CLOSED, untouched.** Confirmed the exact doc comment the batch-15 recheck cites
  (`coordinatorScopedReferral`'s "THE FIELD SET HERE IS ENFORCED BY tsc, NOT BY THE TEST SUITE" block,
  including the "Mutation run 2026-09-02, `originSiteCode` removed and restored byte-identically"
  line) is present verbatim at
  `src/components/ward-management/ward-referral-visibility.ts:246-266` at this HEAD. Not re-derived,
  per instruction.

- **§14.2 — STILL HOLDS at HEAD, line numbers drifted slightly.** Confirmed
  `tests/ward-referral-visibility.test.ts:469` (`expect(Object.keys(projection!).sort()).toEqual(
ALLOWED_WARD_PROJECTION_FIELDS)`, run against real `wardScopedReferral(...)` output) is a genuine
  runtime pin of the ward field set. Confirmed the "fully-populated projection" test — now at line
  508, not 486 (a 22-line drift, consistent with the general warning that "a cited line number may now
  point at something else") — asserts `expect(Object.keys(canonical).sort()).toEqual(
ALLOWED_WARD_PROJECTION_FIELDS)` against a **hand-built literal** (`canonical`), never against
  production output; its real teeth remain the `Required<WardScopedReferral>` type annotation, which
  vitest does not check (no `typecheck` block in `vitest.config.mts`, confirmed unchanged). The
  corrected form from the recheck — "the line-486 [now ~508] test adds nothing at runtime beyond its
  sibling [line 469]" — still holds.

- **§14.2b (`suburb`) — STILL ABSENT, still self-documented at HEAD.** Confirmed
  `coordinatorScopedReferral`'s own doc comment
  (`src/components/ward-management/ward-referral-visibility.ts:262-266`) states verbatim: "`suburb`
  is on `Referral` and on neither projection, so there is nothing for `tsc` to require… Whether a
  coordinator should see a patient's suburb is a product question and is with the owner." The gap is
  real and the module still names it at the site, exactly as the recheck recorded.

- **The dead loop (§14 B3) — STILL HOLDS, still self-documented, still mitigated.** Confirmed at
  `tests/ward-referral-visibility.test.ts:436-446`: `multi` (seeded referrals with 2+ destinations) is
  asserted `.toBe(0)` today, and the loop at line 450 (`for (const referral of multi) { … }`)
  therefore runs zero iterations. The comment immediately above (lines 438-446) names this explicitly
  and gives the exact remedy for the day it stops being true ("change the expectation to
  toBeGreaterThan(0) and delete the recorded gap"). The rule this loop cannot exercise today is
  covered non-vacuously elsewhere by tests using the constructed `multiDestinationReferral()` fixture
  (e.g. the "reaches no other destination's referral data" tests at lines ~530+), matching the
  recheck's "a documented seed-coverage placeholder, not the only cover for the rule."

**Nothing in the staleness-recheck section needed correction against this HEAD** — all four items
(§14.1 closed / §14.2 / §14.2b / dead loop) read the same at `5c1dc6080` as the recheck reported at
the master line, modulo the ~22-line drift on one test's location, which is exactly the kind of drift
the recheck's own header warned to expect.
