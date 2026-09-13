# WF-BUILD-004 — a false mechanism inside the correction that was meant to stop a false claim

## Part 1 — `HOLD_BED` does not exist

Two comments name `HOLD_BED` as the event that writes `Admission.followUp`. **There is no such
event.** `git grep -n "HOLD_BED" -- src tests` returns exactly these two comments and nothing else.
The real event is `PULL_PATIENT`.

**The two sites:**

- `src/components/ward-management/community/community-screen.tsx` — header doc comment, point 1
- `tests/ward-community-index.test.ts` — the describe-block comment

**Verified on this tree, so use these and not the numbers currently written:**

| What the comments cite                              | What is actually there                                 |
| --------------------------------------------------- | ------------------------------------------------------ |
| `ward-admissions.ts:417` for `Admission.followUp`   | **`:452`**, `followUp: FollowUpRecord \| null;`        |
| `ward-admissions.ts:449` for the field-presence map | **`:484`**, `followUp: true,`                          |
| `ward-admissions.ts:143` for `FOLLOW_UP_STATES`     | **`:159`**                                             |
| `ward-flow-reducer.ts:814` for the write            | **`:941`**, inside `case "PULL_PATIENT"` at **`:811`** |

⚠️ **CITE BY SYMBOL NAME, WITH THE LINE AS A HINT ONLY. Do not simply renumber**, or you have
rebuilt the same decay one commit later — these numbers moved once already today when three
destinations were added. Write "`Admission.followUp` (`ward-admissions.ts`, around `:452`)", not a
bare number.

⚠️ **THE SUBSTANCE OF THE CORRECTION IS RIGHT AND MUST SURVIVE.** `followUp` genuinely has no reader
anywhere in `src/`, and the seed genuinely sets two real records. **Only the named mechanism is
false.** Do not let a fix to the mechanism talk you into softening the finding.

## Part 2 — a test that stays green while a clinical all-clear inverts

`tests/ward-community-index.test.ts:293`:

```js
expect(markup).toContain("everyone who is missing");
```

The page renders: _"this list is everyone recorded as referred to this team and discharged to the
community — **not** everyone who is missing follow-up."_

**Falsifier that should go red and does not: delete `<strong>not</strong> ` from that sentence.** The
page then asserts the discharge list **is** everyone missing follow-up — the exact false all-clear
the whole notice exists to prevent, on a clinical-adjacent page — and the markup still contains
`everyone who is missing`, so the test stays green.

Its own title is _"keeps the conclusion the correction does not touch: an empty list is never an
all-clear"_, so **it is guarding the wrong half of its own sentence.** The sibling assertion pins a
different sentence and survives the inversion intact. **This line is the only pin on that sentence
anywhere in the suite** — checked across all of `tests/`.

**Fix:** pin the negation itself — `"— not everyone who is missing follow-up"` — or assert on the
`<strong>` element's content. Then prove it: delete the `<strong>not</strong>`, watch it go red,
restore the file and confirm it byte-identical by hash.

## Part 3 — a loop with no floor of its own

Same file: `it("each link's dynamic segment decodes back to the team id…")` iterates `linked`, which
is computed at `describe` scope. **Only the previous test asserts `linked.length > 0`.** If the index
rendered no links this test passes vacuously, and so does its `needingEscape` assertion over the same
empty derivation.

The file's own standard is a per-test floor and its DOM sibling does exactly that. Add one.

## Constraints

- **Files:** `community-screen.tsx` and `tests/ward-community-index.test.ts` ONLY.
- **Do not touch** `ward-movements.ts` — Ward Lead is fixing its stale nine-referrals comment.
- **Do not reword the four empty-state sentences.** They are mine and they wait on a join fix in
  flight in another worktree. Touch only what Parts 1-3 name.
- Everything outside those two files is READ ONLY.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list, refuse an empty discovery, and **report the RAN count, not the passed
count** — a run that dies at startup reports "0 failed", indistinguishable from a pass.
