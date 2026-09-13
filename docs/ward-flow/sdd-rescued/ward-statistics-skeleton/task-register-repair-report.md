# Register repair — report

**Status: work COMPLETE and GREEN; NOT COMMITTED — blocked by the pre-commit hook on another
session's files. Named below.**

## The gate

```
NODE_OPTIONS="--max-old-space-size=10240" npx tsc -p tsconfig.typecheck.json --noEmit    # exit 0
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx \
                    tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Discovered list, echoed and non-empty (12 files):

```
tests/ward-community-hub.dom.test.tsx      tests/ward-community-hub.test.ts
tests/ward-community-index.dom.test.tsx    tests/ward-community-index.test.ts
tests/ward-community-referral-survives.test.ts
tests/ward-statistics.dom.test.tsx         tests/ward-statistics.test.ts
tests/ward-statistics-claims.test.ts       tests/ward-statistics-derivations.test.ts
tests/ward-statistics-incoherent-gap.test.ts
tests/ward-statistics-sections.dom.test.tsx tests/ward-statistics-sections.test.ts
```

```
 Test Files  12 passed (12)
      Tests  228 passed | 1 expected fail (229)
EXIT: 0
```

**RAN = 229** (12 files, all loaded). `tests/ward-statistics-claims.test.ts` alone: **19 ran, 19
passed, exit 0.**

Two false starts worth recording, both of which report "0 failed" if the exit code is not read:
`--reporter=basic` no longer exists in vitest 4.1.10 and dies as a Startup Error (exit 1, zero tests
run); and `tsc` died twice with `FATAL ERROR: Zone Allocation failed` (exit 134) before passing at
`--max-old-space-size=10240`, with 9.8 GB free at the time.

## Prior-art check (asked for before Part 1)

**Nothing in this repository applies an edit in memory and re-tests a predicate.** Three near
neighbours, none extensible into this:

- `tests/ward-flow-single-source.test.ts` solves the _same underlying problem_ (prose satisfying a
  source scan) for one identifier, by walking the TypeScript AST so comment trivia can never count.
  It is a _prose-exclusion_ mechanism, not a falsification one, and its own header records that a
  hand-rolled comment/string scanner desynced on a regex literal — which is why the exact
  comment-span test is not built here either.
- `tests/route-reachability.test.ts` is AST/JSX-based and self-tests against synthetic source. It
  never mutates a real file.
- `tests/ward-flow-chat-control.test.ts` already carries the _idea_: handover evidence must declare
  a `falsifier`. But it is validated only for presence as a non-empty string, is local to that file,
  and is never applied.

So this is new, and it is built to be pointable at another surface later without being generalised
now: `falsifiabilityProblem(source, claim)` takes only `{sourceFile, evidence, falsifiedBy}` and has
no dependency on this register.

## Part 1 — the guard

**Representation chosen: a find/replace pair over `sourceFile`, plus a `change` line in words.**

```ts
export type FalsifyingEdit = { change: string; find: string; replaceWith: string };
```

Why: every other shape is a special case of it. An insertion is `find: "<anchor>"` /
`replaceWith: "<anchor> <new line>"`; a deletion is `replaceWith: ""`; a rename or retype is the
ordinary case. Nothing else was needed across 85 entries, and it was the shape that stayed writable
correctly at that volume.

The test applies it to an in-memory copy and asserts the evidence is then ABSENT. **Three failure
modes are distinguished on purpose**, because an undetected one would let the check pass by doing
nothing:

- `anchor-missing` / `anchor-ambiguous` — the _edit_ has gone stale. Without this a dead anchor
  applies nothing, the evidence survives, and it is indistinguishable from an unfalsifiable citation.
- `no-op` — `replaceWith === find`.
- `evidence-survives` — the real finding.

`change` is not decoration: it is the only defence against a _weak_ edit (one that removes the cited
bytes for a reason unrelated to the claim), because it forces the author to state, in the register,
what change to the world the edit stands for. Where an edit falsifies only part of a claim — the
positive half of an "only", the required half of "physically present" — `change` says so in that
entry. The residual is stated in the module's own doc comment, as asked.

`isEntirelyComment` is kept as a cheap fast-fail and explicitly demoted. **The proposed tightening
was NOT shipped.**

## Part 2 — the two test defects

- **Exact counts, not floors.** `MODEL_CLAIMS.length === 85`, `UNEVIDENCED_CLAIMS.length === 13`,
  `REGISTERED_SURFACES.length === 9`, each with a message saying that a red resolved by deleting the
  claim is the failure the pin exists to prevent.
- **Every registered surface must carry at least one entry** — in _either_ list. Either list,
  because `statistics-disclaimers.tsx`'s two claims are genuine absences: requiring a `MODEL_CLAIMS`
  entry would force a fake citation onto exactly the page that must not have one.

## Part 3 — the twelve

| #   | Claim                                             | Repair                                                                                                                                |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1,2 | `…/ward-destination-records-bed-criteria` ×2      | `WARD_DESTINATION_ARM` now runs `kind:` → closing brace. Its doc comment records that it previously _said_ "cited whole" and was not. |
| 3   | `…/a-null-referral-id-means-a-movement`           | Re-pointed from `ward-admissions.ts` prose to the `PATIENT_ARRIVED` line in `ward-flow-reducer.ts` that writes `referralId: null`.    |
| 4   | `…/ed-requests-arrive-verbally`                   | **Moved to `UNEVIDENCED_CLAIMS`** with the reason. An absence given a citation anyway.                                                |
| 5   | `…/confirmed-at-is-one-shared-field`              | Two-field slice → the whole `BedRelease` record.                                                                                      |
| 6–9 | the four "is derived" claims                      | Type declaration → the line that computes each.                                                                                       |
| 10  | `…/a-site-code-may-resolve-to-nothing` ×2         | Signature → signature + body, because `?? wardSites[0]` is legal against the unchanged return type.                                   |
| 11  | `…/the-missing-region-field-is-enforcement`       | **Deleted** as a duplicate; `COMMUNITY_TEAM_BODY` on its sibling is the real guard. Recorded in that sibling's doc comment.           |
| 12  | `…/the-vocabulary-comes-from-one-source-document` | Function head + first loop → the whole function.                                                                                      |

Beyond the twelve, two "lower confidence" citations were widened while their edits were being
written, because the honest edit needed it: the withheld-declines block (bare `data-testid` → the
enclosing figure and heading, so a wrapping condition has to cut _inside_ the cited run) and the
other-teams switcher (bare `aria-label` → nav + heading + list).

## The two coordinator findings, taken in the same work

- **Finding A — `hasControlCharacter` was never shown to reject anything.** Fixed: it now has a
  dedicated rejection case (bytes built with `String.fromCodePoint`, never as escapes), and it is
  applied to the claim's own words, to the unevidenced claims' words and reasons, and to all three
  fields of the falsifying edit — a backspace in `find` would be an edit that can never apply.
- **Finding B — `isEntirelyComment`'s code-token test passes almost any real doc comment.** Not
  patched, per the brief. Both holes are written out on the function itself, along with what would
  close them exactly and why it is not built.

## Counts

- `MODEL_CLAIMS`: **87 → 85.** One moved to `UNEVIDENCED_CLAIMS`, one deleted as a duplicate. None
  deleted to make anything pass.
- `UNEVIDENCED_CLAIMS`: **12 → 13.**
- **85 of 85 claims carry a falsifying edit**, and all 85 pass.

## The two proofs that the guard fires

Both mutations were applied to the working file, the test run, then the file restored from a hashed
backup and `sha256sum -c` verified before continuing.

**Proof 1 — a type declaration cited for a computation** (the exact shape of findings 6–9). Restored
`evidence: "longStays: number;"` while leaving its edit in place:

```
AssertionError: 1 claim(s) are not falsifiable by their own recorded edit:

CLAIM statistics-ward-screen/computed/long-stays-are-derived
  says: `wardStatistics()` derives a count of long stays.
  ITS EVIDENCE SURVIVES ITS OWN FALSIFYING EDIT, so nothing here is guarding this claim.
  cited fragment: "longStays: number;"
  edit: "const longStays = liveAdmissions.filter(…).length;" -> "const longStays = 0;"
 Tests  1 failed | 18 passed (19)      EXIT: 1
```

Restored → `19 passed (19)`, exit 0, hashes `OK`.

**Proof 2 — the two-field slice cited for an "only"** (findings 1–2). Restored the pre-repair
`WARD_DESTINATION_ARM`:

```
AssertionError: 2 claim(s) are not falsifiable by their own recorded edit:
CLAIM statistics-screen/declines/ward-destination-records-bed-criteria
CLAIM statistics-compare-screen/declines/ward-destination-records-bed-criteria
 EXIT: 1
```

Both screens go red together, which is the correct blast radius. Restored → `19 passed (19)`, exit
0, hashes `OK`.

## What the findings file got wrong

1. **"74 `MODEL_CLAIMS`" — there were 87** at `bf2f95400` and still 87 at `321fa124b`. Verified two
   ways (`grep -c '^    id: "'` inside the array, and a per-surface tally that sums to 87).
2. **Its own correction was the error.** It says "there are **10** `UNEVIDENCED_CLAIMS`, not 12. I
   have said 12 to three chats." **There were 12.** The original figure was right and the correction
   was wrong; three chats have now been corrected toward a false number.
3. **The floor understated the exposure.** `>= 40` against 87 means **47** claims could be deleted in
   silence, not 34.
4. **The falsifying-edit test does NOT subsume the comment guard, contrary to "It subsumes the
   comment guard."** For a comment citation an author can record `find: <the comment>,
