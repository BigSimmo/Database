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

# Triage batch A — findings 1.5, 2.5, 5.1, 6.1, 6.2, 6.8, 6.9, 7.3

Read against HEAD `5c1dc6080` (branch `claude/ward-builder-two`). The sweep document
(`.superpowers/sdd/ts-sweep-copy.md`) was read at `b5205b45a`. Every finding below was re-derived by
reading the cited production file and every candidate guard (`.test.ts`, `.dom.test.tsx`, and
`.spec.ts`) at HEAD — not accepted from the sweep's prose. Method traps from the brief were applied:
no leading-slash pathspecs, ripgrep matches read in full (not trusted as "a use" from the snippet
alone), no `$?` after a pipe, and every "nothing catches this" conclusion was backed by a search that
also proved it _could_ find something (a positive control — e.g. finding the forensic guards in
`.dom.test.tsx`/`.spec.ts` before concluding other findings had no such sibling).

Coverage: **8 of 8 findings resolved.** All 8 classified by reading the cited code at HEAD (not from
the sweep text alone). None unresolved.

| #   | Verdict                                                                                            |
| --- | -------------------------------------------------------------------------------------------------- |
| 1.5 | CURRENT — GENUINELY UNGUARDED                                                                      |
| 2.5 | CURRENT — GENUINELY UNGUARDED                                                                      |
| 5.1 | CURRENT — **MIS-ATTRIBUTED** (real guard confirmed, upgraded from the sweep's "grepped, not read") |
| 6.1 | STALE-CLOSED (pre-confirmed by dispatcher; independently re-verified, see below)                   |
| 6.2 | CURRENT — GENUINELY UNGUARDED                                                                      |
| 6.8 | CURRENT — GENUINELY UNGUARDED                                                                      |
| 6.9 | CURRENT — GENUINELY UNGUARDED                                                                      |
| 7.3 | CURRENT — **MIS-ATTRIBUTED** (two real guards found in file types the original sweep never read)   |

Two findings (5.1, 7.3) flip status relative to how the sweep left them: 5.1's own mitigation note
was explicitly unverified ("grepped that sibling rather than reading it"), and 7.3 carried no
mitigation note at all. Both now have a confirmed, load-bearing test. **7.3 is the one worth jumping
the queue for** — see the note at the end.

---

## 1.5 — `ward-referral-suburb-pin.test.ts` · "the picker offers every honest 'not known' answer"

**Staleness: CURRENT.** `src/components/ward-management/ward-model.ts` and
`src/components/ward-management/referrals/referral-intake.tsx` (the two files this finding touches)
are both untouched since `b5205b45a` — confirmed with `git diff --stat b5205b45a..HEAD -- <path>`
returning nothing for either. `tests/ward-referral-suburb-pin.test.ts` is also unchanged.

### The exact edit

File: `src/components/ward-management/ward-model.ts`

Before (line ~1163):

```ts
export const suburbUnknownLabels: Record<SuburbUnknownReason, string> = {
  not_known: "Suburb not known",
};
```

After:

```ts
export const suburbUnknownLabels: Record<SuburbUnknownReason, string> = {
  not_known: "",
};
```

### Prediction

**Only `tests/ward-referral-suburb-pin.test.ts`, test `"half 3 — the picker offers every honest 'not
known' answer, so a person of no fixed abode can be referred"`, assertion:**

```ts
expect(select![1], `... an option a clinician cannot read is an answer they cannot choose.`).toContain(
  `>${suburbUnknownLabels[reason]}<`,
);
```

With the label emptied, the probe string becomes `"><"`. The rendered option is
`<option value="not_known"></option>` (from `referral-intake.tsx:840-843`, unchanged), which
contains the literal substring `"><"` — so the assertion **passes**, exactly as the finding claims.
I traced the actual rendered markup rather than trusting the finding's description.

**Nothing else goes red.** I checked every file that imports `suburbUnknownLabels` or
`SUBURB_UNKNOWN_REASONS` (`ward-referral-suburb.test.ts`, `ward-community-referral-survives.test.ts`,
plus a grep across `tests/*.dom.test.tsx` and `tests/*.spec.ts` for the literal string
`"Suburb not known"` — zero hits). `ward-referral-suburb.test.ts` line 130
(`expect(referralSuburbLabel({...})).toBe(suburbUnknownLabels[reason])`) recomputes with the
production map on both sides of the comparison, so it stays green whatever the label's value is —
that is itself a second, smaller instance of the same "test recomputed with the production helper"
shape the sweep flags elsewhere (see 6.3), but it is not part of this finding's numbered scope.

### Classification: GENUINELY UNGUARDED

No test anywhere distinguishes a real label from an empty one for this picker.

### Fairness note

No throw risk — `referral-intake.tsx` renders the option unconditionally from the map; an empty
string renders as an empty text node, not an error.

---

## 2.5 — `ward-withdrawal-reason-privacy.test.ts` · the FD-23 guard, narrower half

**Staleness: CURRENT.** `src/components/ward-management/ward-sites.ts` changed since `b5205b45a`,
but only a comment (confirmed by reading the diff: it documents the 6.1 fix, touches no data).
`src/components/ward-management/ward-change-reasons.ts` and `ward-flow-reducer.ts`'s
`ACCEPT_IN_PRINCIPLE` handler are both byte-for-byte unchanged (`git diff --stat` empty for both).
`tests/ward-withdrawal-reason-privacy.test.ts` is unchanged.

### The exact edit

File: `src/components/ward-management/ward-change-reasons.ts`

Before (line 197):

```ts
export const WITHDRAWAL_REASONS = ["another_unit_accepted", "referrer_withdrew"] as const;
```

After:

```ts
export const WITHDRAWAL_REASONS = [
  "another_unit_accepted",
  "referrer_withdrew",
  "accepted_elsewhere_in_network",
] as const;
```

Before (line 219-224):

```ts
export const withdrawalReasonLabels: Record<WithdrawalReason, string> = {
  another_unit_accepted: "Withdrawn — another unit accepted this patient.",
  // Says the referral ended and that the referrer ended it. Asserts nothing about the person, and
  // names no destination — a ward reading this learns that it may stop holding the request, which
  // is the whole of what it needs.
  referrer_withdrew: "Withdrawn — the referrer no longer needs this bed.",
```

After (add a fourth line before the closing brace):

```ts
export const withdrawalReasonLabels: Record<WithdrawalReason, string> = {
  another_unit_accepted: "Withdrawn — another unit accepted this patient.",
  // Says the referral ended and that the referrer ended it. Asserts nothing about the person, and
  // names no destination — a ward reading this learns that it may stop holding the request, which
  // is the whole of what it needs.
  referrer_withdrew: "Withdrawn — the referrer no longer needs this bed.",
  accepted_elsewhere_in_network: "Withdrawn — a bed was confirmed at Fremantle Hospital.",
```

File: `src/components/ward-management/ward-flow-reducer.ts`, inside the `ACCEPT_IN_PRINCIPLE`
handler (line 801):

Before:

```ts
          reason: "another_unit_accepted" as const,
```

After:

```ts
          reason: "accepted_elsewhere_in_network" as const,
```

(I used "Fremantle Hospital" rather than the sweep's illustrative "Rockingham General Hospital"
because the test file's own `ACCEPTING_UNIT` constant is `"fre-adult-open"`, whose site is
`Fremantle Hospital` — the label has to name the site that actually wins in the dispatched test for
the "WRITES A CODE ON A REAL ACCEPTANCE" test below to be a fair exercise of the edit.)

### Prediction: nothing goes red

I dispatched the scenario mentally against every assertion in the file and confirmed each one still
passes:

- `"offers reasons as a fixed list, not free text"` — `accepted_elsewhere_in_network` still matches
  `/^[a-z_]+$/`. Passes.
- `"NAMES NO UNIT IN ANY REASON OR LABEL"` — loops `allUnits()` checking `withdrawalReasonLabels[reason]`
  doesn't contain any unit's `.name`. "Withdrawn — a bed was confirmed at Fremantle Hospital." contains
  no unit name (unit names are like `"FRE Adult Open"`, `"RGH Adult Secure"` — none is a substring of
  the site sentence). Passes — confirming the finding's core claim that this loop checks **unit**
  names only, never site names.
- `"ASSERTS NO MOVEMENT"` — the label contains none of `placed/moved/transferred/admitted/arrived/bed
is free/discharged`. Passes.
- `"HAS EXACTLY ONE WITHDRAWAL WRITER"` — counts `withdrawnReferrals:` write sites in the source
  (must stay 3). My edit changes a _value_ on an existing write site, not the count. Passes.
- `"uses the ward page's wording verbatim"` — pins only `withdrawalReasonLabels.another_unit_accepted`,
  which I did not touch. Passes.
- `"gives every reason a label"` — `Object.keys(withdrawalReasonLabels)` now includes the new key, and
  I supplied it. Passes.
- `"WRITES A CODE ON A REAL ACCEPTANCE"` — dispatches `REFER_TO_UNITS` then `ACCEPT_IN_PRINCIPLE` with
  `ACCEPTING_UNIT = "fre-adult-open"`, `OTHER_UNIT = "rph-adult-secure"`. After the edit,
  `entry.reason === "accepted_elsewhere_in_network"`. `WITHDRAWAL_REASONS).toContain(entry.reason)`
  passes (real member). `expect(entry.reason).not.toContain(accepting.name)` compares the _code_
  string `"accepted_elsewhere_in_network"` against the _unit name_ `"FRE Adult Open"` — never
  matches, by construction. Passes.
- `"AND THE SEED CARRIES NONE EITHER"` — reads the static seed (`ward-movements.ts`), untouched by a
  reducer-path edit. Passes.

I also searched every `.dom.test.tsx` and `.spec.ts` file for `withdrawalReasonLabels` or
`WITHDRAWAL_REASONS` and read the one hit, `tests/ward-screen-fd23-leaks.dom.test.tsx` (a file the
original sweep did not read, per the brief's warning). Its withdrawal test
(`"never names the unit that accepted..."`) reads from the **static seed**, not from a dispatched
`ACCEPT_IN_PRINCIPLE`, so it is not exercising my reducer edit at all — and even so, it only loops
`allUnits()` checking `unit.name`, the identical blind spot. It is not a guard for this edit either
way.

### Classification: GENUINELY UNGUARDED

Confirms the sweep's own corrected conclusion. I did not find a different guard.

### Fairness note

No throw risk; the reducer's arithmetic and array construction are unaffected by which string
literal is written.

---

## 5.1 — `ward-referral-ed-destination.test.ts` · the FD-18 guard

**Staleness: CURRENT.** `src/components/ward-management/ward-referrals.ts` changed substantially
(97 lines added) since `b5205b45a`, but the added code is two new exports
(`edAnsweredReferralsFor`, `referralAddressingStateLabel`) inserted after `edReferralsFor`, which is
itself byte-identical and still starts at line 214 (confirmed with `grep -n "^export function
edReferralsFor"`). `tests/ward-referral-ed-destination.test.ts` is unchanged.

### The exact edit

File: `src/components/ward-management/ward-referrals.ts`

Before (line 213-229):

```ts
export function edReferralsFor(
  referrals: readonly Referral[],
  edId: string,
  purpose: ReferralPurpose,
): EdAddressedReferral[] {
  const addressed: EdAddressedReferral[] = [];
  for (const referral of referrals) {
    for (const addressing of referral.destinations) {
      const destination = addressing.destination;
      if (destination.kind !== "emergency_department") continue;
      if (destination.edId !== edId) continue;
      if (destination.purpose !== purpose) continue;
      if (addressing.state !== "queued") continue;
      addressed.push({ referral, addressing, destination });
    }
  }
  return addressed.sort((a, b) => a.referral.raisedAt - b.referral.raisedAt);
}
```

After (replace the purpose check with the site-code inference the file's own doc comment names as
the refused workaround):

```ts
export function edReferralsFor(
  referrals: readonly Referral[],
  edId: string,
  purpose: ReferralPurpose,
): EdAddressedReferral[] {
  const department = allEmergencyDepartments().find((candidate) => candidate.id === edId);
  const addressed: EdAddressedReferral[] = [];
  for (const referral of referrals) {
    for (const addressing of referral.destinations) {
      const destination = addressing.destination;
      if (destination.kind !== "emergency_department") continue;
      if (destination.edId !== edId) continue;
      if (referral.originSiteCode !== department?.siteCode) continue;
      if (addressing.state !== "queued") continue;
      addressed.push({ referral, addressing, destination });
    }
  }
  return addressed.sort((a, b) => a.referral.raisedAt - b.referral.raisedAt);
}
```

(Needs `allEmergencyDepartments` added to the existing `ward-sites` import at the top of the file —
it is not currently imported there. `purpose` becomes an unused parameter; see the fairness note.)

### Prediction: `tests/ward-ed-psychiatry-hub.dom.test.tsx` goes red

`tests/ward-referral-ed-destination.test.ts` itself — including its own "FD-18 guard" test — **stays
green**, exactly as the sweep found: that test builds its own two objects and filters them with a
hand-written predicate, never calling `edReferralsFor`.

But I read (not grepped) `tests/ward-ed-psychiatry-hub.dom.test.tsx`, the sibling the sweep flagged
as an unverified mitigation, and it **does** exercise this exact scenario. Test:
`"⚠️ separates the self-addressed review from the ward's medical notification at the SAME
department"`. It raises three referrals via the real reducer — `bed`, `review`, `medical` — all
addressed to `departments[0]` (Royal Perth Hospital ED, `siteCode: "RPH"`), and **all three raised
with `originSiteCode: "RPH"`** (hardcoded in the test's own `raiseAll` helper, not derived from the
department). With the purpose check replaced by a site-code check, all three referrals share the
same `edId` _and_ the same site code, so the site-code inference can no longer tell them apart —
`edReferralsFor(all, department.id, "psychiatric_review")` now returns all three instead of just
`review`.

The specific assertion that fails, immediately:

```ts
expect(
  inbox.map((entry) => entry.referral.id),
  "the inbox must hold the self-addressed review request and nothing else",
).toEqual([review.id]);
```

`inbox` now has length 3, not 1 — this `toEqual` fails first (the two `.not.toContain` assertions
right after it would also fail, but this one fails before they run).

I also confirmed the two other tests in that `describe` block are **not** affected: `"does not take
another department's review request"` is excluded by the `destination.edId !== edId` check (untouched
by my edit, still present) regardless of purpose/site-code; `"carries the purpose through"` and
`"drops an addressing this department has already answered"` don't depend on the purpose filter at
all.

### Classification: MIS-ATTRIBUTED

The property (FD-18: purpose, not site code, disambiguates the self-addressed inbox from a ward's
medical notification) **is guarded** — by `ward-ed-psychiatry-hub.dom.test.tsx`, not by the file
whose title claims to guard it. This upgrades the sweep's own "grepped, not read" mitigation note to
a confirmed, load-bearing guard with a named assertion. `ward-referral-ed-destination.test.ts`'s
"FD-18 guard" test itself is still a lying title and worth an honest rename, but nothing is actually
at risk from this specific falsifier.

### Fairness note

The edit leaves `purpose: ReferralPurpose` as an unused parameter. Vitest transforms via esbuild and
does not typecheck (confirmed elsewhere in this repo's own docs), so this does not throw or fail the
test run — but it would surface under `npm run typecheck`/`lint` as a separate, non-test signal. Not
a reason the test-red prediction above is unfair, just worth flagging since the brief asks about
unsafety specifically in terms of "before any assertion runs" — there is none here.

---

## 6.1 — `ward-eligibility.test.ts` · sex-designation gate on the movement path

**Status: STALE-CLOSED, independently re-verified** (already given to me as settled; I re-derived it
rather than only recording the claim). `src/components/ward-management/ward-eligibility.ts` now
reads the ward's `sexDesignation` inside `eligibility()` (the movement-path function) at line 101:

```ts
const designationAccepts = sexDesignationAccepts(unit.sexDesignation, movement.sex);
```

and emits a `sex_designation` gate (lines ~126-149) that participates in the same
`gates.every((gate) => gate.pass)` verdict as every other gate. Fixed by commit `6cc80c774`
("fix(ward-flow): the movement path never asked the ward its sex designation"), landed via merge
commit `f2abfba77`. `tests/ward-eligibility.test.ts` gained a whole new `describe("sex designation, on
the movement path", ...)` block (5 tests) proving the gate fires for `fsh-adult-secure` specifically
— the exact unit and scenario the finding named as live. Nothing more to add.

---

## 6.2 — `ward-eligibility.test.ts` · every gate test proves the flag, never the verdict

**Staleness: CURRENT.** `tests/ward-eligibility.test.ts` changed since `b5205b45a` (+67 lines), but
the diff is purely additive — the whole new sex-designation `describe` block from 6.1, appended after
the existing `describe("clinical and operational gates", ...)` block. The five refusal tests the
finding names (`"refuses a cohort mismatch"`, the security-gate test, `"refuses when the ward cannot
staff..."`, `"refuses a unit that has already declined..."`, `"drops a unit whose allocatable figure
has gone stale..."`) are byte-identical, still asserting only `gate.pass`, never `verdict.eligible`.
Interestingly, the _new_ tests added for 6.1 do check both `gate.pass` and `verdict.eligible`
together — better practice, but they don't touch the five pre-existing gaps.
`src/components/ward-management/ward-eligibility.ts`'s `eligibility()` function changed (the 6.1
fix added a gate), but its combining line — `return { eligible: gates.every((gate) => gate.pass),
gates };` — is untouched, now at line 186.

### The exact edit

File: `src/components/ward-management/ward-eligibility.ts`

Before (line 186, end of `eligibility()`):

```ts
  return { eligible: gates.every((gate) => gate.pass), gates };
}
```

After:

```ts
  return {
    eligible: gates.every((gate) => gate.gate === "capacity_freshness" || gate.pass),
    gates,
  };
}
```

(Justified exactly as the finding proposes, by the file's own nearby comment at line ~386-387 calling
a `capacity_freshness` failure "a staleness warning" rather than a hard stop.)

### Prediction: nothing goes red

`"drops a unit whose allocatable figure has gone stale rather than showing it hopefully"` only checks
`verdict.gates.find((gate) => gate.gate === "capacity_freshness")?.pass).toBe(false)` — the gate
itself still reports `false`, so this passes.

I checked the blast radius the way the sweep did, but independently: `eligibleCandidatesAmong`
(`ward-derivations.ts:443`) is the only production caller of `eligibility()` outside the test file,
and it only **reorders** by `verdict.eligible` (eligible-first, stable sort), it never filters
ineligible units out entirely — so a false "eligible" only matters if some other test asserts on the
membership or order of a _specific_ stale-but-otherwise-good unit. I grepped every `.test.ts`,
`.dom.test.tsx` and `.spec.ts` file for `capacity_freshness` and found exactly two other hits
(`ward-referral-matching.test.ts`, `ward-referral-model.test.ts`), both of which import
`referralEligibility` (the separate referral-path function, its own `return` statement at line 381,
untouched by this edit) rather than `eligibility()`. Nothing calls `eligibility()` with a
simultaneously-stale-and-allocatable unit from the standard fixture — I confirmed the fixture data in
`ward-sites.ts` is unchanged since the sweep (only a comment changed), so the sweep's own blast-radius
statement ("no unit in the standard fixture is simultaneously stale and allocatable") still holds; I
did not re-derive that arithmetic by hand, I relied on the fixture being unchanged plus the absence of
any other test observing it.

### Classification: GENUINELY UNGUARDED

### Fairness note

No throw risk — purely a boolean-combination change.

---

## 6.8 — `ward-referral-reducer.test.ts` · "copies the referral fixture rather than aliasing it"

**Staleness: CURRENT.** `tests/ward-referral-reducer.test.ts` is byte-identical since `b5205b45a`.
It imports `seedWardFlowState`/`wardFlowReducer` from `ward-flow-reducer.ts` (unchanged) and
`referralState` from `ward-referrals.ts` (changed, but only by addition — `referralState` itself is
untouched).

### The exact edit

File: `src/components/ward-management/ward-flow-reducer.ts`

Before (line 281, inside `seedWardFlowState`):

```ts
    referrals: structuredClone(referrals),
```

After:

```ts
    referrals: referrals.map((referral) => ({ ...referral })),
```

### Prediction: nothing goes red

The named test (`"copies the referral fixture rather than aliasing it"`, line 704-708) only checks
top-level object identity (`not.toBe`) and deep structural equality (`toEqual`). A shallow spread
still produces a distinct top-level object per referral, and `toEqual` cannot see reference sharing —
both assertions pass, exactly as the finding claims.

I looked for what would actually be at risk from the aliasing (every seeded state's `referrals[i]
.destinations` array becoming the _same_ array object across every call to `seeded()`, and the same
object as the module-level fixture in `ward-movements.ts`) and searched for anything that would
expose it: (1) every reducer branch that touches `referral.destinations` — all nine sites use
`.map()`/`.find()`, none mutates in place (`git grep -n "\.destinations\."` in
`ward-flow-reducer.ts`, all nine hits read); (2) every test file for direct mutation of a referral's
`destinations` array (`.push`, index assignment, `.splice`) — zero hits across `tests/*.ts` and
`tests/*.tsx`; (3) every test file for an identity check specifically on a nested `destinations`
array (`.not.toBe` on `.destinations`) — zero hits. Nothing currently exploits the aliasing, so
nothing goes red anywhere I could find.

### Classification: GENUINELY UNGUARDED

The defect is real (today's code takes a real deep clone; the hypothetical shallow-spread version
would silently share nested arrays across every seeded state) but latent — nothing today mutates
through the shared reference, so nothing observes the difference.

### Fairness note

No throw risk.

---

## 6.9 — `ward-referral-reducer.test.ts` · a refusal asserted without the state check its sibling has

**Staleness: CURRENT.** Same file, unchanged since `b5205b45a` (see 6.8). The `RECEIVE_REFERRAL`
empty-destinations branch in `ward-flow-reducer.ts` (line ~1967) is also unchanged.

### The exact edit

File: `src/components/ward-management/ward-flow-reducer.ts`

Before (line ~1967):

```ts
if (event.destinations.length === 0) {
  return reject(state, event, `RECEIVE_REFERRAL needs at least one destination`);
}
```

After:

```ts
if (event.destinations.length === 0) {
  state = reject(state, event, `RECEIVE_REFERRAL needs at least one destination`);
}
```

This is the minimal version of "record the rejection and fall through to the append": it keeps the
rejection push (so the message assertion still holds) but stops short-circuiting, so every later
`RECEIVE_REFERRAL` validation runs against `event.destinations = []` and falls through to construct
and append a real referral with `destinations: []`.

I traced every subsequent check in the function body against an empty `event.destinations` and the
`receiveMulti` helper's fixed fields (`source: "community"`, `homeRegion: "Perth Metropolitan"`,
`suburb: { kind: "named", name: "Armadale" }`, `urgency: 2`, `originSiteCode: "SCGH"`,
`triagedAt` unset) to confirm none of them throws or refuses: the duplicate-kind check
(`new Set(kinds).size !== kinds.length`) is `0 !== 0` → false; the `kinds.some(...)` membership
check is vacuously false on an empty array; the ED-arm and ward-arm destination lookups both
`.find()` nothing and are skipped; every remaining field (`source`, `homeRegion`, `suburb`,
`urgency`, `originSiteCode`) is valid per `receiveMulti`'s fixture. Execution reaches the final
`return { ...state, referrals: [...state.referrals, created], ... }`, which merges the earlier
rejection (still present in `state.rejections`, since `reject()` only ever appends) with the new
referral append — so **both** the rejection and the empty-destination referral end up in the final
state.

### Prediction: only `tests/ward-referral-reducer.test.ts` is affected, and even there nothing goes red

The relevant test, `"refuses an empty list and the same kind twice, each by its own reason"`, only
checks:

```ts
const empty = receiveMulti(seeded(), []);
expect(empty.rejections.at(-1)?.reason).toContain("at least one destination");
```

The rejection message is still present and still last, so this passes — exactly as the finding
claims; **it never checks `empty.referrals` at all**, unlike its very next block (the duplicate-kind
half), which does `expect(twice.referrals).toEqual(seeded().referrals)`.

I searched every test file for `destinations: []` used with `RECEIVE_REFERRAL` — zero hits outside
this one test — and for any generic "a rejected event never changes state" assertion that might apply
across the board — none found (`ward-referral-decision-scope.test.ts`,
`ward-referral-ed-destination-validation.test.ts` and the other files with `rejections.length`
assertions all check specific, unrelated validation branches with their own fixed non-empty
`destinations`).

### Classification: GENUINELY UNGUARDED

### Fairness note

No throw risk — traced the full execution path above and confirmed a clean fall-through to a valid
(if empty-destination) referral object.

---

## 7.3 — `ward-referral-matching.test.ts` · every refusal test but one asserts the gate, never the offer

**Staleness: CURRENT for the cited test file** (`tests/ward-referral-matching.test.ts` unchanged
since `b5205b45a`) **but the production function's line number and two of the three "offer" consumers
changed materially since the sweep — I re-verified all three rather than trusting the citations.**
`src/components/ward-management/ward-eligibility.ts` gained the `ELIGIBILITY_GATES` union and the new
movement-path `sex_designation` gate (the 6.1 fix), but `referralEligibility()`'s own combining line
is untouched, now at line 381 (was presumably a lower number pre-fix; confirmed by grep, not assumed).
`coordinator/shortlist-panel.tsx` changed (28 insertions/10 deletions) but for an unrelated reason —
it renders the **movement**-path `eligibility()` verdict, not `referralEligibility()`, so its citation
in the finding's prose ("the verdict is what decides the offer, at `shortlist-panel.tsx:326`") is a
second, analogous instance of the same pattern, not the actual consumer this specific falsifier
threatens. `coordinator/flow-diagram.tsx:563` (the "Eligible now" badge, genuinely fed by
`referralEligibility` via `referralCandidates`) is unchanged and is the real second consumer.
`tests/ward-referral-screens.dom.test.tsx` changed substantially (+280 lines) since the sweep, but I
confirmed by diff that none of the new hunks touch the forensic-bed test discussed below — it is
byte-identical to its pre-sweep form.

### The exact edit

File: `src/components/ward-management/ward-eligibility.ts`

Before (line 381, end of `referralEligibility()`):

```ts
  return { eligible: gates.every((gate) => gate.pass), gates };
}
```

After:

```ts
  return {
    eligible: gates.every((gate) => gate.gate === "forensic" || gate.pass),
    gates,
  };
}
```

### Prediction — and this is the one that reverses the sweep's implicit picture

**`tests/ward-referral-matching.test.ts` itself stays fully green**, exactly as the finding says:
`verdict.eligible` is asserted `false` in only one place in the whole file (line 350, the
`sex_mix`-driven refusal test), and that test's failing gate is `sex_mix`, not `forensic`, so
exempting `forensic` doesn't touch it. `"a forensic bed never accepts a Phase 7 referral"` (line
237-239) only checks the gate itself, unaffected by how gates combine into `eligible`.

**But `tests/ward-referral-screens.dom.test.tsx` goes red — a real, working guard the sweep never
read.** Its `describe("ReferralMatchView — reducer refusal surfaces visibly, never swallowed", ...)`
block dispatches a real `ACCEPT_REFERRAL` at the network's one forensic bed
(`brm-adult-secure`, `forensic: true`, confirmed in `ward-sites.ts`), specifically through a harness
that feeds the **UI** a lied-to copy of the unit (`forensic: false`) while the **reducer** still reads
the real internal unit list. I traced the reducer path: `ward-flow-reducer.ts`'s `ACCEPT_REFERRAL`
handler (line 2170) calls `referralEligibility(referral, addressing.destination, unit, event.now)` —
the exact function I'm editing — and gates the whole acceptance on it:

```ts
const verdict = referralEligibility(referral, addressing.destination, unit, event.now);
if (!verdict.eligible) {
  const failedGate = verdict.gates.find((gate) => !gate.pass);
  return reject(
    state,
    event,
    `${unit.name} does not accept referral ${referral.id} — failed gate ${failedGate?.gate}: ${failedGate?.detail}`,
  );
}
```

With `forensic` exempted from `eligible`, and forensic being (per `ward-sites.ts`'s own comment) "the
ONLY reason this otherwise-eligible Adult/Secure/authorised bed is never offered," `verdict.eligible`
flips to `true` for this exact unit and referral, the `if (!verdict.eligible)` guard is skipped, and
the acceptance **succeeds** instead of being refused.

The specific assertion that fails, in test `"an acceptance the reducer refuses (forensic bed) surfaces
as a visible Rejection naming the failing gate"`:

```ts
const rejection = screen.getByTestId("ward-referral-match-rejection");
expect(rejection).toBeInTheDocument();
```

`screen.getByTestId` throws outright (element not found) because no rejection is rendered at all — the
acceptance went through.

**A second, independent guard exists one layer up, in Playwright** (`tests/ui-ward-referrals.spec.ts`,
needs `npm run ensure` + `verify:ui`, not plain `vitest`). I traced
`referrals/referral-match.tsx:518-536`: it renders an "Accepts this referral" + Accept button block
when `candidateAccepts(candidate)` is true, and a `data-testid="ward-referral-match-reason-${unit.id}"`
explanation block _only in the else branch_ when it is false. `candidateAccepts` (`ward-referrals.ts:712`)
is a direct passthrough of `candidate.verdict.eligible`. With my edit, the forensic bed's candidate
would flip to the "Accepts this referral" branch, so the reason `<p>` (and its testid) would not
render at all, and this assertion would fail to find its target:

```ts
await expect(page.getByTestId(`ward-referral-match-reason-${FORENSIC_UNIT_ID}`)).toHaveText(
  `${FORENSIC_UNIT_NAME} is a forensic bed and is never offered as a destination`,
);
```

I want to flag one imprecision in my own read here: that specific reason **text** ("is a forensic bed
and is never offered") is produced by a direct `unit.forensic` check elsewhere in `referral-match.tsx`
(line 509), not by `verdict.eligible` — so the wording itself isn't what breaks. What breaks is that
the whole reason paragraph (and that testid) stops rendering because the component takes the "accepts"
branch instead, which is what the Playwright `getByTestId` call would fail to find.

### Classification: MIS-ATTRIBUTED

The property this finding names ("the overall verdict decides the offer, and only one test in this
file checks the verdict rather than the gate") **is guarded — twice, at two different layers** — just
not by `ward-referral-matching.test.ts` itself, and not by anything the original sweep read (both
guards are in `.dom.test.tsx`/`.spec.ts`). The DOM guard runs under plain `vitest`/`test:focused`; the
Playwright guard needs the live-server UI gate.

### Fairness note

No throw risk before any assertion runs in either guard — I traced the full reducer path and the full
render branch and confirmed both reach their respective assertion cleanly (one succeeding when it
should fail, the other failing to find an element), never throwing for an unrelated reason first.

### Why this one is worth flagging to jump the queue

This is the strongest correction in the batch: the sweep's prose for 7.3 carried **no** mitigation
note at all (unlike 5.1, which at least flagged an unverified one), which reads as "nothing catches
this." Two real, currently-passing tests do — one of them a DOM test that runs in the ordinary
offline suite. Anyone treating 7.3 as evidence that the referral-matching offer path is unguarded
would be acting on a false premise; the actual gap is narrower (a title/rename problem in
`ward-referral-matching.test.ts`, not a missing safety net for a clinician-facing forensic-bed
offer).
