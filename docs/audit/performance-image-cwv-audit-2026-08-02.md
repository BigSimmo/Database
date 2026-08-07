# Performance, Image & Core Web Vitals Audit — Clinical KB Database

**Date:** 2026-08-02  
**Scope:** Production front-end routes and assets. Excludes `src/app/mockups/**`, `*-mockups.*`, `public/mockups/**`, backend/worker/ingestion, and API/database latency work already covered by `docs/audit/latency-audit-2026-07-28.md`.  
**Method:** Static, read-only code audit. No builds, browsers, provider calls, or code changes.  
**Skills applied:** `performance-review`, `largest-contentful-paint`, `cumulative-layout-shift`, `interaction-to-next-paint`, `render-blocking`, `lazy-loading`, `image-optimization`.

---

## 1. Executive summary

A seven-skill, code-only audit of the production front-end found **10 concrete performance findings** (all P2 or P3) and a number of controls that are already in good shape. No P0 or P1 findings were identified.

**Dominant themes:**

1. **Bundle & payload bloat from Therapy Compass.** The Therapy Compass workspace is statically imported by the shared search shell, so its module graph ships to every `(search-app)` route, and its 3.16 MB JSON catalogues are fetched entirely client-side.
2. **Cumulative Layout Shift on phone** from the overlay chrome reserve hook, already tracked as `#147`.
3. **Interaction latency in the PDF viewer** from a non-passive wheel listener and multiple `setTimeout` callbacks that can run during user interaction.
4. **CSS paint cost** from the shared `Skeleton` using a `background-position` shimmer, three stacked `backdrop-filter` passes in the glass header, and the universal `html.theme-transitioning *` selector.
5. **Image-optimization misses** in raw `<img>` tags (missing `decoding`, missing dimensions), a lazily-loaded source preview that may be above the fold, and demo PNGs not served in modern formats.

**Cross-audit note:** Most of these findings are already documented in `docs/audit/latency-audit-2026-07-28.md` and `docs/outstanding-issues.md` (notably `#016`, `#017`, `#013`, `#147`, `#117`). This report applies the requested seven skill lenses, reframes where the prior audit has already retired a finding, and adds a small number of new INP/LCP/code-shape observations.

---

## 2. Severity key

Per `docs/codex-review-protocol.md`:

- **P0:** data loss, security breach, production outage, clinical safety issue.
- **P1:** broken core workflow, unsafe automation, privacy/auth failure, repeatable defect blocking merge/handoff.
- **P2:** real defect, missing guardrail, fragile process, or test gap.
- **P3:** low-risk cleanup, clarity, documentation, or future-proofing.

This audit found no P0/P1 issues.

---

## 3. Top 10 severity-ranked findings

| #   | File                                                                    | Lines              | Skill(s)                               | Sev | One-line impact                                                                                             |
| --- | ----------------------------------------------------------------------- | ------------------ | -------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `src/components/clinical-dashboard/use-phone-overlay-chrome-reserve.ts` | 53-72              | CLS                                    | P2  | Stale phone header reserve causes 128 px layout shift on `/documents/search` and `/dsm`                     |
| 2   | `src/components/clinical-dashboard/shared-search-app-shell.tsx`         | 8                  | performance-review                     | P2  | Therapy Compass workspace statically imported into every `(search-app)` route                               |
| 3   | `src/components/therapy-compass/data/use-therapy-data.ts`               | 11, 36-56          | performance-review                     | P2  | Up to 3.16 MB of Therapy Compass JSON fetched client-side on mount, no SSR                                  |
| 4   | `src/app/layout.tsx`                                                    | 104                | render-blocking                        | P2  | Reading `headers()` for a per-request nonce opts all routes into dynamic rendering                          |
| 5   | `src/components/clinical-dashboard/use-app-preferences.ts`              | 156-183            | performance-review                     | P2  | `GET /api/account/preferences` → conditional `PUT` bootstrap is a sequential waterfall                      |
| 6   | `src/components/ClinicalDashboard.tsx`                                  | 960-1050           | performance-review                     | P2  | Local identity → `setup-status` → parallel fan-out of 4 is a sequential waterfall                           |
| 7   | `src/components/document-viewer/non-pdf-source-preview.tsx`             | 142-149            | largest-contentful-paint, lazy-loading | P2  | Main source-preview image is `loading="lazy"` and likely above the fold                                     |
| 8   | `src/components/document-viewer/use-viewer-gestures.ts`                 | 77                 | interaction-to-next-paint              | P2  | Wheel listener registered `{ passive: false }`, blocking compositor scroll                                  |
| 9   | `src/components/ui-primitives.tsx` + `src/app/globals.css`              | 499, 2565-2572     | render-blocking, performance-review    | P2  | Default `Skeleton` uses paint-based `background-position` shimmer                                           |
| 10  | `src/app/globals.css`                                                   | 856-895, 3231-3238 | render-blocking, CLS                   | P3  | Three stacked `backdrop-filter` passes and `theme-transitioning *` transition 6 properties on every element |

