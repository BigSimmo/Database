# Ward Flow — its own sandbox, and the design repair

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Ward Flow into its own administrator-gated sandbox, reachable only through the
developer page, and repair the navigation, landmark and structure defects it accumulated while it was
being built.

**Architecture:** This repository already has the mechanism. `src/proxy.ts` blocks every
`/mockups/**` path in production **except** an explicit list of developer-gated prefixes, which
instead reach `DeveloperAreaGate` — a signed-in-administrator gate using the same claim that gates
document management. Two prototypes already live there: **Caring Contacts** and **Care Plan**. Ward
Flow becomes the third. This plan follows that proven pattern rather than inventing a new one.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS modules with `@theme`
design tokens, Vitest, Playwright (Chromium).

**Supersedes:** `docs/superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md`. That plan
recommended leaving the addresses in place and cutting links. **That recommendation was wrong** — see
decision S1 below. Do not execute the superseded plan.

---

## Product-owner decisions

- **S1 (REVERSED 2026-08-25) — Ward Flow MOVES to `/mockups/ward-flow/*`.** The earlier plan
  recommended leaving `/ward-management/*` and merely cutting inbound links, on the stated reasoning
  that moving "buys only a cosmetic signal in the address bar". **That reasoning was false and the
  recommendation was withdrawn.** Unlinking leaves the prototype a fully public production route that
  anyone can reach by URL with no sign-in — unadvertised, but not sandboxed and not protected.
  Moving it under a developer-gated prefix is the thing that actually enforces the separation. The
  product owner's instruction — _"ensure each is its own sandbox only interacting via the developer
  page, otherwise standalone app"_ — settles it.
- **S2 — Removed completely from the clinical app.** No search hit, no tools-catalogue entry, no
  launcher tile, no category-index entry.
- **S3 — No redirect is left behind at `/ward-management`.** A public redirect into a gated area
  would keep advertising that the prototype exists and would itself need a reachability allowlist
  entry. The routes are removed. _If the product owner wants bookmarks preserved, that is a
  one-file addition and his call — raise it, do not assume it._

## Global Constraints

1. **Never invent, infer, restate or "correct" any figure, requirement, title or classification from
   the Mental Health Act.** Form titles come from `formTitleForCode` or render as the bare code.
2. **Synthetic data only.** Sex is the only permitted patient attribute. Free text counts.
3. **Conservative failure.** An absence renders as an explicit absence, never a substituted default.
4. **Not a medical device**, and the pages say so. Moving Ward Flow out of the clinical app must not
   also remove the statement that it is not clinical.
5. Design tokens only, no raw hex. Every `<button>` has a real handler, is a submit inside a form, or
   is a `<Link>`. Never both `disabled` and `aria-disabled`. Tap targets `3rem`/48px, never `2.75rem`.
6. Internal navigation via `<Link>`/`router.push`, never a raw `<a href="/…">`.
7. **One search composer per page.** Read `docs/search-chrome-behaviour.md` before touching chrome.
8. **Mutation-test every test added or changed**; print the edited line back from the file. A
   surviving mutation is reported, never reshaped around.
9. Read counts, never exit codes. No Playwright, build, or provider-backed command from an
   implementer — the controller runs those.

---

## What is actually wrong — every row measured on 2026-08-25, none assumed

### The sandbox defects

| #   | Defect                                                     | Evidence                                                                                                                                                                               |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Ward Flow is advertised as a **production clinical tool**  | `tools-catalog.ts`: `status: "ready"`, `highYield: true`, keywords "bed management", "patient flow", "ED transfer" — so a clinician searching any of those finds a synthetic prototype |
| D2  | It is **simultaneously** a developer-hub panel             | `hub-panels.ts` → `{ id: "ward-flow", href: "/ward-management" }`                                                                                                                      |
| D3  | It leaks into four more surfaces                           | `applications-launcher-page.tsx`, `tools/tools-search-results-page.tsx`, `category-identity.ts`, `tools-page-mockups/tool-fixtures.ts`                                                 |
| D4  | **It is publicly reachable in production with no sign-in** | `/ward-management/**` is an ordinary app route; the `/mockups/**` production block and `DeveloperAreaGate` do not apply to it                                                          |

