# Task 2 — the hub index on the statistics home page

**Do not start this until BOTH are true:** Task 1 has committed `statistics-sections.ts`, and the
constant-gap implementer has committed its changes to `statistics-screen.tsx` and
`tests/ward-statistics.dom.test.tsx`. Until then those two files carry another agent's uncommitted
work and editing them destroys it.

## What to build

The statistics home page at `/mockups/ward-flow/statistics` is currently a single screen of
figures. Make it also the **hub** the owner asked for: a friendly index, above the existing
figures, with one entry per section.

Render the index from `statistics-sections.ts` — the module Task 1 created. **Do not restate the
section names, hrefs or descriptions in the screen.** One place per fact; that module is the place.

Each entry is a `<Link>` carrying the section's label and its one-line description. The two
per-unit sections (`ward/[unitId]`, `ed/[edId]`) have no single href, so the index either links to
a chosen example unit or presents them as described-but-not-linked — **your call, but say in the
copy which it is.** A link that silently goes nowhere is worse than a described section.

## What NOT to do

- **Do not move the existing figures off this page.** That is a content migration and it is
  explicitly out of scope; a ruling in the ledger records why. The figures stay exactly where they
  are and keep every one of their `data-testid` attributes unchanged.
- **Do not add a figure, a count, or a number of any kind to the index.** Not "3 sections", not a
  per-section item count. The index is navigation.
- Do not touch `ward-nav.ts` or `tests/ward-nav.test.ts` — another chat owns both.

## Constraints that bind

Global Constraints 1, 4, 5, 6, 7, 8 and 9 from
`docs/superpowers/plans/ward-statistics-skeleton.md` apply unchanged. In particular: design tokens
only, `<Link>` never a raw anchor, no invented figures, and the phone-bar reserve below 40rem.

## The gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx | tr '\n' ' ')
```

Derive the file list from disk as shown — do not name test files by hand. Every existing test must
still pass: the home page's figures are reviewed work with two closed Critical findings behind
them, and a broken `data-testid` there is a regression, not a rename.

Add a test proving the index renders **one entry per section in `statistics-sections.ts`**, driven
by the module rather than by a hand-written list — so a section added later either appears or
fails, and cannot be silently missed.

`tests/ward-nav.test.ts` is already red on this branch for a reason another chat owns. Do not edit
it and do not treat it as your failure.

---

## Added after the skeleton and the audit landed — read this half too

### The disclaimer fold is now harder than "delete one copy", and that is the point

The two copies have **already diverged**, in both sentences:

- Banner — `statistics-screen.tsx` "…every instant **they are computed from** is invented" vs
  `statistics-section-frame.tsx` "…every instant **this prototype holds** is invented".
- Access — `statistics-screen.tsx` "…can reach this page **and read every figure on it**" vs
  the frame's "…can reach this page."

Both divergences are defensible: the section pages compute nothing and show no figures. **So you
cannot fold by deleting a copy — you must choose wording true of BOTH a page with figures and a
page without.** The DOM tests assert substrings only, so a fold that silently drops a clause passes
green. Whatever you write, pin the WHOLE sentence in the assertion, not a fragment.

If you conclude the two should stay separate, that is an acceptable answer — say so and say why,
and make the doc comment carry the reason. A deliberate duplication with a written reason is
better than a fold that quietly weakens a disclaimer.

### The index's third entry has no single destination

`ward/[unitId]` and `ed/[edId]` are dynamic. The section module points the third entry at the unit
chooser on the comparisons page via a fragment. **Render whatever the module says — do not
hand-write a destination.** If the fragment is missing from the href you render, the reader lands
at the top of a page that opens with two sections about why no comparison exists and has to scroll
to find the list. A previous round fixed exactly that in four other places.

### Do not add a count

Not "3 sections", not a per-section item count, not a badge. This page withholds figures it cannot
support; an index that counts itself invites the reader to read every number on the page as
measured. The index is navigation.

### The home page's own figures are reviewed work — do not disturb them

Two closed Critical findings sit behind them and a third was found by audit after that. Every
existing `data-testid` on this page stays exactly as it is. If you need a new one, add it; never
rename one.
