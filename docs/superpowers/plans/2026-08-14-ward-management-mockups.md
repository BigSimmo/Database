# Ward Management Mockup Generation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` (inline execution). Use Product Design `ideate` for image directions. Do not use subagents for this plan.

**Goal:** Produce and validate three independent desktop visual directions for the approved synthetic WA mental-health ward-management command map, then create responsive and role-specific companions only after the user selects a direction.

**Architecture:** Visual discovery is separate from product implementation. The approved specification fixes the clinical workflow, information architecture, responsive behaviour, state semantics, and safety boundaries. Image generation may vary visual hierarchy, density, and interaction treatment, but it may not vary those approved product contracts. No production source code is changed until a visual target is selected and a separate production implementation plan is approved.

**Tech stack:** Clinical KB design tokens and shared shell as visual references; Product Design `ideate`; built-in Image Generation; local Clinical KB preview for source capture; synthetic fixtures only.

## Global constraints

- Approved source of truth: `docs/superpowers/specs/2026-08-14-ward-management-design.md`.
- Planned production route: `/ward-management`; do not create it during image ideation.
- Desktop foundation: schematic hospital network grouped by North, East, South, and Country coordinating services.
- Phone foundation: role-specific operational queue; `Hospitals` and `Map` are secondary views.
- Roles: flow coordinator, ED team, ward manager.
- Cohorts: general adult and older adult.
- Data: visibly synthetic; no real names, MRNs, dates of birth, addresses, contacts, narrative histories, or real-time bed counts.
- Bed states: occupied, allocatable now, held, potential after action, blocked/unavailable.
- Movement stages: placement requested, destination review, accepted/bed held, handover and transport ready, moving, arrived/closed.
- Matching: catchment first, explainable statewide escalation, human confirmation required.
- Priority: human urgency tier first; algorithmic score only orders within a tier and exposes its factors.
- Legal state: plain language first with form and timing detail available.
- Visual system: Clinical White / Sky Graphite; graphite commands, clinical-blue focus/movement, green ready/complete only, amber held/potential/time-sensitive, red blocked/overdue only.
- Do not use colour as the sole state signal.
- Current-date anchor for every generated concept: 14 August 2026, Australia/Perth.
- Do not deploy, publish, call live clinical providers, or use patient-identifiable information.

## Artifact map

### Existing sources to inspect

- `docs/superpowers/specs/2026-08-14-ward-management-design.md` — approved product and safety contract.
- `docs/design-system.md` — current reusable design-system rules.
- `docs/redesign/02-design-direction.md` — Clinical White / Sky Graphite rationale.
- `docs/search-chrome-behaviour.md` — shared responsive shell and phone-chrome ownership.
- `src/app/globals.css` — implemented role tokens and typography.
- `src/components/clinical-dashboard/global-search-shell.tsx` — production shell owner.
- `src/app/mockups/layout.tsx` and `src/app/mockups/mockups-layout-client.tsx` — design-scratch route ownership for any later coded prototype.

### Source captures outside Git

- `C:/Users/joshs/.codex/visualizations/2026/08/14/01a00060-be1a-7252-922f-b9dfc7a496b3/ward-management/sources/clinical-kb-shell-desktop.png`
- `C:/Users/joshs/.codex/visualizations/2026/08/14/01a00060-be1a-7252-922f-b9dfc7a496b3/ward-management/sources/clinical-kb-shell-phone.png`

### Generated visual set

- Three independent `1440 × 1024` desktop coordinator concepts, shown in the conversation as separate generated images.
- After selection: one refined desktop coordinator target, one `390 × 844` phone coordinator target, and representative ED and ward-manager companion screens.
- Generated images stay outside the Git worktree unless the user later approves a coded mockup or asset package.

### Possible later coded mockup files — not part of this plan's execution

- `src/app/mockups/ward-management/page.tsx`
- `src/components/ward-management-mockups/ward-management-mockup-page.tsx`
- `src/components/ward-management-mockups/synthetic-fixtures.ts`
- `tests/ward-management-mockup.contract.test.ts`

These paths are reserved only to make the next production or coded-prototype plan concrete. Do not create them during image ideation.

## Task 1: Capture the current Clinical KB visual source

**Files**

- Read: the existing sources listed in the artifact map.
- Create outside Git: the two source captures listed above.

**Produces**

- A desktop and phone reference showing the real Clinical KB shell, typography, surfaces, spacing, header behaviour, and role-token use.
- A brief visual-source checklist recorded in the execution notes: shell, typography, colour roles, radius, border, density, and phone behaviour.

**Steps**

- [ ] Confirm the isolated worktree remains on `codex/ward-management-design` and contains no unrelated changes.
- [ ] Run `node scripts/setup-codex-worktree.mjs` so the isolated worktree has a lockfile-identical dependency runtime.
- [ ] Run `npm run workflow:design-sweep -- --write-evidence` and retain its evidence path.
- [ ] Run `npm run ensure`; use only the URL it prints.
- [ ] Verify `/api/local-project-id` identifies this Clinical KB checkout before capture.
- [ ] Capture the production shell at `1440 × 1024` and `390 × 844` using synthetic/demo content.
- [ ] Inspect both captures directly; do not infer design details from filenames.
- [ ] Confirm neither capture contains patient-identifiable or secret-bearing data.