### The structure defects — full 16-route sweep

Fetched from the running server, every route, same checks:

| Route                                    | `<main>` | `id="main-content"` | `<h1>` | skip link | navs  |
| ---------------------------------------- | -------- | ------------------- | ------ | --------- | ----- |
| `/ward-management`                       | **0**    | **0**               | 1      | 1         | 2     |
| `/ward-management/capacity`              | 1        | 1                   | 1      | 1         | 2     |
| `/ward-management/constellation`         | —        | —                   | —      | —         | —     |
| `/ward-management/ed/peel-ed`            | 1        | **0**               | 1      | 1         | **1** |
| `/ward-management/escalation`            | 1        | **0**               | 1      | 1         | **1** |
| `/ward-management/exceptions`            | 1        | 1                   | 1      | 1         | 2     |
| `/ward-management/governance`            | 1        | 1                   | 1      | 1         | 2     |
| `/ward-management/handover`              | 1        | **0**               | 1      | 1         | **1** |
| `/ward-management/movements`             | 1        | 1                   | 1      | 1         | 2     |
| `/ward-management/network`               | 1        | 1                   | 1      | 1         | 2     |
| `/ward-management/patients/WF-001`       | 1        | 1                   | 1      | 1         | 3     |
| `/ward-management/queue`                 | 1        | 1                   | 1      | 1         | 2     |
| `/ward-management/search`                | 1        | **0**               | 1      | 1         | **1** |
| `/ward-management/transport`             | 1        | **0**               | **0**  | 1         | 2     |
| `/ward-management/transport/officer`     | 1        | **0**               | **0**  | 1         | **1** |
| `/ward-management/ward/rph-adult-secure` | 1        | **0**               | 1      | 1         | **1** |

`constellation` is a deliberate 307 redirect to `/network`, documented in its own file. **Verified,
not a defect** — recorded so nobody "fixes" it.

| #   | Defect                                                                                                                                                                                                                                                                    | Extent                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D5  | **The skip link is broken on 8 of 15 live routes.** Every route ships `href="#main-content"`, but `id="main-content"` is missing on eight — so the skip link lands nowhere. A skip link that goes nowhere is worse than none, because a keyboard user believes it worked. | `/ward-management`, `/ed/[edId]`, `/escalation`, `/handover`, `/search`, `/transport`, `/transport/officer`, `/ward/[unitId]` |
| D6  | **The primary screen has no `<main>` landmark at all**                                                                                                                                                                                                                    | `/ward-management`                                                                                                            |
| D7  | **Two routes have no `<h1>`**                                                                                                                                                                                                                                             | `/transport`, `/transport/officer`                                                                                            |
| D8  | **The "Ward Flow views" nav is missing on 6 of 15 routes**, so moving between boards silently drops the navigation                                                                                                                                                        | `/ed/[edId]`, `/escalation`, `/handover`, `/search`, `/transport/officer`, `/ward/[unitId]`                                   |
| D9  | The rail is **hand-written and unsourced** — 329 lines of individually pasted link blocks, one appended per task, which is _why_ routes and nav could drift apart                                                                                                         | `ward-management-navigation.tsx`                                                                                              |
| D10 | Three rail links point at **one arbitrary hardcoded instance** as though it were a section                                                                                                                                                                                | `/ward/rph-adult-secure`, `/ed/peel-ed`                                                                                       |
| D11 | The rail is labelled **"Clinical applications"**                                                                                                                                                                                                                          | wrong for a standalone sandboxed prototype                                                                                    |

**D5, D7 and D8 predate Phase 4** — the role screens (`/ed`, `/ward`, `/transport/officer`) carry
them and were built in Phase 3. Phase 4 then replicated the pattern on three new boards. This is a
long-standing systematic fault, not new breakage.

### What moving under `/mockups/` forfeits — checked, not assumed

