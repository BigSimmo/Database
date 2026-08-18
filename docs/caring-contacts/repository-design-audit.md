# Caring contacts — repository design audit

**Status:** synthetic design-phase audit, 15 August 2026  
**Decision source:** [approved rollout plan](../superpowers/plans/2026-08-14-caring-contact-coordination-rollout.md)

## 1. Conclusion and source order

The repository-native direction is a dedicated `/caring-contacts/**` operational workspace. It
inherits Clinical KB v2 tokens, primitives, themes and gates but remains separate from query-first
search, RAG and browser persistence. Repository maturity supports synthetic design; it does not prove
the current deployment, privacy posture or individual-owner storage is suitable for patient data.

Use sources in this order: repository `AGENTS.md`; `src/app/ckb-v2-tokens.css`; committed tests;
`.design-sync/conventions.md`; then [SPEC](../design-system/SPEC.md),
[TOKENS](../design-system/TOKENS.md), [COMPONENTS](../design-system/COMPONENTS.md),
[GATES](../design-system/GATES.md), DECISIONS and ADOPTION. Older design/redesign documents are
historical where they conflict. Token values remain in owning CSS files, not prose.

## 2. Visual and rendered sources

Inherit the true-white/graphite clinical canvas, restrained command hierarchy, Clinical Sky identity,
semantic-only status colour, Geist type, semantic spacing/radius/elevation, one edge owner, sparse
surfaces and the five named responsive states. Dark, forced-colour, reduced-motion, 320px and 400%
zoom treatments are required states. Do not copy Psychbase visual, navigation or clinical-state
assumptions.

| Rendered source         | Repository evidence                                                            | Lesson, not template                                      |
| ----------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Dashboard desktop/phone | `tests/__screenshots__/linux/dashboard-shell.png`, `dashboard-shell-phone.png` | Calm hierarchy, one command, compact safe-area discipline |
| Results desktop/phone   | `search-results-band.png`, `search-results-band-phone.png`                     | Dense metadata in rows; controls collapse explicitly      |
| Document viewer         | `document-viewer.png`                                                          | Split inspection, provenance and progressive disclosure   |
| Therapy Compass home    | `therapy-compass-home.png`                                                     | Native workflow entry with restrained choices             |

## 3. Reuse and ownership map

| Need                                                  | Reuse / owner                                            | Binding rule                                                   |
| ----------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Root theme, auth context, announcements, overlay root | `src/app/layout.tsx`                                     | No duplicate provider or overlay tree                          |
| Tokens                                                | `ckb-v2-tokens.css`, `globals.css`                       | Semantic roles only; theme parity                              |
| Structure                                             | `PageHeader`, `Breadcrumb`, `PanelHeading`, `Disclosure` | One wrapping `<h1>` and explicit hierarchy                     |
| Actions                                               | `Button`, `IconButton`                                   | One filled command; verb-first; busy/disabled named            |
| Fields                                                | `FormField` family, `ErrorSummary`                       | Persistent labels; connected hint/error; reviewed autocomplete |
| Decisions                                             | `Sheet`, `ConfirmDialog`, `OverlayRoot`                  | Mandatory names, focus containment/restoration, one stack      |
| View choice                                           | `Tabs`, `SegmentedControl`                               | Tabs change panels; segments change sort/view                  |
| Status                                                | `Chip`, `InlineNotice`, `StatusMark`                     | Domain vocabularies; text primary, shape/colour secondary      |
| Dates/missing values                                  | `DateDisplay`, `MissingValue`                            | ISO in; Perth display; explicit absence                        |
| Feedback                                              | announcer, Toast, Empty/Error/Loading/Skeleton           | No patient data; spinner never terminal                        |
| Tables                                                | `AccessibleTable`                                        | Only for real relationships; caption and compact strategy      |
| Future launch/reachability                            | `tools-catalog.ts`, wiring convention, route test        | One coordination entry; no `AppModeId`; no orphan route        |

Later domain components use a new caring-contact namespace under the existing components tree:
shell/context switcher, identity header/assurance, communication eligibility, plan summary,
continuity thread, activation stepper, pathway/variant selectors, SMS preview/segment count, one-way
notice, assurance review, closed plan/contact state chips, action/schedule rows, delivery/audit
history, coordinator selector and quiet programme metric. Promote one only after a second genuine
domain use and the design-system authoring contract.

## 4. Mockup and browser isolation

- The synthetic suite belongs under noindexed `/mockups/caring-contacts`; mockup-only fixtures cannot
  be imported by production.
- No live patient, provider, Supabase, OpenAI/RAG or other API call is permitted.
- Controls are wired or explicitly unavailable with a stated reason; mockup exemptions do not permit
  inert enabled controls.
- No patient persistence, recent-search, analytics or offline cache is copied into the mockup.
- Browser proof uses repository wrappers, a focused caring-contact spec and the URL selected by
  `npm run ensure`; `/api/local-project-id` must confirm `Clinical KB`. Never call Playwright
  directly or assume a port.
- Later proof covers 320/390/430/768/1024/1440, keyboard/focus, text/zoom reflow, dark, forced
  colours, reduced motion and overlays. Physical iPhone Safari/PWA remains separate evidence.

## 5. Explicitly unsuitable directions

| Do not extend or copy                                                      | Reason                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GlobalSearchShell`, `MasterSearchHeader`, shared composer                 | Patient-first workspace; patient details must not enter global search        |
| `app-modes.ts`, RAG/OpenAI answer or document routes                       | Caring-contact coordination has no search contract or generated content path |
| `patient-profile-storage.ts` or browser-local patient state                | Persistent/offline patient storage is prohibited                             |
| `FilterBar`, `DataTable`, `AsyncButton`                                    | Retired/deprecated; use surface filters, `AccessibleTable`, current `Button` |
| Risk-ranked queues or `best match`                                         | Objective timing and named operational conditions only                       |
| Decorative status colour, generic SaaS, glass-heavy or marketing gradients | Conflicts with clinical colour and sparse hierarchy contracts                |
| Copied Psychbase styling                                                   | Not a repository source of truth; carries unrelated assumptions              |
| Raw mockup design values or ad-hoc z/portal stacks                         | Production promotion requires tokens and the shared overlay contract         |

## 6. Audit limit

Design-sync registration proves local source/export/prop/preview publication, not complete browser
acceptance or caring-contact suitability. Real-patient use additionally needs approved team tenancy,
Australian PHI-capable hosting, datastore, audit, records and provider boundaries. This document is
verified only by the Task 1 documentation checks; it does not claim that routes or components exist.
