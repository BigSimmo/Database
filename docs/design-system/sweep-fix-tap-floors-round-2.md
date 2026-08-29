# Sweep fix — tap floors, round 2 (2026-08-29)

Round 1 (`sweep-fix-tap-floors.md`) taught `interactiveTapFloorDeclarations` to read responsive
bands. It left three sub-floor interactive `min-h-*` declarations in production. This round closes
one of them, teaches the checker the token it was already sanctioning, and — deliberately — does
**not** teach it the pseudo-element idiom the other two use.

Owner ruling this round implements: **40px is acceptable for the compact roles the design system
already names** (`--spacing-compact-meta`), rather than requiring 48px everywhere.

| Gate metric                         | Before | After |
| ----------------------------------- | ------ | ----- |
| `sub-floor interactive min-heights` | 3      | **2** |

---

## 1. The arithmetic in the brief did not hold

The brief's reading was: `before:-inset-y-3` is 12px, so the two `DocumentTagCloud` "+N more"
chips get 28+24 = **52px** and 24+24 = **48px** of effective hit area, both at or above the floor.

**That is wrong by a border width on each side, and it flips the verdict on one of the two chips.**

An absolutely positioned child — including a `::before` — resolves its insets against the
containing block's **padding box**, not its border box. These chips carry `border` (1px). So
`inset-block: -12px` puts the pseudo-element's edge 11px outside the button, not 12px.

Measured in the running app at `http://localhost:3350`, by inserting a real element carrying the
identical insets into the identical button and reading `getBoundingClientRect()` — so this is the
resolved geometry, not point-sampling and not arithmetic:

```
[ { id: 'd7', buttonHeight: 28, expandsAbove: 11, expandsBelow: 11,
    hitAreaHeight: 50, meetsTapFloor48: true  },
  { id: 'd6', buttonHeight: 24, expandsAbove: 11, expandsBelow: 11,
    hitAreaHeight: 46, meetsTapFloor48: false } ]
```

Confirmed by removing the border, which restores the full 12px per side:

```
[ { id: 'withBorder', border: '1px', box: 28, above: 11.98, below: 11, effective: 50.98 },
  { id: 'noBorder',   border: '0px', box: 28, above: 12.98, below: 12, effective: 52.98 } ]
```

The span differs by exactly 2px — one border width per side.

So:

| Control                                      | Brief said | Actually is | Verdict       |
| -------------------------------------------- | ---------- | ----------- | ------------- |
| `DocumentTagCloud` "+N more", default branch | 52px       | **50px**    | clears 48px   |
| `DocumentTagCloud` "+N more", `compact`      | 48px       | **46px**    | **2px under** |

### Residual for the owner — a real, newly found defect

The `compact` branch of `DocumentTagCloud`'s "+N more" button is a **46px** tap target. It is not a
false positive; the gate is right about it for the wrong reason.

The owner subsequently asked for it to be closed with the one-token remedy proposed here
(`before:-inset-y-3` → `before:-inset-y-3.5`). That remedy was measured and **rejected** — see
§8. The chip is unchanged, and the recommendation in this document's first revision was wrong.

---

## 2. `answer-content.tsx:517` — fixed

> **SUPERSEDED by §10.** This change broke a committed browser contract and has been reverted.
> The 28px control is recorded debt again, and the count is 3, not 2.

`src/components/clinical-dashboard/answer-content.tsx`, the source-only disclosure header. It was
`min-h-7` (28px) with no hit expansion — genuinely 20px under the floor.

Raised to **`min-h-compact-meta`** (40px). Its own comment already called it a "compact-meta
disclosure", and "disclosure" is named verbatim in the TOKENS.md §2 compact-meta role list, so the
owner's 40px ruling is exactly what this control should carry.

**The `::before` alternative was tested and rejected on evidence, not taste.** The wrapping
`<section>` is `overflow-hidden` (it clips the expanded detail block to the pill radius). Overflow
clipping removes the clipped region from hit testing as well as from paint, so the idiom expands
nothing here. Measured, with the pseudo-element confirmed present and correctly positioned:

```
{ id: 'p-old', box: 28, beforePosition: 'absolute', beforeContent: '""',
  beforeInsetBlock: '-12px', hitsAt11_9Above: false, hitsAt11_9Below: false }
```

`::before` exists, is absolute, is inset by 12px — and yields **zero** expansion.

Visual check (the Browser pane could not composite a raster screenshot in this session, so this is
measured geometry rather than an image): the closed pill goes from 202×30 to 202×42, aspect 6.7 →
4.8, leaving 11.8px of space around the 16.5px line box. That is an ordinary pill, not a balloon.

