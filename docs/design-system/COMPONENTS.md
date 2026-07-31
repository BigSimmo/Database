# Clinical KB design system — COMPONENTS

**The eight unbuilt specifications (five of them safety infrastructure), plus the maturity
matrix for everything that exists.** Prop shapes are normative contracts; token references
are roles only — values live in the token files (see [TOKENS.md](TOKENS.md)).

- **Date:** 31 July 2026 · companions: [SPEC.md](SPEC.md) · [DECISIONS.md](DECISIONS.md) ·
  [GATES.md](GATES.md)
- **Tier vocabulary:** `main` — in production code · `branch` — committed at `ef13a072a`
  (local-only; **zero product imports**) · `design` — design project only · `spec` —
  specified, not built.

---

## 0 · Maturity matrix

"Built" alone is too ambiguous — these columns are the claim. **Dark proof** means a
component-level computed-style or visual dark check (the token-level dark contract exists,
but no component has dark proof until the cascade port lands — the branch copy still ships
`.ckb-v2:not(.dark)`). **HCM** = forced-colours proof. All proofs absent are marked `—`;
an asserted-but-untested behaviour is _worse_ than `—` and is called out.

### 0.1 Registered components (27 — published to the design project)

| Component                              | Tier                   | Preview | Direct test                     | Dark | HCM | 320px | Print | Product imports | Stability                   |
| -------------------------------------- | ---------------------- | ------- | ------------------------------- | ---- | --- | ----- | ----- | --------------- | --------------------------- |
| AccessibleTable                        | main (+branch changes) | ✓       | ✓                               | —    | —   | —     | —     | yes             | stable (live)               |
| AnswerCard                             | branch                 | ✓       | —                               | —    | —   | —     | —     | 0               | experimental                |
| AnswerFooter                           | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| AsyncButton                            | main (+branch)         | ✓       | ✓                               | —    | —   | —     | —     | yes             | deprecated → `Button`       |
| Breadcrumb                             | branch                 | ✓       | —                               | —    | —   | —     | —     | 0               | experimental                |
| Button                                 | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| Chip                                   | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| ConfirmDialog                          | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| DoseLine                               | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| EmptyState                             | main (+branch)         | ✓       | ✓                               | —    | —   | —     | —     | yes             | stable (live)               |
| IconButton                             | main (+branch)         | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live)               |
| InlineNotice                           | main (+branch)         | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live)               |
| LoadingPanel                           | main (+branch)         | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live)               |
| PageHeader                             | branch                 | ✓       | —                               | —    | —   | —     | —     | 0               | experimental                |
| Pagination                             | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| PanelHeading                           | main (+branch)         | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live)               |
| SafeBoldText                           | main                   | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live)               |
| SearchField                            | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| Sheet                                  | main (+branch)         | ✓       | — (no standalone contract test) | —    | —   | —     | —     | yes             | stable (live), defects open |
| Skeleton                               | main (+branch)         | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live)               |
| SourceDesignationBadge                 | main (+branch)         | ✓       | ✓                               | —    | —   | —     | —     | yes             | stable (live)               |
| SourceProvenance                       | main (+branch)         | ✓       | ✓                               | —    | —   | —     | —     | yes             | stable (live)               |
| SourceStatusBadge                      | main (+branch)         | ✓       | ✓                               | —    | —   | —     | —     | yes             | stable (live)               |
| Tabs                                   | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| TextField                              | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |
| ToastRegion (+ ToastProvider/useToast) | branch                 | ✓       | ✓ (provider flow)               | —    | —   | —     | —     | 0               | experimental                |
| ToggleSwitch                           | main (+branch)         | ✓       | —                               | —    | —   | —     | —     | yes             | stable (live), defects open |
| Tooltip                                | branch                 | ✓       | ✓                               | —    | —   | —     | —     | 0               | experimental                |

**[verified:** register and previews from `EXPORT_MANIFEST.md`; direct-test coverage from the
master handover's audit of the shipped test set; `main` presence from this worktree
(`src/components/ui/` on main holds only `OverlayProvider`, `badge`, `card`, `sheet`; the
branch deletes the dead `badge`/`card`).**]** Product-import counts for `main` components are
**[assumed: >0** for live shared components; exact counts belong to the adoption tracker, not
this document**]**.

### 0.2 Built, not registered (15 public symbols across 8 modules — `branch` only)

