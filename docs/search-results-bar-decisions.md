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

- **State tile.** Carries state as shape, not only colour: alert when the search faulted or
  returned partial results, spinner while one is running, funnel once the result set is
  narrowed, magnifier otherwise. The funnel is driven by `appliedFilters.length`, the same
  data the shelf reads, so a filtered list looks different from an unfiltered one before
  any text is read.
- **Filter at the right edge, Sort inboard.** Sort is set about once a session. Filter is
  the only control carrying state and the one returned to repeatedly, and on a phone the
  right edge is where the thumb already is. The page filter is therefore the utility
  rail's **last** child; `tests/ui-tools.spec.ts` asserts that placement and a matched
  phone tap height, rather than the Sort/Filter adjacency it asserted before.
- **The shelf.** A labelled `Filtered by` row under the bar, one tap to remove each
  filter, trailing `Clear` once more than one is applied. The label matters: without it a
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

- **The library button stays in the bar.** The argument for removing it is that corpus
  browsing belongs in nav. In this app the documents action menu routes through
  `onSearchModeChange`, which calls `setQuery("")` and `setModeSearchSubmitted(false)`
  (`ClinicalDashboard.tsx`) — reaching the library that way discards the search being
  read. The bar button is the only in-context route, and is named after what it opens
  (`Library` / `Open source library`). Do not remove it before nav has a route that
  preserves the query.
- **Sort does not move into the phone filter sheet.** Only documents and therapy-compass
  currently have phone filter sheets (`Filter documents` / `TherapyFilterSheet`). Of the
  four production `onSortChange` consumers, documents already pairs Sort with a sheet;
  therapy has a sheet but no Sort. Moving Sort into the sheet from the shared band would
  remove Sort from phones in the three sheetless Sort consumers — differentials, forms,
  and services — the exact defect an earlier round fixed. If this is ever wanted it is
  per-page work on those consumers, not a shared-band change.