---

## 3. `min-h-compact-meta` is now measured, not invisible

`minHeightPixels` could not resolve `min-h-compact-meta`, so it returned `null` and the token was
**dropped before any floor applied**. Every site round 1 migrated to `sm:min-h-compact-meta` was
unmeasured, and so were the base-band uses in `bedside-sheet.tsx` and `directory-grid.tsx`.

Changes in `scripts/design-system-contract-utils.mjs`:

1. `minHeightPixels("min-h-compact-meta")` → `COMPACT_META_PX` (40).
2. A `min-h-*` declaration now carries `compactRole`, and the floor for a band is chosen by **which
   token won that band**: the named `min-h-compact-meta` floors at 40px on every band including the
   base one; anything else keeps 48px at base / 40px on a prefixed band.
3. The licence attaches to the documented role marker, **not** to the number. `min-h-10`,
   `min-h-[2.5rem]` and `min-h-[40px]` are all 40px and all still fail at base band.
4. `RESPONSIVE_STEP_DOWN_FLOOR_PX` is now an alias of `COMPACT_META_PX` rather than a second literal
   40, so the two cannot drift apart.

The number is pinned against its own source: a test reads `--spacing-compact-meta` and
`--spacing-tap` out of `src/app/globals.css` and asserts `minHeightPixels` agrees. Without that,
"compact-meta is 40px" would be a claim this file makes about itself.

### The prefilter was silently exempting the token

`findInteractiveTapFloorDeclarationsInSource` opens a file only if a cheap regex matches. It matched
`min-h-<digit>` and `min-h-[` — so it admitted neither `min-h-px` (which `minHeightPixels` resolves
to 1px, making that branch unreachable) nor `min-h-compact-meta`.

This was found by mutation testing, not by reading: **the first attempt at mutation B passed 56/56
green**, because the compact-role floor it deleted was unreachable for the exact token the tests
exercised. `bedside-sheet.tsx`'s two base-band compact-meta jump chips had never been scanned at
all.

The regex is now `SUB_TAP_MIN_HEIGHT_PREFILTER`, exported, with an explicit invariant: **admit every
token `minHeightPixels` can resolve below the 48px floor.** Only `min-h-tap` is omitted, because a
token at the floor can never be the violating one. A test asserts the invariant against
`minHeightPixels` itself rather than restating it in a comment.

---

## 4. The pseudo-element rule: NOT added

The brief permitted a `before:-inset-y-*` exclusion only if it could be made strict and provable
from the classes. **It cannot be**, and §1 shows the failure is not hypothetical.

A rule computing `min-h + 2 × inset` from the class string produces 52px and 48px — and would have
**passed the compact branch, which is really 46px**. It would have excluded a true violation on its
first application. Three inputs it needs are invisible to the class string of the element itself:

1. **Border width.** The insets resolve against the padding box. 1px of border costs 1px of
   expansion per side. `border` may also arrive from a `cn()` branch, a recipe, or a parent.
2. **Ancestor overflow.** An `overflow-hidden` ancestor deletes the expansion from hit testing
   entirely (measured above: 0px). Nothing in the button's own classes shows this.
3. **Overlap and paint order.** These chips sit in `flex flex-wrap gap-1.5` — 6px between wrapped
   rows against ~11px of expansion each way, so adjacent rows' expanded regions overlap and the
   later element in DOM order takes the shared area.

A loose rule here is a loophole: `before:-inset-y-px` would silence a real violation. A strict rule
is not derivable. Per the brief — a wrong exclusion is worse than a known false positive — the two
`DocumentTagCloud` findings **stay recorded debt** in `design-system-contract-baseline.json`, with
the measured numbers and the reasoning written into the component itself.

---

## 5. Mutation tests

Every rule added was mutated, with the failure predicted in advance, then restored and verified
byte-identical by `sha256sum -c`.