| Symbols                                                      | Direct test | Notes                                                                          |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------ |
| `Checkbox`, `RadioGroup`                                     | —           | Native inputs, real fieldset/legend; RadioGroup contract defect (PR 4).        |
| `Citation`, `CitationList`                                   | —           | Contract defect: enabled-inert possible (PR 4).                                |
| `Disclosure`, `DisclosureGroup`                              | —           | Hardcoded `<h3>`; `hidden`/Ctrl-F claim retracted.                             |
| `Progress`, `StageList`                                      | —           | Width animation; live-region defects (PR 9 / PR 8).                            |
| `Quantity`                                                   | —           | Strongest addition; consumes a retiring type step (fix in retirement tranche). |
| `Select`                                                     | —           | Shares the field-shell defects (PR 7 folds into `FormField`).                  |
| `StatusMark`                                                 | —           | Forced-colour survival **asserted, not proven**.                               |
| `TextLink`, `ExternalTextLink`, `DownloadLink`, `LinkAction` | —           | `tone` leaks to DOM; `gap` animation (PR 9).                                   |

Support APIs, unregistered: `ToastProvider`/`useToast` (tested via provider flow),
`OverlayProvider`/`useOverlay` (`main`, **zero imports** — superseded by `OverlayRoot`, §7),
`sheet-focus` stack (`branch`; folds into `OverlayRoot`).

### 0.3 Specified, not built

_The eight in this document:_ `VerificationNotice` · `AnswerState`/`RetrievalStateBanner` ·
`MissingValue` · `FormField`+`FieldHint`+`FieldError`+`ErrorSummary` ·
`LiveAnnouncer`/`RouteAnnouncer` · `DocumentFrame` · `OverlayRoot` · `DateDisplay`.

_P1 reusable (specified in outline only):_ `Menu`/`Popover` · `KeyValue` · `FilterBar`/
`AppliedFilters`/`FilterSheet` · `ResponsiveActionGroup` · `ScrollableStrip`/
`ScrollAffordance` · `SourceLink` · `DataTable` · `Banner` · `CopyButton`/`CopyField` ·
state family (`ErrorState`, `OfflineState`, `PermissionDeniedState`, `NotFoundState`,
`UnavailableState`).

_P2 clinical and governance:_ `LifecycleTrack` · `ConfidenceMeter` · `EvidenceGutter` ·
`Dropzone` · `AuditTimeline` · `VersionDiff` · `ProvenancePanel` · `ClinicalCallout` ·
print primitives (`PrintHeader`, `PrintFooter`, `CitationFootnote`, `PrintOnly`,
`ScreenOnly`, `KeepTogether`) · `SegmentedControl` · toolbar family · `Stat` · `Divider` ·
`TruncatedText` · `Identifier` · `Avatar` · `CommandPalette`.

### 0.4 Open-defect ledger (existing components → closing PR)

