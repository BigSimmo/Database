# Clinical KB design system — ADOPTION (PR 13 / PR-J step 0 registration)

**The committed contract every adoption commit codes against.** Nothing may be adopted before
this file exists; every surface below adopts against the allowlist recorded here, and a diff
that touches a file outside its surface's allowlist is rejected whole rather than trimmed.

- **Date:** 2 August 2026 · branch `claude/ds-v2-adopt`
- **Base:** `origin/main` at `706607014` (PR-Arch squash `62dfa3490` is an ancestor)
- **Phase 1 blockers resolved first, in their own commits:** `#207` ungrounded `AnswerState`,
  `#208` clipboard composition. See [SPEC.md](SPEC.md) §13 PR 6 clinical review, blockers 1–2.
- **Companions:** [SPEC.md](SPEC.md) · [COMPONENTS.md](COMPONENTS.md) ·
  [DECISIONS.md](DECISIONS.md) · [GATES.md](GATES.md) · [TOKENS.md](TOKENS.md)

**Registration means** a component has a proof surface and is product-ready — not that it
exists on disk. COMPONENTS §0.1 lists 28 already-registered components; §0.2 lists what is
built but unregistered. A surface may only import a component that is registered by the time
that surface's commit lands.

---

## 1 · Adoption order

Six surfaces, in this order, one commit each, each commit carrying **its own test-pin flips**
so a surface stays a single revert unit:

| #   | Surface           | Owner                     |
| --- | ----------------- | ------------------------- |
| 1   | forms             | Builder A                 |
| 2   | headers           | Builder A                 |
| 3   | catalogues        | Builder B                 |
| 4   | docs              | Builder B                 |
| 5   | source provenance | **controller only**       |
| 6   | answer            | **controller only, last** |

SPEC §13 names the shorter list — isolated form → page header and actions → source-provenance
→ answer last. The six-surface list is a deliberate expansion of it, not a contradiction:
catalogues and docs are separated out because they own distinct route families and distinct
pins. Provenance before answer, and answer last, are unchanged from SPEC.

**Provenance and answer are never delegated.** Source rendering and answer output are both on
the repo's clinical-risk list, and the answer surface is the reason this wave is pinned to the
top model at all.

---

## 2 · Surface allowlists

A builder may edit **only** the files listed for its surfaces, plus the test files named in
that surface's pin set. Everything else — including a file another surface owns — is out of
bounds. Ambiguity is a stop-and-report, never an improvisation.

### 2.1 forms — Builder A

```text
src/components/ui/form-field.tsx
src/components/ui/text-field.tsx
src/components/ui/select.tsx
src/components/ui/choice.tsx
src/components/forms/forms-home-page.tsx
src/components/forms/forms-search-results-page.tsx
src/components/forms/form-detail-page.tsx
src/components/forms/form-detail-client.tsx
src/components/clinical-dashboard/patient-profile-panel.tsx
src/components/clinical-dashboard/settings-dialog.tsx
src/components/formulation/formulation-builder-page.tsx
```

**Fold first, then adopt.** `FormField`, `TextField`, `SearchField`, `Select`, `Checkbox` and
`RadioGroup` have **zero** production mounts today — their only call sites are DS contract
tests. So the work is (1) refactor the five controls onto the shared `FormField` shell inside
`src/components/ui/`, closing the COMPONENTS §0.4 defect where the hint is dropped when an
error is present, then (2) adopt the hand-rolled product fields onto the folded controls. Do
not invent product mounts that do not exist.

**Leave alone in this surface:** `aria-pressed` segmented groups in `patient-profile-panel`
and `settings-dialog` (SegmentedControl is specified, not built — do not approximate it with
`RadioGroup`); `SettingsToggleField` (a switch applies immediately, a checkbox batches —
COMPONENTS §4); the shell composer query input.

### 2.2 headers — Builder A

```text
src/components/ui/page-header.tsx
src/components/mode-home-template.tsx
src/components/information-page-shell.tsx
src/components/dsm/dsm-page-header.tsx
src/components/clinical-dashboard/search-results-header-band.tsx
```

`PageHeader` and `Breadcrumb` have **zero** product mounts; `InformationPageHeader`
(`information-page-shell.tsx`) is defined but unused. Adoption converges the hand-rolled
headers onto `PageHeader` + `Breadcrumb`.

**Explicitly NOT in the headers allowlist**, despite being header-adjacent:
`global-search-shell.tsx`, `shared-search-app-shell.tsx`, `master-search-header.tsx`,
`src/lib/search-shell-props.ts`, `src/lib/search-route-ownership.ts`. Those own composer
placement and phone collapse geometry. Changing them is a search-chrome change, not a header
adoption, and belongs to the controller under `docs/search-chrome-behaviour.md`.

