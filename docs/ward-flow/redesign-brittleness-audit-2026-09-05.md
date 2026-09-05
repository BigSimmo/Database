# Redesign-brittleness audit — state at hand-over, 2026-09-05

**Ward Verifier.** Branch `build/ward-space-ladder-2026-09-05`. Written because a sweep that
reports only its findings is indistinguishable from a complete one, and this one is **not**
complete. **The coverage table below matters more than the findings.**

## Why the audit exists

Owner instruction, 2026-09-05, relayed by Ward Lead and then confirmed by the owner directly:

> "ensure that all testing works with the redesigns rather than fighting them since i am going to
> redesign many pages"

and

> "I need you to fix the testing you have so it doesn't run pointless testing that will go red
> during a redesign"

Ward Lead's rule, which this audit implements:

    GUARD THE CLAIM AND THE CLINICAL PROPERTY. NEVER THE RENDERING.

## The defect being removed, stated precisely

A screen test that pins a caption's exact sentence cannot distinguish two very different events:

| event                                    | what it means                           | old assertion |
| ---------------------------------------- | --------------------------------------- | ------------- |
| the caption is **reworded**              | nothing is wrong                        | RED           |
| the caption is **deleted**, figure stays | the figure is now unqualified on screen | RED           |

Both produce the same red, so during a redesign the reds are overwhelmingly the harmless kind — and
a guard that fires on correct work gets deleted, **taking the honest guards with it in the same
tidy-up.** The replacement asserts presence, substance, and named concepts, so a reword passes and a
deletion still fails.

## Coverage — REACHED and NOT REACHED

Measured 2026-09-05 at tip `4b3962a2f`, comments blanked before counting. "Divergent" means the file
differs across the live ward branches, so another session holds a version and editing mine would
revert their work at the fold.

    ward screen tests carrying pinned copy      24 files
      REACHED, converted                        13 files   47 conversions   20 pins kept   7 negative
      REACHED, reviewed, left alone              3 files    4 pins
      NOT REACHED (divergent — owners must)      8 files   65 pins          13 negative

### ⚠️ NOT REACHED — this is the gap

| pinned | negative | file                              |
| -----: | -------: | --------------------------------- |
|     21 |        5 | `ward-community-hub`              |
|     16 |        6 | `ward-statistics-sections`        |
|     11 |        0 | `ward-referral-screens`           |
|     10 |        0 | `ward-pull-vocabulary`            |
|      3 |        2 | `ward-ed-psychiatry-hub`          |
|      2 |        0 | `ward-network-referral-placement` |
|      1 |        0 | `ward-discharge-board`            |
|      1 |        0 | `ward-patient-search`             |

`tests/helpers/ward-caption.ts` is on the master line and absent from all three builder branches, so
those owners can adopt it without inventing anything.

### Also not reached

- **The 20 negative pins** (`.not.toContain("<a sentence that was once false>")`). A different
  defect: they survive a reword and would **miss the same lie rephrased**. `expectNeverSaysAgain`
  exists for them and is unused; nothing has been converted.
- **`tests/ward-statistics-sections.test.ts`** — the one source-scanning file. Handed to Ward Lead,
  fixed by them in `f5986a714`; see the block-comment note below.
- **Non-DOM ward tests** were scanned for the source-text defect but not audited for brittleness of
  other kinds.

## What was converted, and what was deliberately kept

**Converted** — explanatory prose whose job is to stop a figure being misread: absence lines,
caveats, framing notes, the locked-ward legal-status warning.

**Kept pinned on purpose. Not every pinned sentence is a fighter:**

- the **"not a medical device"** disclaimer — a regulatory phrase where a red on any change is wanted
- **"0 beds currently on leave at SCGH Adult Open"** — a measured zero rendered as a numeral, plus
  its attribution to a named unit. This is the property, not the rendering
- **model values and enum labels** — status transitions, `BED_RELEASE_BLOCKERS` text
- **proper nouns** — "State bed coordination desk"
- **identifiers** — `Movement.declines`, `ReferralAddressing`, `NOW_ANCHOR`
- **template-interpolated expectations**, which are already derived rather than typed

## 🔴 The teaching case — my own replacement fought a reword

Recorded here because a commit subject is not where anyone looks.

**The pin:** `expect(detail.textContent).toContain("These are beds, not people")` in
`ward-board-selection.dom.test.tsx`, guarding the caveat that a bed release records nothing about
who is leaving.

**My replacement:** `expectSays(..., ["beds, not people", "not people"])`.

**The reword it fought:** I changed the component to _"A bed is not a person: a bed release records
nothing at all about who is leaving."_ — a faithful restatement of the identical fact. **My new
guard went RED.** I had replaced a guard that fights a redesign with a guard that fights a redesign,
one attempt after writing the rule down.

**What caught it:** the reword arm of the control, run on my own work. Nothing else would have. The
suite was green; the conversion looked finished.

**The fix:** `["not people", "not a person", "not persons"]`, then both arms re-run — reword 12
passed, caveat replaced with "About these beds:" 1 failed, restored hash-identical.

**The rule:** _a conversion is not proven until its reword arm runs._ Two of my other conversions
passed that arm first time, which is exactly why this one would have shipped.

## Two more traps found by running the controls

**A caption exposed as a derived string, not an element.** The transformer appended `.textContent`
to a string, which yields `undefined`; the assertion then read `""` and failed **on correct code** —
a guard calling honest work a lie. It bit twice in `ward-daily-sheet`. `expectSays` now accepts
either shape.

**A concept that does not discriminate.** `["0"]` for the on-leave count was true of the element for
other reasons and dropped the unit attribution. Both sites reverted to the original pin.

## ⚠️ Ward Lead's correction — whitespace collapse is not enough for block comments

