# Ward Flow Navigation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ward Flow one navigation shell — the ground its panels float on, the role switcher, and the place you are in — mounted once rather than reinvented per screen, and **without adding a second chrome owner** to a surface that already has two stacked phone bars nobody guards.

**Architecture:** `ClinicalRail` already mounts on every Ward Flow screen and already owns the phone bar. This plan does **not** build a new shell beside it; it gives the existing owner a header region and a ground-painting wrapper. Everything else in this plan exists to stop that addition from breaking a rule that is currently unenforced on this surface.

**Tech Stack:** Next.js 16, React 19, TypeScript 6 strict, CSS Modules with `composes`, Vitest, Playwright.

**Depends on:** `docs/superpowers/plans/2026-09-04-ward-flow-design-foundation.md` — Tasks 1 (`.wardTokens`), 2 (`.panel`), 4b (`.wardName`, `.hero`). Do not start before Task 1 lands.

---

## Global Constraints

All Global Constraints of the foundation plan apply unchanged. These are additional, and each one is a measured fact rather than a preference.

- **Ward Flow only.** No file outside `src/components/ward-management/`, `src/app/mockups/ward-flow/`, `tests/ward-*` may change. In particular **do not modify `PhoneHeaderCollapsePortal`, `use-hide-on-scroll.ts`, `master-search-header.tsx` or `docs/search-chrome-behaviour.md`** — they serve twelve other routes.
- ⚠️ **THE APP'S SHARED COLLAPSE SLOT DOES NOT EXIST ON THIS SURFACE, AND ADOPTING IT WOULD BE A SILENT NO-OP.** Measured 2026-09-04 on `codex/task-ward-flow-live-state-20260831`: `#phone-header-collapse-addon-slot` is rendered by exactly one component, `src/components/clinical-dashboard/master-search-header.tsx`, and `src/app/mockups/ward-flow/layout.tsx` mounts `DeveloperAreaGate > WardFlowProvider > children` — no `GlobalSearchShell`, no `ClinicalDashboard`. `PhoneHeaderCollapsePortal` reads `phoneHost ? createPortal(children, phoneHost) : children` (`phone-header-collapse-portal.tsx:34`), so on a ward route it finds nothing and renders in place. **Wrapping the Ward Flow header in it would look like compliance, change nothing, and pass every test.**
- ⚠️ **NO COMMITTED GUARD ENFORCES THE ONE-OWNER RULE ON WARD FLOW.** Read 2026-09-04: every assertion in `tests/header-scroll-hide-contract.test.ts` is a `toContain` against a hard-coded source path — `documentViewerSource`, `differentialDetailSource`, `inPageNavHeaderSource`, `registryModeNavSource` — and **none of them points anywhere under `src/components/ward-management/`**. `tests/mode-nav-addon-slot.dom.test.tsx` counts slot occupants only for the routes it mounts, and mounts no Ward Flow component. `scripts/phone-chrome-plan.mjs:38-73` lists no ward pattern, so a ward-only change classifies as `unknownUi` and escalates to a blanket `verify:ui` (line 138), which asserts nothing about header count. **Task 5 exists because of this.**
- ⚠️ **WARD FLOW ALREADY STACKS TWO PHONE BARS, UNDETECTED.** `.phoneBar` is `position: fixed; top: 0` below 40rem (`ward-sidebar.module.css:271-291`) and `.workspaceHeader` is `position: sticky; top: var(--spacing-ward-phone-bar)` below 40rem (`ward-management.module.css:823-826`), on the patient workspace. Two further screens declare their own `position: fixed` bottom bars (`coordinator.module.css:1910` `.shortlistActionRow`, `officer.module.css:216` `.actionRow`) — both bottom-edge action rows with documented edge-to-edge reasoning, not top chrome. **The header this plan adds must not become a third top element.**
- **Exactly one `<h1>` and one `<main id="main-content">` per route.** `tests/ward-landmarks.test.ts:267` and `:251` assert this across **31 renderable routes**. The shell must add neither.
- **Every guard ships with a mutation step naming the expected message.**

---

## The three decisions, and the evidence for each

### Decision 1 — the ward or team you are in stays in the PAGE. The header carries the role.

**Settled by counting the approved prototypes, not by preference.** Of the ten, the place you are in is the `<h1>` on **three**: `mockup-ed-hub.html:292` ("Royal Perth Hospital Emergency Department"), `mockup-ward-entry.html:307` ("RPH Adult Secure"), and `community-home.html:221` as a scope title ("All community teams"). **The other seven have no place at all** — their `<h1>` is a patient's name (`mockup-patient.html:289`, `mockup-referral.html:306`) or a network-wide scope ("Statistics — wait, decline and discharge", "Transport", "Ward overview", "Emergency departments — every site", "Search").