| #       | Mutation                                                    | Predicted                                                                        | Observed                                                                                                                                                                                      | Match                                                                                         |
| ------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A       | Delete the `min-h-compact-meta` line from `minHeightPixels` | 1 failed / 55 passed, `expected null to be 40`                                   | `AssertionError: expected null to be 40`; `1 failed \| 55 passed (56)`                                                                                                                        | exact                                                                                         |
| B (1st) | Delete the `compactRole` floor                              | test goes red                                                                    | **56 passed — NOT DETECTED.** Prefilter had already exempted the token. Fixed the prefilter, then re-ran.                                                                                     | **prediction failed → real defect found**                                                     |
| B (2nd) | Delete the `compactRole` floor                              | 1 failed / 55, `expected [ 'src/example.tsx:1' ] to deeply equal []`; gate 2 → 5 | `AssertionError: expected [ 'src/example.tsx:1' ] to deeply equal []`; `1 failed \| 55 passed (56)`; gate `increased from 2 to 6` (bedside-sheet 0→2, directory-grid 0→1, answer-content 0→1) | message exact; **count 6 not 5** — I forgot `answer-content.tsx` now carries the token itself |
| C       | Drop `compact-meta` from the prefilter                      | prefilter-invariant test red; gate still green at 2                              | `expected { token: 'min-h-compact-meta', admitted: false } to deeply equal { … admitted: true }`; `1 failed \| 56 passed (57)`; gate passed at 2                                              | exact — and confirms the gate alone cannot see this exemption                                 |
| D       | Drop `px` from the prefilter                                | 2 failed / 55                                                                    | `expected { token: 'min-h-px', admitted: false } …` + `expected [] to deeply equal [ 'src/example.tsx:1' ]`; `2 failed \| 55 passed (57)`                                                     | exact                                                                                         |
| E       | `COMPACT_META_PX` 40 → 44                                   | 1 failed / 56, `expected 44 to be 40`                                            | `expected 44 to be 40` **plus** the pre-existing Gate 2 test, because `RESPONSIVE_STEP_DOWN_FLOOR_PX` now aliases the same constant; `2 failed \| 55 passed (57)`                             | **stronger than predicted**                                                                   |
| F       | Revert `answer-content.tsx` to `min-h-7`                    | gate fails, 2 → 3                                                                | `interactiveTapFloorDeclarations increased from 2 to 3`; `… at src/components/clinical-dashboard/answer-content.tsx increased from 0 to 1`                                                    | exact                                                                                         |

Two predictions were wrong (B's first run, E's blast radius) and one count was wrong (B's second
run). B's failure is the substantive one: it found a rule that could not fail.

---

## 6. Verification

```
BEFORE  Design-system contract passed (1079 production files; … sub-floor interactive min-heights 3; …)
AFTER   Design-system contract passed (1079 production files; … sub-floor interactive min-heights 2; …)
```

```
npx vitest run --reporter=dot tests/design-system-contract-utils.test.ts
  Test Files  1 passed (1)
      Tests  57 passed (57)
```

The 14 vitest files that reference the changed surfaces, discovered by grepping `tests/` rather
than guessed:

```
  Test Files  14 passed (14)
      Tests  174 passed (174)
```

```
npx eslint scripts/design-system-contract-utils.mjs tests/design-system-contract-utils.test.ts \
  src/components/DocumentTagCloud.tsx src/components/clinical-dashboard/answer-content.tsx --max-warnings 0
  (no output) eslint exit=0
```

Browser: `npm run ensure` reported the server already running at `http://localhost:3350`; all
geometry above was measured against it. Playwright journeys (`ui-smoke`, `ui-style-contract`) were
**not** run — no browser gate was executed this round.

## 7. Not done

- The 46px `compact` "+N more" chip (§1). The proposed inset widening was measured and rejected
  (§8); the chip is unchanged. A coherent remedy needs a design decision about row pitch.
- The tap-theft between wrapped rows (§8) affects every `DocumentTagChip`, not just "+N more".
  Not fixed — it is a design change, not a token change.
- The gate cannot see a `className` passed as an identifier (§9), so the chips are uncounted.
  Not fixed — resolving local class variables is its own piece of work with its own fallout.
- No Playwright/browser gate, no `verify:cheap`, no `verify:pr-local`.
- `min-h-11` was not introduced anywhere; it remains forbidden.

---

## 8. Follow-up: the inset widening was measured and REJECTED — chip unchanged

The owner asked to close the 46px compact chip with the one-token remedy proposed in §1:
`before:-inset-y-3` → `before:-inset-y-3.5`, on the condition that it must not create a
neighbour-overlap problem. **It does. The change was not shipped.**

### Can the branches be changed independently?

Partly, and it does not matter. The `::before` sits in the **shared** half of the `cn()` call while
`min-h-6` / `min-h-7` sit in the `compact` ternary, so raising only the compact branch would mean
moving `before:-inset-y-*` into the ternary. That is mechanically easy. The measurement below made
the question moot.

Note also that `DocumentTagChip` carries the **same** `before:-inset-y-3` idiom, so this is not two
buttons — it is every chip in the cloud.

### The overlap: measured, current code, no change applied

