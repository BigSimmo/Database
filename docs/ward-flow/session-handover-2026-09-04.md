# Ward Flow — session handover, 2026-09-04

**Written by Ward Lead at close-out.** Four builder sessions plus a verifier, folded onto
`codex/task-ward-flow-live-state-20260831`.

**State at close: tree clean, full suite green — 1,138 files, 14,997 tests, 2 expected fail, 77
skipped, gate receipt recorded.** Not the ward subset. The whole thing.

---

## 1. What shipped

**The ward model now describes mixed wards.** `Unit.security` — a whole-ward `Open | Secure` flag —
is gone, replaced by per-bed `lockedBeds` / `allocatableLocked` with the ward category **derived**
rather than stored. This was the one place the app gave a **wrong** clinical answer rather than an
incomplete one: a mixed ward recorded as open hid every locked bed from every patient who needed one.

**`authorised` stays a separate fact**, and a test now pins that the two can disagree —
`sjgs-adult-secure` is locked and **not** an authorised hospital. **Floored on the population**, so it
fails loudly rather than passing over an empty set.

**One word for one number.** Seven renderings of `min(allocatable, empty)` collapse to "ready". A
service heading that summed a different quantity under the same word now sums what its cards show.

**Three device banners give a reason that survives the software ranking** — _"It places nobody: a
coordinator decides every placement, one at a time"_ — replacing a promise the owner's own ruling had
retired and which was never quite true.

**The warning background stopped being cream.** `--warning-bg` was the only warm surface left in the
product, used 46 times.

**Two new primitives, wired to nothing:** `contention()` and `contentionPairs()` — the first thing in
this codebase that can express that two patients want the same bed. One real pair exists in the seed.

---

## 2. The three things that nearly shipped wrong

**A detained patient became placeable somewhere he was not.** A fixture widening added locked beds to
two wards the fixture calls open. Invented clinical data changed a clinical outcome, and the
synthetic-data rule was obeyed to the letter. **Caught by a test whose failure message says a shorter
list of unplaceable patients is not automatically good news.**

**A patient was accepted at a ward that cannot lawfully hold them.** The generator picks each demo
patient's ward by position in a list; the list changed, and one patient landed on an unauthorised
unit. The safety flag fired correctly. **The test that should have caught it counted four of five
categories and passed only while the fifth was empty — and the obvious fix, changing the four to a
five, would have gone green and left the patient there.**

**A safety warning went silent.** One condition was serving two different clinical questions. _"Is
this ward tighter than this patient needs"_ is about the ward; _"might this voluntary patient be
unable to walk out"_ is about the bed. Sharing a wholly-locked-only guard meant Bentley — the owner's
own worked example of a mixed ward — stopped warning about voluntary patients behind its locked
doors. **Split. Ward Lead's ruling, not the owner's, and one line to reverse.**

---

## 3. 🔴 Six ways a check reported success without checking anything

**All six in one night, all in different costumes, and every one produces an outcome a reader scores
as fine.**

1. **A pipeline's exit status is its last command's.** `cmd | tail` reports `tail`'s success.
2. **A tool-level timeout is not a process kill.** The runner survives and keeps the machine lock
   while its owner believes the command failed. Happened twice, to two sessions.
3. **A focused test runner that refuses every path under `tests/` and exits 2.** Neither passes nor
   failures — an outcome that looks like nothing at all. Five planned gates were unrunnable.
4. **A test file whose NAME matches no runner's include pattern.** Collected by nothing. Green
   forever.
5. **A mutation that never applied.** The edit matched nothing because prettier had reflowed the
   line; the test passed, indistinguishable from a real pass.
6. **A suite that fails eleven tests and exits 0.** Anything keying on exit status calls it a pass.

⚠️ **The remedy that costs nothing: state the DENOMINATOR whenever reporting a gate.** "1142 files, 0
failed" and "224 files, 0 failed" are different sentences and neither can be mistaken for the other.
**"Green" cannot carry that** — and "green" is what both Ward Lead and a builder said about runs that
had not measured what the word implied.

---

