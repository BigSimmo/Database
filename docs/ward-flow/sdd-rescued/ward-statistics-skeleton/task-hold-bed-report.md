# WF-BUILD-004 report — HOLD_BED correction, negation pin, loop floor

## Status

All three parts implemented and gate-verified GREEN. **Commit is currently blocked**, not
skipped: the shared `.githooks/pre-commit` documentation-sync guard refuses whenever any
file under `src/components/` or `tests/` has unstaged/untracked changes anywhere in the
worktree, and another agent has `src/components/ward-management/statistics/statistics-claims-register.ts`
and `tests/ward-statistics-claims.test.ts` mid-write throughout this session (repeatedly
staged, then unstaged again, in the seconds between my check and the hook's own check — a
live race, not a stale leftover). I made 37+ commit attempts across roughly 3 minutes,
including several launched at the instant `git status`/`git diff --name-only`/`git ls-files
--others` all reported clean, and the hook still caught an in-flight edit every time. Per
this repo's explicit instruction ("that is correct behaviour and must not be worked
around"), I did not use `SKIP_DOCS_SYNC_HOOK=1` or any other bypass.

**Both target files are staged (`git add`), byte-verified, gate-green, and ready to commit
the moment the tree is free.** The commit message is fully drafted (used verbatim in every
attempt, reproduced below). Nothing was lost; nothing needs to be redone — only a retry of
the plain `git commit` once `git status --short` shows no unstaged/untracked entries under
`src/components/` or `tests/` outside my two files.

Only `src/components/ward-management/community/community-screen.tsx` and
`tests/ward-community-index.test.ts` were touched. `ward-movements.ts` and the four
empty-state sentences in `community-screen.tsx` were left untouched, as instructed.

## Commit range

Not yet committed (blocked — see above). Staged and ready as an uncommitted change on top
of `321fa124b` on branch `claude/ward-builder-community-route`. Drafted commit message:

```
fix(ward-flow): retire HOLD_BED from the community follow-up correction, and pin the negation it forgot
```

(full body drafted; first line above, subject to being applied on next successful commit)

## RAN count

Gate commands, exactly as specified in the brief:

```
npx tsc -p tsconfig.typecheck.json --noEmit
```

Exit 0. No errors.

```
npx vitest run tests/ward-community-hub.dom.test.tsx tests/ward-community-hub.test.ts tests/ward-community-index.dom.test.tsx tests/ward-community-index.test.ts tests/ward-community-referral-survives.test.ts
```

Discovered list (`ls tests/ward-community*.test.ts tests/ward-community*.test.tsx`) — 5
files, not empty:

- `tests/ward-community-hub.dom.test.tsx`
- `tests/ward-community-hub.test.ts`
- `tests/ward-community-index.dom.test.tsx`
- `tests/ward-community-index.test.ts`
- `tests/ward-community-referral-survives.test.ts`

Result: **5 test files RAN, 52 tests RAN** (51 passed, 1 pre-existing intentional
`it.fails(...)` in `tests/ward-community-index.dom.test.tsx:107` — unrelated to this
change, a deliberately-red placeholder pending a nav-rail entry). Exit code 0. This is the
RAN count, not a "0 failed" startup-death reading: the run reported concrete file and test
totals, and a second full run (see Part 2 mutation proof below) independently reproduced
1 failing / 11 passing inside `ward-community-index.test.ts` alone when the sentence was
deliberately broken, confirming the suite executes rather than short-circuits.

## Part 1 — before/after of each HOLD_BED comment

### Site 1 — `src/components/ward-management/community/community-screen.tsx` (header doc

comment, point 1)

**Before:**

> `Admission.followUp` is a `FollowUpRecord | null` (`ward-admissions.ts:417`, and in the
> field-presence map at `:449`), `FollowUpRecord` carries a `state`, a `recordedAt` and a
> `recordedBy` role, the vocabulary is `FOLLOW_UP_STATES = ["arranged", "not_arranged"]`,
> and the seed sets a real record on two departed admissions.
>
> ... The only mention in `ward-flow-reducer.ts` writes `followUp: null` when `HOLD_BED`
> creates an admission, so no action available in this prototype can put a record there;
> ...

**After:**

> `Admission.followUp` is a `FollowUpRecord | null` (`ward-admissions.ts`, around `:452`,
> and in the field-presence map around `:484`), `FollowUpRecord` carries a `state`, a
> `recordedAt` and a `recordedBy` role, the vocabulary is `FOLLOW_UP_STATES`
> (`ward-admissions.ts`, around `:159`) = `["arranged", "not_arranged"]`, and the seed sets
> a real record on two departed admissions.
>
> ... The only mention in `ward-flow-reducer.ts` writes `followUp: null` (around `:941`,
> inside `case "PULL_PATIENT"` around `:811`) when it creates an admission, so no action
> available in this prototype can put a record there; ...

### Site 2 — `tests/ward-community-index.test.ts` (describe-block comment)

**Before:**