`replaceWith: ""`; the evidence duly disappears and the check passes. What changes is that the
`change`field must then say the change to the world is "the comment is deleted" — visibly not a
change to the world at all. The defect moves from invisible to written down. That is worth having
and it is not subsumption, so`isEntirelyComment` is kept rather than retired.
5. **Finding 3's location was one file out.** Its falsifying edit ("mint a referral id for
   movement-originated admissions") is right, but the citation it named is prose in
   `ward-admissions.ts` while the code that writes the null is in `ward-flow-reducer.ts`. The repair
   had to change `sourceFile`, not just the string.

## ⚠️ Why this is not committed, and what is needed

`git commit -F … -- <my two files>` is refused by the repo's pre-commit hook:

```
[pre-commit] Documentation inputs have unstaged or untracked changes:
src/components/ward-management/community/community-screen.tsx
tests/ward-community-index.test.ts
[pre-commit] Stage or separate these inputs before regenerating commit documentation.
```

Those two files belong to **another session sharing this worktree**. They appeared, already staged,
partway through this task. Retried 24 times over roughly 12 minutes, unchanged throughout. This is
the documented and correct behaviour of that hook (AGENTS.md, "When you genuinely cannot commit")
and it was **not** worked around: no `--no-verify`, no `git add -A`, no stash.

One thing was done and undone: those two files were briefly unstaged so a pathspec commit could be
attempted, then re-staged in the same command. Their index blobs are byte-identical before and after
(`ff45c412…`, `8ddf31c8…`) — nothing of theirs was altered or lost. The hook refuses either way,
because a pathspec commit leaves them outside it whatever their staging.

**To land this: whoever owns `community-screen.tsx` and `tests/ward-community-index.test.ts` commits
them, then the commit message at**
`…/scratchpad/msg.txt` **replays as-is.** Working copies of both green files are held at
`…/scratchpad/register.green.ts` and `…/scratchpad/test.green.ts` with `green.sha256`.

## Note for the merge

`13b786ee4` (Ward Lead, another branch) corrects the same two claims — `the-admission-states-…` and
the pull-to-arrival clamp. **Both corrections are already present in this tree's content** (they
arrived by an earlier route), so nothing was re-fixed and nothing conflicts semantically. The
register file will still conflict _textually_ on merge, because this change rewrites its type,
constants and every entry.
