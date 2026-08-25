# Ward Flow — standalone prototype, and the navigation repair

> **SUPERSEDED 2026-08-25** by `2026-08-25-ward-flow-sandbox-and-design-repair.md`. Do not execute
> this plan. Its decision S1 — leave the addresses and merely cut inbound links — was **wrong**: it
> would have left Ward Flow a fully public production route reachable by URL with no sign-in.
> Unadvertised is not sandboxed. The superseding plan moves it into the developer-gated subtree the
> repository already uses for Caring Contacts and Care Plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Ward Flow out of the clinical application entirely — reachable only from the
developer hub — and repair the navigation, landmark and structure defects that accumulated while it
was being built.

**Architecture:** Ward Flow already has its own layout and does not mount the main app's shell, so
separation is mostly about removing advertising, not rebuilding. The rail becomes data-driven from a
single source, the way the main app drives its own navigation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS modules with `@theme`
design tokens, Vitest, Playwright (Chromium).

**Product-owner decisions, 2026-08-25:**

- **S1 — Addresses stay.** Ward Flow keeps `/ward-management/*`. Nothing moves under a new prefix.
  Rejected the alternative because it rewrites every internal link, test, sitemap entry and doc, with
  real risk of missing one, and buys only a cosmetic signal in the address bar.
- **S2 — Remove it completely from the clinical app.** No search hit, no tools-catalogue entry, no
  launcher tile, no category-index entry. The developer hub is the only way in.

## Global Constraints

1. **Never invent, infer, restate or "correct" any figure, requirement, title or classification from
   the Mental Health Act.**
2. **Synthetic data only.** Sex is the only permitted patient attribute. Free text counts.
3. **Conservative failure.** An absence renders as an explicit absence, never a substituted default.
4. **Not a medical device**, and the pages say so.
5. Design tokens only, no raw hex. Every `<button>` has a real handler, is a submit inside a form, or
   is a `<Link>`. Never both `disabled` and `aria-disabled`. Tap targets `3rem`/48px, never `2.75rem`.
6. Internal navigation via `<Link>`/`router.push`, never a raw `<a href="/…">`.
7. **One search composer per page.** Read `docs/search-chrome-behaviour.md` before touching chrome.
8. **Mutation-test every test added or changed**; print the edited line back from the file. A
   surviving mutation is reported, never reshaped around.
9. Read counts, never exit codes. No Playwright, build, or provider-backed command from an
   implementer — the controller runs those.

## What is actually wrong — measured 2026-08-25, not assumed

| #   | Defect                                                                                     | Evidence                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Ward Flow is advertised as a **production clinical tool**                                  | `tools-catalog.ts` carries it as `status: "ready"`, `highYield: true`, with clinical keywords ("bed management", "patient flow", "ED transfer") that put it in universal search |
| D2  | It is **simultaneously** a developer-hub panel                                             | `src/lib/developer-area/hub-panels.ts` → `{ id: "ward-flow", href: "/ward-management" }`                                                                                        |
| D3  | It leaks into four more production surfaces                                                | `applications-launcher-page.tsx`, `tools/tools-search-results-page.tsx`, `category-identity.ts`, `tools-page-mockups/tool-fixtures.ts`                                          |
| D4  | **The coordinator screen has no `<main>` landmark and no `id="main-content"`**             | `curl /ward-management` → 0 `<main>`; every other ward route has 1                                                                                                              |
| D5  | Handover, escalation and search have a `<main>` but **no `id="main-content"`**             | `curl` each → `<main>` present, id absent; `/queue` has both                                                                                                                    |
| D6  | Those same three pages **lack the "Ward Flow views" navigation** every other board carries | `curl` → `aria-label="Ward Flow views"` present on `/queue`, `/capacity`, `/governance`; absent on `/handover`, `/escalation`, `/search`                                        |
| D7  | The rail is **hand-written and unsourced** — 329 lines of individually pasted link blocks  | `ward-management-navigation.tsx`; each Phase 3/4 task appended its own block                                                                                                    |
| D8  | Three rail links point at **one arbitrary hardcoded instance**                             | `href="/ward-management/ward/rph-adult-secure"`, `href="/ward-management/ed/peel-ed"` sit in permanent navigation as though they were sections                                  |
| D9  | The rail is labelled **"Clinical applications"**                                           | `aria-label="Clinical applications"` — wrong for a standalone prototype, and part of what makes it read as clinical software                                                    |

---

## Task 1: Remove Ward Flow from every clinical discovery surface (D1, D3)

