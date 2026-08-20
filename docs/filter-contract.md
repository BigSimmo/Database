# The filter contract

One filter surface, shared by every mode. This is the rule set; the component is
`src/components/clinical-dashboard/result-filter-control.tsx`.

It exists because an audit of all ten filter surfaces in 2026-08 found the same dimension
rendered three different ways, two modes whose "filter" discarded the search instead of
narrowing it, and a mode whose footer counted items its filters did not govern. The fix is not a
restyle — it is agreeing on what a filter group _means_ before deciding how it looks.

## 1. A mode declares semantics, never a layout

`ResultFilterGroup` is discriminated by `kind`. The mode says what the dimension is; the
component decides the renderer. No call site picks chips, rows or a segmented control.

| Kind             | Meaning                                                         | Selection                         | Built with                 |
| ---------------- | --------------------------------------------------------------- | --------------------------------- | -------------------------- |
| `lens` (default) | The options **partition** the result set; exactly one is active | one-of-N                          | `resultFilterGroup()`      |
| `facet`          | Independent constraints that accumulate                         | many-of-N, OR within / AND across | `resultFilterFacetGroup()` |

`kind` is optional and defaults to `lens`, because that is what all seven existing call sites
are. Adding the facet kind changed no rendered output.

**Which is which is a question about the data, not the UI.** Differentials'
All / Presentations / Diagnoses is a lens: a result cannot be both. Formulation's twelve domains
are facets: a mechanism routinely carries four. Rendering facets as radios — which formulation
does today — tells the reader they cannot hold two domains at once, which is false.

### There is no `navigate` kind, and that is the point

Services' former quick filters did not filter. They called `router.push` and **replaced the
query**, so choosing one discarded the search and its results with no warning and no undo. A
control labelled "Filter" must not do that. Moving those presets beside the results as suggested
searches still made a second search-navigation row compete with the result hierarchy, so the
production Services route removes them entirely. The separate service-group strip moves into the
sheet as the real, URL-backed **Service category** facet: its four categories overlap, so they use
OR-within multi-selection rather than pretending to be a one-of-N lens.

Factsheets' category dimension is not this pattern, despite an earlier draft of this section
grouping it with services' quick filters: `filterFactsheets(query, category)` ANDs the two, so
selecting a category narrows within the current search and preserves `q` — it is a real `lens`
(one-of-N, exactly the shape this section describes above), not a query-replacing preset. Its
actual defect was the one section 2 names next: the desktop rail used raw `<Link>` chips while
the phone sheet correctly used `resultFilterGroup`, so the two breakpoints disagreed on
component even though they agreed on values. Converged, not evicted — see the Rollout section.

Until a mode has real facets, it is better for its filter trigger to be absent than to open a
sheet that throws the query away.

## 2. Accessibility follows from the kind

|            | `lens`                          | `facet`        |
| ---------- | ------------------------------- | -------------- |
| Container  | `role="radiogroup"`             | `role="group"` |
| Option     | `role="radio"` + `aria-checked` | `aria-pressed` |
| Tab stops  | one per group, roving tabindex  | one per option |
| Arrow keys | move **and select**             | not bound      |

The single tab stop is correct for a lens precisely because arrowing _replaces_ the selection.
It would be wrong for a facet, where arrowing would silently accumulate constraints the reader
never asked for, and where every toggle must be individually reachable.

Both breakpoints use the same contract. The per-mode desktop chip rails that use `aria-pressed`
for one-of-N dimensions are wrong and are replaced as each mode adopts.

## 3. Counts, and the rule that makes them safe

A count goes in `option.hint` and answers **"how many would I have if I ticked this as well?"** —
the same predicate as the filter. Under OR-within-group, adding an option to an already-selected
group _widens_, so a count derived by narrowing the current subset would disagree with what the
click actually does. `projectSmartTagFacetGroups` in `src/lib/document-tags.ts` is the reference
implementation.