> - `Admission.followUp: FollowUpRecord | null` — `ward-admissions.ts:417`, and present in
>   the field-presence map at `:449`.
> - `FollowUpRecord = { state: FollowUpState; recordedAt: Instant; recordedBy: string }`,
>   with the vocabulary `FOLLOW_UP_STATES = ["arranged", "not_arranged"]` (`:143`).
> - The seed sets a real record on two departed admissions (`ward-admissions-seed.ts:733`,
>   `:770`).
>
> What IS true is narrower and sharper: the field has **no producer and no consumer**.
> Nothing reads it, and the sole mention in `ward-flow-reducer.ts` (`:814`) writes
> `followUp: null` when `HOLD_BED` creates an admission, so no action available in the
> prototype can put a record there.

**After:**

> - `Admission.followUp: FollowUpRecord | null` — `ward-admissions.ts`, around `:452`, and
>   present in the field-presence map around `:484`.
> - `FollowUpRecord = { state: FollowUpState; recordedAt: Instant; recordedBy: string }`,
>   with the vocabulary `FOLLOW_UP_STATES = ["arranged", "not_arranged"]`
>   (`ward-admissions.ts`, around `:159`).
> - The seed sets a real record on two departed admissions (`ward-admissions-seed.ts:733`,
>   `:770` — unchanged; not flagged by the brief).
>
> What IS true is narrower and sharper: the field has **no producer and no consumer**.
> Nothing reads it, and the sole mention in `ward-flow-reducer.ts` writes `followUp: null`
> (around `:941`, inside `case "PULL_PATIENT"` around `:811`) when it creates an admission,
> so no action available in the prototype can put a record there.

Every citation now names the symbol (`Admission.followUp`, the field-presence map,
`FOLLOW_UP_STATES`, `case "PULL_PATIENT"`) with the line number kept only as an "around"
hint, verified against this tree:

| Symbol                                        | Verified location          |
| --------------------------------------------- | -------------------------- |
| `Admission.followUp: FollowUpRecord \| null;` | `ward-admissions.ts:452`   |
| field-presence map `followUp: true,`          | `ward-admissions.ts:484`   |
| `FOLLOW_UP_STATES = [...]`                    | `ward-admissions.ts:159`   |
| `case "PULL_PATIENT":`                        | `ward-flow-reducer.ts:811` |
| `followUp: null,` write                       | `ward-flow-reducer.ts:941` |

The substance was preserved unchanged: both sites still state that `followUp` has no
reader anywhere in `src/` and that the seed sets two real records — only the named
mechanism (`HOLD_BED` → `PULL_PATIENT`) and the four line citations changed.

## Part 2 — the vacuous-negation test, fix and mutation proof

**Before** (`tests/ward-community-index.test.ts`, inside `"keeps the conclusion the
correction does not touch..."`):

```js
expect(markup).toContain("everyone who is missing");
expect(markup).toContain("does not mean everybody is being followed up");
```

The rendered JSX (`community-screen.tsx`) wraps only the word "not" in `<strong>`:
`...to the community — <strong>not</strong> everyone who is missing follow-up.` The old
assertion's substring sat entirely after the closing `</strong>`, so it survived deleting
`<strong>not</strong>` intact.

**After:**

```js
expect(markup, "the discharge list must still read as NOT the missing-follow-up list").toContain(
  "— <strong>not</strong> everyone who is missing follow-up",
);
expect(markup).toContain("does not mean everybody is being followed up");
```

Pinned on the raw markup including the `<strong>` tags, so the negation itself is part of
what must survive.

**Mutation proof, run in sequence:**

1. Hashed `community-screen.tsx` before mutating:
   `sha256sum` → `4e371fdd1490eca8627c3ab87423e69bef1b61eb7af4f8a2e5e0f377a03511cb` (this
   hash already reflects the Part 1 comment fix, captured after that edit and before this
   mutation).
2. Edited the file, deleting `<strong>not</strong>` from the sentence (replaced
   `... the community — <strong>not</strong> everyone` with `... the community — everyone`).
3. Ran `npx vitest run tests/ward-community-index.test.ts`:
   **12 tests, 1 failed** — exactly
   `"keeps the conclusion the correction does not touch: an empty list is never an
all-clear"`, with the assertion error:
   ```
   AssertionError: the discharge list must still read as NOT the missing-follow-up list:
   expected '<div ...' to contain '— <strong>not</strong> everyone who i…'
   ```
   Confirmed red, and red for the intended reason (the negation is exactly what is now
   pinned).
4. Reverted the mutation by re-inserting `<strong>not</strong>` in the same edit location
   (reverse of step 2, not a `git checkout`).
5. Re-hashed the file: `sha256sum` →
   `4e371fdd1490eca8627c3ab87423e69bef1b61eb7af4f8a2e5e0f377a03511cb` — **byte-identical**
   to the pre-mutation hash in step 1.
6. Re-ran the full discovered 5-file suite after restoring (see RAN count above): 52 tests,
   51 passed, 1 pre-existing unrelated `it.fails`, exit 0.

## Part 3 — the vacuous loop's missing floor

`it("each link's dynamic segment decodes back to the team id, rather than merely containing
it", ...)` iterated `linked` (computed once at `describe` scope) with no assertion of its
own that `linked` was non-empty; only the _previous_ test in the same `describe` block
asserted `linked.length > 0`. Added the same floor, matching the file's own established
pattern:

```js
expect(linked.length, "the community index rendered no team links at all").toBeGreaterThan(0);
```

placed at the top of that test, before the `for (const id of linked)` loop and before the
`needingEscape` derivation (also over `expected`, also previously unguarded by this test).
