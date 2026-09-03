# Task report: name the constant gap on screen, not only in a comment

Brief: `task-constant-gap-brief.md`. Worktree `D:/Worktrees/Database/ward-builder-community-route`,
branch `claude/ward-builder-community-route`.

**Note on this file.** The brief did not name a report file and no
`task-constant-gap-report.md` existed; the round-1 report was delivered in chat. Fix round 1 asked
me to "append to the same report file", so this file was created carrying BOTH rounds rather than
appending round 2 to a file that was never written. If the coordinator meant a different file, this
is the discrepancy to correct.

---

## Round 1 — initial implementation (commit `8b42f0c9d`)

### What changed

- `src/components/ward-management/statistics/statistics-screen.tsx` — one new
  `<p className={styles.figureNote}>` after the existing range paragraph, conditional on the two
  ends being non-null and equal. New testid `ward-statistics-arrival-constant-gap`; every existing
  testid untouched.
- `tests/ward-statistics.dom.test.tsx` — a new describe block with a positive and a negative test,
  plus three assertions added to the existing live-world test.
- `statistics-derivations.ts` NOT changed: `shortestMinutes` and `longestMinutes` were already on
  the returned object, so no new boolean was needed.

### Gate

`npx vitest run tests/ward-statistics.dom.test.tsx tests/ward-statistics-derivations.test.ts`
-> `Tests  42 passed (42)` (from 40).
`npx tsc -p tsconfig.typecheck.json --noEmit` -> exit 0, no diagnostics.

### Adversarial proof

Condition replaced with `true`; the negative test went red at the `queryByTestId` line. File
restored from a scratchpad copy and sha1 confirmed identical
(`8c64a602da8ae535596465c48b5f30320fe4df49`) before the gate was re-run and the commit made.

---

## Fix round 1 — both Importants addressed

### FINDING 1 — the copy asserted a mechanism the condition cannot establish

**Accepted in full, and the reviewer is right about why it matters here specifically.** The render
guard observes an equality of two numbers. Two independently generated gaps that happened to
coincide satisfy it identically, so the page cannot distinguish "coincidentally equal" from
"structurally identical" — yet the old copy stated the fixed-offset derivation as settled fact.
That is this page's own defect class (a claim it cannot verify) relocated from a number into a
cause, which is worse here than it would be anywhere else because the whole point of the paragraph
is to stop a reader believing an unverifiable claim.

The copy now leads with what the condition **does** entail — every measured gap is the same length,
therefore no variation, therefore not a measurement of the service — then says outright that the
page can see only that the ends coincide and never why, and offers the fixed offset as "an
explanation this shape points at rather than a finding the page has established".

Deliberately **not** over-hedged: the first sentence is still an unqualified instruction not to read
the figure as a measurement of how long beds take to fill, and the closing sentence still names the
admissions side as where the change belongs. The hedge is on the CAUSE, not on the warning.

### FINDING 2 — a single measured admission breaks the sentence

**Accepted.** With one measured record the gap is its own shortest and its own longest, so the
equality holds trivially and there is nothing for the one gap to agree with.

The guard is now `arrivals.measuredCount > 1 && <both non-null> && <equal>`. The count conjunct is
first and carries a comment saying it is part of the condition rather than an optimisation.

I took the coordinator's ruling that the case is real (generic screen, non-generic callers) and did
not re-litigate it. I did **not** invent a replacement sentence for the one-record case: the
population is already rendered beside the average ("across 1 admission"), and a new paragraph there
would be a second gap this brief did not ask for.

### What changed in round 2

- `statistics-screen.tsx` — copy rewritten as above; `measuredCount > 1` added to the guard; two new
  comment blocks recording why each is load-bearing.
- `tests/ward-statistics.dom.test.tsx` — positive-test assertions updated to the new copy and
  **extended with two assertions that pin the hedge itself** (`"What this page can see is that the
two ends coincide, never why they do"` and `"an explanation this shape points at rather than a
finding"`), so a future edit cannot quietly re-assert the mechanism as fact. One new test:
  `"says nothing when a single admission makes the two ends meet trivially"`.

The single-admission fixture carries a **second, unmeasured** admission (pulled, no arrival) on
purpose, so the test cannot pass merely by having one record on the page — the guard has to count
MEASURED gaps, not admissions.

The no-digit assertion (`expect(text).not.toMatch(/[0-9]/)`) is retained: it is what stops anyone
later putting the seeded value or the population size into the copy.

### Gate — file list derived from disk, as instructed

```
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx | tr '\n' ' ')
npx tsc -p tsconfig.typecheck.json --noEmit
```

Decisive lines:

- Round-1 two-file set, for a like-for-like count: `Tests  43 passed (43)` — 42 -> 43, the one new
  test.
- Disk-derived set at first run (3 files): `Test Files  3 passed (3)` / `Tests  63 passed (63)`.
- Disk-derived set at final run (5 files): `Test Files  5 passed (5)` / `Tests  100 passed (100)`.
- `npx tsc -p tsconfig.typecheck.json --noEmit` -> `EXIT=0`, no diagnostics. Confirmed the edited
  file is in that program (`--listFiles | grep -c statistics-screen.tsx` -> `1`) rather than
  trusting a silent zero.
- Prettier: `All matched files use Prettier code style!`

**The disk-derived list is why this instruction mattered.** It immediately picked up
`tests/ward-statistics.test.ts`, which my round-1 hand-named gate never ran, and then grew again
mid-task to five files as the other implementer landed
`tests/ward-statistics-sections{,.dom}.test.ts(x)`. A hand-named list would have missed all three.

### Adversarial proof — both guards, independently

Backed up to scratchpad, mutated, ran, restored, hash-verified.

1. **Whole condition replaced with `true`:** `Tests  2 failed | 18 passed (20)` — BOTH negative
   tests red (`says nothing of the kind once the gaps actually differ`, `says nothing when a single
admission makes the two ends meet trivially`).
2. **Only the `measuredCount > 1` conjunct removed:** `Tests  1 failed | 19 passed (20)` — exactly
   the new single-admission test red, the spread test still green. This is the proof that the count
   guard is separately load-bearing and separately tested, rather than incidentally covered by the
   equality test.

Restored from `screen-r2.bak`; sha1 `e9594020b5bf16006bb81c206dc6d198b09a687b` matches the
pre-mutation hash, and `grep -c "arrivals.measuredCount > 1 &&"` returns `1`.

### Decisions this round

1. **No new sentence for the one-record case.** Guarded to silence rather than reworded. Stated
   above; flagging it because the coordinator asked for a guard and a test, not for copy, and I read
   that literally.
2. **The hedge is asserted by tests, not just written.** Two assertions pin the epistemic wording.
   Without them Finding 1 could reappear in a later edit with nothing red.
3. **Report file created rather than appended** — see the note at the top.