| Component                    | Open defects (compressed)                                                                                                                              | Closes in                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Button                       | danger contrast token · brightness hover/active bypass tokens · 44px comment · no ref · needless client boundary                                       | PR 3, PR 4                     |
| AsyncButton                  | no `type="button"` (can submit a form)                                                                                                                 | PR 4 (retire or alias)         |
| IconButton                   | `disabled:opacity` (one of 10 remaining uses)                                                                                                          | PR 3                           |
| ToggleSwitch                 | unnameable · knob animates `left`/`right` · opacity disabled                                                                                           | PR 4, PR 9                     |
| Chip                         | 20px remove target · optional `removeLabel` · no full-value path                                                                                       | PR 4                           |
| TextField/SearchField/Select | hint dropped on error (comment promises otherwise) · describedBy overwritten · placeholder on the decoration tier · no external id/refs                | PR 7                           |
| Checkbox/RadioGroup          | RadioGroup inert-control contract · raw dimensions · unsanitised ids · no group hint/error                                                             | PR 4, PR 7                     |
| Citation/CitationList        | enabled-inert · `aria-label` on bare span · index keys · unstructured data                                                                             | PR 4                           |
| DoseLine                     | must compose `Quantity` · structured dose model · overdue text + non-colour mark + open action                                                         | PR 6                           |
| StatusMark                   | app-type coupling · inline styles/raw geometry · HCM asserted-not-proven                                                                               | PR 2, PR 12                    |
| AnswerCard                   | unrestricted slots — no required verification/answer state                                                                                             | PR 6                           |
| AnswerFooter                 | accepts preformatted strings; must take machine values + compose `DateDisplay` + `MissingValue`                                                        | PR 6                           |
| PageHeader/Breadcrumb        | `<h1>` truncates · actions starve title · low-contrast eyebrow                                                                                         | PR 3, PR 7-adjacent layout fix |
| Tabs                         | `aria-controls` to unrendered panels · invalid selected value can empty the tab order · split `SegmentedControl`                                       | PR 4-adjacent, own tranche     |
| Pagination                   | unclamped props · 320px overflow · opacity disabled · no focus/announce policy                                                                         | PR 3, PR 8                     |
| Links                        | `tone` leaks to DOM · `download` overridable by spread · `gap` animation · new-tab policy implicit                                                     | PR 9                           |
| Tooltip                      | overwrites child handlers/describedBy · no portal/collision/delay · hardcoded z                                                                        | PR 10                          |
| Toast                        | z below `--z-toast` · warning=danger icon · urgency coupled to tone · no pause on hover/focus · no portal/queue cap                                    | PR 10                          |
| Sheet/ConfirmDialog          | optional name · portal default off · hardcoded z/duration · title truncates · bare "Confirm" default                                                   | PR 10                          |
| Disclosure                   | hardcoded `<h3>` · no print behaviour · truncation                                                                                                     | PR 11                          |
| Progress/StageList           | width animation · "step 0 of N" · whole-list live region                                                                                               | PR 8, PR 9                     |
| EmptyState                   | `live="polite"` by default                                                                                                                             | PR 8                           |
| AccessibleTable              | div caption vs `aria-label` · optional caption · uppercase dense headers · **bare `-` for missing cells** · inline equal widths · hand-rolled expander | PR 6 (`MissingValue`), PR 12   |
| ui-primitives.tsx            | 572-line module mixing recipes/actions/feedback/clinical — split                                                                                       | PR 12                          |

---

## 1 · `VerificationNotice`

**Problem.** The AI-verification wording is a call-site convention, so a generated answer can
render without it, with drifted wording, or with wording a lay reader cannot use. The system
must own the words; the call site may only choose the state it is in.

```ts
type VerificationNoticeProps =
  | {
      /** Drives the approved wording variant. Never free text. */
      state: "ready" | "stale_evidence" | "partial_retrieval" | "source_only";
      /** "plain" is the lay-reader variant for patient/carer-facing prints (factsheets). */
      audience?: "clinician" | "plain";
      /** Screen variants may omit printed metadata. */
      medium?: "screen";
      sourceCount?: number;
      className?: string;
    }
  | {
      /** Drives the approved wording variant. Never free text. */
      state: "ready" | "stale_evidence" | "partial_retrieval" | "source_only";
      /** "plain" is the lay-reader variant for patient/carer-facing prints (factsheets). */
      audience?: "clinician" | "plain";
      /** Print rendering is self-contained: no wording may depend on the live link. */
      medium: "print";
      sourceCount?: number;
      /** Print medium requires printedAt/printedBy. ISO timestamp rendered through DateDisplay. */
      printedAt: string;
      printedBy: string;
      className?: string;
    };
```

**Variants.** `screen`/`clinician` (default, rendered inside `AnswerCard`) ·
`print`/`clinician` (standalone document header block) · `print`/`plain` (lay wording;
required for factsheet prints — DECISIONS §Q4). `screen`/`plain` exists for on-screen
factsheet preview parity.

**States.** One approved wording per `state`. `ready` still carries the verification
disclaimer — ready is not verified. `stale_evidence` and `partial_retrieval` wording names
the degradation category; the specific sources are `RetrievalStateBanner`'s job, not this
component's.

**Keyboard & screen reader.** Static text in document order, above answer actions. Not a
live region, not focusable; its icon is `aria-hidden`. On print it always renders, first in
the answer block.

**Tokens.** Body text `--text-muted`; icon per the SPEC §5 vocabulary (`Info` neutral,
`TriangleAlert` caution); caution states use the warning role — never danger red, because
this is source-currency/operational severity, not clinical hazard.

**Must refuse to render.** Without a `state` (type-level) · with caller-supplied wording
(no children or text props exist) · a `no_answer` state (no card exists to attach it to) ·
elided or truncated in print (print CSS may not hide it; gate planned).

