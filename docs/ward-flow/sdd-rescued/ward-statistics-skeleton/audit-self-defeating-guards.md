# Self-defeating guard audit — ward-community* / ward-statistics* / ward-daily-sheet-placement

All reads were `git show HEAD:<path>` — the working tree was not touched (other agents are
editing it live) and vitest was not run, per instructions.

## Discovery

```
ls tests/ward-community*.test.ts tests/ward-community*.test.tsx tests/ward-statistics*.test.ts \
   tests/ward-statistics*.test.tsx tests/ward-daily-sheet-placement.dom.test.tsx
```

13 files discovered, all 13 examined:

1. `tests/ward-community-corrected-claims.test.ts`
2. `tests/ward-community-hub.dom.test.tsx`
3. `tests/ward-community-hub.test.ts`
4. `tests/ward-community-index.dom.test.tsx`
5. `tests/ward-community-index.test.ts`
6. `tests/ward-community-referral-survives.test.ts`
7. `tests/ward-daily-sheet-placement.dom.test.tsx`
8. `tests/ward-statistics.dom.test.tsx`
9. `tests/ward-statistics.test.ts`
10. `tests/ward-statistics-claims.test.ts`
11. `tests/ward-statistics-derivations.test.ts`
12. `tests/ward-statistics-incoherent-gap.test.ts`
13. `tests/ward-statistics-sections.dom.test.tsx`
14. `tests/ward-statistics-sections.test.ts`

(14 files — the glob matches `ward-statistics-sections` under both `.test.ts` and `.dom.test.tsx`,
and `ward-statistics-claims.test.ts` also matched the `ward-statistics*` pattern; count is 14 on
disk, all examined, comfortably over the 10-file refusal floor.)

## Method

Pass 1 (original brief): grepped every file for `toBe(0)`, `toEqual([])`, `toHaveLength(0)` and
`.length).toBe(` as candidate guards/pins, then read each in its surrounding test to check what
runs after it and over which population.

Pass 2 (mid-flight addition): grepped the five DOM files for every Testing-Library query family
(`getBy*`, `getAllBy*`, `queryBy*`, `queryAllBy*`, `findBy*`) and read each `queryBy*`/`getAllBy*`
occurrence in context. The nine `.test.ts` (non-DOM) files contain no `render`/`screen` usage —
grep hits on the string `screen` in them are prose referring to `*-screen.tsx` source files, not
Testing Library. Full treatment (both passes) was given to all 5 `.dom.test.tsx` files; the 9
non-DOM files only needed pass 1, since they have no queries to classify.

## Part 1 — SELF-DEFEATING / ORTHOGONAL-BUT-EMPTY (original brief)

**Zero found in either category.** Every `toBe(0)` / `toEqual([])` / `toHaveLength(0)` in the set
is a final assertion about a scenario deliberately built to be empty (e.g. `wardStatistics(UNIT,
[], ...)` asserting `readyToLeaveCannot` is a real `0`, or `refusedAndNothingPending` on a
movement with a live referral asserting `count` is `0`), never a precondition that a later
assertion in the same test then depends on being non-empty. Every non-vacuity guard in the set
(`expect(x.length).toBeGreaterThan(0)`, or an exact pin like `MODEL_CLAIMS.length === 86`,
`ADMISSION_STATES.length === 4`, `PLACEMENT.length === 7`, `DECLINE_REASONS.length > 0`) pins to a
**non-zero** value and every loop that follows iterates the _same, unfiltered_ array the guard
just proved non-empty — never a `.filter()`-derived subset that the guard left unchecked.

`tests/ward-statistics-claims.test.ts` specifically: the exact-count pin (`EXPECTED_MODEL_CLAIMS =
86`, `EXPECTED_UNEVIDENCED_CLAIMS = 12`, `EXPECTED_REGISTERED_SURFACES = 9`) is followed by every
other test iterating `MODEL_CLAIMS` / `UNEVIDENCED_CLAIMS` / `REGISTERED_SURFACES` directly, with
no intervening `.filter()` that then gets looped over unchecked. The only `.filter()` calls in the
file (`bare = REGISTERED_SURFACES.filter(...)`, `duplicates = ids.filter(...)`, `collisions =
UNEVIDENCED_CLAIMS.filter(...)`) are each immediately closed with `toEqual([])` — testing for
emptiness is the assertion itself there, not a precondition for something after it. **Verdict:
SOUND**, and I looked specifically for the filtered-subset shape the brief flagged as likely and
did not find it.

