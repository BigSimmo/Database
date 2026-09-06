# Two sets of primitives, and which of them should survive

**Written 2026-09-05 by Ward Builder One, after the statistics design layer turned out to duplicate
four shared Ward Flow primitives.** This is a recommendation, not a change. Everything below was
measured on `claude/ward-builder-community-route`; nothing is recalled.

## How this happened, because the mechanism matters more than the mess

The agent that built `statistics-primitives.tsx` was scoped to exactly two files. Importing
`ward-bar.tsx` to compose it would have reached outside that brief, and it judged — correctly for a
scoped task — that composing a shared primitive was a bigger architectural call than its brief
authorised. **It then reported the overlap rather than burying it.** That is the behaviour that made
this document possible.

⚠️ **The failure is not the agent's judgement. It is that a correctly-scoped brief produces a
correctly-scoped omission, and nothing inside the brief can see it.** Two implementations of one
thing produce no merge conflict and fail no test; they are invisible by construction and diverge
quietly, with the weaker one winning wherever it happens to get used. Somebody has to be reading
across the briefs.

## The four overlaps, measured

| new                | existing                         | verdict                                                                      |
| ------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| `DistributionBar`  | `WardBar`                        | **Duplicate. Delete the new one.**                                           |
| `Kpi` / `KpiStrip` | `WardFigure` / `WardFigureStrip` | **Grow the existing one. Do not fork.**                                      |
| `StatChip`         | `WardChip`                       | **Genuinely different domains — but the RENDERING is shared and should be.** |
| `StatPanel`        | `WardPanel`                      | **Duplicate. Delete the new one; the gaps belong in CSS, not a component.**  |

### 1. `DistributionBar` → delete, use `WardBar`

`WardBar` is not merely equivalent, it is **stronger in three ways the new one does not attempt**:

- it **throws** if any segment has a colour but no word;
- it **throws** on an all-zero bar, because an empty grey rail reads as "still loading" rather than
  as "nothing is in any of these categories";
- it renders `role="img"` with an `aria-label` naming **every segment and its number**, so a
  screen-reader user gets the same reading as somebody looking at the widths.

**Do not make `DistributionBar` a thin wrapper.** A wrapper is the same divergence with an extra hop:
the second name still spreads, and the day someone adds a prop to the wrapper the two have parted.
The statistics screens import `WardBar`.

The one thing the new bar has that `WardBar` lacks is forced-colors handling — see the separate
finding below. **The fix is to add it to `WardBar`, where three existing screens get it too.**

### 2. `Kpi` / `KpiStrip` → grow `WardFigure`, and mind the constraint you are about to defeat

`WardFigure` genuinely lacks three things the prototype uses: a tone beyond the single amber
`flagged`, a delta indicator, and the "odd last tile spans the full row" reflow at phone width.
Those are real gaps and adding them to `WardFigure` serves every screen rather than one.

🔴 **BUT ADDING A GENERAL `tone` PROP WOULD SILENTLY DEFEAT THE GUARANTEE THAT MAKES `WardFigureStrip`
WORTH HAVING.** It throws when more than two tiles are `flagged`, on the stated grounds that amber
means "look here" and stops meaning anything when everything carries it. **A `tone="crit"` prop
routes straight around that count.** If tone is added, the ceiling must count _every
attention-carrying tone_, not just `flagged` — otherwise the constraint is still in the file, still
green, and no longer true. That is the whole failure mode this project keeps finding: a guard that
cannot fail.

### 3. `StatChip` vs `WardChip` → the vocabularies are different; the rendering should not be

`WardChip`'s six levels — `urgent`, `routine`, `stalled`, `accepted`, `enroute`, `cancelled` — are
**referral and transport lifecycle STATES**. A statistics tone (`good`, `signal`, `crit`, `accent`,
`neutral`) is **not a state**; it is an editorial emphasis. Merging the two vocabularies would open a
closed set, and the closedness is the point: a fixed list is why nobody can invent a seventh state
on one screen.

**So keep two typed entry points — and extract the shared rendering underneath them.** What must not
be duplicated is the property, which `WardChip` already enforces: **colour may never carry state
alone, and it throws on a wordless child.** A statistics chip that renders its own markup will get
that guarantee only by remembering to re-implement it.

### 4. `StatPanel` → delete, use `WardPanel`

`WardPanel` takes `title`, `count`, `blurb`, `headingLevel`, `testId`, and renders a labelled
`<section>` so `getByRole("region", { name })` reaches every panel without a testid. The two gaps
reported — no body grid, no footnote slot — **are layout and content, not component behaviour.** A
body grid belongs in the consuming screen's own CSS; a footnote is a child. Neither justifies a
second panel component.

## A separate finding: `WardBar` has no forced-colors and no print handling