---

## 4. Per-skill findings

### 4.1 `performance-review`

#### PR-1: Therapy Compass barrel is statically imported into the shared search shell

- **File:** `src/components/clinical-dashboard/shared-search-app-shell.tsx`
- **Lines:** 8
- **Severity:** P2
- **Finding:** `TherapyCompassWorkspace` is imported at the top of the shared shell and only rendered for `/therapy-compass/*` paths. Because the import is static, the whole Therapy Compass module graph (`bindings.tsx`, `nav.tsx`, `workspace.tsx`, and their data dependencies) is included in the client chunk for every `(search-app)` route, inflating the bundle for routes that never mount it.
- **Evidence:** `import { TherapyCompassWorkspace } from "@/components/therapy-compass";` and the conditional render at lines 18-24.
- **Measurement needed:** `npm run build:analyze` to measure the transitive bundle impact on a non-therapy route.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-2; `docs/outstanding-issues.md` #016(f).
- **Recommended fix:** Convert the import and conditional render to `next/dynamic` with `ssr: false` and a `LoadingPanel` fallback, mirroring `clinical-dashboard-lazy.tsx`.

#### PR-2: Therapy Compass JSON catalogues are fetched client-side with no SSR

- **File:** `src/components/therapy-compass/data/use-therapy-data.ts`
- **Lines:** 11, 36-56, 77-119
- **Severity:** P2
- **Finding:** The hook fetches up to 3.16 MB of JSON (`therapies.json`, `therapies-index.json`, `therapies-home.json`, `pathways.json`, `reference.json`) from `/therapy-compass-data` on mount. The files are content-addressed and have an `immutable` cache header in `next.config.ts` (lines 132-141), so repeat visits revalidate cheaply, but the first visit still pays the full payload and parsing cost with no server-side rendering.
- **Evidence:** `const BASE = "/therapy-compass-data";` and `CATALOGUE_ALIASES` at lines 36-40; `useEffect` at lines 118-119 triggers the fetch.
- **Measurement needed:** Chrome DevTools Network panel on a cold `/therapy-compass` load to confirm transferred bytes and parse time.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-3; `docs/outstanding-issues.md` #016(c), #017.
- **Recommended fix:** Serve at least the small `therapies-home.json` from a Server Component or route loader, and defer the full/index catalogues until user interaction. Keep the existing content-addressed immutable caching for the heavy assets.

#### PR-3: Account preferences load is a sequential waterfall

- **File:** `src/components/clinical-dashboard/use-app-preferences.ts`
- **Lines:** 156-183
- **Severity:** P2
- **Finding:** After authentication, the effect does `GET /api/account/preferences`, and only if the body has no `preferences` does it await a `PUT /api/account/preferences`. The PUT cannot start until the GET response is read, making a two-hop sequential chain on the critical path of dashboard readiness.
- **Evidence:** `fetch("/api/account/preferences", { ... }).then(... const bootstrapResponse = await fetch("/api/account/preferences", { method: "PUT", ... }) ...)`.
- **Measurement needed:** Chrome DevTools Network waterfall on authenticated mount.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-6; `docs/outstanding-issues.md` #016(g).
- **Recommended fix:** Fire GET and the conditional PUT in parallel where semantically safe, or precompute whether a bootstrap is needed from local state.

#### PR-4: Dashboard load waits for identity, then setup-status, then parallel data fetches

- **File:** `src/components/ClinicalDashboard.tsx`
- **Lines:** 960-1050
- **Severity:** P2
- **Finding:** The dashboard boot path awaits local identity validation, then `setup-status`, and only then fans out four document/job/batch/quality fetches in `Promise.all`. The two preceding hops are strictly sequential before the parallel block starts.
- **Evidence:** `fetch("/api/setup-status", ...)` at lines 976-980; the `Promise.all` block begins at line 1034.
- **Measurement needed:** Chrome DevTools Network waterfall on dashboard mount.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-6; `docs/outstanding-issues.md` #016(g).
- **Recommended fix:** Investigate whether `setup-status` and the initial data fetches can start earlier (e.g., in parallel once identity is known) without breaking the demo-mode gate.

