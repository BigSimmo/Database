# Ward Flow — the fold (COMPLETED 2026-08-29)

> ## OUTCOME — the fold is done, and this page was incomplete
>
> **Merge `899917421`** (parents `9cd9acf09` + `f341d5db7`), repairs at **`904363e1b`**, confirmation
> run at that SHA: **Test Files 70 passed (70) · Tests 1043 passed (1043)**. The board branch is fully
> contained in `claude/ward-flow-phases-6-7-design`, which is now the main line. Verified here with
> `git merge-base --is-ancestor`, not taken from the report.
>
> **The resolution rule below was right and was followed.** The board's copy of the three admission
> paths was taken wholesale — which is why those three files do **not** appear in the merge's
> conflict set: taking one side wholesale leaves no diff against that parent.
>
> ### This page said three conflicts. There were FOUR — and a first correction here said five, which was wrong.
>
> **What git actually reported as conflicted**, re-run between the two parents:
>
> ```
> CONFLICT (add/add) src/components/ward-management/ward-admissions-seed.ts
> CONFLICT (add/add) src/components/ward-management/ward-admissions.ts
> CONFLICT (add/add) tests/ward-admission-model.test.ts
> CONFLICT (content) tests/ward-nav.test.ts        <-- the one this page missed
> ```
>
> **The three add/add paths were exactly right.** The fourth, `tests/ward-nav.test.ts`, became a
> content conflict the moment the board branch committed its nav work — see the merge-tree note below
> for why no session could see it earlier.
>
> **An earlier version of this block claimed five, measured as "files differing from both parents".
> That measures the wrong thing and is corrected here.** Differing from both parents means only *git
> had to combine two sets of edits*; a conflict means *git could not, and a human chose*. Four of
> those five — `site-map.md`, `ward-nav.ts`, `ward-nav-icons.ts`, `ward-landmarks.test.ts` — merged
> cleanly and automatically. The two sets overlap in exactly one file.
>
> ### And that measurement is blind to the files this page exists for — which is the real lesson
>
> The three admission paths are **byte-identical to the board parent** in the merge (blobs
> `ccd6c66422b4`, `f56fe635671e`, `97550d8e9b7d`; verified here). Taking one side wholesale leaves no
> diff against that side — **so those three can never appear in a differs-from-both query, no matter
> how dangerous they were.**
>
> **The better the rule was followed, the more invisible they become to that measurement.** A query
> that looks authoritative, answers a slightly different question, and goes blind in exactly
> proportion to the procedure working. That is a sharper warning than any count, and it is the third
> correction this page has taken about its own conflict list.
>
> **Why this page could not see them, and it is not a mistake in the analysis.** `git merge-tree`
> compares **committed tips only**. When every one of us ran it, the board branch's nav work — the
> board route's link, its icon, and both counts — was sitting **uncommitted in its working tree**. So
> the conflict did not exist yet at the refs, and every three-file answer quoted by any session was
> correct for the commits it was computed from.
>
> **The lesson, which is rule 11 in its purest form:** a merge preview is a claim about two commits,
> not about two worktrees. Before trusting one, check `git status` in both — an uncommitted file is
> invisible to `merge-tree` and becomes a conflict the moment it lands.
>
> ### One check on this page was too weak, and it has been strengthened
>
> The verification greps below test field **names**. **A mutation that keeps the names and nulls every
> value passes them untouched** — found by the fold session stress-testing its own check against a
> live mutation. The name greps must be paired with at least one **value** assertion: a non-null
> `dischargeConfirmedAt` in the seed. They fail differently, so both lines must be read. See
> "After resolving, prove it" below, item 2, which already tested a value and is the pattern the
> others should follow.
>
> Everything below is preserved as written for the record.

---

# Ward Flow — the fold will NOT merge cleanly

**The 2026-08-29 handover is wrong about the most consequential thing it says.** Its §2 reads:

> The ward board folds into Phase 8's branch when Phase 8 lands. […] There are no overlapping code
> files, so the merge should be clean.

There are three overlapping code files, and the merge stops on all three. This page says which, how
to resolve them, what a careless resolution destroys, and — the part that matters most — **how to
tell whether this page has gone stale before you act on it.**

## Verified against these exact commits