So a header that owns "the ward or team you are in" would be **empty on seven of ten screens**. That is not a header with a missing value; it is a header whose subject does not exist for most of the surface.

Three further facts point the same way:

- `tests/ward-landmarks.test.ts:267` asserts exactly one `<h1>` per route across 31 routes. A header `<h1>` reddens all 31 at once.
- The foundation plan's Task 4b already hoists **`.wardName`** as one of the seven shared classes — the page-level name is being standardised right now. Moving it to the header orphans a primitive mid-build.
- A screen rendered outside the shell — a DOM test, an error boundary, a print view — would lose its own identity entirely.

**What the header carries instead:** the role switcher, and — only on the routes that have one — the place as a **non-heading** label. `.eyebrow` in the prototypes carries "Coordinator" on five screens (`community-home.html:220`, `mockup-ed-home.html:286`, `mockup-patient.html:288`, `mockup-statistics.html:284`, `mockup-transport.html:254`); that role label is what moves into the header, and the eyebrow keeps the screen's own subject.

### Decision 2 — switching role returns you to that role's own home. It cannot keep you where you are.

**This is forced by the model, not chosen for simplicity.** `src/components/ward-management/ward-referral-visibility.ts` states FD-23 as an architecture rather than a rule:

> _"The two projections are two TYPES, not one type with a switch. `WardScopedReferral` has no `destinations` field at all — the plural does not exist on it… Nothing converts one into the other, and neither takes a role, a scope or a viewer as an argument."_
>
> _"There is no `hideOtherDestinations` flag anywhere in this module and there must never be one: a flag is a thing that can be passed the other way."_

"Keep you on the referral with less visible" therefore requires either a converter (does not exist, by design) or a viewer flag (forbidden, by name). **A coordinator's referral view and a ward's are different shapes, not the same shape with fields hidden.**

`WardRoleSwitcher` already navigates by `<Link>` to role homes — `/mockups/ward-flow` (coordinator), `/mockups/ward-flow/transport/officer`, `/mockups/ward-flow/ward/${unit.id}`, `/mockups/ward-flow/ed/${ed.id}`. **This plan keeps that and writes down why**, so the next person to file "switching role loses my place" as a bug meets the reason instead of fixing it.

⚠️ **One thing the ward can still infer, and it is the owner's intent rather than a leak:** a ward reading its own addressing as `"cancelled"` can infer the patient was placed somewhere, because FD-22 cancels destinations on somebody else's acceptance. The module records this deliberately. It tells the ward _that_, never _where_.

### Decision 3 — the one collapse owner is `ClinicalRail`'s `.phoneBar`. Not `PhoneHeaderCollapsePortal`.

The app's rule names `PhoneHeaderCollapsePortal` as the template, and on this surface **it would do nothing** — see Global Constraints. Ward Flow is not inside the search shell, the slot element is never rendered, and the portal falls back to rendering in place.

So Ward Flow's single collapse owner is the fixed bar it already has: **`.phoneBar`, `ward-sidebar.module.css:271`, `position: fixed; top: 0`, shown below 40rem.** Below that breakpoint the shell's header renders **inside the phone bar's subtree**, never as a sibling fixed element. At 40rem and above the header is an in-flow grid row beside the icon rail, as `.workspaceHeader` already is.

**Convergence on the app-wide portal is deferred, not dismissed.** It becomes possible only if Ward Flow adopts the search shell, which is a larger decision than this plan; the foundation plan already sequences "Phone layouts" after the screens. Task 5 makes the deferral safe by guarding the property directly rather than trusting the shared mechanism that is not present.

---

### Task 1: The shell wrapper, and the ground nothing paints

**Files:**

- Create: `src/components/ward-management/ward-shell.module.css`
- Create: `src/components/ward-management/ward-shell.tsx`
- Test: `tests/ward-shell-ground.test.ts`

**Interfaces:**

- Consumes: `.wardTokens` (foundation Task 1).
- Produces: `WardShell({ children, place, role })` rendering the ground-painting wrapper and the header region. Renders **no** `<h1>` and **no** `<main>`.