#### PR-5: Large clinical snapshot JSON is ESM-imported at module evaluation

- **File:** `src/lib/medication-snapshot.ts`, `src/lib/differential-fixtures.ts`, `src/lib/service-catalog.ts`
- **Lines:** 1
- **Severity:** P3
- **Finding:** Approximately 5.6 MB of snapshot JSON is imported at module evaluation (`medications-snapshot.json` 3.52 MB, `differentials-snapshot.json` 1.19 MB, `services-snapshot.json` 915 KB plus additional catalogues). This is a cold-start / memory cost, not a per-request latency cost.
- **Evidence:** `import medicationsSnapshot from "../../data/medications-snapshot.json";` and similar in each file.
- **Measurement needed:** `npm run build:analyze` to confirm these modules end up in the server bundle; local cold-start timing.
- **Existing reference:** `latency-audit-2026-07-28.md` L4-1; `docs/outstanding-issues.md` #013.
- **Recommended fix:** Consider lazy-loading these snapshots on first use or fetching them as JSON assets to reduce cold-start memory footprint.

#### PR-6: Lighthouse budget is not baselined and does not enforce

- **File:** `lighthouse-budget.json`
- **Lines:** 3, 13
- **Severity:** P3
- **Finding:** The Lighthouse budget exists but has `"enforce": false` and `"baseline": null`. It therefore cannot block a merge or provide a relative regression guard. The bundle budget (`bundle-budget.json`) is enforced.
- **Evidence:** `lighthouse-budget.json` lines 3 and 13.
- **Measurement needed:** A known-good production build + `npm run check:lighthouse-budget -- --update`.
- **Existing reference:** none.
- **Recommended fix:** Establish a baseline with `npm run check:lighthouse-budget -- --update` and set `enforce: true` once it has held across a few runs.

---

### 4.2 `largest-contentful-paint`

#### LCP-1: Source-preview image is lazy-loaded and may be the LCP element

- **File:** `src/components/document-viewer/non-pdf-source-preview.tsx`
- **Lines:** 142-149
- **Severity:** P2
- **Finding:** The main image for a document source page uses a native `<img>` with `loading="lazy"`. On `/documents/source/evidence` and similar routes this preview is likely the largest above-fold element, so lazy-loading it can push LCP behind the browser's lazy-load threshold and the image byte fetch.
- **Evidence:** `<img src={signedUrl} ... loading="lazy" decoding="async" ... />`.
- **Measurement needed:** Lighthouse LCP trace on `/documents/source/evidence` with `fetchpriority`/`loading` flags to confirm the element is the LCP and the lazy load is the cause.
- **Existing reference:** none.
- **Recommended fix:** Drop `loading="lazy"` if measurement confirms this is an LCP element, or make it conditional on an `aboveFold` prop. Add `fetchpriority="high"` and explicit `width`/`height` or ensure the `aspect-[4/3]` container remains in place.

#### LCP-2: No explicit priority path for above-fold `SignedImage`

- **File:** `src/components/clinical-dashboard/signed-image.tsx`
- **Lines:** 25-54
- **Severity:** P3
- **Finding:** `SignedImage` exposes `rootMargin` and `zoomable` but not a `priority` prop. Evidence images that render at the top of an answer therefore load through the `IntersectionObserver` (default 640 px rootMargin) instead of `priority`/`eager`, potentially delaying LCP for image-heavy answers.
- **Evidence:** Props interface at lines 25-54; `shouldLoad` is false by default unless the URL is cached.
- **Measurement needed:** Lighthouse LCP on an answer page with visual evidence to see whether an evidence image is the LCP.
- **Existing reference:** `latency-audit-2026-07-28.md` L6-3 (deliberate `unoptimized` design); `docs/outstanding-issues.md` #016(g).
- **Recommended fix:** Add an optional `priority` prop that skips `IntersectionObserver` and passes `priority` to `next/image` for callers that know the image is above the fold. Keep `unoptimized` for the signed-URL privacy invariant.

---

### 4.3 `cumulative-layout-shift`

#### CLS-1: Phone overlay chrome reserve publishes a stale initial value