**Pairing rationale:** forms and headers go to one builder because headers is where the
one-composer-per-page rule is most likely to break, and forms is the surface most likely to
add a field that looks like a composer. Both sides of that interaction stay in one context.

### 2.3 catalogues — Builder B

```text
src/components/services/services-home-page.tsx
src/components/clinical-dashboard/differentials-home.tsx
src/components/clinical-dashboard/favourites-command-library-page.tsx
src/components/dsm/dsm-home-page.tsx
src/components/dsm/dsm-search-page.tsx
src/components/factsheets/factsheets-home-page.tsx
src/components/applications-launcher-page.tsx
src/components/therapy-compass/screens/home-screen.tsx
```

Complete empty/loading gaps with `EmptyState` and `LoadingPanel`; converge local chip
duplicates onto DS `Chip`. **`FilterBar`, `SegmentedControl` and `DataTable` are specified,
not built — do not invent them.**

**Coordination:** catalogues share the results ribbon and `search-band` pins with headers.
`search-results-header-band.tsx` belongs to **headers**; a catalogue commit that needs a ribbon
change stops and reports instead of editing it.

### 2.4 docs — Builder B

```text
src/components/clinical-dashboard/document-search-results.tsx
src/components/DocumentViewer.tsx
```

`DocumentFrame` is specified, **not built** (PR 11) — do not adopt as if present. Until it
exists, this surface is token/recipe cleanup plus the live-region retirement below. Keep every
`role="alert"` semantic; route announcements through the announcer policy rather than deleting
roles, because many `role="status"` sites are implicit polite live regions with no `aria-live`
attribute and removing the role without an `announce()` call changes what a screen reader
hears.

`DocumentViewer.tsx` owns its own page composer. Do not add a second one, and do not touch the
shell props that hide the shared composer on document routes.

### 2.5 source provenance — controller

```text
src/components/ui-primitives.tsx           (SourceDesignationBadge / SourceStatusBadge / SourceProvenance)
src/components/clinical-dashboard/evidence-panels.tsx
```

The provenance implementations live in `ui-primitives.tsx`, **not** under
`src/components/ui/source*.tsx` — COMPONENTS §0.1 names them as registered components without
naming the module. Adoption here is consistency, not a rewrite of what the badges mean: the
three axes (designation, status, provenance) stay independent and no badge infers one from
another.

`SourceProvenance` deliberately drops unknown review-date and jurisdiction segments as filler
while `clipboardProvenanceLine()` stays fully explicit. That difference is recorded in both
implementations and is **not** a defect to reconcile: the visible strip is read at speed, the
clipboard line is an audit artefact.

The work that is real here is the caution channel: `answerSupportPriority()` gains an optional
`answerState`, so the live "Review source match" card and the DS `RetrievalStateBanner` derive
from the same projection and cannot drift once the answer surface adopts `AnswerCard`. It is an
addition to the three original signals, never a replacement — deriving from the state alone
would lose the stale-and-ungrounded case, which the projection collapses to `stale_evidence`.
Pinned by `tests/answer-support-priority.dom.test.tsx`.

### 2.6 answer — controller, last

```text
src/components/clinical-dashboard/answer-content.tsx
src/components/clinical-dashboard/answer-result-surface.tsx
src/components/clinical-dashboard/answer-thread-turn.tsx
src/components/ClinicalDashboard.tsx        (answer orchestration only)
```

`answer-result-surface.tsx` was missing from this list when it was first written and is added
here rather than silently edited: it is the module that calls `answerSupportPriority()` and
owns the inline support card, so the answer surface cannot be adopted without it.

Adopts `AnswerCard` + `AnswerState` + `VerificationNotice` + `RetrievalStateBanner`, with
`DateDisplay` / `MissingValue` for absent fields, and wires `onCopy` to
`composeAnswerClipboardText()` (`#208`). The `#207` ungrounded channel must already be on the
branch — it is, as the first Phase 1 commit — because the projection could otherwise report a
`grounded: false` answer as `ready` and adoption would retire the live "Review source match"
caution.

**`src/lib/rag/**` is read-only for every surface, including this one.** A change that appears
to need it stops and becomes a separate contract-PR proposal.