`tests/ward-daily-sheet-placement.dom.test.tsx`: see Part 2 below — the verdict changed from the
brief's working hypothesis once the query semantics were accounted for.

## Part 2 — query-family pass (mid-flight addition)

### Query inventory, all 5 DOM files

| Family        | Throws on zero matches?         | Throws on multiple matches? | Used in this set?                                            |
| ------------- | ------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `getBy*`      | yes                             | yes                         | extensively (hundreds of `getByTestId`, several `getByRole`) |
| `getAllBy*`   | yes (empty array is impossible) | no                          | `getAllByRole` (7 call sites across 3 files)                 |
| `queryBy*`    | no — returns `null`             | yes (still throws on 2+)    | `queryByTestId`/`queryByRole` (~30 call sites)               |
| `queryAllBy*` | no — returns `[]`               | no                          | **zero call sites in the entire discovered set**             |
| `findBy*`     | no — rejects (async)            | yes                         | zero call sites                                              |

### 1. `tests/ward-daily-sheet-placement.dom.test.tsx` — REDUNDANT-BUT-LOAD-BEARING-ELSEWHERE

- Test 1 (`"finds the away line and at least one group heading..."`) guard:
  `expect(headings.length).toBeGreaterThan(0)`, where `headings = within(sheet).getAllByRole("heading", { level: 3 })`.
- Test 2 (`"places the away line after every one of the group headings..."`) does its own separate
  `render()` and its own `const headings = within(sheet).getAllByRole("heading", { level: 3 })`,
  then `for (const heading of headings) { ... }`.
- **A guard in test 1 cannot protect test 2 at all** — separate `it` blocks, separate `render()`
  calls, no shared state but the `describe`. That part of the brief's suspicion was correct.
- **But test 2 needs no protection from test 1**, because `getAllByRole` **throws** on zero
  matches rather than returning `[]`. If production stopped rendering any level-3 heading, test
  2's own `within(sheet).getAllByRole("heading", { level: 3 })` call would throw before the loop
  ever ran, failing the test with a Testing-Library "unable to find" error — the loop can never
  silently run zero times.
- **The real protection is the query itself, invisible, in test 2. The visible protection (test
  1's guard) is doing nothing for test 2 and never could.** This is dangerous exactly as flagged:
  a refactor of test 2's line to `within(sheet).queryAllByRole("heading", { level: 3 })` (e.g. to
  "handle" a transiently-empty render) would silently delete the only real protection test 2 has,
  while test 1 keeps passing and still reads as "the file's vacuity guard."
- **Remedy, as a comment on the query, not the assertion:** a one-line comment directly above test
  2's `getAllByRole` call — `getAllByRole throws on zero matches; this is the test's only