| Branch | Head when this was written |
| ------ | -------------------------- |
| `claude/ward-flow-ward-board` | `1aba4812c140e115d2d3dc42ca54a0117e6f321c` |
| `claude/ward-flow-phases-6-7-design` | `a4006f22f979c5b9a0aa45c46b0bc6f4e10bc82e` |

Both branches were being actively committed to at the time of writing. **The ward board head moved
three times during the twenty minutes this was checked.** Treat the SHAs above as the thing this page
is true of, not as current.

## What conflicts, and why

Three files. Git is not looking at two edits of a shared file; it is looking at two files that share
a name and no common history. That is an `add/add` conflict, and git will not guess:

- `src/components/ward-management/ward-admissions.ts`
- `src/components/ward-management/ward-admissions-seed.ts`
- `tests/ward-admission-model.test.ts`

Nothing else collides. The ward board's other nine files — the derivations, the discharge dates, the
statistics, the teams, and their tests — exist on neither the other branch nor the merge base, and
merge without incident.

**How this actually happened** (corrected by the Phase 8 session, then verified here). Phase 8 did
not write these files. The ward board authored them; Phase 8 **cherry-picked** them; the ward board
then extended its own copies with the discharge-confirmation work. Confirmed by patch-id:

| Ward board | Phase 8 | patch-id |
| ---------- | ------- | -------- |
| `f8facae8a` | `4c3c4625a` | `c0eb26774d06` — identical |
| `f35e044be` | `a039940b5` | `8ebfb6cd3770` — identical |

A cherry-pick creates a new commit with no shared ancestry for those paths, so git sees an add/add
collision even though one side is a copy of the other. **Phase 8 has never authored a byte in any of
the three files**, which is what makes taking the ward board's copies cost it nothing.

**Why the parallel-execution rule did not catch it:** the rule was "never edit a file that exists on
the other branch". Nobody edited one — one side created them and the other copied them. A rule about
editing does not cover creating, or copying.

## The resolution: take the ward board's three files whole

Resolve all three in favour of `claude/ward-flow-ward-board`. Do not hand-merge them. Do not open a
three-way merge tool and stitch the two versions together.

## The evidence, and it is the direction that matters

The tempting question is "which version is bigger". That is the wrong question, and it is wrong in
the dangerous direction — a superset by line count can still be missing something.

The question that decides it is: **is there anything on Phase 8's side that the ward board does not
already have?** Asked that way, the answer is three seed rows in their pre-confirmation form:

```
["Female", "South West", 34, -2, { blockReason: "Awaiting accommodation" }],
["Male", "Kimberley", 5, 3],
["Female", "Perth Metropolitan", 6, -3],
```

The ward board carries all three, extended with the discharge-confirmation field that DB-2 requires.
Nothing else on Phase 8's side is absent from the ward board's version. That is what makes "take the
ward board's whole" safe rather than merely convenient.

## The guard against a wrong resolution is itself inside the conflict set

**This is what makes the resolution above the only safe one rather than the tidier one.** Raised by
the Phase 8 session; verified here.

`tests/ward-admission-model.test.ts` is not merely a third casualty. It holds the record's
**structural privacy allowlist** — an exact-equality assertion on the full field set, built so that a
future field named `notes`, `diagnosis`, `name` or `dob` **fails** rather than being discouraged by
convention. It follows the same pattern as the `Referral` and `LeaveBed` allowlists from Phases 4, 5
and 7.

The ward board's allowlist has **28** fields. Phase 8's has **26** — the two missing entries are
`dischargeConfirmedAt` and `dischargeConfirmedBy`. So the three possible resolutions behave like this:

| Resolution | Record | Allowlist | Result |
| ---------- | ------ | --------- | ------ |
| **All three from the ward board** (correct) | 28 fields | 28 | **Green, and right.** |
| **All three from Phase 8** | 26 fields | 26 | **GREEN, AND WRONG.** DB-2's confirmation work is gone, and the assertion that would have caught it was deleted by the same resolution. |
| **Mixed** — board's source, Phase 8's test | 28 fields | 26 | **Red.** The equality assertion catches it. |