⚠️ **`--ward-ground` IS DECLARED AND CONSUMED BY NOTHING.** Measured 2026-09-04 across every file under `src/components/ward-management/` on `codex/task-ward-flow-live-state-20260831`: **one declaration** (`ward-tokens.module.css`), **zero consumptions**. The Board direction is panels floating on a ground; panels, chips and figure tiles each paint their own surface and none paints what is behind them, because that is the shell's job. **A missing background is not an error** — the rule never written and the token resolving to nothing both produce a white page that looks deliberate, no gate goes red, and the entire visual direction quietly reverts.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-shell-ground.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return path.endsWith(".module.css") ? [path] : [];
  });
}

describe("the shell owns the ground", () => {
  const files = stylesheets(WARD_DIR);

  it("found the Ward Flow stylesheets, or every assertion below is vacuous", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain(join(WARD_DIR, "ward-shell.module.css"));
  });

  it("has exactly one stylesheet painting --ward-ground, and it is the shell's", () => {
    const painters = files.filter((file) => /background:\s*var\(--ward-ground\)/.test(readFileSync(file, "utf8")));
    // Pinned as a sorted list, not a count: a count survives the declaration moving to
    // another file, which is the failure this guard exists to catch.
    expect(painters).toEqual([join(WARD_DIR, "ward-shell.module.css")]);
  });

  it("declares the token exactly once, so the shell is painting a real value", () => {
    const declarers = files.filter((file) => /^\s*--ward-ground:/m.test(readFileSync(file, "utf8")));
    expect(declarers).toEqual([join(WARD_DIR, "ward-tokens.module.css")]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-shell-ground.test.ts`
Expected: FAIL on the first assertion — `ward-shell.module.css` does not exist yet.

- [ ] **Step 3: Write the stylesheet**

```css
/* src/components/ward-management/ward-shell.module.css
 * The ground the Board's panels float on. This is the ONLY Ward Flow stylesheet that paints
 * --ward-ground, and tests/ward-shell-ground.test.ts pins that: a second painter means two
 * elements are both claiming to be what is behind the panels. */
.shell {
  composes: wardTokens from "./ward-tokens.module.css";
  min-height: 100%;
  background: var(--ward-ground);
}
```

- [ ] **Step 4: Write the component** — a `<div>` wrapper only. No `<main>`, no `<h1>`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-shell-ground.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Prove the guard can fail — delete the line**

Delete `background: var(--ward-ground);` from `ward-shell.module.css`, run the test, and read the message.
Expected: FAIL on _"has exactly one stylesheet painting --ward-ground"_ — `expected [] to deeply equal [ 'src/components/ward-management/ward-shell.module.css' ]`.
Then restore the line and confirm green. ⚠️ **Record both runs.** A guard is accepted because somebody watched it go red for the right reason, not because it passed.

- [ ] **Step 7: Prove the second mutation — move the paint**

Add `background: var(--ward-ground);` to `ward-panel.module.css` as well, run, and read.
Expected: FAIL naming **two** painters. This is the mutation a count-based assertion survives and a sorted-list assertion does not.

- [ ] **Step 8: Commit**

---

### Task 2: The header region, which adds no landmark and no heading

**Files:**

- Modify: `src/components/ward-management/ward-shell.tsx`, `ward-shell.module.css`
- Test: `tests/ward-shell-header.dom.test.tsx`

**Interfaces:**

- Consumes: `WardRoleSwitcher`, `.wardTokens`.
- Produces: a `<div>` header region carrying the role switcher and an optional place label.

- [ ] **Step 1: Write the failing test.** Assert, with `WardShell` rendered inside a route fixture: exactly one `<h1>` in the document (the page's own); zero elements with `role="main"` contributed by the shell; the place label is **not** a heading (`queryByRole("heading", { name: place })` is null while `getByText(place)` is present); and the role switcher is present exactly once.

- [ ] **Step 2: Run test to verify it fails.**

- [ ] **Step 3: Implement**, composing `.shell` from Task 1.

- [ ] **Step 4: Run test to verify it passes.**

- [ ] **Step 5: Mutation — make the place label an `<h2>`, then an `<h1>`.**
      Expected on `<h1>`: `tests/ward-landmarks.test.ts` _"renders exactly one `<h1>` on …"_ fails **on every route it covers**, and the new test's _"the place label must not be a heading"_ fails naming the element. Record which assertion fired; a mutation that reddens the suite for the wrong reason proves nothing.

- [ ] **Step 6: Commit.**

---

### Task 3: The place, derived — and absent where there is no place

**Files:**

- Create: `src/components/ward-management/ward-place.ts`
- Test: `tests/ward-place.test.ts`

**Interfaces:**

- Produces: `wardPlaceFor(pathname): { kind: "ward" | "ed" | "team"; name: string } | undefined`.

⚠️ **`undefined` is the common case and must be rendered as nothing, never as a placeholder.** Seven of the ten prototypes have no place. A header showing "—" or "All wards" on a network-wide screen invents a scope the screen does not have.

- [ ] **Step 1: Write the failing test.** Assert a ward route resolves to that unit's name **from `ward-sites.ts`, never a literal**; an ED route to that department's name; a route with no place returns `undefined`; and an unresolvable id returns `undefined` rather than substituting a neighbour — the same conservative-failure shape `person-screen.tsx` uses for an unknown patient.

- [ ] **Step 2-4: fail, implement, pass.**

- [ ] **Step 5: Mutation — return the first unit for an unresolvable id.**
      Expected: _"an unknown ward id must not resolve to a different ward"_. This is the `?? array[0]` defect in navigation form.

- [ ] **Step 6: Commit.**

---

### Task 4: Switching role lands on that role's home, and the reason is written down

**Files:**

- Modify: `src/components/ward-management/ward-role-switcher.tsx` (comment only)
- Test: `tests/ward-role-switch-scope.test.ts`

- [ ] **Step 1: Write the failing test.** A static guard, because the property is architectural: assert `ward-referral-visibility.ts` exports **no** function taking a role, scope or viewer argument; that the string `hideOtherDestinations` appears nowhere under `src/components/ward-management/`; and that `WardScopedReferral`'s field list contains no `destinations`. Pin the field list against a hand-written literal, so widening the projection is a test failure and not a silent widening.

- [ ] **Step 2-4: fail, implement, pass.**

- [ ] **Step 5: Mutation — add `destinations` to `WardScopedReferral`.**
      Expected: _"WardScopedReferral must not carry destinations — FD-23 is a projection, not a hidden field"_.

- [ ] **Step 6: Commit.**

---

### Task 5: ⚠️ The chrome guard Ward Flow does not have

**Files:**

- Create: `tests/ward-chrome-owner.test.ts`

**This is the task that matters most and it is the one nobody asked for.** The one-owner rule is real, binding, and **currently unenforced on this surface**: every existing guard reads a hard-coded list of non-ward source files. Adding a header without adding this guard means the rule is documented and unchecked, which is the state that let two stacked phone bars ship already.

- [ ] **Step 1: Write the failing test.**

```ts
// tests/ward-chrome-owner.test.ts — sketch; the implementer writes it against the real files.
// Assert, over every *.module.css under src/components/ward-management/:
//   1. The set of selectors declaring `position: fixed` OR `position: sticky` anchored to `top`
//      inside a phone media query equals exactly [".phoneBar"] — pinned as a sorted list, never
//      a count.
//
//   ⚠️ WIDENED FROM `fixed` ONLY, 2026-09-04. The narrow form was written while Open Question 3
//   was still open, and the ruling that closed it — .workspaceHeader loses its sticky positioning
//   — is a ruling the narrow guard CANNOT ENFORCE. `.workspaceHeader` is
//   `position: sticky; top: var(--spacing-ward-phone-bar)` at ward-management.module.css:823-826,
//   so a guard covering only `fixed` would have gone green on the exact arrangement the ruling
//   forbids. The property being enforced is ONE TOP-ANCHORED PHONE ELEMENT, not one fixed one.
//
//   Bottom-edge action rows stay enumerated and allowed: coordinator.module.css:1910
//   `.shortlistActionRow` and officer.module.css:216 `.actionRow` are `position: fixed` with a
//   documented edge-to-edge rationale and are not top chrome.
//   2. Bottom-edge action bars (`bottom: 0`) are allowed and enumerated by name
//      (.shortlistActionRow, .actionRow), because they are documented edge-to-edge action rows
//      rather than top chrome. A new one is a decision, so it fails until somebody adds it here.
//   3. No Ward Flow component references PhoneHeaderCollapsePortal — on this surface it is a
//      no-op and adopting it would read as compliance while changing nothing.
```

- [ ] **Step 2: Run it and watch it PASS on the current tree first.** ⚠️ A guard written against an already-broken state certifies the breakage. Record the green run before mutating.

- [ ] **Step 3: Mutation A — add a second fixed top bar** to `ward-shell.module.css` inside the phone media query.
      Expected: _"Ward Flow must have exactly one top-anchored phone element… found .phoneBar, .shellHeader"_.

- [ ] **Step 3b: Mutation B — restore `.workspaceHeader`'s sticky rule** (`position: sticky; top: var(--spacing-ward-phone-bar)`) inside the phone media query in `ward-management.module.css`, run, then reverse it.

Expected: the guard names **`.phoneBar, .workspaceHeader`**.

⚠️ **THIS MUTATION IS THE WHOLE REASON THE GUARD WAS WIDENED, AND IT MUST BE RUN SEPARATELY FROM MUTATION A.** Mutation A adds a `fixed` element and passes under either form of the guard, so it cannot tell the narrow guard from the wide one. **Only mutation B distinguishes them** — under the `fixed`-only form it goes green, which is the arrangement that shipped undetected. If mutation B does not go red, the guard was not actually widened, whatever the source says.

- [ ] **Step 4: Mutation B — wrap the shell header in `PhoneHeaderCollapsePortal`.**
      Expected: _"PhoneHeaderCollapsePortal renders in place on /mockups/ward-flow/_* because no search shell mounts the slot — this is a no-op, not adoption"*. This mutation exists because it is the change a well-intentioned reviewer would _ask_ for, and it would do nothing.

- [ ] **Step 5: Commit.**

---

### Task 6: Mount the shell once, and prove all ten screens sit inside it

**Files:**

- Modify: `src/components/ward-management/ward-management-navigation.tsx` (header region inside `ClinicalRail`)
- Test: `tests/ward-shell-adoption.test.ts`

⚠️ **Scope question the implementer must not decide alone — see Open Questions.** The shell mounts inside `ClinicalRail`, which mounts on **all** ward screens, not only the ten redesigned ones.

- [ ] **Step 1: Write the failing test** — every route in `RENDERABLE_ROUTES` renders exactly one shell wrapper, exactly one `<h1>`, exactly one `<main id="main-content">`.
- [ ] **Step 2-4: fail, implement, pass.**
- [ ] **Step 5: Mutation — mount the shell twice on one screen.** Expected: _"exactly one shell wrapper"_ naming the route.
- [ ] **Step 6: Commit.**

---

## Open questions — decisions I could not make from the brief

1. ⚠️ **Ten screens or thirty-one?** `ClinicalRail` mounts on every ward route, and `tests/ward-landmarks.test.ts` counts **31 renderable routes**. A shell inside the rail reaches all 31; a shell mounted per-screen reaches ten and leaves twenty-one on the old chrome. The first is consistent and larger than the brief; the second is the brief and leaves the surface split. **This is a scope decision for Ward Lead or the owner.** The plan is written for the rail mount and Task 6 can be narrowed without restructuring.
2. **Does the ED hub's `<h1>` stay the department name once the header shows the place?** On `mockup-ed-hub.html:292` and `mockup-ward-entry.html:307` the place is the `<h1>`, so the header would echo it. Duplication is defensible (a breadcrumb repeats a title routinely) but it is a design call, not a technical one.
3. **RULED 2026-09-04: `.workspaceHeader` loses its sticky positioning and becomes ordinary in-flow content.** `.phoneBar` is the single collapse owner; two sticky bars is the defect, not the baseline. If removing it breaks a layout, fix the layout rather than restoring the second bar. Task 5's guard has been widened from _fixed_ to _fixed or sticky anchored to top_ accordingly, with its own mutation (Step 3b) — the narrow form would have gone green on precisely the arrangement this ruling forbids.
4. **No Playwright journey is confirmed to visit a ward route for phone chrome.** `scripts/phone-chrome-plan.mjs` names no ward pattern; whether `ui-phone-scroll*.spec.ts` happens to visit one was not checked. Until it is, **Playwright is not a net** and Task 5's static guard is the only net. ⚠️ **Do not write "covered by browser tests" anywhere in this plan or its commits.** An unverified net is worse than no net, because it is the thing that stops the next person looking.
5. **Unrelated defect found while reading, recorded rather than fixed:** `src/app/mockups/ward-flow/layout.tsx:18` mounts `WardFlowProvider` with no `initialNow`, so it falls to `wallClockNow()` and every ward page throws a React hydration mismatch in dev. Out of scope for this plan; it will be adjacent to any layout change.

## What is real, and what is not

**Real, from the repository:** 31 renderable ward routes plus 1 redirect-only (`tests/ward-landmarks.test.ts:193`); 10 approved prototypes; `--ward-ground` declared once and consumed zero times; `.phoneBar` fixed below 40rem; `.workspaceHeader` sticky below 40rem; two bottom action bars; the slot rendered only by `master-search-header.tsx`; FD-23's two projections; the five prototypes carrying a "Coordinator" eyebrow; the three carrying a place as `<h1>`.

**No figure in this plan is invented.** Where a number was not measured it is named as unknown — see Open Question 4.
