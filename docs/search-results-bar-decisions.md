# Search results bar — decisions

The shared results bar is `SearchResultsHeaderBand`
(`src/components/clinical-dashboard/search-results-header-band.tsx`). All twelve
`results-band` modes render it (every searchable mode except answer), so a change
there lands everywhere at once. This file records the decisions that are easy to
reverse by accident — each was reached by checking what the app actually does, not
what the surface looks like it should do.

Composer placement, phone dock reserves, and hide/reveal behaviour are a different
contract: see [search-chrome-behaviour.md](search-chrome-behaviour.md).

## Anatomy

- **One line, and a lead rule instead of a full-width border.** The band was 123 px on a
  phone to say "12 documents", because the utility rail dropped to its own row and that row
  was ~85% empty. It is now 58 px (60 px from `sm`), and the accent is a 2 × 18 px mark
  inside the padding rather than a line across the whole width — at bar height that line
  read as a divider between the composer and the results rather than as the band's own
  accent. The mark is a `border-left` on a zero-width box, not a background: forced colors
  drops backgrounds and maps border colour to `CanvasText`, and `border-style: double` is
  what keeps the faulted state structural there.
- **State is still shape, not only colour** — the rule the deleted state tile existed to
  hold. The tile carried three jobs and only one needed a tile. _Narrowed_ is now carried
  by the shelf itself: applied filters grow the band by a whole labelled row, which is a
  louder signal than a funnel swapped into a 40 px square. _Running_ was already inline —
  a spinner and the word "Searching…" inside `role="status"`. _Faulted or partial_ is the
  one that would have regressed to hue alone, so it keeps three independent non-chromatic
  channels: the lead rule doubles from one stroke to two, a `CircleAlert` renders before
  the count for non-`ready` states only, and a faulted band renders no digit at all
  (`countUntrusted`). Do not reduce these to a colour swap; under forced colors
  `--clinical-accent` resolves to `LinkText` and `--warning` is not remapped at all, so hue
  cannot carry state there even in principle.
- **Nothing on the bar is reachable only by horizontal scroll.** Only the optional controls
  (sort, view, save, page utilities) sit in the scrolling track. Filter and Retry are
  pinned siblings outside it — Filter because it is the only control carrying state, Retry
  because it is the recovery action in a degraded state. Before this, Filter was the
  track's last child and so the first control to fall off the right edge once a mode added
  anything.
- **A full-width phone control keeps its own row.** `mobileControlsPlacement` defaults to
  `row` whenever a page passes `mobileControls`, because six modes pass a `w-full`
  `MobileResultFilterControl` (formulation and specifiers pass _two_, in a two-column grid)
  and pinning one of those into a 58 px line at 320 px makes it unreadable. Documents and
  therapy-compass pass a compact badged trigger and opt in with `inline`. The default is
  the safe one on purpose: a new mode that forgets the prop degrades to today's layout
  rather than to an unusable one.
- **Filter at the right edge, Sort inboard.** Sort is set about once a session. Filter is
  the only control carrying state and the one returned to repeatedly, and on a phone the
  right edge is where the thumb already is. The page filter is therefore the utility
  rail's **last** child; `tests/ui-tools.spec.ts` asserts that placement and a matched
  phone tap height, rather than the Sort/Filter adjacency it asserted before.
- **The shelf.** A labelled `Filtered by` row under the bar, one tap to remove each
  filter, trailing `Clear` once more than one is applied. The chips scroll in an inner
  track; the label and `Clear` are pinned outside it, because the shelf was one
  `overflow-x-auto` row and four or five chips pushed its only global action past the right
  edge — the same defect the shelf was built to avoid for the chips themselves. `Clear` is
  matched to the chips at the tap floor rather than kept small; it stays quiet through
  weight and an underline. The label is a funnel glyph below `sm` and the wordmark from
  `sm`: a prefixed chip costs ~215 px of a 350 px bar, so every character the label spends
  is a chip the reader cannot see. Either form is decorative — the group keeps
  `aria-label="Applied filters"`. The label matters: without it a
  row of accent pills reads as a second bank of buttons rather than as state. It
  deliberately survives `loading` and a zero-result set — nothing matching is exactly when
  a filter needs relaxing, and dropping it mid-search would flicker the chips out and back
  on every keystroke. Only a fault removes it, because filtering a result set that never
  loaded is meaningless.

## The shelf is scoped to two modes, on purpose

`documents` and `therapy-compass` only. Both have multi-valued filters hidden behind a
panel, so what is applied is not otherwise visible. Of the other ten results-band modes:

- Differentials, prescribing, specifiers, formulation, services, and factsheets keep a
  single-select dimension whose control is already on screen, so a shelf would restate it.
- Forms still ships a Filter trigger whose panel is a coming-soon placeholder, not applied
  filter state, so there is nothing for a shelf to show.
- Favourites renders its own active-filter chips inside `filterControls` rather than the
  shared shelf props.
- DSM filters by category through navigation links, and tools through a single category
  select — neither passes `appliedFilters`.

Two traps met while drawing that line:

- **Count what a control does, not how many there are.** Formulation's "Pattern" and
  factsheets' "Category" look like filters and are navigation (`router.push`). Services'
  "quick filter" rewrites the query. None of them belong behind a filter surface.
- **A shared component must not read filter state from context.** The original shelf
  pulled `commandScopes` from a context that no page populated. It passed a DOM test which
  constructed that context by hand, and rendered for nobody in production. The replacement
  is prop-driven — the page supplies `appliedFilters` (`id`, `label`, `onRemove`) and an
  optional `onClearFilters`. Keep it that way.

## Deliberately not done

- **The library button does not go back on the rail.** _(Amended: it was on the rail until
  the one-line redesign; the reasoning below is why it moved rather than was deleted.)_
  Corpus browsing does not belong in nav here: the documents action menu routes through
  `onSearchModeChange`, which calls `setQuery("")` and `setModeSearchSubmitted(false)`
  (`ClinicalDashboard.tsx`), so reaching the library that way discards the search being
  read. It therefore needs an in-context route that preserves the query — but that route
  did not have to be the utility rail, where it sat adjacent to Filter while answering a
  different question (Filter narrows what this query returned; Library opens the whole
  corpus), made the old name read as a second filter, occupied the space the pinned Filter
  needs, and was the sole reason the phone rail could overflow at all. It now has two
  in-context homes that both preserve the query: the filter sheet's footer, under a rule
  and phrased as reach with the corpus count beside it, and the zero-result state. Do not
  delete either without giving nav a query-preserving route first.
- **Sort does not move into the phone filter sheet.** Only documents and therapy-compass
  currently have phone filter sheets (`Filter documents` / `TherapyFilterSheet`). Of the
  four production `onSortChange` consumers, documents already pairs Sort with a sheet;
  therapy has a sheet but no Sort. Moving Sort into the sheet from the shared band would
  remove Sort from phones in the three sheetless Sort consumers — differentials, forms,
  and services — the exact defect an earlier round fixed. If this is ever wanted it is
  per-page work on those consumers, not a shared-band change.