Realistic layout: four fixed-width chips in `flex flex-wrap gap-1.5`, wrapping to two rows, chips
`c0` (row 1) and `c2` (row 2) vertically aligned. `getBoundingClientRect` for geometry;
`document.elementFromPoint` for who wins the tap.

| Config                               | chip box | hit area | row gap | hit overlap | intrudes into row-1 **visible box** | tap at row-1 bottom-1px |
| ------------------------------------ | -------- | -------- | ------- | ----------- | ----------------------------------- | ----------------------- |
| `-inset-y-3` `min-h-6` (**current**) | 24px     | 46px     | 6px     | 16px        | **5px**                             | **`c2`**                |
| `-inset-y-3.5` `min-h-6` (proposed)  | 24px     | 50px     | 6px     | 20px        | **7px**                             | **`c2`**                |
| `-inset-y-3` `min-h-7` (**current**) | 28px     | 50px     | 6px     | 16px        | **5px**                             | **`c2`**                |
| `-inset-y-3.5` `min-h-7` (proposed)  | 28px     | 54px     | 6px     | 20px        | **7px**                             | **`c2`**                |

Scanning down through row 1's visible box for the exact point where it stops winning:

| Config                               | stolen from bottom of visible box | % of chip height | thief |
| ------------------------------------ | --------------------------------- | ---------------- | ----- |
| `-inset-y-3` `min-h-6` (**current**) | **5.5px**                         | **23%**          | `c2`  |
| `-inset-y-3.5` `min-h-6`             | 7.5px                             | 31%              | `c2`  |
| `-inset-y-3` `min-h-7` (**current**) | **5.5px**                         | **20%**          | `c2`  |
| `-inset-y-3.5` `min-h-7`             | 7.5px                             | 27%              | `c2`  |

Answering the owner's question directly: **yes, adjacent rows already have overlapping hit areas,
and the bottom chip wins.** Both chips are positioned with `z-index: auto`, so paint order is DOM
order and the later element takes the shared region.

The horizontal axis is clean: `-inset-x-1` is 4px against a 6px column gap, so the 2px of overlap
falls inside the gap and never enters a neighbour's visible box (`stolenFromRightEdge: 0`).

### Two conclusions

1. **Do not widen the inset.** It takes theft from 5.5px to 7.5px. Per the owner's stop condition,
   the change was not shipped and the chip stays at 46px.

2. **The pre-existing theft is the more serious defect**, and it is not something this round
   introduced. Today, on any wrapped tag cloud, a tap on the bottom fifth of a chip selects a
   different filter. On a phone — where the cloud wraps most — that is a live misfire, and it is
   worse than 2px of shortfall.