That contract has one failure mode: an option that matches nothing reports the unchanged total
rather than zero, so an empty option looks identical to a full one. The companion rule removes
the failure rather than patching it:

> **Derive the option list from the data. Never declare it.**

Formulation declares twelve domains; three of them — Biological, Social and Cultural — match
none of the twelve mechanisms, so the sheet offers three controls that can never return anything.
Documents derives its facets from the current match set, so a zero-member facet cannot exist.
Derive, and the union count is always safe.

A zero **as a consequence of the current selection** is legitimate and must stay visible: dashed
border, muted pair, `aria-disabled`, click guarded, still focusable, with an `sr-only` reason.
Never `opacity` — it multiplies against an already-muted foreground and does not survive
forced-colors, where border-style is preserved. A reader who has narrowed to nothing needs to see
which choice did it.

## 4. Scope is conditional, and most modes do not get it

Where a mode has a catalogue meaningfully larger than the current result set, the sheet offers a
scope segment — `These results N | All items N`, counts on both — built from the shared
`SegmentedControl` (`src/components/ui/segmented-control.tsx`), which already has the roving
tabindex and radio semantics. `ResultFilterSheet` reserves the slot (`scopeControl`) but does not
build the segment itself: "meaningfully larger" and what the two counts mean are per-mode
judgements the shared renderer cannot make. Services is the first mode to use it — see
`services-navigator-page.tsx`: the segment is gated on the catalogue exceeding the query-scoped
result set (not the facet-narrowed one, so the segment does not flicker away as facets are applied),
and both counts reflect the current category/facet/lens selection.

It earns its place because it is the only escape from a filtered-to-zero state that does not
discard the query: the commit becomes "Show N in all items" instead of a dead end.

**Render it only when the catalogue is meaningfully larger than the result set.** Otherwise the
two segments show the same number and the row is noise.

| Gets scope                                                              | Does not                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| services (219), medication (328), differentials (232), specifiers (585) | factsheets (8), applications (13), formulation (12) |

Documents is deliberately excluded: it already answers this with a `N of M documents shown` meter
and a "Browse all sources" action framed as _reach, not refinement_. That is a better fit for a
corpus of that size, and it stays.

## 5. Density is a function of option count

Facet groups only. Density scales with option and group volume across three tiers:

| Options / Groups                | Renderer                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| ≤ 5 options, no counts          | chips, single row / wrapping chips                                                     |
| 2–5 options **carrying counts** | the row renderer below, in a two-column grid                                           |
| 6–20 options                    | dense full-width vertical list with right-aligned count column and group headings      |
| > 3 groups, or > 20 options     | list/chips plus find-a-filter and collapse-by-default, every group behind a disclosure |

`ResultFilterSheet` computes the threshold across facet groups. Facet groups containing 6–20 options
render as compact full-width rows with a right-aligned count column for fast scanning. When a sheet
exceeds 3 groups or 20 total options, it additionally adds find-a-filter and collapse-by-default chrome.

**A counted chip is not a chip.** A two-to-five-option group whose options carry counts uses the same
row renderer as the 6–20 tier, laid out in two columns. A chip carrying a count is wide enough that
four of them wrap one per line and leave most of each row empty — documents' Source status (4) and
Clinical validation (3) were exactly that, a ragged single column down a phone sheet. Two columns
halve the height and align the counts. A group with no counts keeps the wrapping chip row, which is
still the right renderer for short bare labels.

**`hint` is announced, `hintLabel` is displayed.** `hint` carries the unit (`"1 loaded source"`) and
is what the option's accessible name is built from; `hintLabel` is the short visible form (`"1"`).
Set both when a count has a unit — spelling the unit into every visible option is what made the
counted rows too wide to sit two-up in the first place. `hintLabel` alone is never enough: the
announced name must keep the unit.

Collapse rules, when they apply: groups start collapsed; a group holding a selection opens
itself; an explicit user collapse beats that; an active needle forces every matched group open
and owns openness. A selected option always survives the needle, so an active constraint can
never become unreachable. A group whose options are all filtered out by the needle disappears
rather than showing an empty heading.

