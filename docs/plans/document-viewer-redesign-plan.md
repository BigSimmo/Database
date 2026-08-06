# Document viewer redesign — PDF + photo surfaces

**Status:** plan only (no product behaviour change in this doc PR)  
**Branch seed:** `cursor/document-viewer-redesign-plan-1db8`  
**Flightplan evidence:** `.local/workflow-evidence/2026-08-06T17-27-05-553Z-flightplan.json`  
**Related ledger:** `#214` (passive wheel / INP), `#219` (preview error announce), `#215` (image decode/priority)

This is the execution plan for a dramatic improvement of design, style, approach,
functionality, and optimisation of the PDF reader and photo/figure viewers. It is
scoped to keep clinical source fidelity, phone search-chrome ownership, and signed-URL
privacy intact.

---

## 1. Current state (what we are redesigning)

### Surfaces

| Surface                                                                    | Today                                                                            | Gap                                                                                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| PDF canvas (`pdf-canvas-viewer.tsx`)                                       | pdf.js single-page raster, fit-width / zoom / rotate / fullscreen, gesture hook  | Toolbar lives outside `DocumentFrame`; no page-linked figure sync; wheel always non-passive (#214); canvas errors not announced |
| PDF native iframe                                                          | “Sharper zoom” localStorage toggle                                               | Uneven parity with canvas (no in-app gesture chrome); dual-engine cognitive load                                                |
| Non-PDF whole-document image (`non-pdf-source-preview.tsx`)                | Contained `<img>` + open/download                                                | No shared lightbox / gesture stack; weaker visual system than crops                                                             |
| Tables & diagrams rail (`source-panels` → `SignedImage` → `ImageLightbox`) | Vertical accordion list, deferred signed fetch, Sheet lightbox with CSS zoom/pan | No filmstrip / page sync; long lists not virtualized; lightbox missing `decoding=async` (#215)                                  |
| `DocumentFrame` (COMPONENTS §6)                                            | Shell-only in product (loading/error/surround)                                   | Spec wants unified zoom/page metadata/viewing-aid ownership; PDF chrome still bespoke                                           |

### Architecture facts that drive the plan

- `DocumentViewer.tsx` is still ~1.7k LOC after partial X3 extraction — load machine,
  signed-URL refresh, summarize, phone chrome, and preview mode share one file.
- `document-viewer-lazy.tsx` is a re-export; real code-splitting is `next/dynamic` of the
  PDF readers inside the shell (guarded by client-performance-boundary tests).
- Gestures are shared (`use-viewer-gestures.ts`) but applied differently: PDF pans via
  scroll + re-raster; lightbox pans via CSS transform.
- Document detail routes own the floating search composer (`docs/search-chrome-behaviour.md`).

---

## 2. Product north star

One **source-faithful reading system** for clinical PDFs and photos:

1. **One visual language** — every page and figure sits in `DocumentFrame` (pixel-faithful
   surround, stable loading geometry, announced errors, shared control chrome).
2. **One gesture model** — pinch / modified-wheel zoom, pan when zoomed, fit-width default
   on phone; passive scroll by default (#214).
3. **One photo path** — whole-document images and indexed crops/diagrams open the same
   lightbox (or an in-frame immersive mode) with shared controls and a11y.
4. **Page ↔ figure sync** — selecting a table/diagram jumps the PDF to its page; optionally
   highlights the crop region when geometry exists.
5. **Fast on phone** — no layout jump on signed-URL arrival; deferred image fetch retained;
   virtualize long figure rails; keep pdf.js out of the initial document chunk.
6. **Honest dual-engine story** — either promote canvas as the primary reader with native
   as progressive enhancement, or hide the toggle behind an advanced preference after
   measured parity.

Design direction stays inside the v2 system (`ckb-v2-tokens.css`, COMPONENTS §6): graded
surround around white clinical pages, hairline frame, no purple/glow/card clutter, no
pixel inversion in any theme.

---

## 3. Hard constraints (non-negotiable)

1. **One composer owner** — `DocumentViewer` keeps the floating in-doc composer; no second
   shell dock on document routes.
2. **Hidden phone reserve = `0rem`** — edge-to-edge footer portal rules stay intact.
3. **Pixel-faithful sources** — no `filter` / `invert` / `color-scheme` on PDF/image pixels
   (`document-frame-contract`, COMPONENTS §6).
4. **Auth identity clear** — never re-show a prior user’s signed URLs or detail.
5. **pdf.js on demand** — canvas/native stay out of the initial document client chunk.
6. **Page flips must not remount** the viewer / reload the PDF document.
7. **Private images** — signed URLs, deferred IO, `unoptimized` where bearer URLs require it.
8. **Production tap targets** — `min-h-12` / `min-h-tap` (do not regress to `min-h-11`).
9. **Clinical failures announce** — loading → error must be audible (#219 / LiveAnnouncer).
10. **Not a RAG-ranking change** unless a phase deliberately touches ranking/retrieval —
    declare `RAG impact:` accordingly; summarize-from-document hits `/api/answer` so treat
    answer-path behaviour changes as clinical governance.

---

## 4. Risk calibration (flightplan vs behaviour)

Automated flightplan on the proposed paths classified **`ui` only**.

**Behavioural correction — treat the programme as:**

| Risk                          | Why                                                              |
| ----------------------------- | ---------------------------------------------------------------- |
| **UI / phone-chrome**         | Composer ownership, scroll-hide, DocumentFrame, lightbox Sheet   |
| **Clinical document surface** | Source rendering, preview failure UX, pixel fidelity             |
| **Privacy**                   | Signed-URL lifecycle, auth-clear blanking                        |
| **Not retrieval/RAG ranking** | Unless a later phase changes summarize routing or answer ranking |
| **Not database**              | No migration expected for viewer UX                              |

PRs that change source rendering / document access need a complete
`## Clinical Governance Preflight` in the PR body even when flightplan says `clinical: false`.

---

## 5. Phased delivery (separate PRs)

Bundle only when each item is independently low-risk and separately revertible. Prefer
**one phase per PR** for anything that touches gestures, chrome, or PDF raster.

### Phase 0 — Measurement unblocking (small, own PR)

**Goal:** fix known INP/a11y debt so redesign work can be measured honestly.

| Work                                                                                                                                         | Closes           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Conditional non-passive wheel in `use-viewer-gestures.ts` (passive scroll by default; non-passive only when unmodified wheel-zoom is active) | `#214`           |
| Announce PDF canvas + any remaining post-load preview failures (`role=alert` and/or LiveAnnouncer)                                           | `#219`           |
| `decoding=async` on lightbox `<img>`; optional `priority` on above-fold `SignedImage`                                                        | `#215` (partial) |

**Verify:** focused gesture + DOM a11y tests; manual INP spot-check on PDF scroll.  
**Stop:** do not break Ctrl/⌘+wheel or trackpad pinch zoom.

### Phase 1 — Shell extraction without UX rewrite

**Goal:** make `DocumentViewer.tsx` a thin orchestrator so design work is safe.

Extract (behaviour-preserving):

- Signed-URL / preview load machine
- Composer + phone chrome wiring
- PDF mode preference + dynamic import boundary
- Summarize stream controller (keep clinical output semantics)

Clarify `document-viewer-lazy` naming vs real dynamic boundaries.

**Verify:** shell/DOM contracts, pdf-reader-lazy, client-performance-boundaries,
`document-detail-performance`, `verify:phone-chrome` (dry-run then focused).

### Phase 2 — Unified viewing chrome (design + approach)

**Goal:** dramatic visual/UX convergence without changing clinical content.

1. Deepen `DocumentFrame` adoption toward COMPONENTS §6 — shared zoom/fit/page metadata
   chrome for PDF canvas and image stages; keep viewing-aid off by default and forced off
   for print/zoomed figures.
2. Route whole-document images through the same immersive viewer as crops (`ImageLightbox`
   or in-frame immersive mode sharing gestures).
3. Figure rail → compact filmstrip / gallery with page badges; click syncs PDF page.
4. Intentionally add 2–3 motions (zoom settle, lightbox open, page crossfade) that respect
   `prefers-reduced-motion`.
5. Revisit native vs canvas: primary = canvas; native as “browser zoom” advanced option
   after parity checklist.

**Verify:** `document-frame-contract`, document-viewer DOM suites, ui-smoke PDF paths,
`verify:phone-chrome`, a11y focused. Update `docs/search-chrome-behaviour.md` only if
ownership semantics change (prefer not to).

### Phase 3 — Functionality + optimisation

**Goal:** make the viewer feel native and stay fast on long documents.

| Capability                               | Notes                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Multi-page virtualization                | Render near pages; dispose far canvases; preserve page URL sync                |
| Crop → page overlay                      | When crop geometry exists, optional highlight on the PDF page                  |
| Keyboard reading mode                    | Page Up/Down, `+`/`-`, `f` fit, `r` rotate — documented, tested                |
| Rail virtualization                      | Long `#source-images` lists                                                    |
| Smarter signed-URL / decode priority     | Above-fold evidence vs below-fold rail                                         |
| Toolbar density                          | Compact phone / expanded desktop; print chrome hidden via existing print hooks |
| Optional OffscreenCanvas / worker raster | Only after measured main-thread paint cost                                     |

**Verify:** performance contract tests, bundle budget for document chunk, phone-chrome,
then `verify:ui` at handoff. Lighthouse / live INP needs explicit approval if provider-backed
or production-like.

### Phase 4 — Polish & design-sync (optional follow-on)

- Register full `DocumentFrame` in design-sync exports when controls are product-real.
- Capture hosted screenshot baselines for draft→ready adoption.
- Close residual `#215` demo PNG/WebP work only if still warranted.

---

## 6. Suggested file ownership by phase

### Phase 0

- `src/components/document-viewer/use-viewer-gestures.ts`
- `src/components/document-viewer/pdf-canvas-viewer.tsx`
- `src/components/DocumentViewer.tsx` (error announce paths only)
- `src/components/clinical-dashboard/image-lightbox.tsx`
- `src/components/clinical-dashboard/signed-image.tsx`
- Tests: `tests/use-viewer-gestures.dom.test.tsx`, focused DocumentViewer a11y DOM tests

### Phase 1

- `src/components/DocumentViewer.tsx` → new focused modules under `document-viewer/`
- `src/components/document-viewer-lazy.tsx` (naming / real boundary if warranted)
- Existing shell/performance tests

### Phase 2–3

- `src/components/ui/document-frame.tsx` + COMPONENTS §6 / ADOPTION notes as needed
- `pdf-canvas-viewer.tsx`, `non-pdf-source-preview.tsx`, `source-panels.tsx`,
  `document-rail-panels.tsx`, `image-lightbox.tsx`, `signed-image.tsx`
- `use-document-viewer-chrome-scroll.ts` only if chrome ownership changes
- `docs/search-chrome-behaviour.md` only if invariants change

**Correct paths note:** lightbox / signed image live under
`src/components/clinical-dashboard/`, not `src/components/ui/` (flightplan path list
had stale ui/ guesses).

---

## 7. Verification ladder (smallest → widest)

### Per-phase default (local / offline first)

```bash
# Gestures / a11y / frame contracts (adjust file list to the phase)
npm run test:focused -- --files \
  tests/use-viewer-gestures.dom.test.tsx,\
  tests/document-viewer-shell.dom.test.tsx,\
  tests/document-viewer-pdf-reader-lazy.test.ts,\
  tests/document-viewer-non-pdf-preview.dom.test.tsx,\
  tests/document-frame-contract.test.ts,\
  tests/document-detail-performance.test.ts,\
  tests/client-performance-boundaries.test.ts,\
  tests/signed-image.dom.test.tsx

# Before browser work
npm run ensure

# Phone chrome when composer / reserves / portals touched
npm run verify:phone-chrome -- --dry-run
npm run verify:phone-chrome

# Handoff
npm run format   # commit the result
npm run verify:pr-local -- --dry-run --files <changed paths>
npm run verify:pr-local
```

### Widen when warranted

| Gate                                 | When                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `npm run verify:cheap`               | Cross-module risk after Phase 1+ extraction or shared primitives |
| `npm run verify:ui`                  | Shared chrome foundations or PR handoff needing full Chromium    |
| `npm run check:production-readiness` | Clinical source-rendering / privacy / env-adjacent phases        |

### Approval-required (do not run without explicit confirmation)

- Live Lighthouse against production-like hosts
- `verify:release`, `test:live`, `check:supabase-project`
- Any OpenAI-backed summarize regression that is not fully mocked
- Hosted CI reruns / PR mutations outside ordinary push

Flightplan `approvalRequired` for the proposed path set: **none** (UI-local). That remains
true only while work stays offline/mocked.

---

## 8. Design principles for the visual pass (Phase 2)

Aligned with repo design rules and COMPONENTS §6:

- **One composition** on the document route: overview → primary reader → secondary rail;
  not a dashboard of competing cards.
- **Brand/clinical quiet:** the page/figure is the hero; chrome is subordinate.
- **Atmosphere from surround grading**, not decorative gradients over pixels.
- **No cards in the reader**; cards only where interaction requires a container (rail
  figure actions, error retry).
- **Motion with purpose:** zoom settle, lightbox enter/exit, page change — not noise.
- **Avoid** purple/indigo AI defaults, cream+terracotta clichés, broadsheet density,
  glow, emoji, oversized multi-shadow stacks.
- Preserve expressive type already in the v2 token layer; do not introduce Inter/Roboto.

---

## 9. Success criteria

| Area          | Done when                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Design        | PDF page and photos share DocumentFrame language; phone and desktop feel intentional                                 |
| Style         | Token-only colour/type/space; pixel-faithful content; print chrome clean                                             |
| Approach      | Single primary reader path; unified photo immersive path; page↔figure sync                                           |
| Functionality | Keyboard + gesture parity; announced errors; fit-width phone default retained                                        |
| Optimisation  | #214 closed; no pdf.js in initial chunk; rail virtualized if long; no remount on page flip; INP scroll path improved |
| Safety        | Auth-clear, signed URLs, composer ownership, zero hidden reserve all still green                                     |

---

## 10. Recommended next action

1. Land this plan doc.
2. Execute **Phase 0** on a dedicated branch (`cursor/viewer-gesture-a11y-…`) — closes
   `#214` / `#219` / partial `#215` with focused tests.
3. Then **Phase 1** extraction PR.
4. Only then start **Phase 2** visual redesign with `npm run ensure` + phone-chrome proof
   and a Clinical Governance Preflight on the PR.

Do not start Phase 2 by inventing a second phone composer or changing hide-reserve
semantics.

---

## 11. Residual risk

- Dual PDF engines may still confuse users until Phase 2 preference policy lands.
- Crop→page overlay depends on crop geometry quality from ingestion (separate worker debt;
  do not block viewer UX on perfect crops).
- Summarize-from-document remains a clinical answer path — redesign must not silently
  change grounding/fallback behaviour.
- Bundle budget can fail on large visual PRs even when routes are production-critical;
  watch `check:bundle-budget` early.
- Flightplan under-classified clinical/privacy behaviour; human PR policy must still
  apply governance text when source rendering changes.
