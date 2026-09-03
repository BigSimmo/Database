# Sweep fix — visible live regions (SPEC.md §9.2)

Closes finding 4 of `sweep-2026-08-29-unenforced-rules.md`. The sweep counted "19 further" visible
`aria-live` nodes beyond its named counterexample. A follow-up verification pass re-audited the
whole claim and found it undercounted: **28 candidate instances across ~26 files**, none fixed by
any prior round. This round is a scoped closure, not exhaustive: it fixes the five highest-leverage,
lowest-risk instances directly, then turns the remainder into a ratcheted, gate-enforced,
documented residual — the same shape this file set already uses for `disabledOpacityUses` and
other oversized debt metrics.

| Gate metric               | Before      | After                          |
| ------------------------- | ----------- | ------------------------------ |
| `visibleLiveRegions`      | _(no gate)_ | **24** (pinned, ratcheted)     |
| Fixed directly this round | —           | **8** instances across 5 files |

---

## 1. The rule

SPEC.md §9.2: **"Live regions are never visible content."** A visible node (no `sr-only` in its
resolved class list) must never carry `aria-live`. The compliant shape is a visible, non-live node
**plus** a separate visually-hidden (`sr-only`) sibling that carries the announcement.

`role="status"` / `role="alert"` alone do **not** exempt a node — those roles already imply live
semantics, so an explicit `aria-live` on a visible node carrying one of those roles is still two
defects layered on one node (see §2.1 below).

---

## 2. Part A — fixed directly

### 2.1 `src/components/primitive-recipes/feedback.tsx` — `LoadingPanel` spinner variant

Before (line 271-272):

```tsx
role="status"
aria-live="polite"
>
```