**Files:**

- Modify: `src/lib/tools-catalog.ts`, `src/components/applications-launcher-page.tsx`,
  `src/components/tools/tools-search-results-page.tsx`, `src/lib/category-identity.ts`
- Test: `tests/ward-flow-not-clinical-surface.test.ts` (new)

**Interfaces:**

- Produces: nothing importable. Removes `"ward-management"` from the `ToolCatalogId` union and its
  record, which is a **compile-time break** — every consumer goes red, which is the point. Follow the
  type errors; do not silence one with a cast.

- [ ] **Step 1: Write the failing guard test first.** It is the deliverable, not the removal.

```ts
import { describe, expect, it } from "vitest";

import { TOOL_CATALOG } from "@/lib/tools-catalog";
import { HUB_PANELS } from "@/lib/developer-area/hub-panels";

describe("Ward Flow is a standalone prototype, not a clinical tool", () => {
  it("appears in no clinical discovery surface", () => {
    expect(TOOL_CATALOG.map((tool) => tool.href)).not.toContain("/ward-management");
    expect(TOOL_CATALOG.some((tool) => tool.href.startsWith("/ward-management"))).toBe(false);
  });

  it("is still reachable from the developer hub, which is the only way in", () => {
    const panel = HUB_PANELS.find((entry) => entry.href === "/ward-management");
    expect(panel, "the developer hub must still carry Ward Flow").toBeDefined();
  });
});
```

Verify the real export names before writing this (`TOOL_CATALOG` may be named differently) — read
`tools-catalog.ts` and use what is actually there.

- [ ] **Step 2: Run it and watch the first assertion fail.**
- [ ] **Step 3: Remove the entry** from the catalogue and the `ToolCatalogId` union, then follow every
      resulting type error to its consumer and remove the Ward Flow branch there.
- [ ] **Step 4: Run and watch both pass.** Then run the whole suite — this removal touches shared
      surfaces and something unrelated will likely pin a count.
- [ ] **Step 5: Handle the reachability gate.** `/ward-management` may now be an orphan.
      **First check whether the developer hub renders a real `<Link>`** — if it does, the route is not
      an orphan and no allowlist entry is needed. Only if it does not, add a `REACHABILITY_ALLOWLIST`
      entry with the reason "standalone prototype; reachable only from the developer hub". Do not add
      an allowlist entry you did not first prove was necessary.
- [ ] **Step 6:** `npm run docs:update`, update `docs/codebase-index.md`, commit.

---

## Task 2: One source for ward navigation (D7, D8, D9)

**Files:**

- Create: `src/components/ward-management/ward-nav.ts`
- Modify: `src/components/ward-management/ward-management-navigation.tsx`
- Test: `tests/ward-nav.test.ts` (new), plus the existing reachability test

**Interfaces:**

- Produces:

  ```ts
  export type WardNavGroup = "role" | "board";
  export type WardNavItem = {
    id: string;
    href: string;
    label: string;
    group: WardNavGroup;
    /** True when the href names one specific synthetic ward or department rather than a section. */
    exampleOnly?: boolean;
  };
  export const WARD_NAV: readonly WardNavItem[];
  ```

- [ ] **Step 1: Write the failing test.** Every `WARD_NAV` href resolves to a real route under
      `src/app/ward-management/`; every static ward page route appears in `WARD_NAV` **or** is
      explicitly recorded as intentionally unlisted with a reason. That two-way check is what stops
      the rail and the routes drifting apart again — a one-way check would not have caught D6.
- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Build `ward-nav.ts`** from the links currently hand-written in the rail. Group them:
      `role` for the four role screens, `board` for the specialist boards.
- [ ] **Step 4: Rewrite the rail to map over `WARD_NAV`**, rendering the two groups under labelled
      headings instead of one flat list of thirteen. Keep every existing `aria-label` and `title` so
      no current selector breaks; if one must change, name every place updated.
- [ ] **Step 5: Deal with the hardcoded examples (D8).** `Ward — RPH Adult Secure` and `ED — Peel ED`
      are links to one arbitrary synthetic ward and one arbitrary department. Mark them
      `exampleOnly: true` and render them under a heading that says what they are — an example entry
      point, not a section of the app. **Do not silently delete them**: they are the only way to reach
      those role screens today, and removing the only route in is a worse defect than mislabelling.
- [ ] **Step 6: Rename the rail's `aria-label`** from "Clinical applications" to a name honest for a
      standalone prototype. Update every test asserting the old string and name them in the report.
