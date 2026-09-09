# The reword arm, run on all 95 conversions — and the arm nobody had run at all

**Ward Verifier, 2026-09-05.** Written against master-line tip `2fa5f0b69`; measurements taken in
`D:/Worktrees/Database/ward-verifier-9afb82c6e`, whose HEAD `a03aa8da4` differs from that tip in two
documentation files only (`git diff --stat HEAD 2fa5f0b69` — no source or test file differs), so
every run below is a run of the master line's code.

The brief was the 88 conversions whose reword arm had never been run. Running it turned up something
the reword arm was never going to find, so that comes first.

---

## 1. 🔴 THREE GUARDS STAY GREEN WHEN THE CAPTION THEY NAME IS DELETED — AND ONE OF THEM IS CLINICAL

> ⚠️ **THIS SECTION SAID TEN UNTIL 2026-09-05 AND THE TEN WAS MINE.** The retraction is at the end
> of this section, kept rather than tidied away, because the way I inflated it sevenfold is the same
> error the rest of this document is about. **Fixed 2026-09-05; each fix proved by deleting the
> caption from the component and requiring red.**

The conversion's own contract, from `tests/helpers/ward-caption.ts`:

> the real risk during a redesign is not a reworded caveat; it is a caveat _dropped_ while the figure
> it qualifies stays on the screen. **That is the defect these assertions must keep catching.**

**Three of the ninety did not catch it.** Each read a container that survives the caption's removal,
so deleting the sentence left a match somewhere else in the same text.

| site                                      | `of`                             | what it read                  | why the deletion survived                                                      |
| ----------------------------------------- | -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `ward-community-hub.dom.test.tsx:826`     | the still-with-team caveat       | `document.body.textContent`   | `"still with"` ×4 on the page                                                  |
| `ward-community-hub.dom.test.tsx:827`     | the still-with-team caveat       | `document.body.textContent`   | `"no team discharge"`, `"no episode end"` each ×2, in two different paragraphs |
| `ward-ed-psychiatry-hub.dom.test.tsx:779` | the acceptance-time absence line | the outbox **list** container | `"Acceptance time not recorded"` on **five separate rows**                     |

### The one that matters clinically

`ward-community-accepted-before-admission-not-active-claim` is the caveat that stops a coordinator
reading the acceptance-before-admission table as _"these people are currently under this team's
care"_ — which the record cannot support, because nothing in the model registers a community team
closing somebody. **I deleted that whole `<p>` from `community-screen.tsx` and the test passed:**

    caveat deleted from the screen, guard BEFORE the fix     Tests  1 passed | 35 skipped
    the same mutant (blob 40ebeba23), guard AFTER the fix     TestingLibraryElementError:
      Unable to find an element by:
      [data-testid="ward-community-accepted-before-admission-not-active-claim"]
    component restored, hash back to e0e496cd0, tree clean

Same mutant blob, opposite verdict. That is the before-and-after, not a description of one.

### The fixes, and what they deliberately did not do

- **826 / 827** now read the caveat's own element. **The negative half of that test still reads
  `document.body.textContent` and must** — it is a page-wide ban on claiming active care, so a
  forbidden phrase anywhere is the defect and narrowing it would be the bug.
- **779** now asserts **per row** rather than over the list's concatenated text. A container's text
  is the union of its members, and a union cannot say _"each"_. Proved by rendering the absence line
  on only the first row: red, naming row 2 by index. (The union form is satisfied by construction on
  that mutant, since row 1 keeps its line — that half is deduction from how the mutation was written,
  not a separate measurement.)
- **No spelling list was lengthened.** A longer phrase makes a guard fight rewords without making it
  discriminate.

### 🔴 THE RETRACTION, AND WHY IT IS KEPT HERE

