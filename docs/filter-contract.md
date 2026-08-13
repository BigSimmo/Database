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

Services' quick filters do not filter. They call `router.push` and **replace the query**, so
choosing one discards the search and its results with no warning and no undo. A control labelled
"Filter" must not do that. Query-replacing presets belong beside the composer as suggested
searches (`AnswerSuggestionChips`), not inside the filter sheet.

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
`services-navigator-page.tsx`: the segment is gated on the catalogue exceeding the query/group
scoped result set (not the facet-narrowed one, so the segment does not flicker away as facets are
applied), and both counts reflect the current facet/lens selection.

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

Facet groups only. Thresholds match the rule documents already uses (`dense = groups.length > 3`).

| Options             | Renderer                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ≤ 5                 | chips, single row where they fit                                                                                                 |
| 6 – 20              | chips, same rendering as above — the group is still small enough on its own; it is the >3-groups tier below that adds the chrome |
| > 20, or > 3 groups | chips plus find-a-filter and collapse-by-default, per group                                                                      |

The `> 3 groups` tier lives directly in `ResultFilterSheet` (`result-filter-control.tsx`), not as a
second hand-rolled panel: a "Find a filter…" field appears once, above the groups, and every facet
group becomes a disclosure. Below the threshold every group renders exactly as it did before this
was added — formulation (one facet group) never crosses it, so its sheet is byte-for-byte
unchanged. Services (five facet groups) is the first mode to cross it.

This intentionally does not yet build the "full-width rows, right-aligned count column" list
layout an earlier draft of this section described for the 6–20 band — a group that size still
renders as wrapping chips, just collapsible. `document-search-results.tsx` keeps its own,
separate dense-list implementation (needle + collapse, chip rendering) for now; porting it up as
the shared `> 20` tier and converging both call sites is PR F's job, not this one's — see
"Rollout" below and `docs/outstanding-issues.md` `#170`.

Collapse rules, when they apply: groups start collapsed; a group holding a selection opens
itself; an explicit user collapse beats that; an active needle forces every matched group open
and owns openness. A selected option always survives the needle, so an active constraint can
never become unreachable. A group whose options are all filtered out by the needle disappears
rather than showing an empty heading.

## 6. Invariants

- **`footerNote` counts what the filters actually govern.** Specifiers currently reports
  `results.length + catalogueMatches.length` while the groups narrow only `results` — the sheet
  claims to scope a list it half controls. A mode must not report a total its filters cannot move.
- **`onClearAll` never touches the query.** Therapy-compass's clear wipes the search box; the
  shared sheet's does not. Clearing filters and clearing a search are different intentions.
- **One trigger component.** `ResultFilterTrigger`. Therapy-compass re-implements it with a
  different icon, a hardcoded test id and a different label-hiding breakpoint.
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
   applications, specifiers (all `lens`, PR A) and formulation (`facet`, PR B). Also done for
   factsheets: its category dimension was already a real `lens` (see the corrected note above),
   so this PR converges its desktop rail onto `SegmentedControl` sharing one counted option array
   with the phone sheet, rather than evicting anything — there was no query-replacing preset to
   evict.
   applications, specifiers (all `lens`, PR A) and formulation (`facet`, PR B). Also done for
   factsheets: its category dimension was already a real `lens` (see the corrected note above),
   so this PR converges its desktop rail onto `SegmentedControl` sharing one counted option array
   with the phone sheet, rather than evicting anything — there was no query-replacing preset to
   evict.
3. **Services** — evict the six query-replacing quick filters to the composer. Done for services:
   five facets (catchments, age_groups, setting_flags, acuity_flags, housing_flags),
   substance_flags as a lens (an exact partition, not an accumulating constraint — see
   `src/lib/service-facets.ts`), a URL round-trip alongside `q`/`group`, and the scope segment
   (section 4). Services is also the first mode dense enough (5 facet groups) to exercise the
   `> 3 groups` chrome added to the shared sheet for this — see section 5.
4. **Documents last** — port its needle and collapse up into the shared component as the
   `> 20` tier, then converge. It is the largest surface and should move once the contract is
   proven elsewhere.
