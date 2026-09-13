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

# Triage batch B — 8 findings, staleness-checked and mutation-verified at HEAD

Base of the sweep: `b5205b45a`. This batch checked at HEAD `5c1dc6080` (branch `claude/ward-builder-two`).
Every finding below was re-read from the actual file at HEAD before writing its verdict — none is
transcribed from the sweep document alone. Where I state "no other test catches this," that claim is
backed by a `grep` across `tests/*.test.ts`, `tests/*.dom.test.tsx` and `tests/ui-*.spec.ts` (all three
families), not just the `.test.ts` family the original sweep read.

---

## 1. Finding 7.4 (sweep line 888) — `ward-referral-matching.test.ts` — firewall regex blind to re-exports/dynamic imports

**Staleness: CURRENT.** Read `tests/ward-referral-matching.test.ts` at HEAD. The extractor is unchanged:

```ts
// tests/ward-referral-matching.test.ts:574
function importStatementsOf(source: string): string[] {
  return withoutComments(source).match(/import\s+[\s\S]*?;/g) ?? [];
}
```

This requires the literal word `import` followed by whitespace. It cannot match `export { X } from "…"`
or `export * from "…"` (starts with `export`, not `import`), and cannot match `import("./y")` (no
whitespace before `(`). The file's own "fix round 5" comment block (lines 438–455, present at HEAD)
documents a different, unrelated repair (regex-literal tracking inside the comment stripper) and does
not touch this gap. I grepped the file for `export\s*{.*from`, `dynamic import`, `import(` and
`re-export` — zero hits. The sister file `ward-flow-seam.test.ts` does not handle export declarations
either (checked). The gap is real and unaddressed.

### The exact edit

**New file** `src/components/ward-management/ward-release-notes.ts`:

```ts
// Re-exports the release model for a caller that does not need it yet.
export { BedRelease } from "./ward-model";

export function releaseNoteFor(id: string): string {
  return `note-${id}`;
}
```

**Edit** `src/components/ward-management/ward-referrals.ts` — add near the top-level imports:

```ts
import { releaseNoteFor } from "./ward-release-notes";

export function debugReleaseNote(id: string): string {
  return releaseNoteFor(id);
}
```