**I reported ten. It is three.** Seven of the ten reach their text through
`screen.getByTestId(...)`, which **throws** when the element is gone — so the deletion is caught,
hard, before `expectSays` is reached. Measured on the governance caption:

    caption deleted from ward-management-modes.tsx
      TestingLibraryElementError: Unable to find an element by:
        [data-testid="ward-governance-dropped-measure"]
      Tests  1 failed | 3 passed        (restored, hash back to 6913b23c2)

**My deletion arm ran on the captured TEXT** — it removed one sentence from the string and re-ran the
predicate. **The element lookup sits upstream of the helper, so a text-level arm is structurally
blind to it.** A guard is **predicate plus query**; I measured the predicate and wrote the sentence
about the guard.

⚠️ **And the tell I walked past: the arm reported 80 of 90 healthy, and I took that as proof it
discriminates.** It does — between two texts. It says nothing about whether text was the right unit.
**A control that produces both answers still vouches only for the axis it varies.**

Ward Lead had the ten in a merge message and was carrying it to the owner. It was recoverable only
because the number was retracted before it arrived.

### The seven, at their real strength: the partial-trim class — RECORDED, NOT FIXED

These read the caption's own element, so its removal is caught. What they cannot see is a redesign
that **trims the specific sentence out of a multi-sentence paragraph** while another sentence in the
same paragraph still carries the spelling — the nuance goes silently.

    community-hub:293      the follow-up provenance note      "follow-up" ×2 in one <p>
    governance:163         the dropped-measure note           "legal deadline" ×2
    statistics-sections:584  the waitlist-timing refusal      "Admission" ×4
    statistics-sections:669  the required-field note          "required field" ×2
    statistics:557         the constant-gap note              "two ends" ×2
    statistics:561         the constant-gap note              "fixture" ×2
    statistics:634         the bed-readiness timing refusal   "instants" ×2

**Worked example: `ward-statistics-arrival-constant-gap`** — eight concepts asserted against one
paragraph, two of them duplicated inside it.

⚠️ **DELIBERATELY LEFT ALONE, and this is a recommendation the owner's instruction decides, not a
backlog item somebody should quietly clear.** The only fix is to split each paragraph into
per-sentence testids so a trim becomes detectable — which is **a test pinning a caption's internal
structure**, the precise opposite of _"testing must work with the redesigns rather than fighting
them"_. That is the §8 failure mode arriving disguised as thoroughness. Ward Lead's ruling,
2026-09-05: leave them, record them.

### An eleventh, of a different kind

`ward-community-hub.dom.test.tsx:801` — `expectSays(otherGroups, "the pulled-not-arrived count",
["1 ", "bed pulled"])`. The spelling `"1 "` is one digit and a space. It is satisfied here by the
_neighbouring_ count's sentence ("1 admission was referred…"), which is site 800's subject. The
deletion arm reports it red only because both counts sit in one unpunctuated run, so the cut removes
both. It is not proof of a live hole, but `"1 "` cannot distinguish this figure from any other
number on the screen.

---

## 2. The reword arm itself: 52 of 90 sites hang on a single phrase

**The measured, judgement-free part.** Every call site was run and its matched spellings recorded:

    converted call sites                                     95   (86 expectSays, 5 expectNeverSaysAgain, 4 expectCaption)
    sites reached by a run                                   95   — every one; 0 unreached, 0 unattributed
    sites where >= 2 listed spellings match in every run      38
    sites where exactly ONE listed spelling ever matches      52

Those 52 have no redundancy at all today. Whatever else is in the list, one specific phrase is
holding the guard up, and the alternates were never exercised.

**The demonstrated part, and I own the judgement in it.** For each of the 52 I wrote one faithful
restatement of the real sentence — the fact unchanged, the wording changed — and evaluated the
helper's predicate on it. **46 went red. 2 survived. 4 could not be judged because their control arm
failed** (they are in the ten above: with the concept removed they stayed green, so nothing they say
about a reword is meaningful).