- **Button-wiring lint:** `MOCKUP_IGNORES` is `["src/app/mockups/**", "**/*-mockups/**", …]`. Ward
  Flow's components live in `src/components/ward-management/**`, which matches none of those, so
  **the lint still covers every button**. Only the thin route wrappers become exempt, and they
  contain no buttons. **Nothing real is lost.**
- **Route-reachability gate:** mockup routes are excluded, so the orphan problem disappears rather
  than needing an allowlist entry.
- **Bundle budget:** ward chunks move from the `production` bucket (10% tolerance) to `mockups`
  (25%). That is the documented intent of the split — design scratch should not be charged against a
  user-facing ceiling.

---

## Task 1: Move Ward Flow into a developer-gated sandbox (S1, D4)

**Files:**

- Move: `src/app/ward-management/**` → `src/app/mockups/ward-flow/**` (15 page routes + layout)
- Create: `src/app/mockups/ward-flow/layout.tsx`
- Modify: `src/lib/developer-area/headers.ts`, `src/lib/developer-area/hub-panels.ts`
- Modify: every internal ward link (`ward-management-navigation.tsx` and any `href="/ward-management…"`)
- Test: `tests/ward-flow-sandbox.test.ts` (new)

**Interfaces:**

- Produces: routes at `/mockups/ward-flow`, `/mockups/ward-flow/queue`, … preserving every existing
  path segment after the prefix. `DEVELOPER_GATED_PATH_PREFIXES` gains `"/mockups/ward-flow"`.

- [ ] **Step 1: Write the failing sandbox test first — it is the deliverable.**