Why this construction: `ward-referrals.ts` is one of the two D15 entry points, so its own
`import { releaseNoteFor } from "./ward-release-notes";` statement is a **normal** import — matched by
the regex, so `collectModuleGraph` follows it and adds `ward-release-notes.ts` to the graph. But
`ward-release-notes.ts`'s own reference to the release model is `export { BedRelease } from
"./ward-model";` — a re-export, not an import statement — so `importStatementsOf` on THAT file's
source returns `[]`, and `importsMention(source, BED_RELEASE_IDENTIFIER)` is `false` even though the
file's source text literally contains `BedRelease`.

### Prediction

**Nothing goes red.** Specifically:

- `tests/ward-referral-matching.test.ts`, test `"no file reachable from referral matching's own
imports mentions the release model"` (line 729), assertion `expect(offenders.map(([file]) =>
file)).toEqual([])` (line 759) — **stays green.** `ward-release-notes.ts` enters `graph` (so
  `graph.size` grows, not shrinks — the `>=5` floor at line 756 still holds) but is never flagged as
  an offender, because the offender filter (line 758) also calls `importsMention`, which finds no
  `import`-shaped statement in that file.
- I grepped `tests/*.test.ts`, `tests/*.dom.test.tsx` and `tests/ui-*.spec.ts` for
  `BED_RELEASE_IDENTIFIER` and `stays independent of the bed-release model`. Only two files match:
  this one, and `tests/ward-network-referral-placement.dom.test.tsx`. I read that file's guard in
  full — it uses a proper AST parser (`tests/helpers/module-graph.ts`'s `parseModuleSource`, which
  correctly distinguishes `ImportDeclaration` from `ExportNamedDeclaration`/re-exports) and so is NOT
  vulnerable to this same defect, **but it only inspects one named component's own import specifiers**
  (`src/components/ward-management/referrals/referral-match.tsx`, the network-placement overlay) — it
  never walks the transitive graph from `ward-eligibility.ts`/`ward-referrals.ts`, so it does not
  reach a new file introduced elsewhere in that graph. It cannot catch this mutation.

I predict **no test file anywhere in the repository goes red** from this edit.

### Classification: GENUINELY UNGUARDED

This is not a hedge — I checked the one plausible alternate guard (the dom test using the AST-based
parser) in detail specifically because it looked like it might close the gap, and confirmed it
doesn't (wrong scope, not wrong mechanism).

### Safety note

None. The edit throws nothing, adds a small unused-in-production module, and every existing assertion
in the file runs to completion normally — this is a clean, non-destructive falsifier.

---

## 2. Finding 8.6 (sweep line 1017) — `ward-referral-producers.test.ts` — producer scan whose comments are not stripped

**Staleness: CURRENT.** Read `tests/ward-referral-producers.test.ts` in full (164 lines) at HEAD.
Confirmed the asymmetry the finding names: `referralFieldNames()` (lines 51–65) strips block and line
comments before extracting field names (lines 60–61: `.replace(/\/\*[\s\S]*?\*\//g, "")` then
`.replace(/^\s*\/\/.*$/gm, "")`). The producer-write scan in the very next test, `"🔴 IS WRITTEN BY
RECEIVE_REFERRAL…"` (lines 80–96), does **not**: it slices the reducer's `RECEIVE_REFERRAL` branch as
raw text (line 84) and does a bare `written.includes(\`${field}: event.${field}\`)` (line 90) with no
comment stripping at all.

### The exact edit

**Edit** `src/components/ward-management/ward-flow-reducer.ts`, line 2068, inside the `RECEIVE_REFERRAL`
case:

Before:

```ts
        transportNeeded: event.transportNeeded,
```

After:

```ts
        transportNeeded: false, // transportNeeded: event.transportNeeded,
```

This keeps the exact substring `transportNeeded: event.transportNeeded` alive inside a trailing
comment (satisfying the unstripped scan) while the real write becomes a hardcoded `false`.

I deliberately chose `transportNeeded` over the sweep's generic "any field" because I checked which
field has the _weakest_ independent coverage. `urgency` and `homeRegion` looked like tempting
candidates but are traps: `tests/ward-referral-reducer.test.ts:101` (`expect(created.urgency).toBe(2)`)
and `:99` (`expect(created.homeRegion).toBe("Perth Metropolitan")`) both submit values that happen to
equal a plausible hardcoded default, so a naive falsifier on those fields can accidentally pass for
the wrong reason (coincidence, not absence of a guard) — a trap worth naming since it is exactly the
kind of false negative this exercise is supposed to catch. `transportNeeded` has no such trap: I
grepped every `.test.ts`, `.dom.test.tsx` and `ui-*.spec.ts` reference to `transportNeeded` (61 hits)
and confirmed only two places submit `transportNeeded: true`/`"yes"` as input
(`tests/ward-referral-screens.dom.test.tsx:956`, in a form-reset test that never inspects the created
referral's field value, and `tests/ui-ward-referrals.spec.ts:339`, whose journey never asserts the
field or anything downstream of it). Every other reference submits `false` as input, which is what my
hardcoded literal also produces — so no test distinguishes "value came from the event" from "value is
always false."

### Prediction

**Nothing goes red.**

- `tests/ward-referral-producers.test.ts`, test `"🔴 IS WRITTEN BY RECEIVE_REFERRAL…"` (line 80),
  assertion at line 89–94 (`written.includes(...)).toBe(true)`) for field `transportNeeded` — **stays
  green** (the comment-embedded substring still satisfies it).
- `tests/ward-referral-reducer.test.ts:103` (`expect(created.transportNeeded).toBe(false)`) — **stays
  green** (the reducer's default-fixture call at line 78 submits `transportNeeded: false`, which
  matches the hardcoded literal).
- No other test in the repository asserts the _value_ of a created referral's `transportNeeded` field
  against a submitted `true`.

### Classification: GENUINELY UNGUARDED

### Safety note

None. This is a pure-function reducer change; no test throws before its assertions run.

---

## 3. Finding 8.8 (sweep line 1034) — `ward-bed-release-lifecycle.test.ts` — six-way rejection count with one leg double-refused

**Staleness: CURRENT**, and I traced the actual refusal mechanism rather than trusting the sweep's
prose, because it matters for the edit. Read `tests/ward-bed-release-lifecycle.test.ts` test 5 (lines
435–489) and the reducer's dispatch path.

The role gate is global and runs **before** any case-specific logic:

```ts
// src/components/ward-management/ward-flow-reducer.ts:479-484
const permittedRoles = EVENT_ROLE[event.type];
if (!permittedRoles.includes(event.role)) {
  return reject(
    state,
    event,
    `${event.type} requires role ${permittedRoles.join(" or ")}, but was
raised by role ${event.role}`,
  );
}
```

`CLEAR_BED_RELEASE_BLOCK: ["ward"]` is set in `src/components/ward-management/ward-flow-events.ts:874`.
So in the test's `afterUnblock` step (`role: "coordinator"`), the role gate fires first and the
case-specific body at `ward-flow-reducer.ts:1755–1778` never runs. **But** that case body itself
contains a second, independent refusal: `if (release.blocker === null) return reject(state, event,
\`release ${release.id} carries no blocked flag to clear\`);`(lines 1768–1769) — and WR-002 (the
release this leg targets) genuinely has no blocker set, because the earlier`BLOCK_BED_RELEASE`
attempt on it (also role: coordinator, also refused by the same role gate) never actually applied.
This is exactly the sweep's "refused regardless of role" claim, verified by reading both check sites.

### The exact edit

**Edit** `src/components/ward-management/ward-flow-events.ts:874`:

Before:

```ts
  CLEAR_BED_RELEASE_BLOCK: ["ward"],
```

After:

```ts
  CLEAR_BED_RELEASE_BLOCK: ["ward", "coordinator"],
```

### Prediction

- `tests/ward-bed-release-lifecycle.test.ts`, test 5 (line 435), assertions at lines 486–488
  (`expect(afterRelease.rejections).toHaveLength(6)`, and the two `.toEqual(beforeConfirmTarget /
beforeReleaseTarget)` state-unchanged checks) — **stay green.** With the role gate now passing for
  `coordinator`, execution reaches the case body, hits the `release.blocker === null` check, and is
  refused there instead — same count (6), same "nothing changed" outcome, different reason text that
  nothing in this file inspects (no leg's rejection `.reason` is asserted anywhere in this test).
- `tests/ward-event-permissions.test.ts`, test `"grants exactly these roles and no others"` (line
  211), the loop assertion at line 218 (`expect([...EVENT_ROLE[event]]).toEqual(roles)`) — **goes RED**
  for `event === "CLEAR_BED_RELEASE_BLOCK"`: the hand-written `PERMISSIONS.CLEAR_BED_RELEASE_BLOCK` is
  pinned to `["ward"]` at line 83 of that file, and `EVENT_ROLE.CLEAR_BED_RELEASE_BLOCK` now reads
  `["ward", "coordinator"]`. `toEqual` fails on the length/content mismatch.

### Classification: MIS-ATTRIBUTED

`ward-bed-release-lifecycle.test.ts`'s own title claims to prove the D2 spec rule ("a coordinator may
not … unblock … a bed"), and its own assertions cannot distinguish a correctly-refused coordinator
from a wrongly-permitted-but-still-incidentally-refused one. But the underlying property — a
coordinator must never be granted `CLEAR_BED_RELEASE_BLOCK` — genuinely is guarded, by
`ward-event-permissions.test.ts`'s literal table pin. This matches the sweep's own "compensated by"
note; I've now confirmed the compensating assertion still exists at HEAD and traced exactly why it
fires. Remedy is an honest rename of the bed-release-lifecycle test's claim, not a new test.

### Safety note

None. The Playwright/vitest reducer call throws nothing; both assertions run.

---

## 4. Finding 8.2, `ward-flow-contracts.test.ts` (sweep line 977) — the parallel-cap assertion is inert twice over

**Staleness: CURRENT.** `PARALLEL_REFERRAL_CAP = 3` (`src/components/ward-management/ward-model.ts:166`,
unchanged). The walk's `REFER_TO_UNITS` step refers to exactly three units (`tests/ward-flow-
contracts.test.ts:45`: `[DECLINED_UNIT_ID, WITHDRAWN_UNIT_ID, ACCEPTED_UNIT_ID]`). The assertion at
line 115 (`expect(movement.referredUnitIds.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP)`) reads
the same constant the reducer enforces, and the walk never attempts to exceed it — so it can never
distinguish "the cap is enforced" from "the cap is never tested."

### The exact edit

**Edit** `src/components/ward-management/ward-flow-reducer.ts`, delete the cap check inside
`REFER_TO_UNITS` (lines 718–724):

Before:

```ts
      if (event.unitIds.length > PARALLEL_REFERRAL_CAP) {
        return reject(
          state,
          event,
          `cannot refer to ${event.unitIds.length} units at once — the parallel cap is ${PARALLEL_REFERRAL_CAP}`,
        );
      }
      if (!REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) {
```

After (block removed):

```ts
      if (!REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) {
```

### Prediction

- `tests/ward-flow-contracts.test.ts`, test `"never lets a movement hold more than the parallel cap"`
  (line 112), assertion at line 115 — **stays green.** The walk still only ever refers 3 units, so
  `3 <= 3` holds with or without the guard.
- `tests/ward-flow-reducer.test.ts`, test `"never refers above the parallel cap"` (line 38), assertion
  `expect(next.rejections).toHaveLength(1)` (line 47) — **goes RED.** This test dispatches
  `REFER_TO_UNITS` with 4 units (`["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure",
"gry-adult-secure"]`, line 45) specifically to exceed the cap. With the guard removed, nothing
  rejects the event, so `rejections` is `[]` (length 0, not 1), and the companion assertion at line 48
  (`referredUnitIds).toHaveLength(0)`) also fails — the movement now shows all 4 referred units instead
  of 0.

### Classification: MIS-ATTRIBUTED

Matches the sweep's own "compensated by" note; confirmed the compensating test and its exact
assertion still exist at HEAD and would fire.

### Safety note

None — deleting the block is syntactically safe (the enclosing `if` chain is unaffected) and no
assertion in either file throws before reaching the ones named above.

---

## 5. Finding 8.1, `ward-flow-contracts.test.ts` (sweep line 945) — PII probe / withdrawal-reason privacy

**Staleness: CURRENT, and already self-corrected inside the sweep document itself** (lines 951–969,
the "⚠️ CORRECTED" block). I did not take that correction on faith — I re-read both files at HEAD to
confirm it still holds, since the correction was written against `b5205b45a` too and could itself have
gone stale.

- `tests/ward-flow-contracts.test.ts:240` — the forbidden-word regex is unchanged: `/\b(name|dob|date
of birth|mrn|medical record|address|diagnosis)\b/i`. It still omits site/unit names, so the
  regex-level weakness the sweep originally reported is real. **But** the specific falsifier the sweep
  first proposed (restoring an interpolated withdrawal reason that names the receiving unit) does not
  work, and the sweep's own correction says why.
- `tests/ward-withdrawal-reason-privacy.test.ts:184` — read directly at HEAD: `expect(WITHDRAWAL_REASONS
).toContain(entry.reason);`, inside test `"⚠️ WRITES A CODE ON A REAL ACCEPTANCE — the path that
produced the leak"` (line 154). This is a live-reducer membership assertion: it dispatches
  `REFER_TO_UNITS` + `ACCEPT_IN_PRINCIPLE` through the real reducer, reads the resulting
  `withdrawnReferrals` entries, and requires each `.reason` to be a member of the fixed
  `WITHDRAWAL_REASONS` enum. A reducer change that reverted to writing an interpolated string naming
  the receiving unit would produce a `.reason` value that is not in that enum, and this assertion would
  fail. **Confirmed present and unchanged at HEAD**, and confirmed by reading it directly rather than
  trusting the sweep's citation.

### The exact edit / prediction / classification

No new edit is needed — I am not proposing the struck-through falsifier again; it is settled. I confirm
the sweep's own retraction: **CLASSIFICATION: MIS-ATTRIBUTED.** `ward-flow-contracts.test.ts`'s regex
genuinely cannot fire on identifying content shaped like FD-23 (that reading is correct and unchanged),
but the property it names — no free-text/interpolated leak survives an accepted referral — is guarded
elsewhere, by `ward-withdrawal-reason-privacy.test.ts:184`. The remedy is an honest rename of this
file's test title, not a new test. I am not re-verifying the surviving, still-working §2.5 falsifier
(site-name leak in a label) since it belongs to a different finding outside this batch; I note only
that the forbidden-word list at line 240 still omits site names, consistent with §2.5 remaining live.

### Safety note

N/A — no edit proposed.

---

## 6. Finding 8.1, `ward-legal-figure-guard.test.ts` (sweep line 1066) — "renders absence as 'no deadline recorded'"

**Staleness: split verdict — one half STALE-CLOSED-ish, one half CURRENT.** This file has been
substantially rewritten since the sweep's "fix wave 1" era (the test itself documents a further
"BROADENED 2026-08-24" rewrite, present at HEAD, lines 1600–1621), and the mechanism the sweep
describes for part (a) no longer exists in the form described.

**(a) "Case-sensitive — the capitalised variant is extracted and matches nothing."** At HEAD, the check
(`tests/ward-legal-figure-guard.test.ts`, lines 1579–1598) does a direct, hardcoded, already-lowercase
substring match: `literals.some((literal) => literal.includes("no deadline recorded"))`. I read the
actual production text it is checking — `src/components/ward-management/ward-management-console.tsx:83`
and `coordinator/shortlist-panel.tsx:163` both literally render lowercase `"…no deadline recorded"` in
a template literal. There is no "capitalised variant" being extracted or compared anywhere in the
current mechanism. **STALE-CLOSED for the mechanism as described** — I cannot reproduce a
case-sensitivity gap here at HEAD; whatever produced it at `b5205b45a` has been rewritten away.

**(b) "JSX text is invisible — the literal collector takes string literals and template fragments
only."** Read the shared helper directly: `tests/helpers/ast-string-literals.ts:25-42`. Its `visit`
function only pushes text for `ts.isStringLiteral`, `ts.isNoSubstitutionTemplateLiteral`,
`ts.isTemplateHead/Middle/Tail`. **It does not check `ts.isJsxText`.** This part of the finding is
**CURRENT** — confirmed by reading the extractor's full implementation, not just its doc comment (which
also does not mention JSX text among what it "cannot see," an omission worth flagging on its own).

### The exact edit

**Edit** `src/components/ward-management/ward-management-console.tsx` — leave the existing
`"…no deadline recorded"` template literal untouched (so the positive assertion at line 1591 still
passes), and add a rendered JSX text child near it, e.g.:

```tsx
{
  legalStatus.dueAt === undefined && <p>There is no statutory deadline for this form.</p>;
}
```

placed as a sibling to the existing deadline text, inside the same component.

### Prediction

- `tests/ward-legal-figure-guard.test.ts`, test `"renders absence as 'no deadline recorded'…"` (line
  1579), assertion at lines 1594–1597 (`literals.filter((literal) => literal.includes("no statutory
deadline"))).toEqual([])`) — **stays green.** `literalsIn` never visits the new `<p>` text node, so
  it never enters `literals`, so the filter finds nothing to flag.
- The second half of the same test (the "form required" raw-text scan, lines 1622–1627) searches for a
  different substring (`"form required"`, not `"no statutory deadline"`) — irrelevant to this specific
  wording, so it does not accidentally catch it either.
- I grepped every `.dom.test.tsx` file that renders `ward-management-console.tsx` or
  `shortlist-panel.tsx` (`ward-console-controls.dom.test.tsx`, `ward-override-register-render.dom.test.
tsx`, `ward-patient-page.dom.test.tsx`, `ward-pull-vocabulary.dom.test.tsx`,
  `ward-shortlist.dom.test.tsx`) for `deadline`/`statutory` — **zero matches in all five.** No DOM test
  renders these components and inspects visible text for this wording.

I predict **no test anywhere goes red.**

### Classification: GENUINELY UNGUARDED (part b only; part a is stale)

### Safety note

None — this is a pure additive JSX change; nothing throws.

---

## 7. Finding 8.2, `ward-legal-figure-guard.test.ts` (sweep line 1079) — "form required" scan is a contiguous substring

**Staleness: CURRENT.** Read the scan directly at HEAD (`tests/ward-legal-figure-guard.test.ts:1622-
1627`):

```ts
const requiredOffenders = wardFilesScanned
  .filter((file) => readFileSync(file.path, "utf8").toLowerCase().includes("form required"))
  .map((file) => file.path);
expect(requiredOffenders, "a ward surface claims a form is or is not REQUIRED").toEqual([]);
```

Lower-cased, but still a contiguous substring — an intervening word still defeats it. Confirmed the
"expected-carriers" allowlist immediately below (lines 1634–1642) lists exactly five files
(`ward-management-console.tsx`, `ward-management-modes.tsx`, `ward-management-network.tsx`,
`coordinator/shortlist-panel.tsx`, `ed/ed-screen.tsx`) — `officer/officer-screen.tsx` is not among them,
confirming the sweep's "not on the expected-carriers list" claim.

### The exact edit

**Edit** `src/components/ward-management/officer/officer-screen.tsx:81`:

Before:

```ts
return transport.formRequired ?? "No transport form recorded";
```

After:

```ts
return transport.formRequired ?? "No transport form is required";
```

### Prediction

- `tests/ward-legal-figure-guard.test.ts`, same test (line 1579), the `requiredOffenders` assertion
  (line 1627) — **stays green.** `"no transport form is required"` (lowercased) does not contain the
  contiguous substring `"form required"` — the word "is" sits between "form" and "required" — so
  `officer-screen.tsx` is not flagged.
- The `recordedCarriers` assertion (lines 1631–1642) is unaffected either way: `officer-screen.tsx` was
  never in that expected list, so removing its "No transport form recorded" text changes nothing there.
- I grepped every `.test.ts`, `.dom.test.tsx` and `ui-*.spec.ts` file for `"No transport form recorded"`
  and for `officer-screen`/`OfficerScreen` rendering this specific field — only
  `tests/ui-ward-roles.spec.ts` renders the officer screen at all, and it never asserts this transport-
  form fallback text (checked: it asserts a legal-clock regex and community-formed timing, unrelated
  fields).

I predict **no test anywhere goes red**, and the officer screen now displays a claim about what the
Mental Health Act requires ("No transport form is required") rather than what the record holds.

### Classification: GENUINELY UNGUARDED

### Safety note

None — string literal change only, no throw path affected.

---

## 8. Finding 8.4, `ward-change-reasons.test.ts` (sweep line 1098) — label text guarded only by "is truthy"

**Staleness: CURRENT but the sweep's "only other reference" claim is incomplete** — I found it missed a
real (partial) counter-example, which changes the classification from a flat "genuinely unguarded" to
"partially guarded, unevenly." Both `tests/ward-change-reasons.test.ts` and `tests/ward-governance.
test.ts` are byte-identical to `b5205b45a` (`git diff --stat` returns empty for both against that ref),
so this is not staleness — the sweep's own reader just didn't read past line 63 of the governance file.

Read `tests/ward-governance.test.ts` in full. It contains **two genuine literal-text pins**, not zero:

- Line 45: `expect(audit[0].detail).toBe("Voluntary → Detained awaiting examination · Recorded by
treating team");` — pins the label for `recorded_by_treating_team`.
- Line 64: `expect(entries[0].detail).toBe("Bed needed elsewhere");` — pins the label for
  `bed_needed_for_another_patient`, **immediately after** the tautological self-comparison at line 63
  the sweep quotes (`expect(entries[0].detail).toBe(changeReasonLabels.bed_needed_for_another_patient)`
  ). The sweep's finding text quotes only line 63 and calls it "the only other reference" — it exists,
  but it is not alone; line 64 right below it is a real, independent pin the sweep missed.

Every other reason code dispatched in `ward-governance.test.ts` (lines 90–118: `reassessed`,
`correcting_an_error`, `pull_made_in_error`, `provider_unavailable`) is asserted only on `[at, kind,
movementId]` tuples (lines 125–131) — `.detail` text is never checked for any of these four. And three
release-hold reasons plus one urgency-change reason are never dispatched in that file at all:
`patient_no_longer_coming`, `ward_withdrew_the_bed`, `new_information`, plus the two remaining
cancel-transport reasons (`patient_not_ready`, `destination_changed`, `job_created_in_error`).

### The exact edit

**Edit** `src/components/ward-management/ward-change-reasons.ts:346`:

Before:

```ts
  patient_no_longer_coming: "No longer coming",
```

After:

```ts
  patient_no_longer_coming: "Ward withdrew the bed",
```

(Reworded to exactly match the existing `ward_withdrew_the_bed` label at line 348, per the sweep's own
falsifier shape: "reword one release-hold reason to another reason's wording.")

### Prediction

- `tests/ward-change-reasons.test.ts`, test `"labels every release-hold reason with real, non-empty
text"` (line 61), assertions at lines 63–64 — **stay green** (`"Ward withdrew the bed"` is truthy and
  non-empty).
- `tests/ward-governance.test.ts` — **stays green throughout.** `patient_no_longer_coming` is dispatched
  once, in `tests/ward-pull-admission-lifecycle.test.ts:209`, but that test only asserts state-shape
  outcomes (admission deleted, movement stage, sequence not rewound) — it never reads `.detail` or any
  rendered label text for this reason.
- I grepped every `.test.ts`, `.dom.test.tsx` and `ui-*.spec.ts` file for `patient_no_longer_coming` and
  for the literal `"No longer coming"` — three hits total, all enumeration/type-list references in
  `ward-change-reasons.test.ts` itself (lines 31, 148) plus the one dispatch site above. None asserts
  the label text.

I predict **no test anywhere goes red**, and `patient_no_longer_coming` and `ward_withdrew_the_bed` now
render identically in the picker and the governance ledger.

### Classification: PARTIALLY GUARDED

Not the sweep's flat "genuinely unguarded" — two of the thirteen release/urgency/legal/transport reason
codes (`recorded_by_treating_team`, `bed_needed_for_another_patient`) do have real, independent literal
pins in `ward-governance.test.ts`. The other eleven, including the one I used for the falsifier, do not.
The sweep's finding undercounted its own compensating evidence by stopping at line 63 instead of reading
line 64 too.

### Safety note

None — string literal change only.

---

## Coverage figure

**8 of 8 findings reached a verdict.** All 8 were classified by reading the cited source and test files
directly at HEAD (not from the sweep document alone): I opened every test file named in this batch in
full or by targeted section, opened every production file each finding's falsifier touches, and for
each of the 8 ran a `grep` sweep across all three test families (`tests/*.test.ts`,
`tests/*.dom.test.tsx`, `tests/ui-*.spec.ts`) to check for a compensating guard before finalizing the
classification. None were resolved by reading the sweep's prose alone. None are unresolved.

Two findings turned out to need correction against the sweep's own text, both discovered by that same
direct-read discipline rather than assumed:

- **Finding 8.1 / `ward-legal-figure-guard.test.ts`** — the sweep's part (a) (case-sensitivity) no
  longer reproduces; the test mechanism was rewritten since `b5205b45a` and now does a direct lowercase
  match against genuinely-lowercase production text. Part (b) (JSX-text blindness) is fully current and
  independently confirmed via the shared extractor's source.
- **Finding 8.4 / `ward-change-reasons.test.ts`** — the sweep says "the only other reference compares
  the map against itself," quoting one tautological assertion; a second, genuinely independent literal
  pin sits on the very next line of the same file and covers a different reason code. This moves the
  finding from "flat unguarded" to "unevenly guarded" — most reason codes are still exposed, but not
  quite the ones the sweep implied were the whole picture.

## Findings I believe are dangerous enough to jump the queue

**Finding 7.4** (re-export/dynamic-import blindness in the D15 firewall). Of the eight, this is the one
where a real, structural, unrelated-to-any-fixture-coincidence gap survives against the file's own
stated purpose — the file exists specifically to prove referral matching never reads the unvalidated
bed-release model, and a completely ordinary refactor idiom (introduce a small helper module that
re-exports a model type) defeats both the identifier check and the graph traversal at once, silently.
Unlike 8.6/8.2(#4)/8.8/8.1(contracts), which are all "one test's title overclaims but a sibling test
genuinely covers it" (mis-attributed, low real risk), and unlike 8.2/8.4(legal-guard)/8.4(change-
reasons), which are wording/label-text presentation defects, 7.4 is the one where the underlying
architectural guarantee the whole file exists to protect has no backstop anywhere in the suite.
