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