- **File:** `src/components/clinical-dashboard/use-phone-overlay-chrome-reserve.ts`
- **Lines:** 53-72
- **Severity:** P2
- **Finding:** The hook calls `sync()` immediately in `useLayoutEffect`, then observes the header stack with `ResizeObserver`. The initial `sync()` can publish a stale reserve (e.g., 200 px) that is revised 15-60 ms later to the correct value (72 px), moving all main content down and back. This is documented as 100% of `/documents/search` CLS and ~75% of `/dsm` CLS.
- **Evidence:** `sync()` at line 72; the `ResizeObserver` setup at lines 76-79.
- **Measurement needed:** `npm run verify:phone-chrome` to produce a before/after CLS pair.
- **Existing reference:** `docs/outstanding-issues.md` #147.
- **Recommended fix:** Defer the first publish until the stack settles, or let the `ResizeObserver` be the only writer and trust the CSS seed (which is already correct) until it fires. Do not change the CSS seed.

#### CLS-2: Non-PDF source preview `<img>` has no explicit dimensions

- **File:** `src/components/document-viewer/non-pdf-source-preview.tsx`
- **Lines:** 142-149
- **Severity:** P3
- **Finding:** The source-preview image has no `width`/`height` attributes. The layout is currently protected by an `aspect-[4/3]` container, but if that container is ever removed or the intrinsic image ratio differs, the image can cause a layout shift.
- **Evidence:** `<img ... className="absolute inset-0 h-full w-full object-contain" />`.
- **Measurement needed:** Lighthouse CLS on a document source page with a slow image load.
- **Existing reference:** none.
- **Recommended fix:** Add explicit `width` and `height` attributes when the image metadata is available, or continue to require the `aspect-[4/3]` container.

---

### 4.4 `interaction-to-next-paint`

#### INP-1: PDF viewer wheel listener is non-passive

- **File:** `src/components/document-viewer/use-viewer-gestures.ts`
- **Lines:** 77
- **Severity:** P2
- **Finding:** The wheel listener is registered with `{ passive: false }` so it can call `event.preventDefault()` for zoom. Because the listener is attached to the document/viewer element, the browser cannot scroll on the compositor thread while it waits for this handler, even when `wheelNeedsModifier` is true and the handler returns early.
- **Evidence:** `element.addEventListener("wheel", onWheel, { passive: false });`.
- **Measurement needed:** Chrome DevTools Performance recording during wheel/pinch in the PDF viewer, or the INP panel in DevTools.
- **Existing reference:** none.
- **Recommended fix:** Attach the non-passive listener only when `wheelZoom && !wheelNeedsModifier` (i.e., when wheel zoom is active and no modifier is required), or use CSS `touch-action: pan-y pinch-zoom` where supported so the default scroll path stays passive.

#### INP-2: Multiple `setTimeout` callbacks can run during user interaction

- **File:** `src/components/ClinicalDashboard.tsx`, `src/components/document-viewer/pdf-canvas-viewer.tsx`, `src/components/clinical-dashboard/master-search-header.tsx`, `src/components/clinical-dashboard/focus-composer-input.ts`
- **Lines:** `ClinicalDashboard.tsx` 532-534, 547-549, 828-830, 1542-1543; `pdf-canvas-viewer.tsx` 170-173, 214-218; `master-search-header.tsx` 1113-1116; `focus-composer-input.ts` 12-14
- **Severity:** P3
- **Finding:** Several interaction-adjacent effects use `setTimeout` delays in the 120-500 ms range (hash nav lock, focus retry, portal retry, resize debounce, zoom re-raster, prefetch delay). If a user interacts while these callbacks fire, they can extend INP because the callbacks run on the main thread.
- **Evidence:** A representative snippet from `pdf-canvas-viewer.tsx` at line 216: `const timeout = window.setTimeout(() => setRenderZoom(zoom), 140);`.
- **Measurement needed:** Chrome DevTools Performance/INP recording during the relevant interactions.
- **Existing reference:** `latency-audit-2026-07-28.md` L6-1 (prefetch is a deliberate trade-off); `docs/outstanding-issues.md` #016.
- **Recommended fix:** Replace non-critical timeouts with `requestIdleCallback` (prefetch, portal retry), `requestAnimationFrame` (focus, resize, zoom), or schedule heavy re-raster work in a `scheduler-yield` / `MessageChannel` task. Keep the non-passive wheel fix separate (INP-1).

---

### 4.5 `render-blocking`

#### RB-1: Nonce CSP forces every route into dynamic rendering