⚠️ **Do not read 46 as "46 broken guards".** I chose a synonym for the load-bearing phrase, and
against a single-spelling list that is guaranteed to go red. The number that means something is
**52 with no redundancy**; the 46 is its demonstration. A different, equally faithful reword might
have kept the phrase at some of them.

**The two that survived are the instructive ones.** `ward-board-triage:230` carries
`["not people", "not a person", "not persons"]` — a genuine synonym set for one fact, so my reword
landed on an alternate. That is the site the last pass fixed after it fought a reword. It is the
shape the other fifty do not have.

Worked examples of the fifty that do not, taken verbatim from the run:

    ward-statistics.dom.test.tsx:560   ["admissions"]
      "written that way on the admissions side"  ->  "on the admission records"     RED on a plural
    ward-statistics.dom.test.tsx:1128  ["floor"]
      "a floor rather than the whole of it"      ->  "a lower bound rather than…"   RED
    ward-morning-page.dom.test.tsx:420 ["the rule"]
      "the difference is the rule"               ->  "comes from that counting rule" RED on an article
    ward-daily-sheet.dom.test.tsx:348  ["real day"]
      "not a record of any real day"             ->  "not a record of an actual day" RED

### Where the redundancy exists but is untested

27 sites list a spelling that matches nothing today. **That is the design working, not a defect** —
the alternate is there for the rewrite that has not happened. It does mean the reword arm has never
exercised those alternates, so the list's coverage of _plausible_ rewrites is still unproven at
those sites. Full list in the run output; the shape is `["no decline", "none"]`, `["falls back",
"fall back"]`, `["precede", "before the referral"]`.

---

## 3. State of the line, confirmed by running rather than by reading

    ward test files (union, executable reference)   273    matches
    passed                                        3 509    matches
    expected fail                                     2    matches
    failed                                            1    ward-mode-workspace-reachability — the deliberate red
    typecheck errors in src and tests                 3    ⚠️ NOT the expected 0

The suite figures are exactly as `NEW-CHAT-PROMPTS-2026-09-05.md` states. The typecheck is not.

**Three type errors, and two of them came out of the conversion pass itself.**

    tests/ward-handover.dom.test.tsx(164,16)     TS2531  Object is possibly 'null'
    tests/ward-morning-page.dom.test.tsx(515,16) TS2531  Object is possibly 'null'
      -> both introduced by 1c7c003fa, the caption-conversion commit. Both are
         `link.closest("p").textContent`, where closest() returns Element | null.
         FIXED in this commit as `link.closest("p")?.textContent`; both files re-run, 28 pass.

    tests/ward-movements-derivations.test.ts(378,42)  TS2345
      -> introduced by 958827a45. `id: \`${abandonedOne!.id}-DUPLICATE\`` infers as string,
         but Movement["id"] is the branded template `WF-${string}`.
      ⚠️ NOT FIXED HERE. claude/ward-builder-community-route is UNFOLDED and holds a different
         blob of that file, so it is Builder One's to change. The fix is to annotate the id
         against Movement["id"] rather than let the template widen.

**Why a green suite did not catch any of the three: vitest runs no `tsc`.** The conversion pass ran
its tests, saw green, and shipped two type errors. This is the same mechanism recorded as _"the suite
never tests the absence"_ — a requirement no test executes is already optional.

---

## 4. Two things the handover says that are no longer true

Both are the kind that a new chat reads as current, so they are recorded rather than mentioned.

**`WARD-LEAD-HANDOVER-2026-09-05.md` §2 still says 265 files / 3 310 passed.** The corrected figures
— 273 / 3 509 — landed in `NEW-CHAT-PROMPTS-2026-09-05.md` at `9cf9a40c2` and the handover was not
updated with them. The handover is the file a new chat is told to read first, so it is the copy that
matters. Measured just now: 273 and 3 509.

