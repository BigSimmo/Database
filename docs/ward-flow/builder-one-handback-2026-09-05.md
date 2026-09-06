# Ward Builder One → Ward Lead, 2026-09-05

Everything below was measured on `claude/ward-builder-community-route` in
`D:/Worktrees/Database/ward-builder-community-route`. Nothing is recalled. **A SHA in this file is a
claim with a timestamp; re-read before acting on any of it.**

## 1. TWO QUESTIONS THAT NEED A PERSON — for the owner, not for a chat

Both are about **whether two team names are one service**, which
`community-vocabulary.ts` states in its own header that nothing in this repository is entitled to
decide: _"these two strings differ by one edit"_ is a property of the strings; _"these two are one
team"_ is a clinical claim about a real service.

⚠️ **Quote the question when you relay it.** The Inner City ruling was very nearly recorded at half
its width because the narrow question and the wide one have different answers — that is recorded in
`community-ratified-aliases.ts` and it is the reason `question` is a required field on the table.

### Q1. `Midalnd` and `Midland` — a transposition typo, both selectable in the picker

`docs/ward-flow-catchment-data.md` already names `Midalnd` as a transposition typo. Nothing has
acted on that, deliberately: §6.5 of that document rules the raw clinic string is KEPT so the source
stays auditable, with any normalisation belonging in a separate mapping. `community-ratified-aliases.ts`
IS that separate mapping and today it holds **exactly one entry** — the Inner City group. So the
Midland pair is sitting in the gap the document described and nobody has been asked about it.

**Suggested wording, wide rather than narrow, with the counts shown:** _"`Midalnd` and `Midland` are
both offered in the referral picker, one letter apart. They route different numbers of suburbs. Are
they one service with a typo, or two? If one, every referral already typed under either spelling
stays findable under the spelling it was typed with — no data is rewritten."_

⚠️ **Show him the two suburb counts, taken on the day you ask.** I have deliberately not put figures
in this file: the same ruling gets a different answer when the numbers move, and a count written down
here would be stale before he read it. Read them from `communityTeamSuburbCounts()`.

**My recommendation, and it is only that:** put it to him. A typo that routes a live referral list is
the same class of defect as the `ICC` case he has already ruled on, and the machinery to record his
answer exists and is empty.

### Q2. Does a bracketed qualifier make two teams different?

`Alma Street (Fremantle)` vs `Alma Street (Melville)`. Raised in
`docs/ward-flow/community-redesign-handover-2026-09-05.md` §9 and still open. It is worth putting
because it is **isolated and clean** — worth about ten names, with no other difference confounding
it — and because the answer generalises to every other bracketed site in the list.

⚠️ **It cannot be answered by loosening a key, and trying is dangerous.** `community-vocabulary.ts`
records that any rule loose enough to merge them would merge things that are genuinely two sites.
This is a person's answer or it is nothing.

**My recommendation:** ask it in the SAME session as Q1, and separately, one at a time. They look
like one question about "name variants" and they are not: Q1 is a typo, Q2 is a real distinction
between two places that share a name.

## 2. 🔴 THE HAZARD PAIR: I RECOMMEND **NEITHER** HALF LANDS, AND HERE IS WHY

Your handover assigns _"`WardFigure` gains `tone`/`delta` **and** the flagged ceiling moves, in the
same commit"_, with the hazard that half the pair produces a worse screen than neither half.
**Neither is one of the two sanctioned outcomes, and I think it is the right one.** Two reasons, both
measured, neither of them about difficulty.

### `tone` has no honest first consumer, because its only motivating one forbids it

The prop was proposed to serve the statistics screens. `statistics-screen.tsx` states, in its own
header:

> **NOTHING HERE IS A TARGET, A THRESHOLD OR A RANKING.** No figure changes colour with its value, no
> ward is compared with another, and no number is called good or bad.

The prototype tone set that motivated the prop was `good` / `signal` / `crit` / `accent` / `neutral`.
**A `good` and a `crit` tone are a number being called good or bad**, which that paragraph forbids in
terms, and its stated reason — that a benchmark invented on this page would carry more authority than
one invented anywhere else in the prototype — is stronger than the convenience of the prop.

So adding `tone` would put a general attention channel on a shared primitive whose only asking
consumer cannot use it. **And then the ceiling change guards nothing real**, which is the worse
half: a constraint extended to cover a case that never arises reads as rigour and is decoration.

⚠️ **ONE THING I AM NOT CERTAIN OF, AND IT IS YOURS.** That paragraph is written on the HUB. Its
reason applies to all five statistics surfaces equally, but nobody has said so, and extending a
stated rule to four pages it was not written on is a judgement rather than a reading. I have not
made it.

⚠️ **AND THE EXISTING `flagged` PROP ALREADY DOES THE FORBIDDEN THING ELSEWHERE, WHICH IS FINE AND
WORTH KNOWING.** `community-home.tsx` sets `flagged: totalQueued.length > 0` — a tile whose colour
follows its value. `community-screen.tsx`, one file away, states that on ITS page the flag is _"a
fixed property of that tile's CATEGORY, never of how large its number is"_. Both are true of their
own pages. That is the shape a general `tone` prop would spread: not wrong anywhere in particular,
and unanswerable in general.

### `delta` has no producer at all

`Kpi`'s `delta` was a worded movement — _"up 3 on yesterday"_, with a direction. **Nothing in this
prototype can produce one.** Every statistics figure is computed from provider state on every render;
`statistics-derivations.ts` says so and `ward-statistics.ts` says so. The nearest thing to a stored
past is `handoverSnapshot()`, and reading it settles the question: it takes `now` and derives from
the CURRENT movement list. There is no series, no previous value, and no field holding one.