## 4. Guards that could not fail — five, found by mutating rather than reading

A `Map` whose comment claimed it prevented a duplicate, defeated by deleting it wholesale. A length
guard whose first half could not fire. An age assertion that computed an expected value and discarded
it. Two test assertions three lines apart both pinning a sentence that was false. A guard inert by
filename.

⚠️ **None was found by reading, and each read as a safeguard — which is what stops the next person
looking.**

**The remedy is now mechanical rather than a habit:** `scripts/ward-flow/mutation-run.mjs` refuses an
untracked target, records the pre-mutation blob, restores in a `finally` from bytes captured before
the edit, verifies the restore by content, reports **which** assertion went red, and refuses an
anchor that does not match exactly once.

**Its own self-test went red on first execution** — the absent-anchor probe occurred once, in the
test file, because writing the test put it there. **A subject that contains its own probe cannot test
an absence.**

---

## 5. Verification traps worth carrying

- **Verify a cherry-pick by CONTENT, never by ancestry.** A cherry-pick copies a commit under a new
  SHA, so an ancestry test returns false — and that false answer is indistinguishable from "my work
  was dropped".
- **Verify a squash-merge the same way**, for the same reason.
- **A branch name is a moving target.** A fold message written from a branch name is a claim about
  whatever the tip was when the prose finished. It cost an undated census and a superseded verdict.
- **A worktree's `.git` is a file, not a directory** — `test -f .git/MERGE_HEAD` is always false. Use
  `git rev-parse --git-dir`.
- **Backticks inside `git commit -m` are command substitution.** Three instances tonight; the commit
  succeeds and the content is silently gone.
- **A literal `\b` written through a heredoc becomes byte 0x08**, silently turning `/^1\b/` into
  `/^1/`.
- **The protection hook fires on the literal string `git checkout --`** appearing anywhere in a
  command, including inside a commit message. Rephrase; never override.

---

## 6. What remains

**Nothing is blocking and nothing is broken.**

- **The referral direction rule** — ruled by the owner, not built. A referral points one way; asking
  for a bed and community care in one act is refused. ⚠️ **The refusal message must say "raise the
  community referral separately, when discharge is being planned"** — otherwise the app reads as
  denying that both are ever needed.
- **One check outstanding from the owner:** does anyone refer TO an emergency department as part of
  discharge planning? The rule as written would block it.
- **The role-and-place foundation.** The app can _change_ role and has no notion of _being_ one; the
  owner has ruled he is "the whole state". Three approved items depend on it. **Not started
  deliberately — it touches every screen.**
- **Bed states, option 2** — ruled, planned, not built. Pulled becomes a real number; the
  pulled-bed location disagreement must be settled **against the seed as well as the reducer**, because
  eight seeded movements sit in a state the reducer cannot produce.
- **A residual, pinned rather than hidden:** a Secure movement passes a mixed ward whose locked beds
  are all occupied. Closing it means teaching the capacity gates about bed kind — the matcher's job.
- **The parked backlog.** A sweep of 36 of 201 documents found dozens of older questions. Most are
  placeholder wording. Four were promoted and settled; the rest are listed in
  `owner-decisions-to-settle-2026-09-04.md`.

---

## 7. One thing about the record itself

**Roughly twenty-two decisions were recorded as the owner's from today. Six carry his own words.
Sixteen are somebody's paraphrase, and nobody can check any of them against what he actually said.
About twenty describe things not yet built — so they have never been contradicted by anything, which
is not the same as having been confirmed.**

**One was an open question wearing his name:** a fixed list of nine delay reasons, tagged as his
ruling, which he had asked to see and never answered. It is now genuinely his — eleven, plus a
standing requirement that the list stay cheap to change.

⚠️ **A tag meaning "he said this" and a tag meaning "he agreed when I proposed this" are different
claims, and one mark was used for both.**

**And the most-quoted sentence in the specification is a paraphrase** — a synthesis of a pattern
across five separate answers, no one of which said it. It may capture his intent better than any of
them did. That is what makes it worth flagging rather than merely wrong: it is the sentence somebody
will cite to justify a shortcut.