**"All five contributing branches read zero unfolded" is stale.** Against tip `2fa5f0b69`:

    claude/ward-builder-community-route   8cfb2a74c   UNFOLDED
    claude/ward-builder-three             8e83fab54   UNFOLDED
    claude/ward-builder-two               e2319c58b   folded
    build/ward-space-ladder-2026-09-05    6439dba87   folded
    ci/ward-journeys-inert-by-default     0db2fe81a   folded

Two builders have moved ahead since the handover was written. That is ordinary progress, not a
problem — but it is why the movements-derivations fix above is not mine to make.

---

## 5. What this pass did NOT do

Stated because a report that lists only what it found is indistinguishable from a complete one.

- **The reword arm was run against the captured text, not by editing the components.** The assertion
  is a pure function of (text, spellings), so this tests the identical property — but it does not
  test that a designer can produce the reworded text, and it does not exercise a rewrite that
  changes the DOM structure the assertion navigates to.
- **The `expectNeverSaysAgain` sites (5) were not put through either arm.** They are a ban, so the
  deletion arm does not apply to them and the reword arm asks the opposite question — whether the
  banned claim returns _paraphrased_. That work is the outstanding "20 negatives, now 11" item and
  is untouched here.
- **`expectCaption`'s `numeralFree` and `minimumLength` rules were not modelled** in the deletion
  arm; only the concept list was. Four sites use `expectCaption`.
- **Nothing was opened in a browser.** Every finding here is a property of the text a test reads.
- **`ward-pull-vocabulary.dom.test.tsx` (10 pins) is still deliberately unconverted** and stays that
  way. Its pins exist to hold the word "pull" on the screen; converting them to concepts would gut
  it, and its subject moving to `DelaysScreen` does not change that.

---

## 6. What I would do next, in order

1. ~~The three in §1.~~ **DONE 2026-09-05.** Each narrowed to the caption's own element (or, for the
   list, to its rows), and each proved by deleting the caption from the component and requiring red.
2. ~~`ward-movements-derivations.test.ts:378`.~~ **DONE.** Whole-repo typecheck is 0, down from 3.
3. ~~The `ward-test-discovery` docblock.~~ **DONE**, with the figure dated, unit-named and labelled
   unenforced.
4. **The `"1 "` spelling at `community-hub:801`** — still open. Replace with something that can only
   be the count it names.
5. **The single-spelling lists among the 52**, when their screens are next touched — add the
   alternates a redesign would plausibly reach for. Every added spelling must be checked against the
   honest copy on the same page, as the last pass found at `ward-community-hub`.
6. **The partial-trim seven** — not work, a decision already taken: leave them, record them. Reopen
   only if the owner asks for caption internals to be pinned.

⚠️ **Whoever takes item 4 or 5: the five statistics screens are NOT free.**
`claude/ward-builder-community-route` holds two unfolded commits over
`statistics-{ward,ed,overview,compare}-screen.tsx`, `statistics-screen.tsx` and two of their CSS
modules. Check with `git rev-list --count <tip>..<branch> -- <path>` before editing — a blob
comparison cannot tell ahead from behind, and it told three of us the wrong thing tonight.

---

## The finding underneath

**The conversion was audited for the arm that fires on correct work, and shipped three guards that
cannot fire at all — and my report of it said ten.** Both arms were named in the helper's own docblock from the first day; only one
of them had a control. The reword arm was the one everybody could feel going red, so it got the
attention — and a guard that stays green is silent by construction, which is why three of them sat
inside a suite that reported 3 509 passing.

The brief said "run the reword arm on the 88". Running it required capturing what each assertion
actually reads, and that capture is what showed the other arm had never been run at all.

⚠️ **And then the capture inflated the answer sevenfold, in the same way.** A text-level arm cannot
see the element lookup above it, so it read a caught deletion as an undetected one. **The version of
this finding that reached Ward Lead was wrong by more than the finding itself was large.** Both
halves belong in the same document: the arm nobody ran found something real, and the instrument that
found it needed the same second look as everything it was pointed at.
