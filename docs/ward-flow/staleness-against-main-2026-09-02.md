# ⚠️ The 228-behind IS a hazard. I expected it not to be.

**Measured 2026-09-02 at `488b2e7d4`, read-only, local git objects only — no fetch, no network.**
Merge base with `origin/main`: `b183dc65a`. Live figures: **228 behind, 781 ahead** (the session-start
banner said 227/780; treat these as current and the banner as a moment-in-time drift).

## The verdict is OVERLAP, not "irrelevant"

`origin/main` has changed **1,205 files** since the merge base, and the intersection with Ward Flow is
not empty in any category that matters.

### Ward source — 18 files under `src/components/ward-management/`

```
coordinator/coordinator.module.css      coordinator/flow-diagram.tsx
coordinator/shortlist-panel.tsx         discharges/discharge-board.tsx
officer/officer.module.css              tracker/live-tracker.module.css
ward-demo-controls.module.css           ⚠️ ward-flow-provider.tsx
ward-management-console.tsx             ward-management-modes.module.css
ward-management-modes.tsx               ward-management-navigation.tsx
ward-management-network.module.css      ward-management.module.css
ward-reduced-motion.module.css          ward-role-switcher.module.css
ward-sidebar-content.tsx                ward-sidebar.module.css
```

⚠️ **`ward-flow-provider.tsx` is the state provider.** ⚠️ **`shortlist-panel.tsx` is one of the
placement dispatchers allocation B is about — and Ward Builder Two edited it today.**

### Ward tests — 7 files

```
tests/ward-capacity-view.dom.test.tsx      tests/ward-clinical-rail-token-bridge.test.ts
tests/ward-discharge-board.dom.test.tsx    tests/ward-flow-provider.dom.test.tsx
tests/ward-management-role.dom.test.tsx    tests/ward-management-role.test.ts
tests/ui-ward-roles.spec.ts
```

### ⚠️ Indirect, via imports — the category nobody would have checked

Every `import` across the 43 `.tsx` files under `ward-management/` was resolved to a repo path and
intersected. Three non-ward files that ward screens import **have changed on `origin/main`**:

```
src/components/ui-primitives.tsx            <- imported by multiple ward screens
src/components/ui/sheet.tsx                 <- imported by multiple ward screens
src/components/clinical-dashboard/brand.tsx
```

⚠️ **A behaviour change in these ripples into ward screens without touching one ward-named file** —
so a name-based staleness check would have reported all-clear.

### ⚠️ Gate configuration changed too

```
package.json · package-lock.json · playwright.config.ts · tsconfig.typecheck.json
eslint-rules/require-lucide-icon-aria.mjs
```

`vitest.config.mts` and the root ESLint config did **not** change. But dependency versions differ, and
**the UI test runner config and the typecheck project config are both different on `origin/main`** —
either can change what a gate _does_ with zero content overlap.

### The only genuinely empty category

`src/lib/ward*` — **EMPTY**, and shown to be a real absence: the grep exited 1 with no output, and a
control intersection against a filename known to be in the change list returned non-empty, so the
method was not silently broken.

## What this means, and what it does not

**It does NOT mean stop and merge `origin/main` now.** That is a 1,205-file merge into a branch 781
commits ahead, with four chats mid-build, and it would be the single most destabilising thing anyone
could do today. **It is not authorised and I am not proposing it.**

**It DOES mean three things, immediately:**

1. ⚠️ **Nobody may say "we are only 228 behind, it is all unrelated."** It is not all unrelated. That
   sentence was about to become received wisdom and it is false.
2. ⚠️ **Any Ward Flow work that eventually reaches `main` will meet a real merge**, concentrated in
   the provider, the modes/navigation shell, the shortlist panel, and the shared UI primitives.
   **`shortlist-panel.tsx` is the sharpest: changed on both sides today.**
3. ⚠️ **Gate behaviour may differ between here and `main`.** A green here is a green under _this_
   branch's `playwright.config.ts`, `tsconfig.typecheck.json` and lockfile — **not a prediction about
   CI.** Every green reported today carries that boundary whether or not it was stated.

## The thing I got wrong about my own instinct

I expected "no overlap" and would have accepted a name-based check that said so. ⚠️ **The import-graph
category — three shared UI files that no ward-named search would ever surface — is the one that would
have made a clean report false.** An absence is only worth what the search behind it can find.