**Deliberately deferred: the `AnswerCard` container swap.** What landed is the whole of
`VerificationNotice` and the whole of `RetrievalStateBanner` on the live surface, driven by a
real `answerStateFromRetrieval()` projection, plus both product copy paths on
`composeAnswerClipboardText()`. What did not land is replacing the existing `answerSurface`
wrapper with `AnswerCard`'s `<article>`. That is a structural change to the chrome of the
primary clinical screen: it collides with the `answerSurface` style contract and the phone
geometry pins, and the first honest signal would be a `verify:ui` run at the end of the wave.
The clinically load-bearing part of PR 6 — the ungrounded channel, the preserved caution, the
copy payload — is adopted without it. This is a narrowing of the surface's scope and is
recorded here rather than left implicit; it needs its own commit and its own `verify:ui` pass.

**Defect found while adopting, and fixed:** attribution in the clipboard cannot be keyed on the
`AnswerState` kind. `#207` precedence puts `ungrounded` above `source_only`, so an extractive
answer that is also weakly supported reports `ungrounded`, and the paste claimed "AI-generated"
over passages no model wrote. `composeAnswerClipboardText()` now takes an explicit `sourceOnly`
tier flag, which both product callers pass. Pinned in
`tests/answer-clipboard-product-path.dom.test.tsx` and `tests/answer-clipboard-composition.test.ts`.

---

## 3 · Components to register before their surface adopts them

Built, not registered (COMPONENTS §0.2) — each must have its proof surface before the listed
surface's commit lands:

| Module                                        | Symbols                                                         | First adopting surface   |
| --------------------------------------------- | --------------------------------------------------------------- | ------------------------ |
| `ui/form-field.tsx`                           | `FormField`, `FieldHint`, `FieldError`, `ErrorSummary`          | forms                    |
| `ui/text-field.tsx`                           | `TextField`, `SearchField`                                      | forms                    |
| `ui/select.tsx`                               | `Select`                                                        | forms                    |
| `ui/choice.tsx`                               | `Checkbox`, `RadioGroup`                                        | forms                    |
| `ui/page-header.tsx`                          | `PageHeader`, `Breadcrumb`                                      | headers                  |
| `ui/live-announcer.tsx`                       | `LiveAnnouncer`, `RouteAnnouncer`, `announce`                   | docs (mount at app root) |
| `ui/verification-notice.tsx`                  | `VerificationNotice`                                            | answer                   |
| `ui/answer-state.ts`                          | `AnswerState`, `answerStateFromRetrieval`                       | answer                   |
| `ui/retrieval-state-banner.tsx`               | `RetrievalStateBanner`                                          | answer                   |
| `ui/answer-card.tsx`                          | `AnswerCard`, `AnswerFooter`, `DoseLine`, `answerClipboardText` | answer                   |
| `ui/missing-value.tsx`, `ui/date-display.tsx` | `MissingValue`, `DateDisplay`                                   | answer                   |

`TextField` and `SearchField` appear in COMPONENTS §0.1 as registered-experimental with **0**
product imports while §0.4 still lists field-shell defects against them. Treated here as
**registered but not adopted**: the fold closes the defects, and the first product mounts are
this wave's work. Registration is not adoption.

`Select` and `Checkbox` have no design-sync registration and `Select` has no dedicated test —
that gap is closed in the forms commit, not deferred past it.

---

## 4 · Exclusions