## 6. Invariants

- **`footerNote` counts what the filters actually govern.** Specifiers currently reports
  `results.length + catalogueMatches.length` while the groups narrow only `results` — the sheet
  claims to scope a list it half controls. A mode must not report a total its filters cannot move.
- **`onClearAll` never touches the query.** Clearing filters and clearing a search are different
  intentions. Therapy-compass now uses the shared sheet's filter-only clear; the composer's
  explicit "Clear search" action remains responsible for deleting the query.
- **One trigger component.** `ResultFilterTrigger`. Therapy-compass now uses the shared trigger
  at the phone breakpoint and the shared facet chips on desktop.
- **Tap targets are `min-h-tap` (48px) on phone.** Do not relax to 44px for generic WCAG
  guidance; it reintroduces a known `ui-smoke` flake.

## 7. Not yet reconciled

`SearchScopeFilters` (`src/lib/search-scope.ts`) is a second filter surface: 20 keys applied
server-side at retrieval, not editable from any panel, visible only as removable chips in the
documents zero-results state. Anything here that claims to be "the" filter contract is currently
telling half the story. Reconciling the two is tracked separately and is not a prerequisite for
adoption.

## Rollout

Contract first, then one PR per mode:

1. **Contract** — add the kinds, the facet renderer and the builders, changing no rendered output.
2. **Per mode** — adopt the right kind, derive the option list, add counts, and retire that mode's
   desktop rail so the breakpoints stop disagreeing. Done for differentials, medication,
   applications and specifiers (all `lens`), formulation (`facet`), and factsheets, whose real
   category lens now shares one counted option array between desktop and phone.
3. **Services** — remove its query-replacing quick filters instead of presenting them as filters or
   a competing suggestion row. Done for services: Service category plus five catalogue facets
   (catchments, age_groups, setting_flags, acuity_flags, housing_flags),
   substance_flags as a lens (an exact partition, not an accumulating constraint — see
   `src/lib/service-facets.ts`), a URL round-trip alongside `q`, and the scope segment (section 4).
   Services is also the first mode dense enough (6 facet groups) to exercise the
   `> 3 groups` chrome added to the shared sheet for this — see section 5.
4. **Therapy-compass** — converge runtime use of the bespoke phone-only filter sheet and trigger
   onto `ResultFilterSheet`, `ResultFilterTrigger`, and `ResultFilterFacetChips`. Topics are OR
   within their group. Review status and handout availability are independent one-option groups
   that AND with Topics and with each other. Option counts and filtering share
   `matchesTopics`/`matchesAvailability`, and Clear filters preserves the query.
5. **Documents last** — converged onto the shared component. Its needle and collapse-by-default
   mechanics moved up into `ResultFilterSheet` first, as part of services (§5); documents itself
   deleted its ~500-line bespoke `DocumentFilterPanel` and rebuilt on `ResultFilterSheet` with
   three small additive extensions the other six modes never needed:
   - `meterContent` — the `N of M documents shown` progress bar, rendered first in the body.
   - `footerOverride` — replaces the default `footerNote` + Done button entirely, for a mode whose
     commit needs its own label (`Show N documents`) and a second action beside it
     (`Browse all sources`).
   - `note` on `resultFilterGroup()` — a short label-adjacent annotation (`"one only"`) that
     distinguishes a `lens` group from the `facet` groups sitting beside it in the same sheet.
     Source type is the first lens to share a sheet with facets; services' `substance` lens beside
     five facet groups (PR C) has the identical shape without this annotation — a follow-up worth
     tracking, not a contradiction this PR resolves. The annotation is scoped to documents' call
     site for now, not a general convention.

   All three are optional and default to inert — the six modes that adopted earlier render
   byte-identical output. This closes the rollout: every filter surface in the audit now shares
   one component.