```ts
import { describe, expect, it } from "vitest";

import { DEVELOPER_GATED_PATH_PREFIXES } from "@/lib/developer-area/headers";

describe("Ward Flow is a developer-gated sandbox", () => {
  it("is on the developer-gated prefix list, so production reaches the admin gate not a 404", () => {
    expect(DEVELOPER_GATED_PATH_PREFIXES).toContain("/mockups/ward-flow");
  });

  it("no longer exists as a public app route", async () => {
    const fs = await import("node:fs");
    expect(fs.existsSync("src/app/ward-management")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch both assertions fail.**
- [ ] **Step 3: Move the route tree** with `git mv` so history follows. Preserve every segment:
      `capacity`, `constellation`, `ed/[edId]`, `escalation`, `exceptions`, `governance`, `handover`,
      `movements`, `network`, `patients/[patientId]`, `queue`, `search`, `transport`,
      `transport/officer`, `ward/[unitId]`.
- [ ] **Step 4: Write the sandbox layout**, copying the **exact** shape of
      `src/app/mockups/care-plan/layout.tsx`. **The order matters and that file says so:**
      `DeveloperAreaGate` must be OUTERMOST, so an unauthorised visitor never renders the inner
      content. `WardFlowProvider` goes inside it. Read that file before writing this one.
- [ ] **Step 5: Add `"/mockups/ward-flow"` to `DEVELOPER_GATED_PATH_PREFIXES`.** That file's own
      comment warns: exact prefixes only, one subtree at a time, **never widen to `/mockups`**. Obey it.
- [ ] **Step 6: Update every internal link.** `grep -rn '"/ward-management' src/ tests/ docs/` and fix
      each. Report the count found and the count changed — they must match.
- [ ] **Step 7:** Update the hub panel href, `npm run docs:update`, `docs/codebase-index.md`, and the
      `docs/design-system/adoption-contract.json` entries (Ward Flow's routes leave the production
      census; the pinned count in `tests/design-system-adoption.test.ts` moves — verify the current
      number, do not assume).
- [ ] **Step 8: Run the full suite.** This move touches route enumeration, the sitemap, reachability
      and the adoption census; expect several pinned counts to move and account for every one.
- [ ] **Step 9: Commit.**

---

## Task 2: Remove Ward Flow from every clinical discovery surface (D1, D3)

**Files:**

- Modify: `src/lib/tools-catalog.ts`, `src/components/applications-launcher-page.tsx`,
  `src/components/tools/tools-search-results-page.tsx`, `src/lib/category-identity.ts`,
  `src/components/tools-page-mockups/tool-fixtures.ts`
- Test: extend `tests/ward-flow-sandbox.test.ts`

- [ ] **Step 1: Extend the guard test.** Assert the tools catalogue contains no entry whose `href`
      starts with `/ward-management` **or** `/mockups/ward-flow` — both, so the entry cannot be
      "moved" back in under the new path. Read `tools-catalog.ts` for the real export name first.
- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Remove `"ward-management"` from the `ToolCatalogId` union and its record.** This is a
      deliberate **compile-time break**: every consumer goes red and the compiler finds the leaks for
      you. Follow each type error to its consumer and remove the Ward Flow branch. **Do not silence
      one with a cast or a default case** — that would hide exactly what this step exists to find.
- [ ] **Step 4: Run and watch it pass, then run the full suite.**
- [ ] **Step 5: Commit.**

---

## Task 3: The developer page says what Ward Flow is (S2, constraint 4)

**Files:**

- Modify: `src/lib/developer-area/hub-panels.ts`
- Test: extend `tests/ward-flow-sandbox.test.ts`

- [ ] **Step 1:** The hub panel summarises Ward Flow as "Queue, capacity, transport, movements" —
      accurate, but it does not say what it _is_. Say that it is a **synthetic prototype, not clinical
      decision support**, at the point where the decision to open it is made. Follow the wording style
      of the Caring Contacts and Care Plan panels; do not invent a new phrasing if one exists.
- [ ] **Step 2:** Assert the panel exists, points at `/mockups/ward-flow`, and carries the prototype
      statement — so removing Ward Flow from the clinical app can never also remove the statement that
      it is not clinical.
- [ ] **Step 3: Commit.**

---

## Task 4: One source for ward navigation (D9, D10, D11)

**Files:**

- Create: `src/components/ward-management/ward-nav.ts`
- Modify: `src/components/ward-management/ward-management-navigation.tsx`
- Test: `tests/ward-nav.test.ts` (new)

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

- [ ] **Step 1: Write the failing TWO-WAY test.** Every `WARD_NAV` href resolves to a real route
      under `src/app/mockups/ward-flow/`, **and** every static ward page route appears in `WARD_NAV`
      or is explicitly recorded as intentionally unlisted with a reason. **A one-way check is what
      allowed D8 to happen** — three boards shipped without their nav and nothing noticed. Enumerate
      the routes from the filesystem, never from a hand-written list.
- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Build `ward-nav.ts`** from the links currently hand-written in the rail, grouped
      `role` (the four role screens) and `board` (the specialist boards).
- [ ] **Step 4: Rewrite the rail to map over `WARD_NAV`**, rendering the two groups under labelled
      headings instead of one flat list of thirteen. Keep every existing `aria-label` and `title` so
      no current selector breaks; if one must change, name every place you updated.
- [ ] **Step 5: Label the hardcoded examples honestly (D10).** `Ward — RPH Adult Secure` and
      `ED — Peel ED` link to one arbitrary synthetic ward and one arbitrary department. Mark them
      `exampleOnly: true` and render them under a heading saying they are an example entry point, not
      a section. **Do NOT delete them** — they are currently the only way to reach those role screens,
      and removing the only route in is a worse defect than mislabelling.
- [ ] **Step 6: Rename the rail's `aria-label`** from "Clinical applications" to something honest for
      a sandboxed prototype. Update every test asserting the old string and name them in the report.
- [ ] **Step 7: Commit.**

---

## Task 5: Landmarks and skip-link targets (D5, D6)

**Files:**

- Modify: the eight route/component trees named in D5
- Test: `tests/ward-landmarks.test.ts` (new)

**The defect, measured:** every ward route ships a skip link to `#main-content`; eight of fifteen have
no element with that id. `/ward-management` has no `<main>` at all. `/queue` has both and is the shape
to copy.

- [ ] **Step 1: Write the failing contract test.** For **every** static route under
      `src/app/mockups/ward-flow/`, assert the rendered output contains **exactly one**
      `<main id="main-content">`. **Exactly one, not at least one** — two landmarks is also a defect,
      and "at least one" would not catch it. Enumerate routes from the filesystem. Render through the
      real component tree with `WardFlowProvider`, as the existing ward DOM tests do.