- **File:** `src/app/layout.tsx`
- **Lines:** 104
- **Severity:** P2
- **Finding:** The root layout reads `headers()` to obtain the per-request CSP nonce. This opts the entire application into dynamic rendering, preventing static generation of the clinical catalogues (DSM, differentials, specifiers, formulation, etc.).
- **Evidence:** `const nonce = (await headers()).get("x-nonce") ?? undefined;`.
- **Measurement needed:** `next build` route table to confirm no routes are marked `○ Static`.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-8; `docs/outstanding-issues.md` #016(a).
- **Recommended fix:** Investigate Partial Prerendering (PPR) or a build-time/static nonce strategy that does not require per-request `headers()`. This is a security/rendering trade-off that needs careful review.

#### RB-2: Default `Skeleton` uses a paint-based `background-position` shimmer

- **File:** `src/components/ui-primitives.tsx`, `src/app/globals.css`
- **Lines:** `ui-primitives.tsx` 499; `globals.css` 156, 2565-2572
- **Severity:** P2
- **Finding:** The default `Skeleton` primitive uses `motion-safe:animate-shimmer`, which animates `background-position`. This is a paint (not compositor) animation and can jank on low-end devices. A GPU-friendly alternative, `animate-skeleton-shimmer` (`shimmer-sweep` keyframe at `globals.css` 2894-2897), already exists but is not used by the default component.
- **Evidence:** `className={cn("...", "motion-safe:animate-shimmer", className)}` at `ui-primitives.tsx` 499; `@keyframes shimmer { from { background-position: -150% 0; } to { background-position: 250% 0; } }`.
- **Measurement needed:** Chrome DevTools Performance recording on a page with many skeletons.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-7; `docs/outstanding-issues.md` #016(g).
- **Recommended fix:** Switch the default `Skeleton` to `animate-skeleton-shimmer` and delete or deprecate the paint-based `shimmer` keyframe.

#### RB-3: Heavy backdrop-filter and theme-transitioning CSS

- **File:** `src/app/globals.css`
- **Lines:** 818-832 (box-shadow in transition), 856-895 (three stacked backdrop-filter passes), 3231-3238 (`theme-transitioning *`)
- **Severity:** P3
- **Finding:** The glass header uses three masked `backdrop-filter` passes on an always-mounted element; `box-shadow` is listed in the `answer-footer-search-pill` `transition`; and `html.theme-transitioning *` forces a 200 ms transition on six properties for every element during theme changes. These are real paint/composite costs but are either gated by reduced motion or scoped to user-triggered state.
- **Evidence:** `.edge-glass-header-backdrop` with `::before` and `::after` blur passes; `.answer-footer-search-pill` `transition` includes `box-shadow 180ms`; `html.theme-transitioning *` selector.
- **Measurement needed:** Chrome DevTools Performance recording during scroll, hover, and theme toggle.
- **Existing reference:** `latency-audit-2026-07-28.md` L3-7; `docs/outstanding-issues.md` #016(g).
- **Recommended fix:** Remove `box-shadow` from the transition list; reduce the stacked blur passes to one where visually acceptable; scope `theme-transitioning` to the elements that actually change instead of the universal selector.

---

### 4.6 `lazy-loading`

#### LL-1: Document source preview is lazy-loaded

- **File:** `src/components/document-viewer/non-pdf-source-preview.tsx`
- **Lines:** 145-146
- **Severity:** P2 (as an LCP risk; see LCP-1)
- **Finding:** The source-preview `<img>` has `loading="lazy"`. If this image is the largest above-fold element on the route, lazy loading directly delays LCP.
- **Evidence:** `<img ... loading="lazy" ... />`.
- **Measurement needed:** Lighthouse LCP on document source pages.
- **Existing reference:** none.
- **Recommended fix:** Make `loading` conditional on an `aboveFold` prop, defaulting to `eager` for the primary preview.

#### LL-2: Several heavy surfaces are already code-split with accessible fallbacks

- **File:** `src/components/clinical-dashboard/clinical-dashboard-lazy.tsx`
- **Lines:** 14-73
- **Severity:** N/A (positive finding)
- **Finding:** All 10 lazy dashboard surfaces use `next/dynamic` with `ssr: false` and a `LoadingPanel` fallback that announces `role="status"`. This matches the latency audit L3-4 remediation.
- **Evidence:** `DifferentialsHome`, `FavouritesHub`, `MedicationPrescribingWorkspace`, etc. each with `loading: () => <LoadingPanel ... />`.
- **Measurement needed:** n/a
- **Existing reference:** `latency-audit-2026-07-28.md` L3-4 (APPLIED).
- **Recommended fix:** None.

---

### 4.7 `image-optimization`

#### IO-1: `non-pdf-source-preview.tsx` uses a raw `<img>` without dimensions

