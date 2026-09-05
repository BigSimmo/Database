# What actually goes red when the ward screens are redesigned

**Ward Verifier, 2026-09-05.** Owner asked for a check that the tests will not fight a redesign.
This is the answer, measured across **261 ward test files** with comments blanked first.

## The headline: a visual redesign breaks almost nothing

    hex colours asserted            0
    rgb / oklch / hsl asserted      0
    getComputedStyle / .style       0
    snapshot tests                  0
    CSS class-name assertions       1
    positional cell reads           1

**Change the palette, the type scale, the spacing, the light/dark treatment, the shadows, the
radii — nothing in the ward test estate asserts any of it.** That is not luck; the design-token
gates live in CSS-contract tests that check tokens resolve, not that a screen looks a particular way.

## The four things that WILL go red, and whether you want them to

### 1. Ten table-width pins — RED BY DESIGN, and the red is wanted

`tests/ward-table-min-width.test.ts` pins `--ward-table-min-width` per board: 30rem, 44rem, 46rem,
48rem, 35rem, 27.5rem. **A redesign that adds or removes a COLUMN moves these**, and they are meant
to move — the value is a fact about that board's column count, not a preference. Composed without
one, a table stops scrolling and starts squashing, silently, on a board read under pressure.

**When one goes red: re-derive the number, do not delete the pin.** The failure message should say
"re-measure", and that is the one thing worth improving about them.

### 2. Roughly forty counts of rendered elements

`getAllBy…(…).toHaveLength(n)`. Most are claims rather than layout — _"both locked-ward
alternatives carry the restriction marker"_, _"exactly one entry per section"_. **A redesign that
changes how many things are on screen changes the claim too**, so these should be read when they
fire rather than relaxed. (334 further `toHaveLength` calls are over model data and are not design
at all — an earlier count of "386 design-fragile" was measuring the wrong unit.)

### 3. Four ordering assertions

`firstElementChild` in `ward-referral-screens.dom.test.tsx` — "the accepting unit appears before the
refusals". **A layout change that reorders those breaks them, and the ordering is a real claim**, so
the red is a question rather than noise: is the new order still honest?

### 4. Wording — largely already fixed

95 assertions now match concepts rather than sentences. See
`redesign-brittleness-audit-2026-09-05.md`, **including its honest limit: about seven of the 95 have
had their reword arm actually run.**

## What is NOT fragile, despite looking it

**Twenty-three `tagName` assertions** — `SELECT`, `BUTTON`, `INPUT`, `TEXTAREA`, `A`. These are
accessibility contracts, not design: they fail when a real control becomes a clickable `<div>`, and
that is exactly when they should. **Keep every one.**

## The one improvement worth making, and it is not a deletion

Nothing here needs removing. The table-width pins are the only shape that will fire repeatedly
during a redesign, and the fix is the failure MESSAGE rather than the assertion: it should say _"this
was measured against a table with N columns; re-measure it"_ rather than _"expected 44rem"_. **A
guard that works with a redesign does not block the change; it tells the person making it what to
re-derive.**