| Excluded                                                          | Reason                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/app/mockups/**`, `*-mockups.tsx`                             | Design scratch; 404 in production; gate-exempt. Never "fixed"                     |
| `src/lib/rag/**` and the other RAG-ranking protected surfaces     | Read-only; not an adoption surface                                                |
| Wrapping or remounting `GlobalSearchShell`                        | One production mount exists (`shared-search-app-shell.tsx`); a second is a defect |
| Half-component adoption                                           | SPEC §13 invariant — a surface adopts a component whole                           |
| Replacing the product copy path with bare `answerClipboardText()` | `#208`; drops the render policy's warnings                                        |
| Adopting the answer surface before `#207`                         | SPEC §13 blocker 2                                                                |
| `SegmentedControl`, `FilterBar`, `DataTable`, `DocumentFrame`     | Specified, not built — do not approximate                                         |
| `#209` warning-as-body-text contrast                              | P3; not a Phase 1 blocker and not in this wave's scope                            |

---

## 5 · Invariants every adoption commit is checked against

- **One search composer per page.** `GlobalSearchShell` is **never** wrapped. Phone composers
  are edge-to-edge, and hidden phone chrome means **zero** reserve — not `0.75rem`, not
  `env(safe-area-inset-bottom)`. Read `docs/search-chrome-behaviour.md` before touching chrome.
- **Production tap targets are `min-h-12`.** Never `min-h-11` — that reintroduces a known
  `ui-smoke` sub-pixel flake. Generic 44px accessibility guidance does not override this.
- **Design tokens, never hex. Named z-rungs, never a raw `z-[N]`.**
- **Internal navigation** via `<Link>` / `router.push` / server `redirect()` — never a raw
  `<a href="/…">` to an internal route.
- **Every `<button>` does something**, or uses the explicit disabled-placeholder pattern
  (`disabled`/`aria-disabled` + `title="… — coming soon"` + an `sr-only` note).
- **Never sweep `tc-` without excluding `qtc-`** — QTc is a cardiac interval, and one RAG eval
  case ID contains it.
- **Test pins flip in the same commit as their surface**, so each surface reverts alone.

---

## 6 · Test pins by surface

The pins each surface's commit is expected to flip or preserve. Full path:line inventory is
held with the wave's prep material; the files are the contract here.

| Surface    | Pin files                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| forms      | `tests/ui-tools.spec.ts` (forms home/results/detail) · `tests/forms-back-navigation.dom.test.tsx` · `tests/information-page-shell.dom.test.tsx` · `tests/patient-profile-panel.dom.test.tsx` · `tests/settings-inert-preferences.dom.test.tsx` · `tests/upload-size-precheck.dom.test.tsx` · `tests/ui-v2-form-field.dom.test.tsx`                             |
| headers    | `tests/search-results-header-band.dom.test.tsx` · `tests/header-scroll-hide-contract.test.ts` · `tests/ui-style-contract.spec.ts` + `tests/helpers/style-contracts.ts` · `tests/ui-route-coverage.spec.ts`                                                                                                                                                     |
| catalogues | `tests/ui-tools.spec.ts` (services/differentials) · `tests/ui-specifiers.spec.ts` · `tests/ui-formulation.spec.ts` · `tests/ui-route-coverage.spec.ts` · `tests/registry-retry.dom.test.tsx` · `tests/page-secondary-navigation.dom.test.tsx`                                                                                                                  |
| docs       | `tests/document-filter-panel.dom.test.tsx` · `tests/document-search-record-fault.dom.test.tsx` · `tests/document-clinical-summary.dom.test.tsx` · `tests/document-section-nav.dom.test.tsx` · `tests/document-section-summary.dom.test.tsx` · `tests/document-section-nav-contract.test.ts` · `tests/ui-smoke.spec.ts` (documents)                             |
| provenance | `tests/source-badges-off-vocab.dom.test.tsx` · `tests/source-metadata.test.ts` · `tests/source-preview-popover.dom.test.tsx` · `tests/forms.test.ts` · `tests/answer-support-priority.dom.test.tsx`                                                                                                                                                            |
| answer     | `tests/ui-smoke.spec.ts` (answer, incl. the **"Review source match"** support-card pin) · `tests/ui-tools.spec.ts` (answer empty state) · `tests/answer-progress-ui-smoke.spec.ts` · `tests/answer-preferences.dom.test.tsx` · `tests/answer-state-contract.test.ts` · `tests/answer-clipboard-composition.test.ts` · `tests/ui-v2-answer-safety.dom.test.tsx` |

**The load-bearing pin for `#207`** is the live "Review source match" assertion on
`answer-support-card` in `tests/ui-smoke.spec.ts`. It must still pass after the answer surface
adopts `AnswerCard`; if adoption moves the caution to a new carrier, the pin moves with it in
the same commit and the new assertion is at least as strong.

---

## 7 · Expected proof shots

Per-surface visual proof targets for the adoption glance. Phone **and** desktop wherever the
chrome differs between them.

| Surface    | Shots                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| forms      | `/forms` home with hero composer · `/forms` results with the sort group · a form detail page with its decision context · the patient profile panel open · a settings preferences row                           |
| headers    | a mode home's universal header + in-flow hero · a results ribbon · an info detail header with breadcrumbs · phone header collapsed vs revealed                                                                 |
| catalogues | `/services` home + results · `/differentials` home with the catalogue notice · `/dsm` home · a specifiers or formulation home · therapy-compass home                                                           |
| docs       | `/documents/search` results + filter shelf · a document detail with section nav · the clinical summary toggle and indexed source panel · a fault/empty search state                                            |
| provenance | the document-admin source metadata block · the answer support caution (pre-adoption baseline) · a differentials source-status chip · the source preview popover                                                |
| answer     | a ready grounded answer · an **ungrounded** answer showing the preserved caution (`#207`) · stale-evidence and source-only banners · a copied-clipboard sample (`#208`) · progress / empty / error / streaming |