**Do:** treat wording changes as spec changes reviewed by the clinical owner. **Don't:**
interpolate model names, vendor names, or percentages into the wording; don't let tone vary
by mode.

---

## 2 · `AnswerState` + `RetrievalStateBanner`

**Problem.** Degraded, partial, and fallback answers are structurally identical to confident
ones; the state lives in ad-hoc call-site branches. The state must be a value the type system
sees, so the degraded invariants (SPEC §2.5 corollary, §10) are unrepresentable to violate.

```ts
type SourceRef = { sourceId: string; title: string; locator?: string };
type OverdueSource = SourceRef & { reviewDueOn: string /* ISO */ };

/** States an AnswerCard may render. */
type AnswerState =
  | { kind: "ready"; sourceCount: number }
  | {
      kind: "stale_evidence";
      /** At least one overdue source; validated at RAG boundary before construction. */
      overdue: [OverdueSource, ...OverdueSource[]];
      sourceCount: number;
    }
  | {
      kind: "partial_retrieval";
      retrieved: number;
      requested: number;
      /** At least one missing source; validated at RAG boundary before construction. */
      missing: [SourceRef, ...SourceRef[]];
    }
  | { kind: "source_only"; reason: "generation_failed" | "quality_gate" };

/** Deliberately NOT an AnswerState: no card may render it. */
type NoAnswer = {
  kind: "no_answer";
  reason: "offline" | "no_confident_answer";
  lastSyncAt?: string; // ISO
};

type RetrievalStateBannerProps = {
  state: Exclude<AnswerState, { kind: "ready" }>;
  /** Q1: the clinician's next act is re-verification — one click to the cited page. */
  onOpenSource: (sourceId: string, locator?: string) => void;
  className?: string;
};
```

**Behaviour.**

- `AnswerCard` takes `state: AnswerState` as a **required** prop (PR 6, type-level gate).
  `NoAnswer` is excluded from the union: offline / no-confident-answer renders **no answer
  card** — the `EmptyState` path with last sync, cached sources, and a "search cached
  sources" action. Neutral, not amber.
- The banner renders above the prose. `stale_evidence` lists every overdue source with its
  review date (`DateDisplay`) and an open-at-cited-page action; the answer remains readable —
  caution, never a gate (DECISIONS §Q1). When every cited source is overdue, the banner
  states totality: "Every source for this answer is past its review date."
- `partial_retrieval` names the gap ("2 of 5 sources unavailable") and lists missing sources
  as unavailable rows — never silently omitted.
- `source_only` says it is a fallback and why that is safe (sources are real and cited);
  this is expected product behaviour, not an apology.
- Announcements go through `LiveAnnouncer` once on settle ("Answer ready, 4 sources" /
  "Answer ready with caveats, 2 of 5 sources unavailable") — the banner itself is **not** a
  live region.
- Copy/export of any non-`ready` state appends the caveat via `clipboardProvenanceLine()`
  (`src/lib/source-metadata.ts`) — one audit path, no parallel implementation.

**States and colour channels.** `stale_evidence` wears the warning (source-currency) role on
the spine and banner. `partial_retrieval` and `source_only` are **operational** severity:
neutral/info treatment plus explicit text — amber is reserved for source currency
(SPEC §11 severity vocabularies). Dose values inside a stale answer demote to label weight
with the unit unchanged.

**Keyboard & screen reader.** The banner is a landmark-free region with a heading-level-
appropriate label; source rows are real buttons/links (never inert); focus order follows
document order; the open action's accessible name names the source and page.

**Must refuse to render.** `RetrievalStateBanner` with `kind: "ready"` (type-level) · an
`AnswerCard` without a state (type-level) · a partial state whose `missing` list is empty
or a stale state whose `overdue` list is empty (the non-empty tuple types prevent
construction; runtime validation at the RAG boundary in `src/lib/rag/` rejects or routes
invalid states with empty collections before reaching render code).

**Do:** keep state derivation in the RAG layer; this component only renders what it is
told. **Don't:** infer staleness in the component from dates — the review policy lives in
`src/lib/source-review.ts`.

---

## 3 · `MissingValue`

**Problem.** Missing clinical data renders as a bare dash (`AccessibleTable` today), which
cannot distinguish _not recorded_ from _not applicable_ from _unable to extract_ — and in
clinical data a dash reads as a negative result.