Read that middle row carefully: **the fully-wrong resolution passes, and only the half-wrong one
fails.** The check and the thing it checks are removed together, leaving a suite that agrees with
itself and is wrong about the record. That is this project's own sentence one level deeper — an
absent signal reads exactly like a passing one, except here the signal deletes itself.

The consequence for practice: **"run the tests afterwards" does not verify this merge.** A green suite
is consistent with the worst outcome. The greps in the next-but-one section are the actual check,
because they assert against something the resolution cannot delete.

## THIS PAGE EXPIRES — run this before trusting it

Phase 8 was still building when this was written. Its last commit touching any of the three was
`a039940b5` at 04:46 on 2026-08-29. **If it edits one of them after `a4006f22f`, then "take the ward
board's whole" silently deletes that work** — and a deletion performed by merge resolution leaves no
failing test, no red gate and no diff to notice. It is the project's own sentence exactly: an absent
signal reads exactly like a passing one.

So before applying anything on this page, run:

```bash
git diff claude/ward-flow-ward-board claude/ward-flow-phases-6-7-design -- src/components/ward-management/ward-admissions.ts src/components/ward-management/ward-admissions-seed.ts tests/ward-admission-model.test.ts | grep '^+' | grep -v '^+++'
```

**Expected output: exactly the three seed rows quoted above, and nothing else.** Anything further in
that output means Phase 8 has moved and this page is out of date — rework the resolution, do not
apply it.

## The one line most likely to be lost

In the ward board's seed, `rph-adult-secure`:

```
["Female", "South West", 34, -2, { blockReason: "Awaiting accommodation", confirmedHoursAgo: 26 }],
```

This occupant is **both confirmed and blocked**, and it is the only seeded case that is. It exists so
that a blocked release is counted *alongside* the confirmed count rather than subtracted from it —
the case the three-stage bed model was built for. Its own comment records that a derivation quietly
dropping blocked releases out of the confirmed count "would pass every test in this repository".

Phase 8's version of that row has no `confirmedHoursAgo`. A hand-merge that reconciles the two
versions row by row will take the shorter one, because it looks like the common ancestor. **Check for
this line by name after resolving.** It is a single line and losing it removes a test case, not a
test — so nothing goes red.

## After resolving, prove it

1. **No markers survive.**
   `grep -rn '<<<<<<<\|>>>>>>>' src/components/ward-management/ tests/` — expect no output.
2. **The confirmed-and-blocked row is present.**
   `grep -n 'confirmedHoursAgo: 26' src/components/ward-management/ward-admissions-seed.ts`
3. **Both confirmation fields survived on the record.**
   `grep -n 'dischargeConfirmedAt\|dischargeConfirmedBy' src/components/ward-management/ward-admissions.ts` — expect them in the type, and again in `ADMISSION_FIELD_PRESENCE`. That second list is the thing that goes stale silently.
4. **Run the ward board's six test files together**, not one at a time:
   `node scripts/run-vitest.mjs run tests/ward-admission-model.test.ts tests/ward-admissions-seed.test.ts tests/ward-board-derivations.test.ts tests/ward-discharge-dates.test.ts tests/ward-statistics.test.ts tests/ward-teams.test.ts`
   Quote the `N passed` line. `npm run test:focused` refuses new test files and demands the full suite; exit code 0 alone proves nothing, because results are memoised — use `GATE_RECEIPTS=refresh` if fresh evidence is the point.
5. **Then Phase 8's own ward tests**, because the resolution changed files Phase 8 depends on.

## What is queued behind this merge

DB-10, DB-11 and DB-12 all state that they are built "at the fold" — they touch `morning-page.tsx`
and `ward-bed-availability.ts`, which the Phase 8 branch owns. DB-7's rolling 24-hour clock is in the
same place. So this conflict does not block a merge in the abstract; it blocks four recorded owner
decisions that cannot start until the merge is done.

## What was NOT verified

- **The ward board's "116 tests, all green" claim.** Not re-run here; it needs a machine-wide test
  lock. Treat it as unconfirmed until someone quotes the `N passed` line.
- **Whether Phase 8 is finished.** It was not, at 09:22 on 2026-08-29.
- **Anything about the merged result.** No merge was performed. Every conflict above was found with
  `git merge-tree --write-tree`, which computes the result in memory and writes nothing.