- **File:** `src/components/document-viewer/non-pdf-source-preview.tsx`
- **Lines:** 142-149
- **Severity:** P3
- **Finding:** The image uses a raw `<img>` tag, not `next/image`, and lacks `width`/`height` attributes. The `aspect-[4/3]` container currently protects layout, but explicit dimensions would provide a stronger CLS guard and let the browser reserve intrinsic size earlier.
- **Evidence:** `<img ... className="absolute inset-0 h-full w-full object-contain" />`.
- **Measurement needed:** Lighthouse CLS with a slow/throttled image.
- **Existing reference:** none.
- **Recommended fix:** Add explicit `width` and `height` if the backend can provide them, or use `next/image` with `unoptimized` (since the URL is a signed, private blob) and a known aspect ratio.

#### IO-2: Lightbox and PWA images lack `decoding="async"`

- **File:** `src/components/clinical-dashboard/image-lightbox.tsx`, `src/components/pwa-lifecycle.tsx`
- **Lines:** `image-lightbox.tsx` 113-123; `pwa-lifecycle.tsx` 149-156
- **Severity:** P3
- **Finding:** Both images use raw `<img>` tags without `decoding="async"`. The lightbox image is user-triggered, so the impact is low; the PWA icon is small (56 px). These are minor, easy wins.
- **Evidence:** `<img src={url} ... />` in `image-lightbox.tsx`; `<img src="/icons/icon-192" ... width={56} height={56} />` in `pwa-lifecycle.tsx`.
- **Measurement needed:** n/a for code-shape findings.
- **Existing reference:** none.
- **Recommended fix:** Add `decoding="async"` to both.

#### IO-3: Demo-document PNGs are not in modern formats

- **File:** `public/demo-documents/clozapine-table.png`, `public/demo-documents/risk-flow.png`
- **Lines:** n/a
- **Severity:** P3
- **Finding:** The two production public raster images are PNG. Converting them to WebP/AVIF would reduce transfer size. `clozapine-table.png` is 79.5 KB; `risk-flow.png` was not measured.
- **Evidence:** `find_file_by_name public/**/*.{png,jpg,...}` returned only these two non-mockup rasters.
- **Measurement needed:** Convert and compare file sizes.
- **Existing reference:** none.
- **Recommended fix:** Serve these as WebP/AVIF with PNG fallbacks, or move them to a static CDN with modern formats. Ensure `next/image` or `<picture>` is used so the browser selects the smallest supported format.

#### IO-4: `next.config.ts` image configuration is well-tuned

- **File:** `next.config.ts`
- **Lines:** 53-81
- **Severity:** N/A (positive finding)
- **Finding:** `next.config.ts` enables AVIF and WebP, defines responsive `deviceSizes` and `imageSizes`, and restricts `remotePatterns` to Supabase Storage hostnames. This is a strong configuration for `next/image`.
- **Evidence:** `images: { formats: ["image/avif", "image/webp"], deviceSizes: [...], imageSizes: [...], remotePatterns: [...] }`.
- **Measurement needed:** n/a
- **Existing reference:** `latency-audit-2026-07-28.md` L3 notes.
- **Recommended fix:** None.

#### IO-5: `SignedImage` is deliberately unoptimized

- **File:** `src/components/clinical-dashboard/signed-image.tsx`
- **Lines:** 25-54, 128-144
- **Severity:** N/A (deliberate design)
- **Finding:** `SignedImage` uses `next/image` with `unoptimized` because the signed URLs are private bearer URLs that must not enter the unauthenticated `/_next/image` cache. CLS is handled by a fixed 4:3 aspect frame. This is an accepted trade-off.
- **Evidence:** `<Image ... unoptimized ... />` and the fixed `aspect-[4/3]` frame.
- **Measurement needed:** n/a
- **Existing reference:** `latency-audit-2026-07-28.md` L6-3; `docs/outstanding-issues.md` #014 (resolved).
- **Recommended fix:** None.

---

## 5. Findings already addressed or not applicable

The following were raised by the requested skills but were found to be already applied, already retired, or deliberate design:

| Skill              | Original concern                                                                                | Status                   | Evidence                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| render-blocking    | Route-group layout `src/app/(search-app)/layout.tsx` importing 71.6 KB of `therapy-compass.css` | **Retired**              | `layout.tsx` no longer imports any CSS; `globals.css:3387` notes the therapy-compass CSS is now token-backed Tailwind on components              |
| lazy-loading       | `ssr: false` surfaces rendering nothing while their chunk loads                                 | **Applied**              | `clinical-dashboard-lazy.tsx` lines 14-73; all 10 surfaces now have `LoadingPanel` fallbacks with `role="status"`                                |
| LCP                | No `preconnect`/`dns-prefetch` to Supabase                                                      | **Applied**              | `src/app/layout.tsx` lines 123-128; `preconnect` with `crossOrigin` and `dns-prefetch` emitted when `authOrigin` is set                          |
| image-optimization | `SignedImage` should not be cached by `/_next/image`                                            | **Deliberate**           | `src/components/clinical-dashboard/signed-image.tsx` uses `unoptimized` for private signed URLs; fixed aspect frame for CLS                      |
| performance-review | Mode-home dashboard prefetch is unconditional                                                   | **Deliberate trade-off** | `ClinicalDashboard.tsx` line 828; documented as a measured trade-off in `latency-audit-2026-07-28.md` L6-1 and `docs/outstanding-issues.md` #016 |

---

## 6. Cross-audit reconciliation

This audit is complementary to `docs/audit/latency-audit-2026-07-28.md` and `docs/outstanding-issues.md`. The table below maps the new skill-lens findings to the existing records.

| New finding                             | Existing reference                      | Relationship                                                              |
| --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| PR-1 (Therapy Compass barrel)           | `latency-audit` L3-2, `#016(f)`         | Same finding; still open and unaddressed                                  |
| PR-2 (Therapy Compass JSON client-side) | `latency-audit` L3-3, `#016(c)`, `#017` | Same finding; cache headers are now correct but payload/SSR issue remains |
| PR-3 (preferences waterfall)            | `latency-audit` L3-6, `#016(g)`         | Same finding                                                              |
| PR-4 (dashboard setup waterfall)        | `latency-audit` L3-6, `#016(g)`         | Same finding                                                              |
| PR-5 (snapshot JSON cold start)         | `latency-audit` L4-1, `#013`            | Same finding                                                              |
| PR-6 (Lighthouse budget not baselined)  | none                                    | New observation                                                           |
| LCP-1/LCP-2                             | `#016(g)` (general client waterfalls)   | New LCP-specific framing for the source preview and evidence images       |
| CLS-1 (phone chrome reserve)            | `docs/outstanding-issues.md` #147       | Same finding; primary open CLS defect                                     |
| RB-1 (nonce CSP → dynamic)              | `latency-audit` L3-8, `#016(a)`         | Same finding                                                              |
| RB-2 (paint-based skeleton)             | `latency-audit` L3-7, `#016(g)`         | Same finding                                                              |
| RB-3 (backdrop/theme transitions)       | `latency-audit` L3-7, `#016(g)`         | Same finding                                                              |
| INP-1 (non-passive wheel)               | none                                    | New finding, not in latency audit                                         |
| INP-2 (setTimeout interactions)         | `#016`, `#017` general context          | New INP-specific framing of existing timeout patterns                     |
| IO-1/IO-2/IO-3                          | none                                    | New image-optimization findings not previously filed                      |

---

## 7. Recommended fix backlog