```ts
type MissingValueProps = {
  reason: "not_recorded" | "not_applicable" | "unknown" | "extraction_failed";
  /** "cell" tightens spacing for dense tables; the phrase is never abbreviated. */
  density?: "inline" | "cell";
  className?: string;
};
```

**Variants.** The four phrases (SPEC §11): `Not recorded` · `Not applicable` · `Unknown` ·
`Unable to extract`. **[assumed:** "Withheld" excluded until a redaction path exists.**]**

**States.** None — it is a terminal, static rendering of absence.

**Keyboard & screen reader.** Plain text; no role, no live region, not focusable. The phrase
is the accessible text — never an icon-only or colour-only rendering. Prints as-is.

**Tokens.** `--text-muted`. Never `--decoration-soft` — this is text carrying meaning.

**Must refuse to render.** Custom text (no children prop) · a bare dash under any density ·
an unknown `reason` (type-level; runtime fallback renders `Unknown` and logs once, never
throws — enum resilience per SPEC §7).

**Do:** adopt inside `AccessibleTable` cells, `AnswerFooter` absent fields, `KeyValue`.
**Don't:** use it for loading (that is `Skeleton`) or for failed requests (that is
`ErrorState` — "no result count is available" is not a missing value).

---

## 4 · `FormField` + `FieldHint` + `FieldError` + `ErrorSummary`

**Problem.** TextField, SearchField, Select and the choice controls each hand-roll the field
shell; the hint disappears when an error appears (contradicting their own comments), caller
`aria-describedby` is overwritten, ids cannot be supplied, refs are not forwarded, and
required/optional/autocomplete have no system.

```ts
type FormFieldRenderProps = {
  id: string;
  describedBy: string | undefined; // merged: caller + hint + error, space-joined
  invalid: boolean;
  required: boolean;
};

type FormFieldProps = {
  label: string; // required — no unlabeled control exists
  id?: string; // external id supported; generated otherwise
  required?: boolean; // marked in the label text, never colour alone
  hint?: string;
  error?: string; // presence ⇒ invalid
  autoComplete?: string; // pass-through guidance, SPEC §9.7
  describedBy?: string; // caller ids — merged, never overwritten
  children: (field: FormFieldRenderProps) => ReactNode;
  className?: string;
};

function FieldHint(props: { id: string; children: string }): JSX.Element;
function FieldError(props: { id: string; children: string }): JSX.Element; // role="alert"

type ErrorSummaryProps = {
  heading?: string; // system default wording
  errors: Array<{ fieldId: string; label: string; message: string }>;
  className?: string;
};
```

**Behaviour.**

- **Hint and error are both in the DOM and both in `describedBy` when invalid.** Losing the
  format hint at exactly the moment the user got the format wrong is the current defect.
- `FieldError` renders in `role="alert"`; the control gets `aria-invalid`. Error is text +
  icon, never colour alone (SPEC §9.6).
- `ErrorSummary` renders at the top of the form after a failed submit, receives focus
  (`tabIndex={-1}`), and each entry is a link that moves focus to its field. It is not a
  live region — focus movement is the announcement.
- Controls consuming the render prop forward refs and accept the generated or supplied `id`.
- Labels are visible text; placeholder is never the label; placeholder colour clears the
  text threshold (TOKENS §5, `--text-placeholder`).

**States.** default · focused · invalid (hint + error) · disabled (encoded via `controlBase`,
not opacity) · required/optional.

**Keyboard & screen reader.** Label → control association by `htmlFor`/`id`; described-by
order: caller, hint, error; Tab order unchanged by validity; summary-link activation moves
focus into the field.

**Must refuse to render.** A field without a `label` (type-level) · an error rendered as
colour alone · overwriting caller `describedBy` (merge is the only path).

**Do:** fold TextField/SearchField/Select/Checkbox/RadioGroup onto this shell (PR 7).
**Don't:** add per-control bespoke hint/error markup again; don't put block content in the
hint (string type is deliberate).

---

## 5 · `LiveAnnouncer` + `RouteAnnouncer`

**Problem.** No focus management or announcement exists on route change — in a 13-mode app
every navigation strands assistive-technology users. Streaming answers re-announce
fragments, result counts announce through a visible low-contrast node, and `StageList` makes
its whole visual list a live region.

