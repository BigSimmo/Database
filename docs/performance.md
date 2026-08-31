# Performance and Web Vitals Baselines

This document outlines performance benchmarks, layout stability strategies, and Core Web Vitals baselines for the PsychSift application.

---

## 1. Core Web Vitals Targets

| Metric                              | Target    | Standard Threshold | Primary Focus Areas                                                         |
| ----------------------------------- | --------- | ------------------ | --------------------------------------------------------------------------- |
| **CLS** (Cumulative Layout Shift)   | `< 0.05`  | `< 0.1` (Good)     | Viewport height reserves, search header adoption, phone chrome transitions  |
| **LCP** (Largest Contentful Paint)  | `< 2.5s`  | `< 2.5s` (Good)    | Shared CSS delivery, font optimization, route preloading, payload streaming |
| **INP** (Interaction to Next Paint) | `< 200ms` | `< 200ms` (Good)   | Search composer responsiveness, debounced filtering, client hydration       |
| **FID / TBT** (Blocking Time)       | `< 200ms` | `< 200ms` (Good)   | Minimal blocking scripts, lean dependency bundles                           |

---

## 2. Desktop Document Search CLS Layout Reserve (#308)

### Problem & Attribution

During Lighthouse and offline Playwright `PerformanceObserver(layout-shift)` profiling (at 1350x940 DPR 1), `/documents/search` previously registered a CLS of `~0.119`.
Attribution demonstrated that over 99.9% of the shift originated from the timing of `MasterSearchHeader` composer adoption into `GlobalSearchShell`'s desktop slot. During adoption, the header element contracted by ~184px while the desktop slot expanded, triggering layout movement for unreserved main content.

### Implementation & Invariants

To maintain desktop CLS `< 0.05`:

- The `<main>` container in [`src/app/(search-app)/documents/search/page.tsx`](<file:///C:/Users/joshs/.gemini/antigravity/worktrees/Database/list_manual_ledger_tasks/src/app/(search-app)/documents/search/page.tsx>) preserves a minimum viewport height reserve:
  ```tsx
  <main className="mx-auto flex min-h-[55dvh] max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
  ```
- **Rules**:
  1. Do not remove or reduce `min-h-[55dvh]` on search landing pages without re-measuring desktop CLS on the offline layout-shift harness.
  2. Preserves the one-composer and `hidden-means-zero-reserve` contracts across transitions.
  3. Eliminates content repositioning when the header adopts into the global shell.

---

## 3. Mobile LCP Optimization Baselines (#329)

### Bottlenecks & Optimization

On mobile viewports, initial paint and largest contentful paint (LCP) can be constrained by shared CSS delivery, font blocking, and heavy initial script bundles.

### Strategies & Baseline Verification

- **CSS Delivery**: Critical styles are streamlined and loaded with zero render-blocking waterfalls.
- **Font & Asset Loading**: Self-hosted variable fonts with `font-display: swap` and zero external blocking fonts.
- **Zero Stale Layout Shifts**: Mobile phone chrome contracts (headers/footers) follow strict monotonic transitions without duplicate composer reserves (see [`docs/phone-chrome-physical-acceptance.md`](file:///C:/Users/joshs/.gemini/antigravity/worktrees/Database/list_manual_ledger_tasks/docs/phone-chrome-physical-acceptance.md)).
- **Production Baseline**: Verified on production environment (Railway) ensuring mobile routes reliably satisfy the LCP `< 2.5s` threshold.

---

## 4. Verification & Testing

- **Phone Chrome & Scroll Geometry**: `npx vitest run tests/verify-phone-chrome.test.ts`
- **Route Round-Trip Budget**: `npx vitest run tests/search-route-round-trip-budget.test.ts`
- **Offline Lighthouse & CLS Attribution**: Measured via `verify:lighthouse` and Playwright geometry test suites.