**Gate**

- Both source images exist, open successfully, match the specified dimensions, and visibly represent the current Clinical KB design system.

## Task 2: Generate three independent desktop coordinator directions

**Consumes**

- Approved specification.
- Both inspected source captures.
- Global constraints in this plan.

**Produces**

- Three separate Image Generation results at `1440 × 1024`.
- Each result is a focused primary coordinator screen, not a feature inventory.

**Direction briefs**

### Signal Spine

- Schematic HSP columns form a quiet central network spine.
- Priority movement and action inbox occupy one restrained side rail.
- Highest glanceability and greatest whitespace.

### Network Ledger

- Hospitals read as a structured operational ledger connected by selective movement lines.
- Strongest comparison of demand, bed state, ownership, and last-confirmed time.
- Highest information density without turning every row into a card.

### Operational Constellation

- Coordinating-service groups form a more spatial network with selected movement paths.
- A contextual patient-to-bed panel appears only for the selected synthetic patient.
- Strongest visual sense of statewide coordination while remaining schematic rather than geographic.

**Steps**

- [ ] Read Product Design `ideate` and Image Generation instructions before the first generation.
- [ ] Attach both actual source captures to every generation; do not claim they were attached unless the tool receives them.
- [ ] Generate `Signal Spine` as one independent image call.
- [ ] Generate `Network Ledger` as one independent image call.
- [ ] Generate `Operational Constellation` as one independent image call.
- [ ] Do not batch the three calls or place several concepts in one image.
- [ ] Use the exact current-date anchor, approved workflow states, and clearly synthetic data in every prompt.
- [ ] Ensure every concept shows the flow-coordinator role, four coordinating-service groups, five bed states, a priority movement, one visible action exception, catchment-first/statewide escalation, and last-confirmed time.
- [ ] Ensure no concept shows automatic allocation, a clinical severity score, real patient data, literal WA travel distance as the matching rule, or a phone device bezel.

**Gate**

- Exactly three generated images are visible once each in the main conversation.
- No screen is clipped, illegible, crowded, or inconsistent with Clinical KB's source captures.
- Every state remains understandable without colour alone.

## Task 3: Stop for visual selection

**Consumes**

- The three visible generated-image results in their displayed order.

**Produces**

- One user-selected direction or a precise combination/revision brief.

**Steps**

- [ ] Number options only by their displayed order after all three image results are visible.
- [ ] Ask only: `Which option should I build: 1, 2, or 3? Or tell me what you'd like to refine or personalize first.`
- [ ] Do not describe or rename the options in the selection message.
- [ ] Stop. Do not generate companion screens or write code until the user selects or requests a revision.

**Gate**

- The selected visual target is unambiguous. If the user combines directions, generate and obtain approval for the combined target before continuing.

## Task 4: Generate the selected responsive and role companions

**Runs only after Task 3 approval.**

**Produces**

- One refined desktop coordinator target at `1440 × 1024`.
- One phone coordinator target at `390 × 844` using the approved role-first queue.
- One representative ED-team screen.
- One representative ward-manager screen.
- One patient-movement detail treatment shared across roles.

**Steps**

- [ ] Resolve the selected target against the displayed result, never the original request order.
- [ ] Carry forward the selected typography, spacing, network treatment, state language, and interaction hierarchy.
- [ ] Keep the phone default queue-first; Map remains secondary.
- [ ] Preserve role ownership: ED readiness/referral/legal/handover, ward capacity/release/acceptance/hold, coordinator match/escalation/movement.
- [ ] Check all outputs against the specification's acceptance criteria.
- [ ] Stop for user approval of the complete visual set.

## Task 5: Hand off to production planning

**Runs only after the complete visual set is approved.**

**Produces**

- A separate, repository-grounded production implementation plan with exact source files, interfaces, tests, accessibility evidence, privacy controls, and rollout boundaries.

**Steps**

- [ ] Do not treat image approval as production-readiness evidence.
- [ ] Reinspect current `origin/main`, applicable Next 16 local documentation, shared shell ownership, app-mode registration, route reachability, and design-system contracts.
- [ ] Plan a synthetic fixture-backed slice before any real integration or patient-data work.
- [ ] Keep real clinical integrations, RBAC, algorithm validation, privacy assessment, and production governance as separately authorised work.

## Plan verification

- [ ] Run the standard specification placeholder scan and resolve every hit.
- [ ] Run `git diff --check`.
- [ ] Run Prettier against this plan with a byte-identical lockfile installation.
- [ ] Confirm this plan changes documentation only and leaves tests, builds, providers, commits, and pushes unrun.