```ts
// Singleton API — one instance mounted at the app root.
function announce(message: string, opts?: { priority?: "polite" | "assertive" }): void;

function LiveAnnouncer(): JSX.Element; // two visually-hidden regions (polite, assertive)
function RouteAnnouncer(): JSX.Element; // subscribes to app-router navigation
```

**Behaviour.**

- **Route change:** if navigation happened inside an overlay or controlled workflow, focus
  is preserved deliberately; otherwise focus moves to the new `<h1>` (fallback: main
  landmark) with `tabIndex={-1}`, and the page title is announced once.
- **Streaming:** the streamed answer renders under `aria-live="off"`; on settle, one
  announcement — "Answer ready, 4 sources" (or the caveated form, §2).
- **Result counts / stage transitions:** concise text through `announce()`; the visible
  count node is ordinary compliant text, never itself live (fixes the
  `document-search-results.tsx` pattern).
- Repeated identical messages within a short window are deduplicated; queued messages never
  interleave mid-sentence.

**States.** None visible — both components render only visually-hidden regions.

**Keyboard & screen reader.** The whole point. `polite` for outcomes and counts;
`assertive` reserved for loss-of-work risks (auth expiry sheet). Focus placement never
scrolls without focus.

**Tokens.** None (visually hidden utility only).

**Must refuse to render.** Visible children (no children prop) · a second instance
(dev-mode throw; production no-op with one logged warning) · announcing on every keystroke
(rate discipline is the component's, not the caller's).

**Do:** route all announcements here. **Don't:** put `aria-live` on any visible content
node anywhere in the product — that is the anti-pattern this component exists to end.

---

## 6 · `DocumentFrame`

**Problem.** PDF pages and source images render bare: white pages glare on the dark shell,
nothing owns loading/error/zoom/print behaviour, and nothing structurally prevents the one
forbidden treatment — inversion — on the most-viewed surface in the product.

```ts
type DocumentFrameProps = {
  src: { kind: "pdf-page"; url: string; page: number; pageCount?: number } | { kind: "image"; url: string };
  /** Required: what the page/figure is, for assistive tech and for the error state. */
  alt: string;
  state?: "loading" | "ready" | "error";
  onRetry?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** User-controlled viewing aid. Off by default. Never during print/export or on a zoomed figure. */
  viewingAid?: boolean;
  className?: string;
};
```

**Behaviour.**

- **Pixel-faithful always.** No `filter`, no `invert`, no `color-scheme`, no default scrim —
  in any theme (SPEC §8). In dark, the _surround_ grades: hairline frame on
  `--surface-raised`, shell luminance stepped so the page edge is not a cliff.
- Loading uses stable-geometry skeleton (no layout shift on arrival). Error renders the
  three-part error structure with retry; it never renders a broken-image glyph alone.
- Page metadata (page _n_ of _m_) renders adjacent to the frame, tabular numerals.
- **Print:** pixel-accurate, viewing aid forced off, frame chrome hidden by
  `[data-print-hide]`, the page never split across sheets (`KeepTogether`).
- **Phone (blocking, DECISIONS §Q3):** fit-width by default at 320px, native pinch zoom
  preserved, zoom controls meet the tap target and stay reachable under 400% zoom.

**Keyboard & screen reader.** The frame is a labelled group (`alt` names it); zoom in/out/
reset are real buttons; page navigation (when `pageCount` present) is keyboard-operable;
focus is never trapped inside the frame.

**Tokens.** `--surface-raised` frame · `--ring-hairline` edge (borderless floating surround)
· `--e1` lift · gutter/space roles for metadata row. Content pixels: none, ever.

**Must refuse to render.** Without `alt` (type-level) · with any colour transform on the
content layer (gate planned: no `filter`/`invert`/`color-scheme` on document surfaces) ·
viewing aid during print/export or on a zoomed figure (component-enforced, not caller
convention).

**Do:** route every document and source-image render through it. **Don't:** re-implement
page dimming per surface; don't let a mode add its own scrim "just here".

---

## 7 · `OverlayRoot`

**Problem.** Two overlay models coexist (`OverlayProvider` on main with zero imports, plus
the `sheet-focus` stack on the branch); Tooltip has no portal; Toast portals nowhere and
hardcodes a z below its own token; Sheet defaults `portal: false`. One overlay architecture
must own stacking, focus, escape, and inertness.