- [ ] **Step 7:** Run the ward suites and the reachability suite, `npm run docs:update`, commit.

---

## Task 3: Landmarks and skip-link targets (D4, D5)

**Files:**

- Modify: `src/components/ward-management/coordinator/coordinator-screen.tsx`,
  `handover/handover-page.tsx`, `escalation/escalation-board.tsx`, `search/patient-search.tsx`
- Test: `tests/ward-landmarks.test.ts` (new)

**The defect, measured:** `/ward-management` renders **zero** `<main>` elements. Handover, escalation
and search render a `<main>` with **no `id="main-content"`**, so a skip link lands nowhere. `/queue`
has both and is the correct shape to copy.

- [ ] **Step 1: Write the failing contract test.** For **every** static route under
      `src/app/ward-management/`, assert the rendered output contains **exactly one**
      `<main id="main-content">`. Not "at least one" — two main landmarks is also a defect, and
      "at least one" would not catch it.
      Render through the real component tree with `WardFlowProvider`, the way the existing ward DOM
      tests do. **Enumerate the routes from the filesystem, not from a hand-written list** — a
      hand-written list is what let three pages ship without the id in the first place.

- [ ] **Step 2: Run it. It must fail naming at least four routes.** If it names fewer, the
      enumeration is wrong — fix the test before touching any component.
- [ ] **Step 3: Fix each route** to the `/queue` shape. Do not add a second `<main>` to a page that
      already has one nested in a shared component; find the existing one and give it the id.
- [ ] **Step 4: Run and watch it pass. Commit.**

---

## Task 4: Consistent in-page navigation (D6)

**Files:**

- Modify: `handover/handover-page.tsx`, `escalation/escalation-board.tsx`,
  `search/patient-search.tsx`
- Test: extend `tests/ward-nav.test.ts`

**The defect, measured:** `/queue`, `/capacity` and `/governance` all render
`<nav aria-label="Ward Flow views">`. `/handover`, `/escalation` and `/search` do not — so moving to
any of the three new boards silently drops the navigation that exists everywhere else.

- [ ] **Step 1: Decide and record which is correct, then make it uniform.** Two defensible answers:
      the three new boards adopt the mode navigation, or the mode navigation is deliberately absent on
      full-page boards. **Either is acceptable; the inconsistency is not.** Prefer adopting it —
      thirteen routes where six behave one way and three another is a defect a user feels, and the
      rail alone does not tell them which board they are on.
- [ ] **Step 2: Write the failing test** asserting the chosen rule holds for every board route,
      enumerated from the filesystem.
- [ ] **Step 3: Run, fix, run, commit.**

---

## Task 5: Say plainly what this is (S2)

**Files:**

- Modify: `src/lib/developer-area/hub-panels.ts`, the ward coordinator screen's existing
  prototype banner
- Test: extend `tests/ward-flow-not-clinical-surface.test.ts`

- [ ] **Step 1:** The developer-hub panel currently summarises Ward Flow as "Queue, capacity,
      transport, movements" — accurate but it does not say what it is. Say that it is a synthetic
      prototype and not clinical decision support, in the hub, where the decision to open it is made.
- [ ] **Step 2:** Confirm the not-a-medical-device statement still renders on the coordinator screen
      and the governance board (Phase 4 Task 9 made it a shared component). Assert it, so removing
      Ward Flow from the clinical app cannot also remove the statement that it is not clinical.
- [ ] **Step 3: Commit.**

---

## Final verification (controller)

- `npx tsc --noEmit -p tsconfig.json` — quote the output.
- Full unit suite — quote file and test counts, and account for every change against the
  pre-plan baseline.
- `npm run ensure`, then the ward Chromium journeys — quote the "N passed" line.
- Re-run the `curl` landmark and nav checks that produced D4, D5 and D6, and paste the output —
  the defects were found that way and that is how they are proved fixed.
- `npm run docs:update`, then `npx prettier --check` on every changed file.
- **Do not run** `verify:release`, `eval:*`, `check:supabase-project`, or anything touching OpenAI,
  Supabase, GitHub Actions or the live database.

## Explicitly not in this plan

- **No visual redesign.** Every defect here is structural — a missing landmark, an absent nav, an
  unsourced link list. I could not run a visual pass in this session (the browser pane was
  unavailable), so **no claim is made about how any of it looks**. A visual review is separate work
  and should be done by someone who can see the screens.
- **No address changes** (decision S1).
- **No change to Ward Flow's behaviour, model, or reducer.** This plan moves and relabels; it does not
  alter what the prototype does.