- [ ] **Step 2: Run it. It must fail naming at least eight routes.** If it names fewer, the
      enumeration is wrong — **fix the test before touching a single component.**
- [ ] **Step 3: Fix each route** to the `/queue` shape. Where a page already has a `<main>` nested in a
      shared component, give that one the id — **do not add a second `<main>`.**
- [ ] **Step 4: Run and watch it pass. Commit.**

---

## Task 6: Every page has a heading (D7)

**Files:** `/transport` and `/transport/officer` components. Test: extend `tests/ward-landmarks.test.ts`.

- [ ] **Step 1:** Extend the contract test: every ward route renders exactly one `<h1>`. Run it; it
      must fail naming those two routes.
- [ ] **Step 2:** Add the heading each page is missing, named from what the page actually shows. **Do
      not invent a title that overstates the page** — the officer view is one transport officer's job
      list, not a transport management system.
- [ ] **Step 3: Run, pass, commit.**

---

## Task 7: Consistent in-page navigation (D8)

**Files:** the six routes named in D8. Test: extend `tests/ward-nav.test.ts`.

**The defect, measured:** `aria-label="Ward Flow views"` renders on `/queue`, `/capacity`,
`/governance`, `/movements`, `/network`, `/exceptions` and the patient page — and is absent on six
others, so moving to those six silently drops the navigation.

- [ ] **Step 1: Decide the rule and record it.** Two defensible answers: the six adopt the views nav,
      or the views nav is deliberately absent on full-page boards and role screens. **Either is
      acceptable; the inconsistency is not.** Prefer adopting it — fifteen routes where nine behave one
      way and six another is a defect a user feels, and the rail alone does not say which board they
      are on. If you choose the other way, the exemption must be data in `ward-nav.ts` with a reason,
      never an accident of which file someone edited.
- [ ] **Step 2: Write the failing test** asserting the chosen rule for every route, enumerated from
      the filesystem.
- [ ] **Step 3: Run, fix, run, commit.**

---

## Task 8: Make the sandbox impossible to undo by accident

**Files:** `tests/ward-flow-sandbox.test.ts`. No source changes.

- [ ] **Step 1:** Assert, in one place, the four properties that together mean "sandboxed":
      `/mockups/ward-flow` is on the gated prefix list; `src/app/ward-management` does not exist; no
      clinical discovery surface references either path; and the developer hub panel does.
- [ ] **Step 2: Mutation-test each of the four** by breaking it and watching this test name the
      break. A guard whose failure message does not say what broke is half a guard.
- [ ] **Step 3: Commit.**

---

## Final verification (controller)

- `npx tsc --noEmit -p tsconfig.json` — quote the output.
- Full unit suite — quote file and test counts, account for every change against the pre-plan
  baseline.
- `npm run ensure`, then the ward Chromium journeys — quote the "N passed" line. **Their URLs all
  change in Task 1; a spec still passing against `/ward-management` would prove the move incomplete.**
- **Re-run the 16-route `curl` sweep that produced D5–D8 and paste the table.** The defects were found
  that way; that is how they are proved fixed.
- Confirm an unauthenticated production-mode request to `/mockups/ward-flow` reaches the gate rather
  than the app. If that cannot be exercised locally, **say so plainly rather than implying it was
  checked.**
- `npm run docs:update`, then `npx prettier --check` on every changed file.
- **Do not run** `verify:release`, `eval:*`, `check:supabase-project`, or anything touching OpenAI,
  Supabase, GitHub Actions or the live database.

## Explicitly not in this plan

- **No visual redesign, and no claim about how anything looks.** Every defect here is structural and
  was measured from served markup. The browser preview was unavailable in this session, so **not one
  screen was seen**. "Optimised and perfected" in the visual sense is separate work needing someone
  who can look at it.
- **No change to Ward Flow's behaviour, model, or reducer.** This plan moves, relabels and repairs
  structure. It does not alter what the prototype does.
- **No redirect at the old addresses** (decision S3) — raise it with the product owner if bookmarks
  matter.
