# Document viewer redesign — PDF + photo surfaces

**Status:** programme plan (Phases 0–3 landed; only Phase 3's crop overlay and the optional Phase 4 polish remain)  
**Branch seed:** `cursor/document-viewer-redesign-plan-1db8`  
**Flightplan evidence:** `.local/workflow-evidence/2026-08-06T17-27-05-553Z-flightplan.json`  
**Related ledger:** `#214` / `#219` resolved; `#215` residual (PWA/demo WebP) optional  
**Landed:** Phase 0 [#1660](https://github.com/BigSimmo/Database/pull/1660), Phase 1 [#1665](https://github.com/BigSimmo/Database/pull/1665), Phase 2 [#1741](https://github.com/BigSimmo/Database/pull/1741), Phase 3 [#1772](https://github.com/BigSimmo/Database/pull/1772)  
**Phase details:** [`document-viewer-phase2-unified-chrome.md`](./document-viewer-phase2-unified-chrome.md) · [`document-viewer-phase3-handover.md`](./document-viewer-phase3-handover.md)

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

### Phase 0 — Measurement unblocking (small, own PR) — **DONE** (#1660)

**Goal:** fix known INP/a11y debt so redesign work can be measured honestly.

| Work                                                                                                                                         | Closes           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Conditional non-passive wheel in `use-viewer-gestures.ts` (passive scroll by default; non-passive only when unmodified wheel-zoom is active) | `#214`           |
| Announce PDF canvas + any remaining post-load preview failures (`role=alert` and/or LiveAnnouncer)                                           | `#219`           |
| `decoding=async` on lightbox `<img>`; optional `priority` on above-fold `SignedImage`                                                        | `#215` (partial) |

**Verify:** focused gesture + DOM a11y tests; manual INP spot-check on PDF scroll.  
**Stop:** do not break Ctrl/⌘+wheel or trackpad pinch zoom.

### Phase 1 — Shell extraction without UX rewrite — **DONE** (#1665)

**Goal:** make `DocumentViewer.tsx` a thin orchestrator so design work is safe.

Extract (behaviour-preserving):

- Signed-URL / preview load machine
- Composer + phone chrome wiring
- PDF mode preference + dynamic import boundary
- Summarize stream controller (keep clinical output semantics)

Clarify `document-viewer-lazy` naming vs real dynamic boundaries.

**Verify:** shell/DOM contracts, pdf-reader-lazy, client-performance-boundaries,
`document-detail-performance`, `verify:phone-chrome` (dry-run then focused).

### Phase 2 — Unified viewing chrome (design + approach) — **DONE** (#1741)

**Goal:** dramatic visual/UX convergence without changing clinical content.

**Detailed safe-rollout plan (sub-PRs 2a–2e, gates, stop rules):**
[`document-viewer-phase2-unified-chrome.md`](./document-viewer-phase2-unified-chrome.md)

1. Deepen `DocumentFrame` adoption toward COMPONENTS §6 — shared zoom/fit/page metadata
   chrome for PDF canvas and image stages; keep viewing-aid off by default and forced off
   for print/zoomed figures. (**PR 2a**)
2. Route whole-document images through the same immersive viewer as crops (`ImageLightbox`
   or in-frame immersive mode sharing gestures). (**PR 2b**)
3. Figure rail → compact filmstrip / gallery with page badges; click syncs PDF page. (**PR 2c**)
4. Revisit native vs canvas: primary = canvas; native as “browser zoom” advanced option
   after parity checklist. (**PR 2d**)
5. Intentionally add 2–3 motions (zoom settle, lightbox open, page crossfade) that respect
   `prefers-reduced-motion`. (**PR 2e**, last)

**Verify:** per sub-PR focused contracts → `verify:pr-local`; phone-chrome only when sheet/composer
touched. Update `docs/search-chrome-behaviour.md` only if ownership semantics change (prefer not to).

### Phase 3 — Functionality + optimisation — **DONE except crop overlay**

**Goal:** make the viewer feel native and stay fast on long documents.

Execution brief: [`document-viewer-phase3-handover.md`](./document-viewer-phase3-handover.md).

| Capability                               | Status                                                                                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-page virtualization                | **Done** — windowed page column, document-wide live-canvas budget, idle ±1 render-ahead                                                                                                                                                 |
| Crop → page overlay                      | **Out of scope, now tracked as a ledger row** — needs `bbox` through `DocumentDetailImage` and `ImageRow`                                                                                                                               |
| Keyboard reading mode                    | **Done** — Page Up/Down, Home/End, `f` fit, `r` rotate; `docs/wiring-conventions.md`                                                                                                                                                    |
| Rail virtualization                      | **Done** — `DocumentImageList` windows `#source-images` and the audit list                                                                                                                                                              |
| Smarter signed-URL / decode priority     | **Done** — explicit `fetchPriority`, tighter rail root margin; batch route still deferred (`#283`)                                                                                                                                      |
| Toolbar density                          | ~~Phase 3~~ — already shipped in Phase 2 (`document-frame.tsx`, `hidden sm:inline` + overflow menu)                                                                                                                                     |
| Optional OffscreenCanvas / worker raster | **Not implemented, by design** — virtualization already keeps the reader's page count low, so the main-thread paint cost this was conditioned on is not known to be a problem. Do not implement it until CI page-flip timings show one. |

Phase 3 also closed `#279`: `tests/ui-document-canvas.spec.ts` is the first browser gate over the
viewer's raster, reading pixels back rather than trusting canvas dimensions.

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

1. ~~Land this plan doc.~~ Done (#1659).
2. ~~Execute **Phase 0**.~~ Done (#1660).
3. ~~**Phase 1** extraction.~~ Done (#1665).
4. ~~Execute **Phase 2**~~ Done (#1741, with Phase 0–2 squashed as `42f87ca`).
5. ~~Execute **Phase 3**~~ Done, except crop → page overlay — see the Phase 3 table above.
6. Crop → page overlay is the one remaining Phase 3 capability. It needs `bbox` plumbed from
   `src/lib/document-detail.ts` (already SELECTed) through `DocumentDetailImage` in
   `src/lib/document-detail-contract.ts`; scope it as a contract change, not a viewer change.
7. Do not invent a second phone composer or change hide-reserve semantics.

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