```ts
type OverlayLayer = "overlay" | "popover" | "modal" | "toast";

function OverlayRoot(): JSX.Element; // single portal host at the app root

type UseOverlayOptions = {
  layer: OverlayLayer;
  open: boolean;
  onEscape?: () => void; // topmost-only delivery
  trapFocus?: boolean; // modal layers default true
  restoreFocus?: boolean; // default true
  inertBackground?: boolean; // modal layers default true
};
function useOverlay(options: UseOverlayOptions): { portal: (node: ReactNode) => ReactPortal };
```

**Behaviour.**

- **One stack.** Layers map 1:1 to the stacking rungs (`--z-overlay`, `--z-popover`,
  `--z-modal`, `--z-toast`) — no other z value exists in overlay code (gate: SPEC §4.8).
  The toast viewport rides above modal, deliberately.
- **Escape** is delivered to the topmost overlay only. **Focus** is trapped on modal layers,
  restored on close (folding in the branch's mature `sheet-focus` nested-sheet handling).
  Background becomes inert (`inert`/`aria-hidden`) for modal layers; scroll is locked.
- Popover/tooltip layers get collision-aware positioning on this foundation (Menu/Popover,
  P1, build here — not another model).
- `OverlayProvider` (main, unused) is deleted when this lands; `Sheet`, `ConfirmDialog`,
  `Tooltip`, `Toast` migrate onto it (PR 10).

**States.** Per-consumer; the root itself has none.

**Keyboard & screen reader.** Trap and restore per layer; dialogs must arrive named
(`Sheet` requires a title or labelledBy — enforced at `Sheet`, re-asserted here: an unnamed
dialog cannot mount); toast announcements go through the toast region's own politeness
model, decoupled from visual tone.

**Must refuse to render.** A second `OverlayRoot` (dev throw) · a consumer passing a raw z
value (no such prop exists) · mounting a modal-layer overlay with no accessible name.

**Do:** migrate every floating surface here before building Menu/Popover. **Don't:** keep
per-component portals or hand-rolled stacks after adoption.

---

## 8 · `DateDisplay`

**Problem.** Date rendering drifts per call site: `AnswerFooter` accepts preformatted
strings, relative dates float free of their absolutes, and print can carry a relative date
that is meaningless on paper.

```ts
/** Validated ISO-8601 timestamp (brand type; preformatted display strings cannot satisfy). */
type ISOTimestamp = string & { readonly __brand: "ISOTimestamp" };

type DateDisplayProps = {
  /** Validated ISO-8601 timestamp. Preformatted display strings are unrepresentable. */
  value: ISOTimestamp;
  /** Review/expiry dates are always absolute; "event" may carry a relative companion. */
  kind: "review" | "generated" | "event";
  /** Screen only; renders beside the absolute, never instead of it. */
  relative?: boolean;
  className?: string;
} | {
  /** Absent value; missing reason required to prevent silent missing-date rendering. */
  value: null | undefined;
  kind: "review" | "generated" | "event";
  relative?: boolean;
  /** Required when value is absent. Rendered via MissingValue. */
  missingReason: "not_recorded" | "not_applicable" | "unknown" | "extraction_failed";
  className?: string;
};
```

**Behaviour.**

- Display locale `en-AU`, timezone `Australia/Perth`, rendered in a `<time>` element with
  the machine value in `dateTime`. Internal comparison logic elsewhere keeps its ISO keys —
  this is a display component only (`perthCalendarDate()`'s `en-CA` machine key is correct
  and untouched).
- `kind: "review"` never renders relative — a review date is a commitment, not an ambience.
- Relative text renders only beside the absolute, and **never in print** — a printout is a
  snapshot (SPEC §4.12).
- Absent value renders `MissingValue` (explicit reason); invalid ISO renders
  `MissingValue("unknown")`, logs once, never throws.

**States.** value · missing · invalid.

**Keyboard & screen reader.** `<time>` semantics; the accessible text is the full absolute
date; relative companion is supplementary text, not the name.

**Tokens.** Inherits its context's text role; tabular numerals via `--nums` where dates
align in columns.

**Must refuse to render.** A preformatted display string (type-level: ISOTimestamp brand
prevents plain strings) · relative without absolute · relative under print media · silent
absence (type-level: missing value requires missingReason, which always renders a phrase).

**Do:** compose inside `AnswerFooter`, `RetrievalStateBanner`, provenance rows, print
headers. **Don't:** format a date anywhere else in product code; don't localise the machine
layer.