| #   | File(s)                                                                                                 | Skill                                 | Sev | Recommended fix                                                                                                                  | Effort       | Measurement needed                              |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------- |
| 1   | `use-phone-overlay-chrome-reserve.ts`                                                                   | CLS                                   | P2  | Remove the immediate `sync()` call; let `ResizeObserver` be the first writer, or defer the first publish until the stack settles | Small        | `npm run verify:phone-chrome`                   |
| 2   | `shared-search-app-shell.tsx`                                                                           | performance-review                    | P2  | `next/dynamic` the `TherapyCompassWorkspace` import with `ssr: false` and a `LoadingPanel` fallback                              | Small        | `npm run build:analyze` before/after            |
| 3   | `use-therapy-data.ts` + therapy routes                                                                  | performance-review                    | P2  | SSR the minimal `therapies-home.json` catalogue; defer full/index loads to user interaction                                      | Medium       | Lighthouse on `/therapy-compass` cold load      |
| 4   | `src/app/layout.tsx`                                                                                    | render-blocking                       | P2  | Investigate PPR or a static nonce strategy so clinical catalogues can be statically generated                                    | Medium       | `next build` route table (`○` vs `ƒ`)           |
| 5   | `use-app-preferences.ts`                                                                                | performance-review                    | P2  | Parallelize GET and conditional PUT where safe, or precompute bootstrap need                                                     | Small        | DevTools Network waterfall                      |
| 6   | `ClinicalDashboard.tsx`                                                                                 | performance-review                    | P2  | Start `setup-status` and initial data fetches in parallel once identity is known                                                 | Medium       | DevTools Network waterfall                      |
| 7   | `non-pdf-source-preview.tsx`                                                                            | LCP, lazy-loading, image-optimization | P2  | Make `loading` conditional on `aboveFold`; add explicit `width`/`height`; add `decoding="async"`                                 | Small        | Lighthouse LCP/CLS on document source pages     |
| 8   | `use-viewer-gestures.ts`                                                                                | INP                                   | P2  | Attach non-passive wheel listener only when unmodified wheel zoom is active; otherwise keep the default passive scroll path      | Small        | DevTools Performance/INP during PDF wheel/pinch |
| 9   | `ui-primitives.tsx` + `globals.css`                                                                     | render-blocking, performance-review   | P2  | Switch default `Skeleton` to `animate-skeleton-shimmer`; remove paint-based `shimmer` keyframe                                   | Small        | DevTools Performance with many skeletons        |
| 10  | `image-lightbox.tsx`, `pwa-lifecycle.tsx`                                                               | image-optimization                    | P3  | Add `decoding="async"`                                                                                                           | Tiny         | n/a                                             |
| 11  | `public/demo-documents/*.png`                                                                           | image-optimization                    | P3  | Convert to WebP/AVIF with PNG fallback                                                                                           | Small        | File-size comparison                            |
| 12  | `globals.css`                                                                                           | render-blocking, CLS                  | P3  | Remove `box-shadow` from transition; reduce stacked `backdrop-filter` passes; scope `theme-transitioning`                        | Small-Medium | DevTools paint cost                             |
| 13  | `ClinicalDashboard.tsx`, `pdf-canvas-viewer.tsx`, `master-search-header.tsx`, `focus-composer-input.ts` | INP                                   | P3  | Replace non-critical `setTimeout` with `requestIdleCallback`/`requestAnimationFrame` or yield scheduler                          | Medium       | DevTools INP trace                              |
| 14  | `signed-image.tsx`                                                                                      | LCP                                   | P3  | Add optional `priority` prop for above-fold evidence images                                                                      | Small        | Lighthouse LCP on answer pages                  |
| 15  | `lighthouse-budget.json`                                                                                | performance-review                    | P3  | Establish a baseline and set `enforce: true`                                                                                     | Small        | `npm run check:lighthouse-budget -- --update`   |
| 16  | `lib/medication-snapshot.ts` etc.                                                                       | performance-review                    | P3  | Lazy-load or fetch large snapshot JSON on first use                                                                              | Medium       | Cold-start memory/time measurement              |

---

## 8. Appendix: scope and inventory

### 8.1 In scope

- `next.config.ts`
- `bundle-budget.json`, `lighthouse-budget.json`
- `src/app/layout.tsx`, `src/app/globals.css`
- `src/app/(search-app)/**` (excluding mockups)
- `src/components/clinical-dashboard/**`
- `src/components/DocumentViewer.tsx` and `src/components/document-viewer/**`
- `src/components/therapy-compass/**` and `src/components/calculators/**`
- `src/lib/brand-image.tsx`, `src/app/opengraph-image.tsx`
- `public/demo-documents/**`, `public/icons/**`, `public/manifest.webmanifest`, `public/sw.js`

### 8.2 Out of scope

- `src/app/mockups/**` and any `*-mockups.*` files
- `public/mockups/**`
- Backend API routes, database queries, worker/ingestion pipelines
- Provider calls, live Lighthouse, Playwright, browser automation

### 8.3 Production public raster images

Only two non-mockup rasters were found under `public/`:

- `public/demo-documents/clozapine-table.png` — 79,558 bytes
- `public/demo-documents/risk-flow.png` — 78,255 bytes

### 8.4 Verification commands that would confirm code-shape findings

| Finding                  | Command / method                                               |
| ------------------------ | -------------------------------------------------------------- |
| Bundle impact            | `npm run build:analyze`                                        |
| Phone chrome CLS         | `npm run verify:phone-chrome`                                  |
| Lighthouse LCP/CLS       | `npm run check:lighthouse-budget -- --update` (after baseline) |
| INP/wheel scroll         | Chrome DevTools Performance recording on PDF viewer            |
| Image format savings     | Convert `public/demo-documents/*.png` to WebP/AVIF and `stat`  |
| Static vs dynamic routes | `next build` and inspect the route table                       |

---

_Generated from a 7-skill code-only audit. No code changes were made._