My fix for the source-scanning guard was `source.replace(/\s+/gu, " ")`. **That is half of it, and
Ward Lead measured the other half.** Prettier wraps a block comment with a `" * "` continuation
marker, which is not whitespace, so a collapse yields `"element * here is"` and a flat match still
misses. Verified independently here:

    whitespace collapse only  -> MISSES  " /** * \"NO CONTROLS. The only interactive element * here is..."
    marker stripped first     -> FINDS   " /** \"NO CONTROLS. The only interactive element here is..."

Shipped normalisation is `/\r?\n[ \t]*\*\/?/gu` → newline, **then** the whitespace collapse.

**Generalised rule for the rest of this audit: WRAP the subject as well as rewording it.** They are
two different attacks and a guard can survive one while failing the other.

`tests/helpers/ward-caption.ts` does **not** have this hole: it reads DOM `textContent`, where
comment markers cannot appear. Checked, not assumed.

## ⚠️ My own measurements were wrong twice before they were right

Stated because the numbers are in other people's messages.

1. **"12 files have the source-text defect."** Wrong. That detector counted files that merely _read_
   a component source.
2. **"6 files."** Also wrong. That one counted matches inside JSDoc comments — the very mistake I had
   fixed in the token guards hours earlier.
3. **The truth: one file, `ward-statistics-sections.test.ts`, with 12 assertions.** Both figures
   being 12 is coincidence.

The corrected figure was given to the owner and to Ward Lead. The method that finally worked was:
blank the comments, then **print the matching lines** rather than counting them.

Likewise "131 pinned sentences" was 3 too high for the same comment reason; the population is 128.

## What I would do next, in order

1. The 8 divergent files, by their owners, using `expectCaption`/`expectSays`.
2. The 20 negative pins — decide per case whether the claim can be checked against the model
   instead, which retires the guard rather than loosening it.
3. Apply the wrap-and-reword control to every guard already converted; only the reword arm has been
   run on most of them.

---

# Second pass — the unreached eight, later the same night

**The blocker dissolved rather than being worked around.** Every builder branch became an ancestor
of the master line with zero unfolded, so the differing blobs that made eight files "divergent" were
**staleness, not competing work**. Verified with `git merge-base --is-ancestor` per branch before
touching anything — the whole reason those files were out of reach was a hazard that no longer
existed.

## Where the population ended

    reword-tolerant call sites     95   across 22 files
    positive pins remaining        55
    negative pins remaining        11   (was 20)

## 🔴 The negatives — the half that fails silently, and the proof

A ban on an exact sentence is defeated by any paraphrase: the withdrawn claim comes back and the
guard stays green. Measured on the real component rather than argued:

    as shipped                                          48 passed
    the retired claim returns PARAPHRASED
      ("nothing records when preparation started")      RED at two sites, naming it
    the ORIGINAL exact ban against that same text       WOULD HAVE PASSED
    restored                                            hash-identical, 48 passed

⚠️ **Widening a negative is not free.** A ban forbids more, so every spelling added is a new way to
go red on honest work. `ward-community-hub` legitimately says _"does not mean everybody is being
followed up"_ three lines from a ban on _"nobody is missing follow-up"_ — widening to `"followed
up"` fails on correct copy. **Every added spelling must be checked against the honest copy on the
same page, and the run is what checks it.**

## ⚠️ Skipped deliberately, and it is a third of what remains

**`ward-pull-vocabulary.dom.test.tsx` (10 pins) exists TO PIN THE WORD ON THE SCREEN.** Task 7
renamed "hold" to "pull" across an event, a stage, a field and a reason code — and every one of
those could be renamed perfectly while a label, a column header, an `aria-label` or an `<option>`
still said "hold" to a clinician. Converting its pins to concepts would gut it.

That is the second time in one night a correct general fix was wrong for a specific file; the first
was comment-stripping, which would have gutted `ward-statistics-sections.test.ts`. **The general
mechanism licenses the wrong fix as readily as the right one. What decides it is what the assertions
point at.**

Also left pinned: model enum labels, proper nouns, identifiers, measured figures with their
attribution, the regulatory disclaimer.

## 🔴 THE HONEST LIMIT OF THIS WHOLE PASS

**Roughly seven of the 95 conversions have had their reword arm actually run.** The rest are green,
which proves only that the concept is present today — **not that a faithful rewording survives it.**
That is the arm that matters, and it is the arm that caught the one conversion which fought a
reword. **Treat the unproven ones as unproven.** The cheapest way to close it is to reword the real
sentence in the component and confirm the guard survives; it takes about two minutes per site.

## Four instruments that lied tonight, all toward absence or false success

    git rev-parse <ref>:<path>      prints its argument back instead of failing
    git show <ref>:<path>           mangles the colon into a Windows path, reports the file missing
    --is-ancestor                   same answer for "not folded" and "not in my object store"
    node -e '<probe>'               the shell eats the escapes, the mutation never applies,
                                    and the run reports the UNMUTATED result as a pass

**Use `git ls-tree` + `git cat-file blob`, check the object exists before calling something
unfolded, and write probes to a FILE with hashes either side.** A mutation that never executed is
indistinguishable from one the assertions cannot detect — except that it invents a defect rather
than missing one.

## The finding underneath all of it

From Ward Builder One, and this audit is the evidence for it: **a correctly-scoped brief produces a
correctly-scoped omission, and nothing inside the brief can see it.** Every serious defect found
tonight was invisible to the thing that should have caught it and visible to a second, independent
look — including my own converted pin, which fought a reword one attempt after I wrote the rule
against it.

**Which is why the unreached list is in this file and not in a message.** A caveat that appears only
in a report is invisible to the next person.