⚠️ **DO NOT QUOTE A RATIO FOR THIS. FOUR FIGURES HAVE NOW BEEN PRODUCED FOR IT AND ALL FOUR
DIFFER — from TWO people, each of whom measured it twice, so this is not a note about anyone's
care.** In order: 8 of 19 and 30 of 48 (Ward Builder One), 9 of 19 and 31 of 51 (Ward Lead, the
last on 2026-09-05 at `aed55fe62`).

⚠️ **And I got the count of the counts wrong while writing this paragraph** — "five people, all
five differed", listing four figures from two people. Corrected before it landed, and left on the
record because it is the same defect one level up: **a figure produced while composing prose, rather
than pasted from a measurement.**

**The ratio is not a stable property of this repository. It changes with every fold**, because
folding ward work adds stylesheets — the capacity, movements and community modules all arrived after
the first two figures were taken. So a quoted ratio is stale the moment it is written, and the
disagreements were never carelessness: they were four different walks over four different
populations, plus one taken at a different time.

**THE TWO WALKS, STATED, because a figure without its walk is unreproducible:**

    recursive     find src/components/ward-management -name "*.module.css"        51 files, 31 handle it
    top level     ls  src/components/ward-management/*.module.css                 19 files,  8 handle it

**The finding below does not depend on any ratio, and that is the point** — it is four per-file facts,
each checkable in one command, each stable:

    ward-bar.module.css      forced-colors 0   @media print 0   background decls 11
    ward-chip.module.css     forced-colors 0   @media print 1
    ward-figure.module.css   forced-colors 0   @media print 1
    ward-panel.module.css    forced-colors 0   @media print 1
    ward-table.module.css    forced-colors 4   @media print 0

**`WardBar` is the primitive whose entire meaning is carried by coloured fills, and it is the only
one of its four siblings with neither.** Its five tones are five `background` declarations; in
Windows High Contrast every one is overridden to a system colour and the bands become
indistinguishable. In print, background colours are dropped by default, so the track prints as an
empty outline — **the exact "empty grey rail that looks like a loading state" the component throws an
error to prevent, reintroduced by a stylesheet that was never written.**

⚠️ **State the severity honestly: there is a real mitigation and it is not luck.** The legend below
the bar renders each segment's **word and number visibly**, not only in the `aria-label` — so in both
forced-colors and print the meaning survives in text and the bar degrades to uninformative rather
than to misleading. That is the difference between a defect worth fixing and an emergency, and it
exists because somebody already decided colour must never carry meaning alone.

**Recommended fix:** `forced-color-adjust: none` on the segment and swatch fills, or a
`forced-colors` block giving each tone a distinct border or pattern; and an `@media print` block
matching the one its three siblings already have. One file, and three existing screens benefit.

## What I recommend doing, in order

1. **Delete `DistributionBar` and `StatPanel`; the statistics screens import `WardBar` and
   `WardPanel`.** No wrappers.
2. **Fix `WardBar`'s forced-colors and print gap** — smallest change, widest benefit, and it is the
   only thing the new code did better.
3. **Grow `WardFigure` with tone and delta, and extend the flagged ceiling to cover tone in the same
   change.** Not one without the other.
4. **Keep two chip vocabularies, extract one rendering.** The closed lifecycle list stays closed.
5. **Trim `statistics.module.css` to what no shared primitive provides** — the chart wrapper, the
   footnote, the eyebrow, the stat line. Delete every class that restyles something a primitive
   already draws.

Items 3 and 4 touch shared files that other Ward Flow chats read, so they are Ward Lead's to
schedule rather than mine to take.

---

## Verified 2026-09-05 by Ward Lead: the prototypes' own arithmetic

Ward Builder One flagged this class as **"reads as verified and is not"** — the statistics
prototypes' governance footers make arithmetic claims about their own invented figures, and nobody
had checked them. Folded content stating conclusions about itself.

**Checked at `aed55fe62`. Every checkable claim holds:**

    overview   19 ready + 8 held + 9 out of service + 267 occupied = 303   exactly the stated ceiling
    cmht       19 / 28  = 67.857  -> 68%      stated 68%
    cmht        7 /  9  = 77.78   -> 78%      stated 78%
    ward       15 / 22  = 68.182  -> 68%      stated 68%
    ed          1 /  9  = 11.11   -> "about 11%"   stated "about 11%"

**One claim is NOT checkable from the page, and the page says so itself.** The overview states that
"the 23 wards' invented splits sum exactly to this page's own invented" totals while showing only
eight of those wards — so a reader cannot verify it. **That would be the defect, except the same
paragraph states that the arrangement across individual wards is invented rather than measured and
that only the 303-bed ceiling is real.** An unverifiable claim that says it is unverifiable is a
different thing from one that does not.

⚠️ **Recorded here rather than left as a green tick, because the value is entirely in the DATE and
the SHA.** These are hand-written figures in prototype HTML; nothing regenerates them and no test
watches them. **This verification expires the moment anybody edits a number on those pages**, and
whoever does should re-run these five divisions rather than assume the tick still holds.