non-vacuity protection and must not become queryAllByRole` — would make the load-bearing query
  visible. No such comment exists today.
- Classification: **REDUNDANT-BUT-LOAD-BEARING-ELSEWHERE**. Redundant assertion: test 1's
  `expect(headings.length).toBeGreaterThan(0)` (protects only test 1). Query actually doing the
  work for test 2: test 2's own `getAllByRole("heading", { level: 3 })` call.

### 2–5. The other four DOM files — no holes found

Checked every `queryBy*`/`queryAllBy*` occurrence in `ward-community-hub.dom.test.tsx` (8 sites),
`ward-statistics.dom.test.tsx` (9 sites), and `ward-statistics-sections.dom.test.tsx` (8 sites):
**every single one is used directly against `.toBeNull()` / `.not.toBeNull()`** — testing for
presence-or-absence is the assertion itself, never iterated or indexed. Zero `queryAllBy*` call
sites exist anywhere in the discovered set, so the specific hole the coordinator described
("`queryAll*` result iterated/indexed without a preceding non-empty assertion") has no instance to
find here — the codebase simply hasn't used that query family yet.

`getAllByRole` (7 sites total, in `ward-community-hub.dom.test.tsx` lines 169/193/202/215/592,
`ward-statistics.dom.test.tsx` lines 967/1064) is in every case either immediately closed with
`.toHaveLength(n)` for a specific non-zero `n`, or (line 967, line 1064) preceded by its own
non-vacuity reasoning — `getAllByRole` throwing on zero matches is itself the protection, and
none of these loops depend on a _different_ test's guard the way the daily-sheet case does.

`getByTestId` (the large majority of query calls) throws on both zero and multiple matches, so it
is real duplicate-detection protection by construction wherever it is used — no site in this set
downgrades a `getByTestId` to an indexed `queryAllByTestId(...)[0]`, so the "nine tests went red on
a duplicate test id" failure mode the coordinator described is not currently latent here.

## Two named guards — final verdicts

1. **`ward-daily-sheet-placement.dom.test.tsx`**: test 1's guard is sound _for test 1_. It cannot
   and does not protect test 2's loop — cross-`it` isolation makes that structurally impossible —
   but test 2 needs no protection from it, because `getAllByRole` throws on zero matches and is
   itself test 2's real (uncommented, and therefore fragile-to-refactor) guard. Net verdict:
   **REDUNDANT-BUT-LOAD-BEARING-ELSEWHERE**, not a live defect today, but one edit away from
   becoming a silent hole.
2. **`ward-statistics-claims.test.ts`**: the exact top-of-file pins are sound, and I specifically
   went hunting for a `.filter()`-then-iterate subset that nothing proves non-empty, per your
   instruction that this was the likeliest real finding. **It is not there.** Every loop in the
   file walks the full pinned array. Verdict: **SOUND**.

## Worst finding, in two sentences

The `ward-daily-sheet-placement.dom.test.tsx` guard/loop pair is not self-defeating, but it is a
near-miss of the same family: the assertion that _looks_ like the file's non-vacuity guard (test
1's `headings.length > 0`) protects nothing outside its own test, while the assertion that
actually prevents a silent zero-iteration pass (test 2's `getAllByRole` call) carries no comment
saying so, so a future refactor to `queryAllByRole` would delete the real protection while leaving
the decoy guard visibly in place and green.

---

## Provenance of this sweep's nought — READ OR MATCHED? UNDETERMINED

Recorded 2026-09-02 at Ward Verifier's request, because **a nought whose method is unrecorded
degrades into an assertion**, and this report will outlive anyone's memory of how it was produced.

**The trap swept for here is scope-relative by construction.** _A non-vacuity guard that guarantees
a different vacuity_ cannot be found by a pattern: it requires holding what a guard establishes
against what later assertions need, across statements. That is a RELATION question, and by this
project's own standing rule a clean nought on a relation question from a mechanical pass is exactly
the nought to discount.

**So: was it read, or matched? I cannot establish it.**

- The agent's transcript is **0 bytes** — a known failure mode on this machine, the same one that
  left an earlier dispatch with no output at all. There is nothing to count.
- What exists: **22 tool uses across 14 files**, and **175,867 tokens**. Fourteen file reads plus a
  discovery listing, a mid-flight instruction, and a report write is roughly twenty calls, so the
  count is _consistent with_ reading each file once. It does not prove it.
- **Weak positive signal:** it reported that the 9 non-DOM files use no Testing Library queries at
  all, and that it specifically hunted a `.filter()`-then-iterate subset in the register — neither
  is a phrase anyone greps for. But both are also reachable by a targeted search, so this raises
  confidence without settling it.

**Standing of the result, stated at its true size:** the four negatives (0 SELF-DEFEATING, 0
ORTHOGONAL-BUT-EMPTY, 0 `queryAllBy*` call sites, register SOUND against the filter-subset hole) are
**unverified as to method**. The one positive finding — the placement test — was found independently
by Ward Verifier reading the file itself, so it does not rest on this sweep at all.

**If the register's per-pin question is ever run, do not treat these negatives as a baseline.**

**Two limits that are NOT about method and still hold:** zero `queryAllBy*` is a fact about today's
files, not a property — the first one anybody writes lands where nothing guards the shortcut and one
file already depends on an uncommented throwing query. And fourteen files is one branch's holdings;
this says nothing about any other chat's tests.
