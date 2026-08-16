# The filter contract

Every searchable catalogue uses the typed filter system in
`src/components/clinical-dashboard/result-filter-control.tsx`. A mode declares the meaning of
its refinements and supplies one predicate; the shared system owns responsive presentation,
selection semantics, applied-state visibility and the result action.

## Responsive anatomy

- `ResultFilterTrigger` is pinned in `SearchResultsHeaderBand`, carries the active-refinement
  count and is available at every supported width.
- `ResultFilterSheet` is a bottom sheet on phones and a restrained right drawer from `sm` up.
  It owns the dialog label, focus trap and restoration, sticky header/footer, safe-area inset,
  reduced-motion behavior and 48 px phone / 40 px desktop action targets.
- The visible order is coverage, optional `Search in` scope, optional dense-filter search,
  groups, polite result summary, one primary result action, then an optional secondary reach
  action.
- More than three facet groups or more than twenty facet options enables dense mode: a
  find-a-filter field and collapse-by-default groups. Selected options remain reachable while
  searching.
- Callers use typed `summary`, `coverage`, `scope`, `secondaryAction` and
  `applicationMode`. Arbitrary caller-owned footer, meter and scope markup is not supported.

## Semantics

| Kind  | Meaning                                          | Selection                         | Component builder                     |
| ----- | ------------------------------------------------ | --------------------------------- | ------------------------------------- |
| Lens  | A one-of-N partition of the same result universe | exactly one                       | `resultFilterGroup()`                 |
| Facet | Values that may accumulate                       | many-of-N                         | `resultFilterFacetGroup()`            |
| Scope | Which result universe is searched                | exactly one, separate from groups | `ResultFilterScopeSelector` / `scope` |

Facets use OR within a group and AND across groups. Visual `optionSections` may organise a long
facet but never create additional AND groups. Formulation domains are the reference case: four
visual sections, one OR predicate.

Sort, display density, grouping, comparison state, suggested searches and Recently used views
are not filters. They do not increment the badge or appear on the applied-filter shelf. A
query-replacing suggestion is never placed in the filter panel. Answer has no artificial filter.

Lens groups expose radio semantics with roving tab focus and Arrow/Home/End selection. Facets
expose individually reachable pressed controls. Selected state always includes an icon and text;
colour or opacity is never the only channel.

## Scope

`Search in` is used only when a mode can meaningfully widen beyond the current query result set.
It is rendered as quiet, labelled radio cards with truthful counts and descriptions, not as a
generic segmented toggle. A non-default scope is an active refinement.

Current scoped modes are Services, Differential stream workspaces, Specifiers and Medication.
Documents has retrieval scope in the same panel but keeps **Browse all sources** as a separate,
query-preserving reach action rather than presenting corpus browsing as a refinement.

An explicit scope is respected even when it yields zero results. Specifiers may choose its
default from available guide matches only when the URL does not specify a scope.

## Counts and dead ends

Options and counts must come from the same predicate as the visible list. A projected facet count
answers “how many would be visible if I selected this too?”; adding another value to a facet group
therefore widens that group while the other groups remain applied.

Derive stable options from catalogue data. If another active refinement makes an option a dead
end, retain it as a focusable, dashed, muted control with `aria-disabled` and an explanation.
Selected values always remain removable, including at zero results. Do not hide a selected value
or disable it natively.

The footer summary counts only the rows governed by the panel. Documents additionally reports
`visible of retrieved matches`; it never compares local refinements with the whole corpus.
Faulted or untrusted catalogue reads must not assert a trustworthy count.

## Applied state and actions

Every hidden or multi-dimensional refinement is represented in the labelled `Filtered by` shelf.
`AppliedFilterChip` separates:

- `valueLabel`, compact enough for phones;
- `groupLabel`, restored on larger screens (for example `Risk: High`);
- `accessibleLabel`, the complete assistive label when the visible forms are not sufficient.

