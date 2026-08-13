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

- **One line from 414 px, and a lead rule instead of a full-width border.** The band was
  123 px on a phone to say "12 documents", because the utility rail dropped to its own row
  and that row was ~85% empty. It is 58 px (60 px from `sm`) wherever one line actually
  fits, and the accent is a 2 × 18 px mark inside the padding rather than a line across the
  whole width — at bar height that line
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
- **The query yields, never the controls.** The inline utilities group is `shrink-0`. It
  shipped as `shrink`, so an over-subscribed line paid the shortfall out of both the query
  _and_ the controls: the sort group was severed by the track's `overflow-x-auto` and its
  trailing option was then washed out by the 28 px overflow mask, which reads as a
  rendering fault rather than as "swipe for more". Measured on the live app: clipped at
  320/375/390/393/402 and 430/440 px, and by 41.9 px at **540 px** with a four-word query —
  so this was never bounded by phone width. `truncate` + `min-w-[2rem]` on the query
  heading already exist to absorb exactly this. Below 414 px one line cannot hold count +
  query + sort + filter even with the query fully truncated, so the utilities take their
  own full-width row there rather than overflow a band that is `overflow-hidden` and would
  clip the pinned Filter. `ui-smoke` asserts the rail fits as geometry, not as a class —
  the class that caused this read as correct, and `expectNoPageHorizontalOverflow` cannot
  see an internal scroller.
- **A control composed from a shared recipe must not rely on override order.** `cn` is a
  plain join, not tailwind-merge. `DocumentFilterTrigger` was `floatingControl` plus an
  override string, so every contradictory utility reached the DOM and stylesheet order —
  not intent — picked the winner. `text-sm`/`text-xs` and the two `shadow-*` happened to
  resolve the way the override wanted; `font-semibold` (600 against the sort group's
  470/560) and `--border-lux` (a visibly darker stroke than `--border`) never did, so the
  one control sitting flush against the sort group rendered as a different component. It
  now uses the band's own control recipe — the same string `Save search` and `Retry` use —
  with the active/resting colours as mutually exclusive branches.
- **Every mode's phone filter is now the badged trigger, not a select.** The `w-full`
  native select is gone from all seven surfaces that shipped one — differentials, services,
  factsheets, prescribing, the tools launcher, and formulation and specifiers, which each
  passed _two_ in a two-column grid. Each now passes one `ResultFilterTrigger`
  (`result-filter-control.tsx`) with `mobileControlsPlacement="inline"`, so the one-line
  band is universal rather than a documents/therapy-compass exception. What the select cost:
  a whole second band row; no way to say how many filters were active without spending
  label width on it; and, because the iOS anti-zoom rule pins every native select to 16 px
  below `sm`, a value rendered at the same size as the query heading above it. Single-choice
  dimensions moved into `ResultFilterSheet`, one `role="radiogroup"` per dimension — real
  radio semantics, because these are one-of-N and an `aria-pressed` bank asserts otherwise.
  Documents keeps its own panel; multi-select facet groups with counts, a find-a-filter
  field and collapse-by-default are not radios.
- **`mobileControlsPlacement` still defaults to `row`.** Nothing relies on that fallback
  now that every caller passes `inline`, and it stays anyway: a new mode that forgets the
  prop, or one with a genuine reason to hand over something full-width, should degrade to a
  second row rather than to an unreadable 58 px line at 320 px. Do not flip the default.
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
  single-choice dimension whose desktop control is already on screen, and whose phone
  trigger carries a count badge, so a shelf would restate what is visible either way.
- Forms still ships a Filter trigger whose panel is a coming-soon placeholder, not applied
  filter state, so there is nothing for a shelf to show.
- Favourites renders its own active-filter chips inside `filterControls` rather than the
  shared shelf props.
- DSM filters by category through navigation links, and tools through a single category
  dimension — neither passes `appliedFilters`.

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
  corpus), made the old name read as a second filter, and occupied the space the pinned
  Filter needs. _(Amended: this also claimed it was "the sole reason the phone rail could
  overflow at all". That was measured wrong — with Library gone the rail still overflowed at
  every common phone width, and at 540 px with a longer query. See "The query yields, never
  the controls".)_ It now has two
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