The conflict is structural rather than a tuning problem: a 6px row gap tolerates **3px** of
expansion per side before neighbours overlap, while reaching 48px from a 24px chip needs **12px** —
4× the budget. **The `::before` idiom cannot produce a compliant, non-overlapping target in a
wrapped row at this gap**, at any inset value. The coherent remedy is real height —
`min-h-compact-meta` (40px, the owner's own compact-role floor) with the `::before` dropped
entirely — which changes row pitch and is therefore a design decision, not a token swap.

This is also a third, independent reason the gate was not taught the `before:-inset-y-*` idiom in
§4: a rule that scored the idiom as compliant would have blessed a control that steals its
neighbour's taps.

## 9. Observation: the gate cannot see a `className` identifier

`DocumentTagChip`'s chips declare `min-h-6` / `min-h-7` on a `<button>` and are **not** counted.
The reason is not the pseudo-element — it is that the class string is built into a local
(`tagClassName`) and passed as `className={tagClassName}`. `jsxClassAlternatives` resolves literals,
ternaries, templates and calls in the attribute itself, but an identifier resolves to `[""]`.

Verified rather than assumed:

```
inline  -> ["src/x.tsx:1"]
via var -> []
```

So `sub-floor interactive min-heights 2` counts the two "+N more" buttons only, and understates the
real number in this file. Left alone deliberately: resolving local class variables would change
findings across the repo and needs its own baseline pass.

## 10. CORRECTION: `answer-content.tsx` is reverted — two committed contracts collide there

**§2 above is superseded.** The `min-h-7` → `min-h-compact-meta` change it reports as fixed broke a
committed browser contract and reached CI. It has been reverted, and `interactiveTapFloorDeclarations`
is back to **3**. That is the correct outcome, not a regression: the debt is visible and recorded
again rather than traded away for a broken safety contract.

### What broke

`tests/ui-smoke.spec.ts:3232`, test `source-only answer keeps support rows honest`:

```
expect(disclosureBox!.height).toBeLessThanOrEqual(30)
Expected: <= 30
Received:    42
```

The 30 → 42 growth is exactly what §6 of this report predicted and reported. §6 ran Vitest and
eslint and explicitly did not run the browser gate, so the one contract the change actually broke
was the one never exercised. The lesson is not "the threshold is too tight" — it is that a geometry
change on a rendered surface is only proven by rendering it.

### Why the threshold must not move

The test runs at a **390px phone viewport** against the **source-only answer** — the degraded state
shown when generated clinical numbers could not be matched to their cited sources. Its comment
records a deliberate decision: source-only owns the one on-screen warning, and the governed compact
wording is folded into this disclosure instead of repeating above the prose. The `<= 30` sits
between two `>= 7` gap assertions; together they pin that safety warning as a single compact line
that cannot dominate the answer.

So two committed contracts meet on one control and cannot both hold:

| Contract            | Wants                                                                                                                 | Source                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Tap floor           | the toggle ≥ 40px (`min-h-compact-meta`, the owner's compact-role floor; "disclosure" is a TOKENS.md §2 compact role) | `interactiveTapFloorDeclarations`                         |
| Source-only density | the disclosure section ≤ 30px tall at 390px                                                                           | `ui-smoke` "source-only answer keeps support rows honest" |

Raising a CI threshold to clear a density contract on a clinical safety surface is not a CI fix.
Which contract yields is a design decision, and it belongs to the owner.

### Measured, in Chromium, at the 390px test viewport

Probed live rather than reasoned about. The harness was a temporary test that has been deleted; the
file is byte-identical to `HEAD` (`git hash-object tests/ui-smoke.spec.ts` =
`a2cfe3c539133614196f593e74e167a18567b9ad`, `git diff --stat` empty). Its measurements:

```
TAPFLOOR_PROBE {
  "before":           {"sectionH":30,"buttonH":28,"up":1,"down":0,"hitHeight":29,"overflow":"hidden"},
  "withPseudo":       {"sectionH":30,"buttonH":28,"up":1,"down":0,"hitHeight":29},
  "withPseudoNoClip": {"sectionH":30,"buttonH":28,"up":7,"down":5,"hitHeight":40}
}
```

`up`/`down` are how many pixels above and below the button's border box still return the button from
`document.elementFromPoint` — real hit reach, not painted area.

**Answer to (2) — yes, it is sub-floor on a phone specifically.** At 390px the toggle is **28px**
tall with a **29px** hit height (the extra pixel is the section's own border). That is 20px under the
48px production tap floor and 12px under the 40px compact-meta floor, on the exact viewport the test
pins.

**Answer to (1) — the `::before` route is still dead as the markup stands, but something _could_
work, and it is the owner's call, so I stopped.**

- `withPseudo` adds the DocumentTagCloud `::before` idiom with the markup unchanged. Hit height stays
  **29px — zero expansion.** The section carries `overflow-hidden`, and overflow clipping removes the
  expanded region from hit testing as well as from paint. The previous round's finding holds, now
  measured on this exact element rather than inferred.
- `withPseudoNoClip` is the same `::before` with the section's clip removed. Section height stays
  **30px** while hit height reaches **40px**. So the two contracts are not geometrically impossible —
  they are only impossible while the section clips.

That remedy is not a token swap, and I did not implement it:

1. `overflow-hidden` is load-bearing. It clips the button's hover fill and the expanded detail block
   to the pill radius across the `transition-[border-radius]` between `rounded-full` and
   `rounded-lg`. Removing it needs the radius moved onto the children and visual proof in both
   states, on a clinical safety surface.
2. It reaches **40px, not 48px**. The measured expansion is bounded by the neighbours: `up` 7 and
   `down` 5 are the gaps to the prose above and the source rail below, which the same test pins at
   `>= 7`. Reaching 48px needs ~10px per side, which would steal taps from the prose and the rail —
   the identical neighbour-theft defect §8 measured and rejected for the tag chips.

So the honest statement is: **no change confined to this control's classes can satisfy both
contracts. One structural change can, at the cost of the pill clipping, and it only reaches the
compact-meta floor.** The choice is between (a) keeping 28px as recorded debt, (b) restructuring the
clip to buy a 40px hit area, or (c) relaxing the 30px density pin. All three are owner decisions.

The reasoning is written into `answer-content.tsx` beside the class, ending "Do NOT raise the test
threshold", so the next session meets it before it meets the gate.

### Baseline

`scripts/design-system-contract-baseline.json`: `interactiveTapFloorDeclarations` 2 → **3**, with
`src/components/clinical-dashboard/answer-content.tsx: 1` pinned per-path.

## 11. Round 3: the gate measured five of this repository's ten breakpoints

### The defect

`MIN_WIDTH_BREAKPOINT_BANDS` was the literal `["sm", "md", "lg", "xl", "2xl"]`. Any other variant
made `minHeightBandIndex` return `null`, and the caller then `continue`d — so the declaration was not
merely mis-banded, it was **skipped entirely**. This repository declares five breakpoints of its own
in `src/app/globals.css`, so all five were unmeasured. Measured before the fix:

```
sm                       ["src/x.tsx:1"]
md                       ["src/x.tsx:1"]
lg                       ["src/x.tsx:1"]
xl                       ["src/x.tsx:1"]
2xl                      ["src/x.tsx:1"]
phone                    []
tablet                   []
desktop                  []
filter-label-collapse    []
filter-label-restore     []
```

`min-h-tap phone:min-h-9` — a genuine 36px tap target on every viewport above 640px — passed the gate.
That is the fourth blind spot found in this one checker, and it was in a fix that had just shipped.

### Derived, not restated

The list is now **read from the two `@theme` layers that actually generate the variants**: Tailwind's
own `node_modules/tailwindcss/theme.css` (`sm`..`2xl`) and `src/app/globals.css` (the five repo names,
which may also redefine an inherited one). Parsing is postcss, restricted to `@theme` at-rules — the
`:root`-scoped `--bp-*` aliases in `ckb-v2-tokens.css` are plain custom properties and generate no
variants, so a whole-file scan would have asserted the wrong set. `rem` and `px` both resolve;
`--breakpoint-*: initial` clears the namespace and `--breakpoint-<name>: initial` clears one name;
anything else throws rather than being skipped, because an unresolvable breakpoint is an exemption no
test can see.

A hardcoded list is what created this defect, so deriving closes the class rather than the instance:
a sixth `--breakpoint-*` token is measured the moment it is declared. The derivation is reliable here
— both files are on disk at gate time, postcss is already a dependency of this module, and the
repository root is resolved from `import.meta.url` rather than `process.cwd()` so the gate cannot
lose a layer by being invoked from a subdirectory.

Resulting table:

```
0   0px      (base)
1   414px    filter-label-collapse, min-filter-label-collapse
2   430px    filter-label-restore, min-filter-label-restore
3   640px    phone, min-phone, sm, min-sm
4   768px    md, min-md, tablet, min-tablet
5   1024px   desktop, min-desktop, lg, min-lg
6   1280px   xl, min-xl
7   1536px   2xl, min-2xl
```

### The band-index shift

Two of the new breakpoints (414px, 430px) sit **below** `sm`, so inserting them in width order shifts
every existing index — `sm` is band 3 now, not band 1. The old code spread the base band across two
pieces of arithmetic that had to agree: `minHeightBandIndex` returned `index + 1`, and the loop was
bounded `band <= MIN_WIDTH_BREAKPOINT_BANDS.length`.

Rather than adjust the offsets, the base band is now **entry 0 of the table itself** —
`{ minWidthPx: 0, variants: [] }`, with `BASE_BAND_INDEX = 0` and a constructor assertion that entry 0
really is the unprefixed band. A band index is therefore always a plain index into the array, and the
loop is a plain `band < bands.length`. There is no `+ 1` left to be wrong. A magic offset that happens
to work today is how the next blind spot gets built, so the relationship is structural instead of
incidental. `tests/design-system-contract-utils.test.ts` pins both ends: `bandOf("sm")` is 3, and a
lone `2xl:min-h-9` is still a finding — which is only true if the loop reaches the last entry.

### Aliases share a band — and a tie inside a band is NOT resolved by class order

`phone`/`tablet`/`desktop` are exact aliases of `sm`/`md`/`lg` (640/768/1024px), so they emit media
queries with identical conditions and are grouped by **width**, not by name.

The existing rule was "ties inside a band go to the last declaration, as the cascade does". I set out
to follow it and **measured that it is wrong**, by compiling the real stylesheet with the repo's own
Tailwind 4.3.3 and reading the emitted order:

```
["sm:min-h-9","phone:min-h-12"] => @media (width >= 640px) { | .phone\:min-h-12 { | @media (width >= 40rem) { | .sm\:min-h-9 {
["phone:min-h-12","sm:min-h-9"] => @media (width >= 640px) { | .phone\:min-h-12 { | @media (width >= 40rem) { | .sm\:min-h-9 {
["phone:min-h-9","sm:min-h-12"] => @media (width >= 640px) { | .phone\:min-h-9 { | @media (width >= 40rem) { | .sm\:min-h-12 {
["sm:min-h-12","phone:min-h-9"] => @media (width >= 640px) { | .phone\:min-h-9 { | @media (width >= 40rem) { | .sm\:min-h-12 {
```

The `sm` block is emitted **after** the `phone` block in all four runs — the order the classes appear
in does not move it. So for `min-h-tap sm:min-h-9 phone:min-h-12` the real winner is `sm:min-h-9` and
the control is **36px above 640px**, while the source-order rule read the later `phone:min-h-12` as
the winner and passed it. Within one variant the emitted order is by value ascending, likewise
independent of class order.

Class order therefore cannot decide a tie, and the emission order that does is an undocumented
Tailwind implementation detail a minor upgrade may flip. **A tie is treated as unresolved and every
candidate in the band is floored.** This is strictly conservative: it catches the real defect above,
and it also flags the mirror case whose height is only accidentally correct today. Two conflicting
`min-h-*` declarations in one width band is the defect either way. The `pointer-events-none` inertness
excuse is read the same way — only an unambiguously inert band is excused.

### Two further spellings, found while measuring

- **`min-<breakpoint>:`** is Tailwind's explicit min-width form and this repo ships it
  (`min-filter-label-collapse:` in `result-filter-control.tsx`). Registered alongside the bare name,
  so the hole is not one rename away.
- **`max-<breakpoint>:`** is a max-width variant — not a min-width band, and this table cannot order
  it. It was being **dropped**, which is the same defect as `phone:`, and the repository has seven
  live `max-sm:min-h-*` declarations. Every max-width variant covers width 0 up to its breakpoint, so
  it always applies at the narrowest viewports — the base band, and exactly where a tap floor matters.
  It is folded there: conservative in the one safe direction, unable to miss a control that is short
  on a phone. It deliberately does not model the band above the breakpoint, where the variant stops
  applying; a finding is raised once either way. **A fuller max-width model is not attempted here** —
  ordering a max-width rule against an overlapping min-width one needs its own measurement, and
  guessing it would be the fifth blind spot rather than the close of the fourth.

### After

```
== every declared min-width variant, `min-h-tap <V>:min-h-9` ==
sm                       ["src/x.tsx:1"]
md                       ["src/x.tsx:1"]
lg                       ["src/x.tsx:1"]
xl                       ["src/x.tsx:1"]
2xl                      ["src/x.tsx:1"]
phone                    ["src/x.tsx:1"]
tablet                   ["src/x.tsx:1"]
desktop                  ["src/x.tsx:1"]
filter-label-collapse    ["src/x.tsx:1"]
filter-label-restore     ["src/x.tsx:1"]

== alias cascade ==
<button className="min-h-tap sm:min-h-9 phone:min-h-12">Save</button>                 ["src/x.tsx:1"]
<button className="min-h-tap phone:min-h-12 sm:min-h-9">Save</button>                 ["src/x.tsx:1"]
<button className="min-h-tap phone:min-h-9 sm:min-h-12">Save</button>                 ["src/x.tsx:1"]
<button className="min-h-tap phone:min-h-12 desktop:min-h-compact-meta">Save</button> []
<button className="min-h-tap phone:min-h-compact-meta">Save</button>                  []
<button className="max-sm:min-h-8">Compact</button>                                   ["src/x.tsx:1"]
<div className="min-h-tap phone:min-h-9">Panel</div>                                  []
```

The last two lines matter as much as the first ten: the sanctioned compact-meta step-down still
passes under the repo names, and a short height on a non-interactive element is still layout.

### Production count: unchanged at 3

```
Design-system contract passed (1079 production files; raw colors 0; literal shadows 0; legacy tap
classes 0; sub-floor interactive min-heights 3; edge conflicts 5; 1px shadow spreads 0).
```

No newly-visible controls. The 3 are the two DocumentTagCloud "+N more" buttons and the reverted
`answer-content.tsx` disclosure from §10 — none of them from the newly-modelled variants. Verified
independently rather than assumed: the five repo breakpoint names appear exactly **once** in `src/`
(`result-filter-control.tsx:261`, an `sr-only` label rule), and the only prefixed `min-h` below the
floor at a modelled variant is `xl:min-h-7` twice in
`differential-presentation-workflow-page.tsx:304,319` — both on a `<span>` and a component wrapper,
correctly not tap targets. So the gate closes a hole that is currently unexploited, which is the
cheapest possible moment to close it.

## 12. Round 3 mutation tests

Each rule was mutated with the failure message predicted **before** running. Every mutation was
restored and the restoration proven by blob hash.

| #   | Mutation                                                                                            | Predicted                                                                             | Observed                                                                                                                                                                                         | Match                                   |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| M1  | Drop the `globals.css` `@theme` layer from the derivation (regress to Tailwind defaults only)       | 3 fail: band table 6 vs 8; `phone` no longer a finding; `bandOf("phone")` undefined   | 4 fail — `expected [ …(6) ] to deeply equal [ …(8) ]`; `expected { variant: 'phone', findings: [] } to deeply equal { variant: 'phone', …(1) }`; `expected undefined to be 1`; plus the tie test | superset (under-predicted the tie test) |
| M2  | Reintroduce the `+ 1` base-band offset in `minHeightBandIndex`                                      | `2xl` pushed past the loop bound, so a lone `2xl:min-h-9` stops being a finding       | 2 fail — `expected { variant: '2xl', findings: [] } to deeply equal { variant: '2xl', …(1) }`; `expected [] to deeply equal [ 'src/example.tsx:1' ]`                                             | exact                                   |
| M3  | Group bands by name instead of width (aliases stop sharing a band)                                  | band table 11 vs 8; `bandOf("phone") !== bandOf("sm")`; a tie ordering stops flagging | 3 fail — `expected [ …(11) ] to deeply equal [ …(8) ]`; `expected 3 to be 4`; `expected [ 'src/example.tsx:1' ] to deeply equal []`                                                              | exact                                   |
| M4  | Restore "last declaration wins" for a tie                                                           | exactly 1 fail: the tie test, `[]` where a finding is required                        | 1 fail — `expected [] to deeply equal [ 'src/example.tsx:1' ]`                                                                                                                                   | exact                                   |
| M5  | Drop the `max-<breakpoint>` registration                                                            | `max-` unknown in the lookup; `bandOf("max-sm")` undefined                            | 2 fail — `expected { name: 'sm', known: false } to deeply equal { name: 'sm', known: true }`; `expected undefined to be +0`                                                                      | exact                                   |
| M6  | Drop the `min-<breakpoint>` spelling                                                                | band variants differ; `bandOf("min-phone")` undefined                                 | 2 fail — `expected [ …(8) ] to deeply equal [ …(8) ]`; `expected undefined to be 3`                                                                                                              | exact                                   |
| M7  | End-to-end: change one real control in `form-detail-page.tsx` from `sm:min-h-10` to `phone:min-h-9` | gate red, 3 → 4, plus the per-path line                                               | `- interactiveTapFloorDeclarations increased from 3 to 4`; `- interactiveTapFloorDeclarations at src/components/forms/form-detail-page.tsx increased from 0 to 1`                                | exact                                   |

M7 is the one that matters most: round 2 learned that a rule can be correct in the helper and
unreachable from the entry point (the prefilter silently exempted `min-h-compact-meta`, and a mutation
deleting the compact floor passed 56/56 green). M7 proves the new bands are reachable from
`check:design-system-contract` on a real production file, not only from a unit test.

Restoration proof:

```
utils:              23509320eff3f8b87847c9132e77234e9d8ccc44  (unchanged across M1-M6; pre-format blob, prettier ran after the mutation window)
form-detail-page:   346d35d98267437cf1b9d8b94ca01c98ae7f7d00  (restored after M7, git diff --stat empty)
ui-smoke.spec.ts:   a2cfe3c539133614196f593e74e167a18567b9ad  (= HEAD, probe harness removed)
```

## 13. Round 3 verification

| Check                                                                                                                                                        | Decisive line                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:design-system-contract`                                                                                                                       | `Design-system contract passed (1079 production files; … sub-floor interactive min-heights 3; edge conflicts 5; 1px shadow spreads 0).` |
| `npx vitest run` on `design-system-contract-utils.test.ts` plus the 7 other files covering `answer-content` / these helpers, discovered by grepping `tests/` | `Test Files  8 passed (8)` / `Tests  140 passed (140)`                                                                                  |
| `npm run test:e2e -- tests/ui-smoke.spec.ts --project=chromium --grep "source-only answer keeps support rows honest"`                                        | `ok 1 [chromium] › tests\ui-smoke.spec.ts:3187:7 › … › source-only answer keeps support rows honest (3.9s)` / `2 passed (9.2s)`         |

The browser gate is the one round 2 skipped, and it is the one that caught the regression. It was run
on the reverted tree; nothing under `src/` changed after that run.
