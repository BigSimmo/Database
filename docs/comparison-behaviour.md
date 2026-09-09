# Comparison behaviour

This is the shared interaction contract for side-by-side comparison surfaces. It standardises
selection, state, navigation, and accessibility without standardising the clinical fields or the
meaning of a comparison.

Dictionary (`/dictionary/compare`) is the **selection interaction** reference: empty-first slots,
a catalogue search sheet (phone sheet / desktop inline panel), starter chips, shareable URL,
Done/Reset, duplicate blocking, and focus return. Specifiers, Formulation, DSM, Therapy Compass,
and Differentials reuse that picker primitive (`src/components/compare/`). They do **not** share
comparison tables, field rows, or clinical copy — those stay mode-owned.

Services Navigator remains a content/shortlist reference, not a catalogue compare route. Therapy
Compass remains a content reference for multi-column field tables. New comparison work should reuse
the Dictionary picker behaviour before introducing another interaction model.

## Selection contract

- Comparison is always an explicit user action. A mode may suggest or initially select likely
  candidates, but every selected item remains visibly removable before comparison begins.
- Zero selected items shows an instructional empty state. One selected item asks for one more.
  Two or more enables the comparison action. The mode owns any upper limit and states it before
  the limit is reached and when an add is refused.
- Selection controls state both actions: `Add <item> to comparison` and `Remove <item> from
comparison`. Selected state is visually apparent and exposed with the appropriate native or
  ARIA state.
- Selection contains stable item identifiers, never copied clinical records. Remove identifiers
  that no longer exist in the active result set or authorised catalogue.
- A query, mode, organisation, or authenticated-user change must not silently carry selections
  into a different scope. Clear them unless the surface has a deliberate, tested, shareable URL
  contract for that exact scope.

## Entry and exit

- The compare affordance includes the current selected count. While fewer than two items are
  selected it is disabled or rendered as an explicit instructional action; it is never inert.
- Desktop placement belongs near the selection controls or summary rail. On phones, a docked or
  composer-adjacent action is allowed only when its owner and content reserve follow
  `search-chrome-behaviour.md`.
- Opening comparison preserves enough context to return to the originating results. Removing an
  item in comparison updates the originating selection if both views share client state.
- A clear-all action is available once anything is selected. It is disabled at zero and does not
  delete, mutate, or hide source records.

## Comparison states

- With two or more items, align equivalent fields so a user can scan one field across all items.
  A narrow viewport may use a labelled stacked layout or horizontal scrolling; it must not reorder
  an item's fields or detach values from their item and field labels.
- Loading or background refetch preserves the last authorised comparison and labels it as
  refreshing. An identity or comparison-scope change clears it synchronously before new data is
  requested.
- Missing, unknown, not applicable, and failed-to-load are distinct states. Do not render a blank
  cell where the distinction affects interpretation.
- Source, review, freshness, or confidence context stays attached to the item or field it qualifies.
  A summary may highlight differences, but it must not replace the underlying source context.
- Copy, print, and share actions operate only on the visible selected set and are disabled until the
  set is valid. Shared URLs must validate every identifier and apply the same access checks as the
  underlying record routes.

## Mode-owned content

The shared contract does not define comparison fields, clinical recommendations, rankings,
thresholds, evidence weighting, or generated prose. Each mode owns those through its existing data,
governance, and safety contracts. Adding a new comparison surface must document:

1. the record type and stable identifier;
2. the minimum and maximum selection count;
3. when selection is cleared or restored;
4. the field order and missing-value semantics;
5. source/review context and any clinical owner;
6. phone layout, keyboard order, and return path; and
7. focused tests for zero, one, valid, over-limit, stale-record, and identity-change states.

Do not create a shared clinical comparison component until at least two modes use the same field
semantics. Shared selection helpers or layout primitives are acceptable when they preserve each
mode's content ownership.

## Catalogue picker (Dictionary interaction)

`src/components/compare/` is the shared picker: labelled slots, local filter input (not `SearchField`),
phone `Sheet` / desktop inline panel, starter chips, live-region announcements, and URL commit helpers
(`pairCompareHref` / `idsCompareHref`). In-sheet search is a local filter. Record-page Compare links
may pre-fill one slot and open the picker on the rest. Deep links stay valid.

| Mode            | Record    | Min / max                | URL               | Starter chips                                              |
| --------------- | --------- | ------------------------ | ----------------- | ---------------------------------------------------------- |
| Dictionary      | Term      | 2 / 2                    | `?a=` `&` `?b=`   | MSE vs MMSE; delirium vs dementia; mood vs affect          |
| Specifiers      | Specifier | 2 / 2                    | `?a=` `&` `?b=`   | Anxious distress vs mixed; melancholic vs atypical         |
| Formulation     | Mechanism | 2 / 2                    | `?a=` `&` `?b=`   | Rumination vs worry; avoidance vs shame                    |
| DSM             | Diagnosis | 2 / 3                    | `?ids=`           | MDD vs bipolar II vs PDD (chips, not an auto-filled table) |
| Therapy Compass | Therapy   | 2 / 4                    | `?ids=`           | CBT vs ACT                                                 |
| Differentials   | Diagnosis | 1+ queue, then workspace | `?ids=` `&` `?q=` | Delirium vs dementia; intoxication vs withdrawal           |

Swap is only offered when exactly two slots are filled. Medications and Tools have no compare route.
Do not add a second page composer on compare routes.
