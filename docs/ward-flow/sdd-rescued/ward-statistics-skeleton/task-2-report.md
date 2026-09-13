# Task 2 report — the hub index, and the disclaimer fold

**Status:** complete. One commit, `2245e0ecf`, on `claude/ward-builder-community-route`
(base `ab16d11a9`). Working tree clean; `git status --porcelain` empty after the mutation
was reversed.

## What was built

### 1. The hub index on `/mockups/ward-flow/statistics`

A `<nav data-testid="ward-statistics-index">` sits between the access notice and the first
audience section — above the figures, below the governance chrome. It renders
`STATISTICS_SECTIONS.map(...)`; the screen types no section label, no description and no href.
Each entry is a `<Link>` carrying two spans, `section.label` and `section.description`, with a
new `data-testid` of `ward-statistics-index-entry-${section.id}`.

- **The href is rendered exactly as the module gives it**, so the third entry carries
  `STATISTICS_UNIT_CHOOSER_HREF` — the comparisons route _plus_ its `#choose-a-unit`
  fragment. Nothing in the screen rewrites, trims or rebuilds an href, and the test compares
  the whole string, so a dropped fragment fails rather than landing the reader at the top of
  a page that opens with two sections about why no comparison exists.
- **Copy says what an entry does without naming a section or a position.** The introduction
  reads: "Each entry opens that section. Where a section has no page of its own, its entry
  opens the chooser the section is reached from instead — nothing here is a link to a page
  that does not exist." A sentence naming "the third one" would be wrong the day a fourth is
  added and nothing would fail, so it names none.
- **No count of any kind.** Not "3 sections", not a per-section tally, not a badge. A test
  asserts the entire index region matches no `[0-9]`, with a length guard so an index that
  rendered nothing could not pass it vacuously.
- **CSS.** New `.index*` rules in `statistics.module.css`, design tokens only, `--st-tap`
  minimum height on the whole entry (one tap target, not two), `auto-fill` not `auto-fit` for
  the reason `ward-index.module.css` records. The entries deliberately do **not** reuse the
  `.figure` treatment: a row of raised cards above a page of figures reads as tiles whose
  numbers have not loaded. The existing 40rem `--spacing-ward-phone-bar` reserve already
  covers the new block because it is on `.screen`.
- **Nothing existing moved.** No figure migrated, no `data-testid` renamed. A test asserts
  each of the four figures is absent from the index and still present on the page.

### 2. The disclaimer fold — folded, with a wording that is neither original

**Decision: fold, into `src/components/ward-management/statistics/statistics-disclaimers.tsx`.**

Both sentences had diverged and both divergences were true of one kind of page and false of
the other, so neither copy could simply be deleted. Resolutions, recorded in that file's doc
comment:

- **Banner.** Home said "every instant _they are computed from_ is invented"; the frame said
  "every instant _this prototype holds_ is invented". **The frame's wording is kept**, because
  it is the broader of the two — everything the prototype holds _includes_ the instants the
  home page's figures are computed from, so the home page loses nothing. A widening, not a
  softening.
- **Access.** Home said "can reach this page _and read every figure on it_"; the frame stopped
  at "can reach this page". **Neither is kept.** The clause now reads **"and read everything
  on it"**. The point of the clause is that access extends to what the page shows, not merely
  to the address. On the home page "everything on it" includes every figure, so nothing is
  dropped there; on the four section pages it is finally true, where naming figures was
  vacuous. Restoring the word "figure" would make the sentence false on four of the five pages
  that render it.

**What is shared is the text, not the markup or the styling.** Each page keeps its own banner
element, its own `data-testid` and its own CSS module — all eighteen ward modules declare
`.governanceBanner`, `.prototypeBadge` and `.notice` on their own root, and two of them
borrowing a nineteenth module's styling would have been the only exception in the directory.
What drifts is the wording, so the wording is what moved. The testids stay as literals at the
call sites, where a grep still finds them.

**Both sentences are now pinned whole on both sides.** `tests/ward-statistics.dom.test.tsx`
previously asserted `toContain("coordinator")`, `toContain("nothing in this prototype enforces
that")` and `toContain("no role check")` — all three survive deleting the very clause the fold
had to change. It now asserts normalised equality on the whole sentence, matching what
`tests/ward-statistics-sections.dom.test.tsx` already did. The identical string is pinned in
both files, so a shared edit fails on both sides and a page-specific edit fails on one.

## The gate

Discovered from disk, echoed, non-empty:

```
tests/ward-statistics.dom.test.tsx tests/ward-statistics.test.ts
tests/ward-statistics-derivations.test.ts tests/ward-statistics-sections.dom.test.tsx
tests/ward-statistics-sections.test.ts
```

- `npx tsc -p tsconfig.typecheck.json --noEmit` — exit 0, no output.
- `npx vitest run <the five above>` — **Test Files 5 passed (5), Tests 130 passed (130)**.
- `npx eslint` on the five changed/added source and test files — exit 0.
- `npx prettier --write` on the same set; the one file it reformatted
  (`statistics-screen.tsx`) is in the commit.

## Mutation proof of the module-driven assertion

Committed first, then mutated one character-range in the committed file:
`STATISTICS_SECTIONS.map(` → `STATISTICS_SECTIONS.slice(0, 2).map(` — i.e. exactly what a
hand-written index looks like once the module grows past it.

Three tests went red, and the messages were the predicted ones:

```
× renders exactly one entry per section, in the module's order
× takes every label and description from the module rather than restating them
× renders each href exactly as the module gives it, fragment and all
AssertionError: expected 2 to be 3 // Object.is equality
AssertionError: expected [ …(2) ] to deeply equal [ …(3) ]
AssertionError: expected [ …(2) ] to deeply equal [ …(3) ]
```

Restored by reversing the edit rather than by `git checkout --`, and proved by hash:

```
before  e4142b76b2a3cab41abbede3446e9f1fdd3e7257fa0b64db4207191e600ef52c
after   e4142b76b2a3cab41abbede3446e9f1fdd3e7257fa0b64db4207191e600ef52c
```

`git status --porcelain` empty afterwards, and the full five-suite run was repeated green
(130/130) on the restored tree.

The vacuity guard is deliberate: `expect(STATISTICS_SECTIONS.length).toBeGreaterThan(0)`
precedes the comparisons, so an emptied module could not make two empty arrays agree while
the index rendered nothing.

## Not mine, and not made worse

`tests/ward-landmarks.test.ts` is red (2 of 51) on this branch — its route-coverage map does
not yet include `/mockups/ward-flow/community` or the four statistics section routes. Another
chat owns that file and those routes. This commit touched six files, none of them under
`src/app/`, and added no route. `tests/ward-nav.test.ts` was not opened.

## What the brief got wrong

Nothing material. Two notes:

1. The brief says the index's third entry "has no single destination" and that it is "my call"
   whether to link it or describe it — but the second half then says to render whatever the
   module gives, and the module already resolves that by pointing the entry at the unit
   chooser with a fragment. There was no choice left to make; the copy states the general rule
   instead of a per-entry exception, which is what keeps it true if a fourth section arrives.
2. The brief warns that a literal `\b` in a test regex becomes a backspace byte. No `\b`
   appears in anything written here — the numeral guards use `/[0-9]/`, which has no escape at
   all.