**A `delta` prop would be a field nothing can write.** It would type-check, pass every gate, and
render as a legitimate empty state on every screen forever — which this project has a name for.

**What I recommend instead:** if the owner wants movement over time, that is a change to the model
(something has to record a value at a time), and it should be asked as that rather than arriving as a
prop that quietly cannot be filled.

## 3. ONE CORRECTION I DID NOT MAKE, BECAUSE IT IS A SHARED FILE

`src/components/ward-management/ward-tokens.module.css`, in the block comment above its
`forced-colors` rule, ends with:

> ⚠️ NOTHING EXTRA IS NEEDED ON THE PRIMITIVES, AND THAT WAS CHECKED RATHER THAN ASSUMED. […] **A
> primitive whose only edge was a fill would need its own rule here; none currently is.**

**It was true when written and false two and a half minutes later.** Measured:

    the claim      d5f0fcc05   2026-09-05 02:48:14 +0800
    ward-bar.css   c4d8b885a   2026-09-05 02:50:43 +0800
    ancestry       neither commit is an ancestor of the other — parallel branches, folded later

`.segment` and `.swatch` in `ward-bar.module.css` are two classes whose only edge is a fill. A
detector over the 19 top-level ward stylesheets — every class given a `--ward-*` fill, minus every
class given a real border or outline in its own file — finds ten fill-only classes across six files;
those two are the only ones inside a primitive whose fill IS its content. The rest are grounds and
hairlines, where losing the fill costs a surface rather than a fact.

**The correction is one sentence and I have not made it, because that file is read by four ward
branches and editing it is not in my brief.** Suggested replacement for the final sentence:

> A primitive whose only edge is a fill needs its own rule, and there is one: `ward-bar.module.css`
> carries its own `forced-colors` and `print` blocks for `.segment` and `.swatch`, guarded by
> `tests/ward-bar-fill-only-edges.test.ts`.

**Leaving it is not neutral.** It is exactly the kind of true-sounding sentence that stops the next
reader looking — the pattern this project has been caught by repeatedly.

## 4. `StatFootnote` HAS NO CALL SITE

`grep -rn "StatFootnote" src` finds only its own definition; only
`tests/ward-statistics-primitives.dom.test.tsx` constructs it. Its own doc comment states a rule —
that a screen carrying any synthetic number always names it as such at the foot of the page — which
**no screen follows through this component.** The obligation is met another way, by the frame's
governance banner and `statistics-disclaimers.tsx`, so nothing on screen is dishonest.

**Not deleted, and not for me to delete:** an unused export here answers to
`docs/agents/dead-code-deletion.md`. Found by a mutation that stripped its marker and left my new
guard green — which looked like a hole in the guard and was a component with no consumer.

## 5. WHAT I BUILT, AND WHAT IS STILL OPEN ON MY LIST

**THE GATE, PASTED RATHER THAN SUMMARISED.** Full ward run, population discovered from disk
(266 files — the 264 of my baseline plus the two guards this session added):

    before   Test Files  6 failed | 258 passed (264)
             Tests       6 failed | 3288 passed | 2 expected fail (3296)
    after    Test Files  6 failed | 260 passed (266)
             Tests       6 failed | 3303 passed | 2 expected fail (3311)

⚠️ **CORRECTED SAME DAY: BOTH FILE COUNTS ABOVE CAME FROM THE RETIRED DISCOVERY COMMAND.** The
authoritative one is in `docs/ward-flow/NEW-CHAT-PROMPTS-2026-09-05.md` lines 75-92 and filters on a
NON-COMMENT line rather than on an import. Re-derived: **274 files on this branch**, not 266. The
eight missed were then run rather than merely counted — 199 tests, all passing — so the conclusion
below stands unchanged. Two of them, `design-system-adoption` and `viewport-fill-contract`, are
exactly the kind my screen changes could have broken. Full account in
`builder-one-branch-red-delta-2026-09-05.md`, together with four typecheck errors I never saw all
session because I piped every tsc run through `grep -i statistics`; none of the four belongs to this
branch, measured with `git rev-list <master>..<branch> -- <path>`.

**The failing set is IDENTICAL BY NAME, not merely identical in count** — `diff` over the two sorted
lists of failing files is empty. All six are the reds
`builder-one-branch-red-delta-2026-09-05.md` accounts for: one deliberate, five staleness against
the master line. The 15 new passes are this session's two guards (10 + 5).

**Built:**

- `ward-bar.module.css` gains `forced-colors` and `print` blocks that DRAW the split rather than buy
  the fills back, plus `tests/ward-bar-fill-only-edges.test.ts` — population derived from the
  stylesheet, floor on the denominator, two control pairs, five mutations each proved to have
  changed the bytes and to go red on the named test.
- All five statistics screens now put their content sections in `WardPanel`, and both statistics
  stylesheets have lost their second (and, on the hub, third) copy of the panel. Guarded by
  `tests/ward-statistics-sections-are-regions.dom.test.tsx`.
- `docs/ward-flow/builder-one-branch-red-delta-2026-09-05.md` — why this worktree reports six reds
  where your handover documents one, and why none of the five extras needs fixing here.

**Still open on my list, unstarted:** the remaining trim of `statistics.module.css` down to what no
shared primitive provides — the chart wrapper, the footnote, the eyebrow, the stat line. The card
duplication is gone, which was the part with a measured cost; what is left is smaller classes that
may or may not have primitive equivalents, and it wants a class-by-class read rather than a sweep.

**Two chip vocabularies, one renderer underneath** — item 4 of
`statistics-primitive-reconciliation.md` — I have not touched. It is a change to `ward-chip.tsx`,
another shared file, and on my reading of §2 above the statistics screens do not need a stat chip at
all, which removes its motivating consumer too. Worth re-deciding rather than inheriting.