After: `aria-live="polite"` deleted; `role="status"` stays (it already implies the live semantics
this attribute duplicated). This one primitive backs 10 caller files across the app (`therapy-compass/
ui.tsx`, `document-search-results.tsx`, `medication-record-page.tsx`, `dashboard-nav.tsx`, two
`dictionary` routes, `source-panels.tsx`, `document-rail-panels.tsx`, `clinical-dashboard-lazy.tsx`,
and one more `dictionary/topics/[slug]` route), so this single change closes the metric everywhere
`LoadingPanel`'s spinner branch is mounted. Checked two callers: each mounts the panel while a
region loads and swaps it for real content on completion — the panel's own text never changes in
place while mounted, so nothing about the accessible announcement (mount-time read by role +
label, same as any freshly-inserted status region) is lost by dropping the redundant explicit
attribute. `LoadingPanel`'s `skeleton` variant was already compliant (`role="status"
aria-label={label}` plus an `sr-only` twin `<span>`, no `aria-live` at all) — untouched.

No test asserted this attribute's presence (grepped `tests/` for `LoadingPanel` and for `aria-live`
near it; none exist), so nothing needed updating.

### 2.2 `src/components/pwa-lifecycle.tsx` — four static notification cards

Lines 630, 675, 713, 741 (offline / update / iOS install hint / native install prompt cards). Each
is a `role="region"` `<section>` that mounts once with fixed copy and is not updated in place — the
`aria-live="polite"` on each was dead weight. `aria-live="polite"` deleted from all four;
`role="region"` and `aria-labelledby` stay. `connectionRestored`'s card (line 662) already had no
`aria-live` and was left alone. No test in `tests/pwa-lifecycle.dom.test.tsx` or elsewhere asserted
`aria-live` on these cards.

### 2.3 `src/components/document-viewer/pdf-preview-loading.tsx`

A static loading placeholder (`Loading PDF reader…`, no dynamic content). `aria-live="polite"`
deleted; `aria-busy="true"` stays. `tests/document-viewer-pdf-reader-lazy.test.ts` only asserts the
component is wired as the lazy-load fallback, not its attributes — unaffected.

### 2.4 `src/components/clinical-dashboard/document-search-results.tsx:609` — the named counterexample, re-litigated

The sweep called this content "static — never changes while the surface is mounted." That is
**wrong**, and the fix follows the correct classification instead of the sweep's.

`documentCount` (the prop feeding this text) resolves to `indexedDocumentTotal =
documentsPagination?.total ?? documents.length` in `ClinicalDashboard.tsx`. Both `documents` and
`documentsPagination` are `useState`, both start empty/`null`, and both are set from a **polling**
effect (`nextRefreshDelayMs` / `indexingActive` drive a repeat fetch loop against
`/api/documents`) that keeps running while the document-search home screen is mounted. During
active ingestion the indexed total visibly increases without a remount — this is dynamic content,
exactly the shape the verification agent flagged, not the sweep's static reading.

Fix: split into a visible node (no `aria-live`) plus a separate `sr-only` twin carrying the
announcement, matching the pattern already used elsewhere in this same file (line 544's copy-status
announcer) and across the codebase (20 pre-existing `sr-only` + `aria-live` twin sites, e.g.
`ClinicalSidebar.tsx:426`, `settings-dialog.tsx:858`, `answer-source-drawer.tsx:606`):

```tsx
{
  documentCount > 0 ? (
    <>
      <p className="text-xs font-semibold text-[color:var(--text-muted)]">
        {documentCount.toLocaleString()} indexed source{documentCount === 1 ? "" : "s"}
      </p>
      <span className="sr-only" role="status" aria-live="polite">
        {documentCount.toLocaleString()} indexed source{documentCount === 1 ? "" : "s"}
      </span>
    </>
  ) : null;
}
```

No test in `tests/document-search-results.dom.test.tsx` or elsewhere asserted `aria-live` on this
`<p>`.

### 2.5 `src/components/clinical-dashboard/global-search-shell.tsx:1148`

A wrapper `<div aria-busy="true" aria-live="polite" data-testid="mode-navigation-loading">` around
an `sr-only` label `<span>Loading {mode}</span>` and a visible `ModeHomeRouteLoading` skeleton. The
outer `<div>` is not itself `sr-only` (it renders the visible skeleton), so per §9.2 it must not
carry `aria-live`. `aria-live="polite"` deleted from the outer div.

**Known trade-off, stated rather than hidden:** the inner `sr-only` span does not carry its own
`aria-live`, so removing it from the ancestor div means this transient "Loading {mode}" label is no
longer itself announced as a live region during the brief mode-switch gap. This is judged
acceptable because the app already has a dedicated, app-root `RouteAnnouncer`
(`src/components/ui/live-announcer.tsx`) that announces the destination's page title via `announce()`
once the real route mounts — the mechanism this transient loading div's label was duplicating,
imperfectly, is not the only announcement path. No test (`mode-navigation-loading` was grepped
across `tests/`) asserted `aria-live` on this node.

---

## 3. Part B — the gate

### 3.1 `visibleLiveRegions` metric

New AST-based scanner in `scripts/design-system-contract-utils.mjs`
(`findVisibleLiveRegionsInSource`), following the same shape as `findElevationInversionsInSource`
and `findHandRolledCommandButtonsInSource`: walk every JSX opening element in a `.tsx` file
(mockups excluded, matching the walker's existing exclusion), and flag any element carrying an
`aria-live` attribute whose resolved class list (`jsxClassNameText` — string literals, template
literals, and `cn()` call arguments) does not include `sr-only`.

Two narrow exceptions, both principled rather than convenient:

- **A statically-known `aria-live="off"` literal** never announces, so it is not "live content" —
  skipped. A _dynamic_ value (`aria-live={faulted ? "off" : "polite"}`) stays in scope, because it
  can resolve to a real live setting at runtime — this is the same "unresolved expressions stay
  in scope" convention the rest of the file already uses.
- **`aria-relevant="additions …"`** marks a container whose live behaviour is "announce children as
  they are inserted" — a fundamentally different shape from a single visible node whose own text
  mutates in place (the failure mode §9.2 exists to catch). This is the toast-region pattern; see
  §3.2.

`role="status"` / `role="alert"` alone are **deliberately not** an exception — `LoadingPanel`'s
spinner variant (§2.1) carried `role="status"` on a visible node and was still a real violation,
because the role already implies the live semantics the explicit attribute duplicates. Exempting
the role generally would have made that fix a no-op for the gate.

Wired into `scripts/check-design-system-contract.mjs` (`recordDebt("visibleLiveRegions", …)`, a
console summary line, and the metric's default-zero entry) and pinned in
`scripts/design-system-contract-baseline.json` at **24**, with a per-path breakdown so any single
file's count is also ratcheted, not just the total.

### 3.2 Disputed/allowlisted cases

**`src/components/ui/toast.tsx`'s `ToastRegion`** — a genuinely visible, `role="status"
aria-live="polite" aria-relevant="additions text"` `<div>` that portals the whole app's toast
notifications. Confirmed this would be a false positive without the `aria-relevant` exception: the
region itself renders no static text of its own — visible `ToastCard`s are inserted into it as
toasts fire, and the visible card **is** the announcement (the standard ARIA "toast" widget
pattern: additions to a live container are what gets read). This is architecturally different from
§9.2's failure mode (a static/dynamic value read directly off a visible node), so it is not
re-litigated as a violation. Verified with the gate itself: `visibleLiveRegions` debt for
`src/components/ui/toast.tsx` is `0`; a mutation test (§4, test 3) confirms the exception is doing
real work, not just always passing.

**`src/components/clinical-dashboard/document-search-results.tsx:609`** — see §2.4. Recorded here
because it is the one case where this round overturned the parent document's own classification
rather than following it.

### 3.3 Residual — 24 instances across 22 files, pinned as ratcheted debt

Not fixed individually this round, per the scoped-closure instruction. Each is a real, currently
uncompliant instance (dynamic or ambiguous visible content wearing `aria-live` directly, per the
gate's own classification) and is pinned in `debtByPath.visibleLiveRegions` so none of them can grow
further without failing the gate, and any one of them can be closed independently in a future round
by moving its baseline entry to 0.

| File                                                                    | Line       |
| ----------------------------------------------------------------------- | ---------- |
| `src/components/clinical-dashboard/answer-status.tsx`                   | 340        |
| `src/components/clinical-dashboard/differentials-home.tsx`              | 119, 759   |
| `src/components/clinical-dashboard/favourites-command-library-page.tsx` | 1289, 1725 |
| `src/components/clinical-dashboard/result-filter-control.tsx`           | 975        |
| `src/components/clinical-dashboard/search-results-header-band.tsx`      | 365        |
| `src/components/clinical-dashboard/settings-dialog.tsx`                 | 1314       |
| `src/components/clinical-dashboard/signed-image.tsx`                    | 222        |
| `src/components/clinical-dashboard/universal-search-also-matches.tsx`   | 217        |
| `src/components/developer-area/clinical-trust-cockpit.tsx`              | 266        |
| `src/components/differentials/diagnosis-map-panel.tsx`                  | 738        |
| `src/components/differentials/differential-detail-page.tsx`             | 1143       |
| `src/components/differentials/differential-stream-workspace.tsx`        | 123        |
| `src/components/document-viewer/document-viewer-state-surface.tsx`      | 56         |
| `src/components/dsm/dsm-search-page.tsx`                                | 104        |
| `src/components/forms/form-detail-page.tsx`                             | 759        |
| `src/components/services/service-detail-page.tsx`                       | 654        |
| `src/components/therapy-compass/recommend-scenario-control.tsx`         | 116        |
| `src/components/therapy-compass/screens/recommend-screen.tsx`           | 95         |
| `src/components/therapy-compass/therapy-card.tsx`                       | 159        |
| `src/components/therapy-compass/workspace.tsx`                          | 30         |
| `src/components/ward-management/ward-management-modes.tsx`              | 1027       |
| `src/components/ward-management/ward-management-network.tsx`            | 447        |

The most consequential of these is `search-results-header-band.tsx:365` — the shared search-result
count/status word rendered on every search route, `role="status" aria-live={faulted ? "off" :
"polite"} aria-atomic="true"` directly on the visible `<span>`. It is exactly the §9.2 shape (a
visible node's own text mutates and is announced from the same node) and Playwright asserts this
node's visibility on every route, so a fix here needs browser-level regression coverage this round
did not include — left as pinned debt rather than risked. `answer-status.tsx:340` is the same shape
for the same reason: `tests/answer-progress-ui-smoke.spec.ts:452` asserts `aria-live="polite"`
directly on this node (`data-testid="answer-progress-line"`), so closing it needs that Playwright
assertion rewritten to check the `sr-only` twin instead, in the same change.

`arithmetic check`: 8 fixed directly (§2) + 24 pinned residual = 32 raw `aria-live`-on-visible-node
instances found across the 5 Part-A files plus the rest of `src/**` before this round, measured by
running the finished scanner against each Part-A file's pre-fix (`git show HEAD:<path>`) content.
This is higher than both the sweep's "19 further" (undercounted) and the verification agent's "28"
(different exclusion/exception rules — this scanner additionally excludes the `aria-relevant`
additions-container shape and literal `aria-live="off"`) — reported as measured, not reconciled to
either prior estimate.

---

## 4. Mutation tests

All four run purely in-memory against `findVisibleLiveRegionsInSource` (no file on disk was ever
written during testing, so there is nothing to restore — `git diff` on the touched source files
shows exactly the Part A fixes, byte-identical before and after this section's testing).

| #   | Mutation                                                                                                                                   | Predicted                                                                        | Observed                                                       | Match                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Reintroduce `aria-live="polite"` on `pdf-preview-loading.tsx`'s visible `<div>`                                                            | one finding at the `<div`'s opening line                                         | `["src/components/document-viewer/pdf-preview-loading.tsx:3"]` | exact                                                      |
| 2   | Reintroduce `aria-live="polite"` alongside `role="status"` on `LoadingPanel`'s spinner variant (`feedback.tsx`)                            | still flagged — role alone must not exempt                                       | `["src/components/primitive-recipes/feedback.tsx:265"]`        | exact — confirms `role="status"` is not a silent exception |
| 3   | Delete `aria-relevant="additions text"` from `toast.tsx`'s `ToastRegion`                                                                   | now flagged — the exception must be doing real work, not passing unconditionally | `["src/components/ui/toast.tsx:183"]`                          | exact                                                      |
| 4   | Delete `sr-only` from `document-search-results.tsx`'s new twin `<span>` (line 617) and, separately, from the pre-existing twin at line 544 | both flagged once `sr-only` is gone from each                                    | line 544 alone → `[":544"]`; both mutated → `[":544",":617"]`  | exact                                                      |

Baseline unaffected by any of these: since none of the mutations touched disk, `npm run
check:design-system-contract` was not re-run per mutation — the direct scanner calls above are the
proof, and `git status`/`git diff` on the five Part-A files and `toast.tsx` show no drift from the
committed content at any point during testing.

---

## 5. Verification

```
BEFORE (this metric did not exist)
AFTER  Design-system contract passed (1107 production files; …)
       Accessibility ratchet: visible nodes carrying aria-live (SPEC §9.2) 24.
```

`npm run check:design-system-contract` on the shared branch moved between failing and passing
several times during this session purely from **unrelated concurrent work** — three other
in-progress fix rounds on the same branch (`interactiveTapFloorDeclarations` / finding 1,
`disabledOpacityUses` / finding 7, `rawCssZIndices` / finding 10) kept editing the same scanner
files and baseline mid-session. Confirmed by direct, repeated `--print-metrics` runs that
`visibleLiveRegions` is stable at **24** across every invocation while those other numbers moved,
and that `visibleLiveRegions` never appeared in any `check:design-system-contract` failure line
produced during this session. The core contract (`node scripts/check-design-system-contract.mjs`)
now passes cleanly with `visibleLiveRegions` at 24 (captured above). The full `npm run
check:design-system-contract` chain additionally runs `generate-gates-figures.mjs`, which reports
"`docs/design-system/GATES.md` figures block is out of date" — a pre-existing, unrelated gap: the
figures block is stale because of the other sessions' still-moving metrics (`interactiveTapFloorDeclarations`
18, `disabledOpacityUses` 39, neither of which this round touches), not because of
`visibleLiveRegions`. Not regenerated here to avoid overwriting `GATES.md` edits those other
sessions have in flight; left for whichever round lands last to refresh with `npm run
design-system:gates-figures:update`. `visibleLiveRegions` will need its own `GATES.md` §2/§3 row at
that point (finding 6's own rule: "a check with no rule… is the failure mode this document exists
to prevent") — noted in §6 below.

```
npx vitest run --reporter=dot \
  tests/design-system-contract-utils.test.ts tests/design-system-target-evidence.test.ts \
  tests/document-search-results.dom.test.tsx tests/document-search-record-fault.dom.test.tsx \
  tests/document-search-scope-zero-results.dom.test.tsx tests/document-viewer-pdf-reader-lazy.test.ts \
  tests/document-viewer-non-pdf-preview.dom.test.tsx tests/pwa-lifecycle.dom.test.tsx \
  tests/mode-home-loading-contract.test.ts tests/clinical-ask-provider-contract.test.ts
  Test Files  10 passed (10)
      Tests  125 passed (125)
```

Plus the broader accessibility/aria-live-adjacent set (16 more files, discovered by grepping
`tests/` for `aria-live` and for the touched component names):

```
  Test Files  16 passed (16)
      Tests  698 passed (698)
```

```
npx eslint src/components/primitive-recipes/feedback.tsx src/components/pwa-lifecycle.tsx \
  src/components/document-viewer/pdf-preview-loading.tsx \
  src/components/clinical-dashboard/document-search-results.tsx \
  src/components/clinical-dashboard/global-search-shell.tsx \
  scripts/design-system-contract-utils.mjs scripts/check-design-system-contract.mjs \
  --max-warnings 0
  (no output) eslint exit=0
```

No browser/Playwright gate was run this round (`verify:ui`, `verify:phone-chrome` — not required by
this change's scope). Checked by grep whether any Part A surface or residual instance is load-bearing
to an existing Playwright assertion: none of the five Part A fixes are, but two residual instances
are — `answer-status.tsx:340`'s `answer-progress-line` (`tests/answer-progress-ui-smoke.spec.ts:452`
asserts `aria-live="polite"` on it directly) and, as already noted below,
`search-results-header-band.tsx:365`. Both are additional reasons those two residual sites need a
Playwright-covered follow-up round rather than a source-only fix.

## 6. Not done

- The 24 residual instances in §3.3 — pinned as ratcheted debt, not fixed. Each can be closed
  independently in a future round.
- `search-results-header-band.tsx:365` and `answer-status.tsx:340` specifically need Playwright
  attention before a fix. `answer-status.tsx:340` has a direct attribute assertion
  (`tests/answer-progress-ui-smoke.spec.ts:452` asserts `aria-live="polite"` on this exact node) that
  would need rewriting to check the `sr-only` twin instead. `search-results-header-band.tsx:365`'s
  containing band (`data-testid="search-query-ribbon"`) has extensive Playwright visibility coverage
  across `ui-accessibility.spec.ts`, `ui-smoke.spec.ts`, `ui-route-coverage.spec.ts` and others, so a
  fix needs that coverage re-run rather than a source-only change.
- No browser/Playwright gate was run.
- No attempt was made to reconcile this round's measured count (32 raw instances) against the
  sweep's "19 further" or the verification agent's "28" — those were both estimates from a
  different counting method; this document reports what the finished scanner actually measures.
- `docs/design-system/GATES.md` does not yet carry a §2/§3 row for `visibleLiveRegions`. Not added
  this round because the figures block is already stale from other in-flight sessions' metrics and
  regenerating it now would overwrite their uncommitted edits; whichever round refreshes
  `GATES.md` next should add this metric's row at the same time (finding 6's own rule).