The shelf remains visible during loading and zero-result recovery. The actions are deliberately
distinct:

- **Remove** clears one value.
- **Reset filters** clears filter-owned state only.
- **Clear search** clears the query.
- **Browse all** widens reach while preserving the query.

Reset never clears `q`, comparison `ids`, group navigation or focus intent unless a mode-specific
contract explicitly owns that parameter.

## Live and staged application

Local catalogues apply filters live. Their footer action closes the panel while announcing the
current result count.

Documents uses `applicationMode="staged"`:

1. Opening the panel snapshots committed retrieval and local facet state into a draft.
2. Dismissing the sheet discards the draft.
3. **Update search** commits all draft changes together.
4. Retrieval/source changes schedule at most one retrieval with the committed scope.
5. Result type and local smart-tag-only changes commit without refetching.

Internal import batch IDs and mode-default label-type constraints are preserved through the merge
but are not clinician-facing options.

## URL contract

Stable catalogue filters use `src/lib/result-filter-url.ts`:

- multi-value parameters are comma-separated, deduplicated and sorted;
- defaults and empty selections are omitted;
- invalid values are ignored;
- unrelated parameters such as `q`, `ids`, `focus` and document `scope.*` state are preserved;
- repeated filter changes use replacement navigation so Back history is not polluted;
- Back/Forward hydration reads from the URL rather than from a second local copy.

Calculator progress and private/session-derived favourites state remain local. A mode must not
persist patient-profile or private clinical state in catalogue filter URLs.

## Mode matrix

| Mode                              | Filter contract                                                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documents                         | Staged selected-source and retrieval governance/locality controls, advanced clinical labels, result type and smart-tag facets; `resultType`/`facet` plus existing `scope.*`; query-preserving Browse all sources. |
| Services                          | Search in Current results / All services; Program type, catchment, age group, setting, acuity and housing; existing URL keys; no query-replacing suggestion rail.                                                 |
| Forms                             | Category, clinical risk and availability facets; `category`, `risk`, `availability`. Exact code matching, grouping and access behavior stay outside the filter predicate.                                         |
| Differentials                     | Combined All / Presentations / Diagnoses lens; stream scope, urgency, presentation/chapter and related-only refinements; grouping is a view control.                                                              |
| DSM Diagnosis                     | Category facets plus independent Has specifiers / Has differential guidance; comma-separated legacy-compatible `category` and `support`; comparison IDs preserved.                                                |
| Specifiers                        | Clinical guides / Full catalogue scope; guide Family/Diagnosis lenses; catalogue Category and Source-verified facets; filter before the progressive display limit.                                                |
| Formulation                       | One Domain OR facet organised into four visual sections; `domain`; pattern suggestions remain outside filters.                                                                                                    |
| Medication                        | Best matches / All medications scope, Match quality lens, Drug class facet and one Safety/Monitoring OR signal facet; patient safety presentation and ranking remain independent.                                 |
| Calculators / Therapy             | Existing predicates with typed summaries and the shared adaptive panel.                                                                                                                                           |
| Factsheets / Tools / Applications | Compact category lenses driven by one counted option source.                                                                                                                                                      |
| Favourites                        | Local Set and Type facets plus independent Pinned and Source-backed refinements; Recently used is a view/sort choice.                                                                                             |
| Answer                            | No narrowing dimension, therefore no filter control.                                                                                                                                                              |

## Verification obligations

Predicate tests cover OR/AND composition and projected counts. URL tests cover invalid values,
stable serialization, query preservation, reset and history hydration. Shared DOM tests cover
scope radios, visual sections, live/staged footer behavior, draft dismissal, focus restoration,
arrow navigation, dead ends, dense search and applied-chip labels.

Browser evidence covers phone, tablet and desktop opening, selection, removal, reset, zero-result
recovery, keyboard-only use, reduced motion and forced colours. Chromium emulation does not close
physical Safari or installed-PWA acceptance.
