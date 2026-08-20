# ED Care Plans Standalone Synthetic Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan one task at a time, `superpowers:test-driven-development` for every behaviour change, `superpowers:requesting-code-review` after each task and for the final branch review, and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Deliver the user-approved, complete, linked, reset-on-refresh ED Care Plans prototype under `/mockups/ed-care-plans`, using only deterministic synthetic data and the repository design system.

**Architecture:** A Next.js 16 App Router route family delegates to one client-side route surface. A layout-scoped provider owns the complete in-memory domain state; a pure reducer enforces Management Plan, Personal Safety Plan, ED Presentation, identification-review, contact-intent, and audit invariants. Server page files validate the finite synthetic dynamic parameters and otherwise render the same client route surface. Shared repository primitives own controls, dialogs, sheets, fields, tabs, announcements, and page structure. Tailwind token utilities provide most styling; one route-scoped CSS Module owns the split shell, phone safe-area behaviour, and print-only rules.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, repository Clinical White / Sky Graphite tokens, Tailwind CSS utilities, CSS Modules, Vitest, Testing Library, and repository-wrapped Playwright Chromium.

**Spec:** [`docs/superpowers/specs/2026-08-20-ed-care-plans-design.md`](../specs/2026-08-20-ed-care-plans-design.md) is binding. [`docs/ed-care-plans-context.md`](../../ed-care-plans-context.md) supplies the binding domain language. If this plan conflicts with the specification, follow the specification and record an SDD ledger ruling.

## Revision history

- **2026-08-20 (Codex):** original nine-task plan, written against the approved specification.
- **2026-08-21 (Claude session, second pass — design review with the user):** five content decisions applied after a proper brainstorming pass the first Claude pass had skipped. (1) Management Plan content cut from nineteen fields to eleven in two tiers, removing four duplicate field pairs and promoting the two safety-critical sections into the first-minute summary. (2) The first-minute summary is exactly five sections, with `whatWouldMakeThisDifferent` never collapsed. (3) The ED Presentation record now requires only a roughly thirty-second set, with the richer fields behind a disclosure, because the earlier full record would not have been completed and would have left the review loop empty. (4) The review clock, previously undefined in the specification, is a 12-month editable default with a 28-day amber window, shared by both plan types. (5) Identification Reviews can now be closed with a recorded decision — previously they could be opened but never closed, so the queue would have filled permanently.
- **2026-08-21 (Claude session, first pass, user-approved):** four user decisions applied — (1) build the synthetic prototype now but keep the domain shaped for later real storage (see the future-persistence seam in Global Constraints); (2) keep the full multi-service workflow including named senior-clinician approval; (3) deliver Tasks 1–5 as Stage A, stop for user review, then Tasks 6–9 as Stage B; (4) local task commits authorised. Also corrected: the target worktree/branch, the stale "preflight already run" line, and the verified import homes of the shared UI primitives.

## Global Constraints

- Work only in `D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd` on `claude/ed-care-plans-impl-7f44cd`, based on `main` at `97f614223`. Preserve the unrelated dirty checkout at `D:\Repos\Database` and the earlier planning worktree at `D:\Worktrees\Database\ed-care-plans`; copy from them, never write to them.
- This worktree is fresh. Confirm dependencies are installed (`node_modules` present and `npm run check:installed-lock-parity` clean) before the first test command; run `npm ci --include=dev` only if they are not.
- The application is synthetic and memory-only. Do not add `fetch`, route handlers, Server Actions, local/session storage, IndexedDB, cookies for prototype state, Supabase, OpenAI, analytics, email providers, or any other network or persistence path.
- No API, provider, production-data, deployment, migration, or live-canary action is authorised.
- Every patient, clinician, team, presentation, plan, review, amendment, and audit identifier begins with `SYN-`. Public crisis telephone numbers are the only intentional non-fictional contact fixtures.
- `IdentificationPolicy.status` is exactly `pending_governance`, `thresholdCount` is exactly `null`, and `thresholdLookbackMonths` is exactly `null`. Raw Presentation Activity may show counts over named observation windows; no count creates eligibility, a patient label, a risk state, or a plan.
- Management Plan content is exactly the eleven fields in `ManagementPlanContent`, in two tiers. The five first-minute keys plus `whyThisPlanExists` are required for approval; the other five may be empty and render as `Not recorded`. Do not reintroduce the superseded nineteen-field shape, and do not add a field that restates another (the duplicate pairs it removed were helps/helpful, worse/unhelpful, engagement/agreed-approach, and pattern/triggers).
- `whatWouldMakeThisDifferent` is the safety boundary. It is always visible on the summary card, visually distinct from the other four sections, and never collapsed, truncated, clipped, or placed behind a disclosure at any viewport or in print.
- The review clock is `REVIEW_INTERVAL_MONTHS = 12` and `REVIEW_DUE_SOON_DAYS = 28`, shared by both plan types. The interval is an editable per-version default, never an enforced rule, and is deliberately unlike the identification threshold, which stays null.
- An ED Presentation requires only site, disposition, plan availability, plan use, plan helpfulness, and the free-text note; arrival date and time default to `PROTOTYPE_NOW` and stay editable. A review reason is required whenever review is suggested, and a deviation reason whenever a deviation is recorded. Presenting indication, assessment outcome, CMHT contact attempt and outcome, and the deviation flag sit behind a disclosure and never block the save.
- An Identification Review closes by recording one `IdentificationDecision` plus a reason. Closing never creates or approves a plan; on `proceed_to_plan` the interface offers to start a draft and the user chooses.
- Each patient has one longitudinal Management Plan. Only a named user whose role is `senior_clinician` can approve an `awaiting_approval` version. Approval atomically produces exactly one `current` version and marks the former Current version `superseded`.
- A Draft or Awaiting Approval version never hides or replaces the Current Plan. Withdrawal leaves `currentVersionId: null` and never restores a superseded version.
- A Personal Safety Plan is patient-owned, independently versioned, and does not use the Management Plan senior-approval transition.
- An ED Presentation is append-only. Corrections append a `PresentationAmendment`; they never overwrite the original field. Plan-use feedback may append a `ReviewTrigger` and never edits a plan.
- CMHT email and telephone actions record only `email_intent_opened` or `call_intent_opened`. The `mailto:` subject is generic and contains no name, MRN, date of birth, presentation content, or plan content. Never claim sent, delivered, read, answered, or completed contact.
- Use the official public WA crisis details verified on 20 August 2026: `000`; MHERL Perth `1300 555 788`; MHERL Peel `1800 676 822`; Rurallink `1800 552 002`, available 4:30 pm–8:30 am weeknights and 24 hours on weekends/public holidays. Display that MHERL is not an emergency service. Retain the official source URLs in fixture metadata.
- Use Australian English, `en-AU`, `Australia/Perth`, ISO source timestamps, plain non-stigmatising language, and the glossary's preferred terms.
- Reuse the existing repository primitives where their contracts apply; every button must have a real action or a stated unavailable reason. Verified import homes in this worktree:
  - `Button` — `src/components/ui/button.tsx`
  - `TextField`, `SearchField` — `src/components/ui/text-field.tsx`
  - `FormField` — `src/components/ui/form-field.tsx`
  - `Select` — `src/components/ui/select.tsx`
  - `Tabs` — `src/components/ui/tabs.tsx`
  - `Sheet` — `src/components/ui/sheet.tsx`
  - `ConfirmDialog` — `src/components/ui/confirm-dialog.tsx`
  - `PageHeader` — `src/components/ui/page-header.tsx`
  - `LiveAnnouncer` — `src/components/ui/live-announcer.tsx`
  - `InlineNotice`, `EmptyState` — `src/components/ui-primitives.tsx` (NOT `src/components/ui/`)
    Confirm each import path before use; do not create a parallel local copy of a primitive that already exists.
- Internal navigation uses `next/link` or `router.push`; contact launch actions alone use external `mailto:` and `tel:` anchors.
- Phone layouts are single-column at 320 px and 390 px, respect the effective top safe-area inset, preserve 48 px targets, and have no horizontal page scroll. Current Plan, CMHT, Safety Plan, and `Record ED presentation` remain directly reachable.
- Support keyboard use, visible focus, dark mode, forced colours, reduced motion, 200% zoom, and monochrome print. Colour never carries state alone.
- Before UI code, follow the already-read installed Next.js 16 guides for layouts/pages, navigation, server/client boundaries, dynamic `params: Promise<...>`, and CSS ordering.
- Use repository wrappers: `npm run test -- ...`, `npm run ensure`, and `npm run test:e2e:ed-care-plans-mockup`. Never call Playwright directly and never assume a localhost port.
- Apply TDD to every production behaviour: add the smallest failing test, run it and confirm the expected failure, implement the minimum, rerun to green, then refactor while green.
- Before writing the first test in any task, the implementer reads `C:\Users\joshs\.codex\plugins\cache\openai-curated-remote\superpowers\6.3.0\skills\test-driven-development\writing-good-tests.md` and names the production change that would make each test fail.
- SDD runs only one implementer at a time, followed by a fresh task reviewer. The controller creates the task brief and review package and records results in this plan's ignored SDD ledger.
- **Local commits are authorised** (user, 21 August 2026): commit once at the end of each task, on this branch, in this worktree. Nothing else is authorised — no push, pull, merge, rebase, PR, deployment, provider access, or publication.
- **Future-persistence seam (user decision, 21 August 2026).** The prototype stays memory-only and reset-on-refresh, but must be built so that storage could later be added without redesigning the domain. Therefore: `prototypeReducer` stays a pure `(state, action) => state` function with no browser, timer, network, or module-level mutable state; `EdCarePlansPrototypeState` and every entity in it stays plain JSON-serialisable data (no `Date`, `Map`, `Set`, class instance, or function value); all IDs are allocated by the caller or by `nextSyntheticId`, never by `crypto`/`Math.random`/`Date.now`; and every state change goes through one dispatched action. Do NOT add a storage layer, adapter interface, persistence flag, or migration scaffolding now — that is speculative work the prototype does not need. The seam is the discipline, not extra code.

## File Map

### Domain and state

- Create `src/components/ed-care-plans/mockups/types.ts` — complete domain/entity/input/action types.
- Create `src/components/ed-care-plans/mockups/fixtures.ts` — deterministic patients, users, sites, CMHTs, plans, presentations, reviews, audit events, scenarios, and public crisis contacts.
- Create `src/components/ed-care-plans/mockups/domain.ts` — search, current-version, activity, queue, contact-URI, and permission selectors.
- Create `src/components/ed-care-plans/mockups/prototype-state.ts` — initial-state builder, pure reducer, transition guards, IDs, and deterministic timestamps.
- Create `src/components/ed-care-plans/mockups/prototype-provider.tsx` — layout-scoped React provider and hook.
- Create `src/components/ed-care-plans/mockups/routes.ts` — literal route registry, query builders, and finite dynamic-parameter guards.

### Route family and shell

- Create `src/app/mockups/ed-care-plans/layout.tsx`, `loading.tsx`, and `route-page.tsx`.
- Create the seventeen `page.tsx` files listed in Task 3.
- Create `src/components/ed-care-plans/mockups/routable-suite.tsx` — pathname/query interpretation and route-to-page composition.
- Create `src/components/ed-care-plans/mockups/ed-care-plans-shell-frame.tsx` — desktop rail, phone navigation, synthetic marker, patient search, role specimen, route header, and announcements.
- Create `src/components/ed-care-plans/mockups/ed-care-plans.module.css` — route-scoped layout/safe-area/print rules.
- Create `src/components/ed-care-plans/mockups/index.ts` — public exports used by route files and tests.

### Product surfaces

- Create `clinical-snapshot-page.tsx`, `patient-directory.tsx`, `patient-workspace.tsx`, `patient-navigation.tsx`, and `contact-actions.tsx`.
- Create `management-plan-pages.tsx`, `management-plan-form.tsx`, and `management-plan-diff.tsx`.
- Create `presentation-pages.tsx`, `presentation-form.tsx`, and `presentation-timeline.tsx`.
- Create `safety-plan-pages.tsx` and `safety-plan-form.tsx`.
- Create `operations-pages.tsx`, `history-page.tsx`, and `system-states-page.tsx`.
- Create `prototype-ui.tsx` only for ED Care Plans-specific presentational patterns that combine repository primitives; do not duplicate shared primitives.

### Existing integration files

- Modify `src/lib/developer-area/headers.ts` and related proxy comments so `/mockups/ed-care-plans/**` uses the existing signed-in-administrator developer gate.
- Modify `src/app/mockups/mockups-layout-client.tsx` so ED Care Plans owns its shell instead of inheriting global mockup search chrome.
- Modify `src/app/mockups/development/page.tsx` to add the literal inbound Developer-hub entry and selected deep links.
- Modify `package.json`, `playwright.config.ts`, `docs/codebase-index.md`, `docs/site-map.md`, and generated documentation required by `npm run docs:update`.

### Tests and handoff evidence

- Create `tests/ed-care-plans-domain.test.ts`.
- Create `tests/ed-care-plans-prototype-state.test.ts`.
- Create `tests/ed-care-plans-route-files.test.ts`.
- Create `tests/ed-care-plans-linked-routes.dom.test.tsx`.
- Create `tests/ui-ed-care-plans-mockup.spec.ts`.
- Modify `tests/proxy.test.ts` and `tests/playwright-project-isolation.test.ts`.
- Create `docs/ed-care-plans/interaction-matrix.md`, `clinical-language-trace.md`, `accessibility-acceptance.md`, `implementation-handoff.md`, and `verification-report.md`.

## Canonical Interfaces

Task 1 must implement these names and unions exactly; later tasks consume them without redefining parallel types:

```ts
export type SyntheticId = `SYN-${string}`;
export type PrototypeRole =
  "ed_clinician" | "liaison_clinician" | "cmht_clinician" | "senior_clinician" | "plan_coordinator";
export type ManagementPlanVersionState = "draft" | "awaiting_approval" | "current" | "superseded" | "withdrawn";
export type SafetyPlanVersionState = "draft" | "current" | "superseded";
export type ReviewState = "within_review" | "due_soon" | "overdue";
export type ParticipationState = "co_produced" | "discussed" | "declined" | "patient_unavailable";
export type PatientConfirmationState = "confirmed" | "discussed_not_confirmed" | "declined" | "unavailable";
export type Disposition =
  | "discharged_home"
  | "short_stay"
  | "mental_health_admission"
  | "medical_admission"
  | "transfer"
  | "left_before_completion"
  | "other";
export type PlanAvailability = "available" | "unavailable" | "not_applicable";
export type PlanUse = "used" | "partially_used" | "not_used" | "not_applicable";
export type PlanHelpfulness = "helpful" | "mixed" | "not_helpful" | "not_assessed";
export type PrototypeScenario =
  | "normal"
  | "empty"
  | "no-current-plan"
  | "overdue-plan"
  | "withdrawn-plan"
  | "unverified-contact"
  | "identity-uncertain"
  | "version-conflict"
  | "offline"
  | "permission-unavailable"
  | "launch-failure"
  | "print-failure";

export type ManagementPlanContent = {
  // First-minute tier. All five are required before a version can be approved,
  // and together they are the entire Current Plan summary card, in this order.
  howToApproach: readonly string[];
  whatHelps: readonly string[];
  whatMakesItWorse: readonly string[];
  agreedEdApproach: readonly string[];
  whatWouldMakeThisDifferent: readonly string[];
  // Full-plan tier. Only whyThisPlanExists is required; the rest may be empty
  // and render as `Not recorded` rather than being silently omitted.
  whyThisPlanExists: string;
  whatThePersonWants: readonly string[];
  practicalNeeds: readonly string[];
  physicalHealthAndMedication: readonly string[];
  whoElseIsInvolved: readonly string[];
  reviewTriggers: readonly string[];
};

export const MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS = [
  "howToApproach",
  "whatHelps",
  "whatMakesItWorse",
  "agreedEdApproach",
  "whatWouldMakeThisDifferent",
  "whyThisPlanExists",
] as const satisfies readonly (keyof ManagementPlanContent)[];

export const FIRST_MINUTE_CONTENT_KEYS = [
  "howToApproach",
  "whatHelps",
  "whatMakesItWorse",
  "agreedEdApproach",
  "whatWouldMakeThisDifferent",
] as const satisfies readonly (keyof ManagementPlanContent)[];

/** Review clock. Default next-review interval and the amber warning window,
 *  shared by the Management Plan and the Personal Safety Plan. The interval is
 *  an editable default per version, never an enforced rule. */
export const REVIEW_INTERVAL_MONTHS = 12;
export const REVIEW_DUE_SOON_DAYS = 28;

export type SafetyPlanContent = {
  warningSigns: readonly string[];
  saferSurroundings: readonly string[];
  reasonsForLiving: readonly string[];
  selfStrategies: readonly string[];
  connectionPeopleAndPlaces: readonly string[];
  personalSupports: readonly { name: string; relationship: string; phone: string }[];
  professionalAndEmergencySupport: readonly string[];
};

export type IdentificationPolicy = {
  id: SyntheticId;
  status: "pending_governance";
  thresholdCount: null;
  thresholdLookbackMonths: null;
  manualReferralEnabled: true;
  explanation: string;
};

export type PrototypeUser = {
  id: SyntheticId;
  displayName: string;
  title: string;
  role: PrototypeRole;
};

export type Patient = {
  id: SyntheticId;
  fullName: string;
  preferredName: string;
  aliases: readonly string[];
  mrn: SyntheticId;
  dateOfBirth: string;
  ageCohort: "adult" | "older_adult";
  pronouns: string;
  homeHealthService: string;
  cmhtId: SyntheticId;
  managementPlanId: SyntheticId;
  personalSafetyPlanId: SyntheticId;
};

export type EdSite = { id: SyntheticId; name: string; healthService: string };

export type CmhtContact = {
  id: SyntheticId;
  name: string;
  catchment: string;
  sharedMailbox: string;
  dutyTelephoneDisplay: string;
  dutyTelephoneUri: string;
  operatingHours: string;
  timezone: "Australia/Perth";
  careCoordinator: string | null;
  afterHoursLabel: string;
  afterHoursTelephoneDisplay: string;
  afterHoursTelephoneUri: string;
  verifiedAt: string;
  verificationState: "verified" | "review_due" | "unverified";
};

export type ManagementPlan = {
  id: SyntheticId;
  patientId: SyntheticId;
  versionIds: readonly SyntheticId[];
  currentVersionId: SyntheticId | null;
};

export type ManagementPlanVersion = {
  id: SyntheticId;
  planId: SyntheticId;
  version: number;
  state: ManagementPlanVersionState;
  reviewState: ReviewState | null;
  authorId: SyntheticId;
  ownerId: SyntheticId;
  approverId: SyntheticId | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  reviewDueAt: string | null;
  revisionReason: string;
  participationState: ParticipationState;
  consentedSupportPeople: readonly string[];
  returnedReason: string | null;
  withdrawalReason: string | null;
  content: ManagementPlanContent;
};

export type PersonalSafetyPlan = {
  id: SyntheticId;
  patientId: SyntheticId;
  versionIds: readonly SyntheticId[];
  currentVersionId: SyntheticId | null;
};

export type PersonalSafetyPlanVersion = {
  id: SyntheticId;
  planId: SyntheticId;
  version: number;
  state: SafetyPlanVersionState;
  reviewState: ReviewState | null;
  authorId: SyntheticId;
  createdAt: string;
  confirmedAt: string | null;
  reviewDueAt: string | null;
  patientConfirmation: PatientConfirmationState;
  collaborationNote: string;
  content: SafetyPlanContent;
};

export type EdPresentation = {
  id: SyntheticId;
  patientId: SyntheticId;
  arrivedAt: string;
  siteId: SyntheticId;
  /** Optional detail. Empty string means the recorder did not fill it in; render
   *  as `Not recorded`, never as an invented or inferred value. */
  presentingIndication: string;
  /** Optional detail, as above. */
  assessmentOutcome: string;
  /** Required free text: anything worth flagging. May be an empty string only
   *  when the recorder explicitly had nothing to add. */
  note: string;
  disposition: Disposition;
  /** Optional detail, as above. */
  cmhtContactAttempt: "not_attempted" | "attempted";
  /** Optional detail, as above. */
  cmhtContactOutcome: string;
  managementPlanVersionId: SyntheticId | null;
  planAvailability: PlanAvailability;
  planUse: PlanUse;
  planHelpfulness: PlanHelpfulness;
  deviationOccurred: boolean;
  deviationReason: string | null;
  reviewSuggested: boolean;
  reviewReason: string | null;
  recordedBy: SyntheticId;
  recordedAt: string;
};

export type PresentationAmendment = {
  id: SyntheticId;
  presentationId: SyntheticId;
  field: "assessmentOutcome" | "disposition";
  originalValue: string;
  replacementValue: string;
  reason: string;
  authorId: SyntheticId;
  amendedAt: string;
};

export type ReviewTrigger = {
  id: SyntheticId;
  patientId: SyntheticId;
  managementPlanId: SyntheticId;
  source: "plan_use_feedback" | "presentation_outcome" | "plan_deviation" | "formal_review" | "contact_verification";
  sourceId: SyntheticId;
  reason: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
};

export type IdentificationDecision = "proceed_to_plan" | "not_needed_now" | "revisit_later";

export type IdentificationReview = {
  id: SyntheticId;
  patientId: SyntheticId;
  reason: string;
  referredBy: SyntheticId;
  referredAt: string;
  status: "open" | "closed";
  decision: IdentificationDecision | null;
  decisionReason: string | null;
  decidedBy: SyntheticId | null;
  decidedAt: string | null;
};

export type AuditEventType =
  | "management_draft_created"
  | "management_draft_saved"
  | "management_version_submitted"
  | "management_version_returned"
  | "management_version_approved"
  | "management_version_withdrawn"
  | "management_review_recorded"
  | "presentation_recorded"
  | "presentation_amended"
  | "safety_plan_draft_created"
  | "safety_plan_draft_saved"
  | "safety_plan_made_current"
  | "safety_plan_print_intent_opened"
  | "email_intent_opened"
  | "call_intent_opened"
  | "identification_review_created"
  | "identification_review_closed"
  | "cmht_contact_verified"
  | "review_trigger_resolved";

export type AuditEvent = {
  id: SyntheticId;
  type: AuditEventType;
  patientId: SyntheticId | null;
  objectId: SyntheticId;
  actorId: SyntheticId;
  occurredAt: string;
  evidence: string;
};

export type PrototypeOutcome = {
  kind: "success" | "blocked" | "info" | "error";
  message: string;
};

export type EdCarePlansPrototypeState = {
  scenario: PrototypeScenario;
  persistence: "memory-only";
  activeUserId: SyntheticId;
  selectedPatientId: SyntheticId | null;
  connectivity: { online: boolean };
  permission: { available: boolean };
  identity: { certain: boolean };
  versionConflict: { active: boolean };
  users: PrototypeUser[];
  patients: Patient[];
  edSites: EdSite[];
  cmhtContacts: CmhtContact[];
  managementPlans: ManagementPlan[];
  managementPlanVersions: ManagementPlanVersion[];
  personalSafetyPlans: PersonalSafetyPlan[];
  personalSafetyPlanVersions: PersonalSafetyPlanVersion[];
  edPresentations: EdPresentation[];
  presentationAmendments: PresentationAmendment[];
  reviewTriggers: ReviewTrigger[];
  identificationPolicy: IdentificationPolicy;
  identificationReviews: IdentificationReview[];
  auditEvents: AuditEvent[];
  lastOutcome: PrototypeOutcome | null;
};

export type ManagementDraftInput = {
  ownerId: SyntheticId;
  reviewDueAt: string;
  revisionReason: string;
  participationState: ParticipationState;
  consentedSupportPeople: readonly string[];
  content: ManagementPlanContent;
};

export type SafetyPlanDraftInput = {
  reviewDueAt: string;
  patientConfirmation: PatientConfirmationState;
  collaborationNote: string;
  content: SafetyPlanContent;
};

export type NewEdPresentationInput = Omit<EdPresentation, "id" | "recordedBy" | "recordedAt">;
```

`types.ts` must also define the discriminated `EdCarePlansPrototypeAction` union in Task 2 using only these canonical types.

---

## Delivery Stages

The user asked to see working software before the whole nine tasks are built. The plan therefore runs in two stages with one mandatory stop between them.

**Stage A — Tasks 1 to 5.** Domain, reducer, gated route family and shell, Clinical Snapshot with patient search and CMHT contact, and the complete governed Management Plan lifecycle. At the end of Stage A the clinical journey the specification's acceptance criteria measure — find the patient, see whether a Current Plan exists, read the first-minute guidance, reach the CMHT, and draft/submit/compare/approve a replacement version — is fully working and testable in a browser.

**Stage A checkpoint (mandatory stop).** Tasks 6 to 9 do not begin until the user has reviewed Stage A and said to continue. Deliberately deferred at that point, and stated as such rather than presented as complete: ED Presentation recording and amendments (Task 6), Personal Safety Plan and print (Task 7), Reviews/Team/Governance/History/System states (Task 8), and all browser, accessibility, responsive and documentation proof (Task 9). Tasks 3 and 4 leave the deferred routes rendering their `RoutePurposeSurface` specimen, which is a truthful placeholder, not a broken page.

**Stage B — Tasks 6 to 9.** The remaining product surfaces and the full verification and documentation gate.

Stage A does not lower any gate. Every Stage A task still runs its own RED/GREEN cycle, task review, typecheck, format, and commit exactly as written below.

---

## Task 1: Domain Model, Deterministic Fixtures, Search, and Privacy-Safe Selectors

**Outcome:** The application has one exact domain vocabulary, deterministic synthetic scenarios, searchable patient fixtures, objective Presentation Activity, safe contact URIs, and review-queue selectors without any UI or state mutation.

**Files:**

- Create: `src/components/ed-care-plans/mockups/types.ts`
- Create: `src/components/ed-care-plans/mockups/fixtures.ts`
- Create: `src/components/ed-care-plans/mockups/domain.ts`
- Create: `tests/ed-care-plans-domain.test.ts`

- [ ] Add `tests/ed-care-plans-domain.test.ts` first. Import the not-yet-created domain modules and write one test for each contract below.

```ts
it("keeps identification policy governance-pending without a numeric rule", () => {
  expect(identificationPolicy).toEqual({
    id: "SYN-IDENTIFICATION-POLICY-001",
    status: "pending_governance",
    thresholdCount: null,
    thresholdLookbackMonths: null,
    manualReferralEnabled: true,
    explanation: expect.stringMatching(/local clinical and privacy governance/i),
  });
});

it.each([
  ["Rowan", "SYN-PATIENT-001"],
  ["SYN-MRN-0001", "SYN-PATIENT-001"],
  ["1986-04-12", "SYN-PATIENT-001"],
  ["Ro", "SYN-PATIENT-001"],
])("finds a patient by supported synthetic identity field", (query, patientId) => {
  expect(searchPatients(syntheticPatients, query).map(({ id }) => id)).toContain(patientId);
});

it("builds a generic CMHT email intent without patient information", () => {
  const contact = syntheticCmhtContacts[0]!;
  const href = buildCmhtMailto(contact);
  expect(href).toBe("mailto:north-river.cmht@example.org?subject=ED+Care+Plans+%E2%80%94+team+contact+request");
  expect(href).not.toMatch(/Rowan|SYN-MRN|1986|presentation|management plan/i);
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts`. A module-resolution error is setup evidence, not the RED gate. Add only the requested export signatures with empty values/throwing bodies, rerun, and confirm an assertion now fails for the intended missing domain behaviour before implementing it.
- [ ] Add the canonical unions and entity types to `types.ts`. Use readonly content arrays in preserved versions; reducer actions will replace whole versions rather than mutating nested arrays.
- [ ] Add deterministic fixture constants to `fixtures.ts` with `PROTOTYPE_NOW = "2026-08-20T14:30:00+08:00"` and these stable entity identities:

| Entity    | Stable fixtures                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patients  | `SYN-PATIENT-001` Rowan Sample; `002` Mira Example; `003` Jordan Test; `004` Evelyn Demo; `005` Alex Fiction                                          |
| Users     | `SYN-USER-ED-001` Dr Casey Example; `SYN-USER-LIAISON-001` Morgan Sample; `SYN-USER-SENIOR-001` Dr Taylor Fiction; `SYN-USER-COORD-001` Riley Demo    |
| EDs       | `SYN-ED-001` North River Hospital ED; `002` Coastal Plains Hospital ED; `003` Wandoo District Hospital ED                                             |
| CMHTs     | `SYN-CMHT-001` North River CMHT; `002` Coastal Plains Older Adult CMHT; `003` Wandoo District CMHT                                                    |
| Scenarios | Normal Current Plan; overdue Current plus Awaiting Approval; no Current Plan; withdrawn Current; mixed-helpfulness Review Trigger; unverified contact |

- [ ] Give every fictional CMHT a reserved-example shared mailbox, fictional Australian mobile, hours, timezone, coordinator, after-hours path, verification date, and verification state. Add the separately labelled official crisis-contact fixtures and source URLs specified in Global Constraints.
- [ ] Add enough ED Presentation fixtures to derive each displayed activity count from presentation timestamps. Rowan must show `7 ED presentations in rolling 12 months`; this is observation-only copy and is never compared with policy.
- [ ] Write fixture plan content against the eleven-field two-tier shape. Every fixture Current version fills all five first-minute keys and `whyThisPlanExists`; at least one fixture leaves two full-plan keys empty so the `Not recorded` path has coverage. Fixture prose must be plausible clinical continuity guidance in the glossary's preferred language, and `whatWouldMakeThisDifferent` must always name concrete new findings that would void the plan rather than generic caution.
- [ ] Derive fixture `reviewDueAt` values from `PROTOTYPE_NOW` and `REVIEW_INTERVAL_MONTHS` so that the fixture set covers `within_review`, `due_soon` (inside `REVIEW_DUE_SOON_DAYS`), and `overdue` without hardcoding unrelated dates.
- [ ] Implement in `domain.ts`: `searchPatients`, `getPatientById`, `getCurrentManagementPlanVersion`, `getOpenManagementDraft`, `getCurrentSafetyPlanVersion`, `countPresentationActivity`, `buildPatientSnapshot`, `buildCmhtMailto`, `buildCmhtTel`, `getReviewQueues`, `canPerformAction`, `deriveReviewState`, and `assertSingleCurrentVersion`.
- [ ] Make `searchPatients` trim and case-fold input and match only synthetic full name, preferred name, alias, MRN, and ISO/display DOB. Do not search plan, presentation, safety-plan, cultural, support-person, or clinical text.
- [ ] Make `getReviewQueues` return exactly `{ awaitingApproval, reviewSuggested, contactVerification, identificationReview }`, each ordered oldest-actionable-first and never severity-ranked. The `identificationReview` queue contains only referrals whose `status` is `open`.
- [ ] Make `deriveReviewState(reviewDueAt, now)` return `overdue` past the date, `due_soon` within `REVIEW_DUE_SOON_DAYS` of it, and `within_review` otherwise, with a test pinning both boundaries exactly.
- [ ] Finish the remaining tests: all entity IDs are synthetic; Current selection is unique; Draft stays separate; raw activity derives from episodes; public contacts match the exact authorised list; no fixture uses stigmatising labels; safe URI builders contain no patient field.
- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts`. Expected GREEN: the new domain test file passes with zero failures.
- [ ] Run `npx prettier --write src/components/ed-care-plans/mockups/types.ts src/components/ed-care-plans/mockups/fixtures.ts src/components/ed-care-plans/mockups/domain.ts tests/ed-care-plans-domain.test.ts` and rerun the same test command.
- [ ] Review the task diff for duplicate entity types, mutable preserved versions, non-synthetic IDs, hidden threshold logic, and real organisation names outside the authorised public crisis fixtures.
- [ ] Commit only Task 1 files with `feat(ed-care-plans): define synthetic clinical domain`. Do not push.

## Task 2: Pure Lifecycle Reducer and Layout-Scoped Provider

**Outcome:** One reducer enforces the complete longitudinal lifecycle and audit semantics; one provider shares the same state across every route and resets on refresh.

**Files:**

- Modify: `src/components/ed-care-plans/mockups/types.ts`
- Create: `src/components/ed-care-plans/mockups/prototype-state.ts`
- Create: `src/components/ed-care-plans/mockups/prototype-provider.tsx`
- Create: `tests/ed-care-plans-prototype-state.test.ts`

- [ ] Write `tests/ed-care-plans-prototype-state.test.ts` before production code. Start with the approval invariant and append-only presentation tests.

```ts
it("approves an awaiting version atomically and preserves exactly one Current Plan", () => {
  let state = createInitialPrototypeState("overdue-plan");
  state = prototypeReducer(state, { type: "set-active-user", userId: "SYN-USER-SENIOR-001" });
  const awaitingId = getOpenManagementDraft(state, "SYN-PATIENT-002")!.id;
  const next = prototypeReducer(state, { type: "approve-management-version", versionId: awaitingId });
  const versions = next.managementPlanVersions.filter(({ planId }) => planId === "SYN-MANAGEMENT-PLAN-002");

  expect(versions.filter(({ state }) => state === "current")).toHaveLength(1);
  expect(versions.find(({ id }) => id === awaitingId)?.state).toBe("current");
  expect(versions.find(({ version }) => version === 2)?.state).toBe("superseded");
  expect(next.managementPlans.find(({ id }) => id === "SYN-MANAGEMENT-PLAN-002")?.currentVersionId).toBe(awaitingId);
});

it("adds a visible amendment without changing the original ED Presentation", () => {
  const state = createInitialPrototypeState();
  const original = state.edPresentations.find(({ id }) => id === "SYN-PRESENTATION-001")!;
  const next = prototypeReducer(state, {
    type: "amend-presentation",
    presentationId: original.id,
    field: "assessmentOutcome",
    replacementValue: "Discharged after senior review and follow-up confirmation.",
    reason: "Clarify the recorded outcome.",
  });

  expect(next.edPresentations.find(({ id }) => id === original.id)?.assessmentOutcome).toBe(original.assessmentOutcome);
  expect(next.presentationAmendments.at(-1)).toMatchObject({ presentationId: original.id, field: "assessmentOutcome" });
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-prototype-state.test.ts`. If the import cannot resolve, add only the exported reducer signatures with throwing bodies, rerun, and confirm the first behavioural assertion fails for the intended lifecycle reason before implementing the transition.
- [ ] Define `createInitialPrototypeState(scenario: PrototypeScenario = "normal")` by deep-cloning fixture arrays, setting `persistence: "memory-only"`, selecting Rowan by default, and deriving scenario flags without browser APIs.
- [ ] Define `getPrototypeMutationBlockReason(state, action)` so offline, unavailable permission, identity uncertainty, and version conflict leave clinical entities unchanged and set a specific `lastOutcome`.
- [ ] Implement deterministic ID allocation as `nextSyntheticId(prefix, existingIds)` plus `nextPresentationId(state)`, and use `PROTOTYPE_NOW` plus stable per-action minute offsets. Do not use randomness or the wall clock in reducer tests. Reducer actions that receive an allocated ID must reject duplicates and the wrong synthetic prefix.
- [ ] Implement the exact discriminated action set:

```ts
export type EdCarePlansPrototypeAction =
  | { type: "select-patient"; patientId: SyntheticId }
  | { type: "set-active-user"; userId: SyntheticId }
  | { type: "create-management-draft"; patientId: SyntheticId }
  | { type: "save-management-draft"; versionId: SyntheticId; input: ManagementDraftInput }
  | { type: "submit-management-draft"; versionId: SyntheticId }
  | { type: "return-management-version"; versionId: SyntheticId; reason: string }
  | { type: "approve-management-version"; versionId: SyntheticId }
  | { type: "withdraw-current-management-version"; patientId: SyntheticId; reason: string }
  | {
      type: "record-formal-management-review";
      patientId: SyntheticId;
      reason: string;
      nextReviewDueAt: string;
    }
  | { type: "record-presentation"; presentationId: SyntheticId; input: NewEdPresentationInput }
  | {
      type: "amend-presentation";
      presentationId: SyntheticId;
      field: "assessmentOutcome";
      replacementValue: string;
      reason: string;
    }
  | {
      type: "amend-presentation";
      presentationId: SyntheticId;
      field: "disposition";
      replacementValue: Disposition;
      reason: string;
    }
  | { type: "create-safety-plan-draft"; patientId: SyntheticId }
  | { type: "save-safety-plan-draft"; versionId: SyntheticId; input: SafetyPlanDraftInput }
  | { type: "make-safety-plan-current"; versionId: SyntheticId }
  | { type: "record-safety-plan-print-intent"; patientId: SyntheticId }
  | { type: "record-contact-intent"; patientId: SyntheticId; cmhtId: SyntheticId; channel: "email" | "call" }
  | { type: "create-identification-review"; patientId: SyntheticId; reason: string }
  | {
      type: "close-identification-review";
      reviewId: SyntheticId;
      decision: IdentificationDecision;
      decisionReason: string;
    }
  | { type: "verify-cmht-contact"; cmhtId: SyntheticId }
  | { type: "resolve-review-trigger"; triggerId: SyntheticId; resolution: string }
  | { type: "apply-scenario"; scenario: PrototypeScenario }
  | { type: "clear-outcome" }
  | { type: "reset" };
```

- [ ] Enforce role permissions through `canPerformAction`. The reducer must independently recheck permission; unavailable UI is not the transition guard.
- [ ] Make approval validate: actor role, version state, named approver, complete required content, and an existing plan. In one returned state, supersede the previous Current version, make the submitted version Current, set approver/approval date/review state, update `currentVersionId`, and append one audit event.
- [ ] Make return-for-changes require a non-empty reason and return Awaiting Approval to Draft without touching Current. Make withdrawal require a non-empty reason and leave no Current version.
- [ ] Make `record-presentation` append an episode and audit event. If helpfulness is `mixed` or `not_helpful`, `reviewSuggested` is true, disposition is a mental-health/medical admission, or a material deviation is recorded, append one deduplicated open Review Trigger.
- [ ] Make `amend-presentation` append original/replacement/reason/actor/time evidence while keeping the episode immutable. Restrict amendable fields to the union in the action.
- [ ] Make Safety Plan publication require an editable Draft, supersede the prior Current Safety Plan, and set the new version Current without consulting senior-approval state.
- [ ] Make contact-intent actions append only intent audit events; make manual identification referral append an Identification Review and audit event without creating a Management Plan or Review Trigger.
- [ ] Make `close-identification-review` require an `open` review and a non-empty reason, set `status: "closed"` with the decision, reason, actor, and time, and append one `identification_review_closed` audit event. It must create no plan and no version on any decision, including `proceed_to_plan`. Closing an already-closed review leaves state unchanged and sets a specific `lastOutcome`.
- [ ] Add `EdCarePlansPrototypeProvider`, `useEdCarePlansPrototype`, and an online/offline listener to `prototype-provider.tsx`. The provider calls `useReducer` once and performs no persistence.
- [ ] Complete reducer tests for draft/current separation, non-senior approval refusal, return reason, withdrawal, formal review, Review Trigger creation/deduplication, Safety Plan independence, manual referral, intent-only audit language, degraded-state refusal, reset, and scenario reconstruction.
- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts`. Expected GREEN: both files pass with zero failures.
- [ ] Format the four Task 2 files, rerun the two tests, and inspect the diff for in-place array mutation, wall-clock/random IDs, overclaimed audit events, and transition paths that bypass permission checks.
- [ ] Commit only Task 2 files with `feat(ed-care-plans): enforce longitudinal plan lifecycles`. Do not push.

## Task 3: Gated Route Family, Literal Navigation, and Responsive Clinical Shell

**Outcome:** All approved URLs compile, validate finite synthetic parameters, share one provider, remain directly reconstructable, use the existing Developer-area authorization boundary, and render a responsive Clinical Snapshot shell without global mockup search chrome.

**Files:**

- Create: `src/components/ed-care-plans/mockups/routes.ts`
- Create: `src/components/ed-care-plans/mockups/ed-care-plans-shell-frame.tsx`
- Create: `src/components/ed-care-plans/mockups/ed-care-plans.module.css`
- Create: `src/components/ed-care-plans/mockups/routable-suite.tsx`
- Create: `src/components/ed-care-plans/mockups/index.ts`
- Create: `src/app/mockups/ed-care-plans/layout.tsx`
- Create: `src/app/mockups/ed-care-plans/loading.tsx`
- Create: `src/app/mockups/ed-care-plans/route-page.tsx`
- Create: every `page.tsx` listed below
- Modify: `src/lib/developer-area/headers.ts`
- Modify: `src/proxy.ts` comments describing gated prefixes
- Modify: `src/app/mockups/mockups-layout-client.tsx`
- Modify: `src/app/mockups/development/page.tsx`
- Modify: `tests/proxy.test.ts`
- Create: `tests/ed-care-plans-route-files.test.ts`
- Create: `tests/ed-care-plans-linked-routes.dom.test.tsx`

- [ ] Add route-file tests first. Pin the exact route registry and every expected file path:

```ts
expect(ED_CARE_PLANS_ROUTES).toEqual({
  home: "/mockups/ed-care-plans",
  patients: "/mockups/ed-care-plans/patients",
  patient: "/mockups/ed-care-plans/patients/SYN-PATIENT-001",
  managementPlan: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/management-plan",
  managementPlanEdit: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/management-plan/edit",
  managementPlanReview: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/management-plan/review",
  safetyPlan: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/safety-plan",
  safetyPlanEdit: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/safety-plan/edit",
  safetyPlanPrint: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/safety-plan/print",
  presentations: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/presentations",
  newPresentation: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/presentations/new",
  presentation: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/presentations/SYN-PRESENTATION-001",
  history: "/mockups/ed-care-plans/patients/SYN-PATIENT-001/history",
  reviews: "/mockups/ed-care-plans/reviews",
  team: "/mockups/ed-care-plans/team",
  governance: "/mockups/ed-care-plans/governance",
  systemStates: "/mockups/ed-care-plans/system-states",
});
```

- [ ] In the same test file, recursively read only the new route/component namespaces and reject `fetch(`, storage APIs, cookies, OpenAI/Supabase/analytics imports, route handlers, and non-mockup application routes.
- [ ] Add proxy tests that expect production access to pass through to `DeveloperAreaGate` for the base, patient deep route, and presentation deep route; expect similarly prefixed archive paths to remain blocked.
- [ ] Add initial DOM tests that render `EdCarePlansRouteSurface` with an injected `navigate` spy, then assert one `<h1>`, the synthetic boundary, desktop rail links, phone navigation, active destination, and route headings.
- [ ] Run `npm run test -- tests/ed-care-plans-route-files.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx tests/proxy.test.ts`. The file-existence and proxy assertions must fail directly. If the DOM import cannot resolve, add only the route-surface export signature returning `null`, rerun, and confirm its landmark/navigation assertion fails before implementing the shell.
- [ ] Run `npm run workflow:design-sweep -- --files src/app/mockups/ed-care-plans,src/components/ed-care-plans/mockups,src/app/mockups/mockups-layout-client.tsx --write-evidence` before UI implementation, review the ignored `.local/workflow-evidence` output, and record the result in the SDD report. This is the repository UI skill's design-system preflight, not product verification.
- [ ] Run `npm run ensure`, use only the repository-printed URL, and confirm `/api/local-project-id` identifies this Database project. Do not attach to or stop another project's server.
- [ ] Create `routes.ts` with `ED_CARE_PLANS_BASE`, the exact `ED_CARE_PLANS_ROUTES` object above, `edCarePlansRoute.patient(patientId)`, `managementPlan(patientId)`, `safetyPlan(patientId)`, `presentations(patientId)`, `presentation(patientId, presentationId)`, `scenario(name, route?)`, and `withQuery(route, key, value)`.
- [ ] Export finite `SYNTHETIC_PATIENT_PARAMS` and `SYNTHETIC_PRESENTATION_PARAMS` aligned to fixtures plus `isSyntheticPatientId` and `isSyntheticPresentationForPatient`. Unknown dynamic parameters must call `notFound()` in the server page.
- [ ] Create these page files; static pages return `<EdCarePlansRoutePage />`, patient pages await `params: Promise<{ patientId: string }>`, and the episode page awaits both IDs:

```text
src/app/mockups/ed-care-plans/page.tsx
src/app/mockups/ed-care-plans/patients/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/management-plan/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/management-plan/edit/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/management-plan/review/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/safety-plan/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/safety-plan/edit/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/safety-plan/print/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/presentations/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/presentations/new/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/presentations/[presentationId]/page.tsx
src/app/mockups/ed-care-plans/patients/[patientId]/history/page.tsx
src/app/mockups/ed-care-plans/reviews/page.tsx
src/app/mockups/ed-care-plans/team/page.tsx
src/app/mockups/ed-care-plans/governance/page.tsx
src/app/mockups/ed-care-plans/system-states/page.tsx
```

- [ ] Add `generateStaticParams()` to every dynamic page from the finite parameter lists. Do not duplicate literal IDs across page files.
- [ ] Create `layout.tsx` that nests `DeveloperAreaGate` outside `EdCarePlansPrototypeProvider`. Create one `loading.tsx`/Suspense fallback that exposes `aria-busy` and no fake patient content.
- [ ] Add `/mockups/ed-care-plans` to `DEVELOPER_GATED_PATH_PREFIXES`, update the proxy's explanatory comment, and update proxy tests. Do not widen access to all `/mockups/**`.
- [ ] Add `isEdCarePlansMockup` to `mockups-layout-client.tsx`; use the same base-or-descendant test as Caring Contact and exclude the route family from both shared composer and shared chrome.
- [ ] Add an ED Care Plans surface to `DEVELOPMENT_SURFACES` with a literal home link and deep links for Patients, Reviews, Governance, and System states.
- [ ] Build `EdCarePlansShellFrame` with desktop `Home`, `Patients`, `Reviews`, `Team`, and `Governance` links; a phone `Home`, `Patients`, `Reviews`, and `More` navigation; one search slot; displayed synthetic user/role; `Synthetic prototype — fictional data only`; page title; and one action slot.
- [ ] Use `Sheet` for phone More navigation and keep the bottom dock outside print. Every link comes from `routes.ts`; every button has a handler. Set `aria-current="page"` from the resolved destination.
- [ ] In `ed-care-plans.module.css`, scope all selectors below `.appRoot`; implement desktop rail plus content, phone single column, top safe-area padding using `max(..., var(--safe-area-top))`, phone dock clearance, reduced-motion overrides, forced-colour borders, and print suppression through `data-print-hide`.
- [ ] Build `EdCarePlansRouteSurface({ pathname, query, navigate })` and `EdCarePlansRoutableSuite()`. The testable surface receives strings and a navigation callback; the router wrapper supplies `usePathname`, `useSearchParams`, and `router.push`.
- [ ] For this task only, route content is a semantic `RoutePurposeSurface` containing the approved route heading and purpose copy. It is a working shell specimen, contains no unavailable controls, and is replaced route-by-route in Tasks 4–8.
- [ ] Run the three-test RED command again. Expected GREEN: route files, DOM shell, and proxy boundary all pass.
- [ ] Run `npm run typecheck`. Expected GREEN: Next 16 async params, client/server boundaries, CSS module, and route imports compile.
- [ ] Format all Task 3 files, rerun the three tests and typecheck, and inspect literal links, gate scope, focus names, 48 px targets, and absence of raw patient content in query strings.
- [ ] Commit Task 3 with `feat(ed-care-plans): add gated clinical route shell`. Do not push.

## Task 4: Clinical Snapshot, Patient Search, Current Plan Hierarchy, and CMHT Actions

**Outcome:** An authorised synthetic ED clinician can search supported identity fields, select the right patient, recognise Current-versus-Draft state, read first-minute guidance, and launch a privacy-safe CMHT email or call intent.

**Files:**

- Create: `src/components/ed-care-plans/mockups/prototype-ui.tsx`
- Create: `src/components/ed-care-plans/mockups/clinical-snapshot-page.tsx`
- Create: `src/components/ed-care-plans/mockups/patient-directory.tsx`
- Create: `src/components/ed-care-plans/mockups/patient-workspace.tsx`
- Create: `src/components/ed-care-plans/mockups/patient-navigation.tsx`
- Create: `src/components/ed-care-plans/mockups/contact-actions.tsx`
- Modify: `src/components/ed-care-plans/mockups/routable-suite.tsx`
- Modify: `tests/ed-care-plans-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for search, selection, Current hierarchy, overdue/no-plan states, patient tabs, and contact intents before creating any Task 4 component.

```tsx
it("finds a synthetic patient and keeps Current Plan above an awaiting draft", async () => {
  const user = userEvent.setup();
  renderRoute(ED_CARE_PLANS_ROUTES.home, "scenario=overdue-plan");
  await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), "SYN-MRN-0002");
  await user.click(screen.getByRole("button", { name: /Open Mira Example/i }));

  const workspace = screen.getByRole("region", { name: "Mira Example clinical snapshot" });
  expect(within(workspace).getByRole("heading", { level: 2, name: "Current Plan" })).toBeInTheDocument();
  expect(within(workspace).getByText(/Awaiting Approval version 3/i)).toBeInTheDocument();
  expect(within(workspace).getByText(/Current version 2 remains in use/i)).toBeInTheDocument();
});

it("exposes only intent-safe CMHT launch links", () => {
  renderRoute(ED_CARE_PLANS_ROUTES.patient);
  expect(screen.getByRole("link", { name: "Email North River CMHT" })).toHaveAttribute(
    "href",
    "mailto:north-river.cmht@example.org?subject=ED+Care+Plans+%E2%80%94+team+contact+request",
  );
  expect(screen.getByRole("link", { name: "Call North River CMHT" })).toHaveAttribute("href", "tel:+61491570101");
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-linked-routes.dom.test.tsx -t "synthetic patient|CMHT|Current Plan|No Current Plan|patient sections"`. Confirm RED because the product surfaces do not exist.
- [ ] Add ED Care Plans-specific `StatusMark`, `DefinitionRow`, `SectionFrame`, `SyntheticMarker`, and `ReviewWarning` compositions to `prototype-ui.tsx`. These combine tokens and shared primitives; they must not recreate Button, fields, tabs, dialogs, or sheets.
- [ ] Implement `PatientDirectory` with `SearchField`, recent patients, objective rolling counts, explicit lookback labels, manual-referral entry point, keyboard-operable row buttons, and deterministic no-results content. Keep all search state local and all selected-patient state in the provider.
- [ ] Make Home a desktop split of directory and selected workspace. On phone, present the directory first and use route navigation to the full-width patient workspace rather than retaining a compressed second column.
- [ ] Implement `PatientWorkspace` identity band with fictional marker, name, MRN, DOB, age cohort, preferred name, pronouns, home health service, plan currency, Safety Plan currency, CMHT verification, and Presentation Activity.
- [ ] Render a central Current Plan summary with preferred engagement, what helps, what may increase distress, immediate continuity considerations, CMHT coordination, owner, approver, version, approval date, review date/state, and the mandatory fresh-assessment boundary.
- [ ] If a Draft/Awaiting Approval exists, render it in a separate secondary region with exact state and state that Current remains in use. If no Current exists, say `No Current Plan` and never promote a Draft visually. If Current is overdue, keep the content readable below an amber text warning.
- [ ] Implement patient navigation links for `Overview`, `Management Plan`, `Personal Safety Plan`, `ED Presentations`, and secondary `History`, all generated from the selected patient's ID.
- [ ] Implement `ContactActions` with displayed mailbox, number, hours, coordinator, after-hours route, verification date/state, and external anchors. `onClick` dispatches `record-contact-intent`; success copy says only that the external application was requested.
- [ ] In `launch-failure`, leave contact details visible, intercept the action, and show what happened/what it means/what the user can do. In `unverified-contact`, keep the details visible with warning copy and a Reviews link.
- [ ] Wire Home, Patients, and patient Overview paths in `routable-suite.tsx`; remove their Task 3 route-purpose surfaces.
- [ ] Complete DOM tests for all supported search fields, empty query/results, route selection, visible Current status, Awaiting Approval separation, no Current, overdue, withdrawn, contact audit intent, unverified warning, launch failure, and accessible patient navigation.
- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 4 files, rerun the same checks, and inspect the 30-second snapshot hierarchy against the spec.
- [ ] Commit Task 4 with `feat(ed-care-plans): deliver searchable clinical snapshot`. Do not push.

## Task 5: Management Plan Read, Draft, Compare, Return, Approval, Review, and Withdrawal

**Outcome:** The complete clinician-facing plan is readable, a replacement version can be drafted and submitted, a named senior clinician can compare and approve or return it, and withdrawal/review remain explicit and audited.

**Files:**

- Create: `src/components/ed-care-plans/mockups/management-plan-pages.tsx`
- Create: `src/components/ed-care-plans/mockups/management-plan-form.tsx`
- Create: `src/components/ed-care-plans/mockups/management-plan-diff.tsx`
- Modify: `src/components/ed-care-plans/mockups/routable-suite.tsx`
- Modify: `tests/ed-care-plans-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for full-plan content, create/edit Draft, submit, version comparison, permission refusal, return-for-changes, approval, formal review, and withdrawal.

```tsx
it("requires named senior approval before an awaiting version becomes Current", async () => {
  const user = userEvent.setup();
  renderRoute(edCarePlansRoute.managementPlanReview("SYN-PATIENT-002"), "scenario=overdue-plan");
  await user.selectOptions(screen.getByRole("combobox", { name: "Prototype role" }), "SYN-USER-SENIOR-001");
  await user.click(screen.getByRole("button", { name: "Approve version 3" }));
  const dialog = screen.getByRole("dialog", { name: "Approve Management Plan version 3" });
  await user.click(within(dialog).getByRole("button", { name: "Approve and make Current" }));

  expect(screen.getByRole("heading", { level: 2, name: "Current Plan" })).toBeInTheDocument();
  expect(screen.getByText(/Current version 3/i)).toBeInTheDocument();
  expect(screen.getByText(/Approved by Dr Taylor Fiction/i)).toBeInTheDocument();
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-linked-routes.dom.test.tsx -t "Management Plan|senior approval|return for changes|withdraw"`. Confirm RED for missing Management Plan surfaces.
- [ ] Render the Current summary card as exactly `FIRST_MINUTE_CONTENT_KEYS` in order, with `whatWouldMakeThisDifferent` visually distinct and never collapsed; add a DOM test and a print-media test pinning that it is present and unclipped. Render empty optional full-plan sections as `Not recorded`.
- [ ] Implement the read page with Current summary first, full structured sections second, review state, open triggers, owner/approver metadata, separate proposed version, version list, and fresh-assessment boundary repeated near clinical guidance.
- [ ] Use `ManagementPlanForm` for both new Draft and edit Draft. Initialise from Current when creating a replacement. Expose owner, next review date (defaulted from `REVIEW_INTERVAL_MONTHS`, editable), revision reason, the five first-minute sections, and the six full-plan sections with the optional five clearly marked optional. Preserve unchanged sections from the source version.
- [ ] Validate exactly `MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS` plus owner, next review date, and revision reason. Render a linked error summary, focus the first invalid field, and dispatch `create-management-draft`/`save-management-draft` only after local validation. Do not require the optional five.
- [ ] Add `Save Draft` and `Submit for senior approval`. Submission uses `ConfirmDialog`, changes only Draft to Awaiting Approval, then navigates to the review route. The existing Current remains visible.
- [ ] Implement `ManagementPlanDiff` as semantic sections with `Added`, `Changed`, `Removed`, and `Unchanged` labels; compare the submitted version against the Current version without clinical interpretation.
- [ ] On the review page, show named author, owner, proposed approver, revision reason, current/proposed versions, patient participation, and change table. Do not allow edits while Awaiting Approval.
- [ ] Return-for-changes opens a Sheet with required reason; on confirm, dispatches the return action and navigates to edit. Approval is available only to `senior_clinician`, opens a plain-language ConfirmDialog, and dispatches the atomic reducer action.
- [ ] Add formal-review and withdrawal actions on the Current plan. Formal review requires a reason plus next review date and updates review evidence without changing plan content or creating a new version. Withdrawal requires a reason, explicit confirmation, and shows `No Current Plan` afterward without restoring history.
- [ ] Show unavailable actions with the repository's stated-reason pattern when the active role, offline state, permission state, identity state, or version state blocks them. The reducer remains the final guard.
- [ ] Wire Management Plan read/edit/review paths in `routable-suite.tsx`; remove their Task 3 route-purpose surfaces.
- [ ] Complete DOM tests for field errors, save/submit, read-only Awaiting Approval, Current preservation, diff labels, non-senior refusal, return reason, approval metadata, exactly one Current, overdue formal review, withdrawal, offline/version-conflict refusal, and live announcements.
- [ ] Run `npm run test -- tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 5 files, rerun both checks, and inspect every action label and state transition against the glossary.
- [ ] Commit Task 5 with `feat(ed-care-plans): implement governed management plans`. Do not push.

---

## Stage A Checkpoint — stop here for user review

**Do not start Task 6 until the user has reviewed Stage A and asked to continue.**

- [ ] Run the complete Stage A focused test set and record the decisive pass line:

```powershell
npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-route-files.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx tests/proxy.test.ts
```

- [ ] Run `npm run typecheck`. Expected GREEN.
- [ ] Run `npm run ensure`, confirm `/api/local-project-id` identifies this Database project, and use only the printed URL. Do not assume a port and do not disturb another project's server.
- [ ] Walk the Stage A journey in the running app as an ED clinician would: search a synthetic patient, open the Clinical Snapshot, confirm Current versus Draft hierarchy, read the first-minute guidance, see the CMHT contact block, then open a plan, create a draft, submit it, compare it, and approve it as the senior clinician. Check it at desktop width and at 390 px.
- [ ] Report to the user in plain language: what works, what is deliberately not built yet, the exact test evidence, and the local URL to look at. State plainly that Chromium/browser, accessibility, print and responsive proof are Task 9 work and have not run.
- [ ] Wait for the user's decision. Do not proceed to Task 6 on your own judgment; this checkpoint is one of the four things that stop an SDD controller.

---

## Task 6: ED Presentation Timeline, Concise Recording, Plan-Use Feedback, and Visible Amendments

**Outcome:** Clinicians can see the longitudinal episode timeline, record a concise ED Presentation, capture plan availability/use/helpfulness, create a human Review Trigger when indicated, and correct outcome/disposition through append-only amendments.

**Files:**

- Create: `src/components/ed-care-plans/mockups/presentation-pages.tsx`
- Create: `src/components/ed-care-plans/mockups/presentation-form.tsx`
- Create: `src/components/ed-care-plans/mockups/presentation-timeline.tsx`
- Modify: `src/components/ed-care-plans/mockups/routable-suite.tsx`
- Modify: `tests/ed-care-plans-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for the chronological timeline, new-presentation validation, current-version linkage, helpfulness feedback, Review Trigger creation, detail view, and amendment preservation.

```tsx
it("records plan-use feedback and creates a Review Suggested item without changing the plan", async () => {
  const user = userEvent.setup();
  renderRoute(edCarePlansRoute.newPresentation("SYN-PATIENT-001"));
  await user.selectOptions(screen.getByLabelText("Disposition"), "discharged_home");
  await user.selectOptions(screen.getByLabelText("Was the Current Plan used?"), "partially_used");
  await user.selectOptions(screen.getByLabelText("Was the plan helpful?"), "mixed");
  await user.type(screen.getByLabelText("Why is review suggested?"), "The sensory guidance needs clarification.");
  await user.click(screen.getByRole("button", { name: "Record ED presentation" }));

  expect(screen.getByRole("status")).toHaveTextContent(/ED Presentation recorded in this synthetic session/i);
  expect(screen.getByText(/Review Suggested/i)).toBeInTheDocument();
  expect(screen.getByText(/Current version 3/i)).toBeInTheDocument();
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-linked-routes.dom.test.tsx -t "ED Presentation|plan-use|amendment"`. Confirm RED because the episode surfaces do not exist.
- [ ] Implement `PresentationTimeline` as a descending semantic list with date/site, indication, outcome, disposition, linked plan version, plan-use summary, CMHT attempt outcome, Review Suggested text, and visible amendment count. Use a line-and-node treatment visually and retain complete text equivalents.
- [ ] Implement the list page with objective rolling counts, explicit observation windows, site filter, disposition filter, and `Record ED presentation` link. Do not add eligibility or severity labels.
- [ ] Implement `PresentationForm` with the required set visible by default and persistent labels: fictional ED, disposition, plan availability, plan use, plan helpfulness, and `Anything worth flagging?` free text. Arrival date and time default to `PROTOTYPE_NOW` and stay editable. Put presenting indication, assessment outcome, CMHT contact attempt/outcome, and the deviation flag behind one `Add more detail` disclosure that is closed on open and never blocks the save.
- [ ] Default the linked Management Plan Version to the Current version at form open; if none exists, show `No Current Plan was available` and submit `managementPlanVersionId: null`. Never link a Draft as the available plan.
- [ ] Require site, disposition, plan availability, plan use, and plan helpfulness; require a review reason whenever review is suggested and a deviation reason whenever a deviation is recorded. Presenting indication and assessment outcome are never required. Use an error summary and focus the first invalid field.
- [ ] On save, call `nextPresentationId(state)`, dispatch `record-presentation` with that ID, announce only local synthetic recording, and navigate to the matching detail route. The reducer validates the caller-provided synthetic ID before appending.
- [ ] Implement the detail page with the original immutable episode, recording clinician/time, linked plan version, plan-use feedback, outcome, Review Trigger, and an `Amend recorded outcome` action.
- [ ] The amendment Sheet permits only assessment outcome or disposition, shows the original value, and requires replacement plus reason. On save, display original and latest amendment together; do not replace the original DOM text.
- [ ] Wire presentation list/new/detail paths in `routable-suite.tsx`; validate that the episode belongs to the patient before rendering and show identity uncertainty rather than another patient's data on mismatch.
- [ ] Complete DOM tests for required fields, no-Current linkage, Current linkage, helpful/no-trigger, mixed/not-helpful trigger, admission trigger, deviation trigger, deduplication, deterministic navigation, original-plus-amendment rendering, and mismatched identity refusal.
- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 6 files, rerun the checks, and inspect that no form field duplicates a full ED note, diagnosis list, medication chart, or risk assessment.
- [ ] Commit Task 6 with `feat(ed-care-plans): track ED presentation continuity`. Do not push.

## Task 7: Patient-Owned Personal Safety Plan, Independent Versioning, and Privacy-Aware Print

**Outcome:** The current Personal Safety Plan is clearly separate from the Management Plan, can be co-produced and versioned without senior approval, and prints a patient-facing seven-step copy with minimum necessary synthetic identifiers and verified crisis contacts.

**Files:**

- Create: `src/components/ed-care-plans/mockups/safety-plan-pages.tsx`
- Create: `src/components/ed-care-plans/mockups/safety-plan-form.tsx`
- Modify: `src/components/ed-care-plans/mockups/routable-suite.tsx`
- Modify: `src/components/ed-care-plans/mockups/ed-care-plans.module.css`
- Modify: `tests/ed-care-plans-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for seven patient-voice sections, confirmation state, independent publication, no senior approval, print content minimisation, print intent, and print failure.

```tsx
it("renders a print-only patient copy without ED Presentation or audit content", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const user = userEvent.setup();
  renderRoute(edCarePlansRoute.safetyPlanPrint("SYN-PATIENT-001"));

  expect(screen.getByRole("heading", { level: 1, name: "My Personal Safety Plan" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
  expect(screen.queryByText(/ED Presentation timeline/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/audit history/i)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Print Personal Safety Plan" }));
  expect(print).toHaveBeenCalledOnce();
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-linked-routes.dom.test.tsx -t "Personal Safety Plan|print"`. Confirm RED because the Safety Plan surfaces do not exist.
- [ ] Implement the view page with patient-owned language, version, last-confirmed date, review state, patient confirmation state, collaboration author, and the seven exact headings from the specification.
- [ ] Keep the clinician-facing plan boundary explicit: this document supports the person's own coping and support actions and is not a Management Plan or a replacement for fresh assessment.
- [ ] Implement `SafetyPlanForm` for a new or existing Draft. Use a labelled repeatable textarea/list treatment for all seven content keys and structured personal-support name/relationship/phone entries.
- [ ] Require at least one item in every section, a next review date, a collaboration note, and one of the four patient-confirmation states. Do not treat declined or unavailable as non-compliance.
- [ ] Save the Draft independently, then use `Make current Personal Safety Plan` with a plain confirmation. Do not show or call the Management Plan approval action. The reducer supersedes the former Current Safety Plan.
- [ ] Implement the print route with `My Personal Safety Plan` as the patient-facing heading, preferred name plus synthetic MRN only, version, last-confirmed date, seven sections, personal supports, CMHT contact, `000`, MHERL Perth/Peel, Rurallink, service caveats/hours, public source links, synthetic watermark, and deterministic printed-at text.
- [ ] Add `data-print-hide` to shell/navigation/actions/audit links and `data-print-only` to the printed timestamp/watermark as needed. In `@media print`, use monochrome-safe borders, large readable type, no clipped sections, no fixed dock, and page-break avoidance for each safety section.
- [ ] The print button dispatches `record-safety-plan-print-intent` and calls `window.print()`. In `print-failure`, do not call print; retain the complete plan and show retry instructions.
- [ ] Wire Safety Plan view/edit/print paths in `routable-suite.tsx`; remove their Task 3 route-purpose surfaces.
- [ ] Complete DOM tests for section labels, edit errors, independent Draft/Current transition, declined/unavailable language, minimum-necessary print content, exact public contacts/caveats, absence of ED/audit content, intent-only audit, and failure recovery.
- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 7 files, rerun the checks, and inspect print DOM and CSS for hidden interactive controls and monochrome state clarity.
- [ ] Commit Task 7 with `feat(ed-care-plans): add printable personal safety plans`. Do not push.

## Task 8: Reviews, Team, Governance, Audit History, and Deterministic Degraded States

**Outcome:** All remaining routes are real operational surfaces: focused human worklists, CMHT/owner directory, combined evidence chronology, explicit pending identification governance, and reconstructable failure/degraded specimens.

**Files:**

- Create: `src/components/ed-care-plans/mockups/operations-pages.tsx`
- Create: `src/components/ed-care-plans/mockups/history-page.tsx`
- Create: `src/components/ed-care-plans/mockups/system-states-page.tsx`
- Modify: `src/components/ed-care-plans/mockups/routable-suite.tsx`
- Modify: `tests/ed-care-plans-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for all four Review queues, manual Identification Review, contact verification, team details, governance policy nulls, combined history, scenario deep links, and mutation refusal.

```tsx
it("creates a manual Identification Review without creating a plan or applying eligibility", async () => {
  const user = userEvent.setup();
  renderRoute(ED_CARE_PLANS_ROUTES.patients, "scenario=no-current-plan");
  await user.click(screen.getByRole("button", { name: "Refer Jordan Test for Identification Review" }));
  const dialog = screen.getByRole("dialog", { name: "Refer for Identification Review" });
  await user.type(
    within(dialog).getByLabelText("Reason for multidisciplinary review"),
    "Coordinate continuity across services.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Add to Identification Review" }));

  expect(screen.getByRole("status")).toHaveTextContent(/review added/i);
  expect(screen.getByText("No Current Plan")).toBeInTheDocument();
  expect(screen.queryByText(/eligible|high risk|frequent flyer/i)).not.toBeInTheDocument();
});
```

- [ ] Run `npm run test -- tests/ed-care-plans-linked-routes.dom.test.tsx -t "Identification Review|Awaiting Approval queue|Governance|System states|Audit history"`. Confirm RED because the operational surfaces do not exist.
- [ ] Implement Reviews with `Tabs` for exactly `Awaiting Approval`, `Review Suggested`, `Contact Verification`, and `Identification Review`. Each item shows reason, source/time, owner, next action, and direct patient/plan route; no severity order or dashboard scoring.
- [ ] Add manual-referral Sheet from Patients and patient Overview, require a reason, dispatch `create-identification-review`, and show the item in Reviews. The action does not create a plan or change Presentation Activity.
- [ ] Add referral closure to the Identification Review queue: a Sheet offering exactly `Proceed to a plan`, `Not needed at this stage`, and `Revisit later`, with a required reason. On confirm it dispatches `close-identification-review` and the item leaves the queue. On `Proceed to a plan` offer a link to start a draft; never create one automatically. Show the closed decision, reason, author, and time in the patient's History.
- [ ] Add Review Trigger resolution with required resolution text and contact-verification action with last/next verified evidence. Both are role-gated and audited.
- [ ] Implement Team as a directory of fictional CMHTs and plan owners showing catchment, shared mailbox, duty telephone, operating hours/timezone, coordinator, after-hours path, verification state/date, and current owned-plan count.
- [ ] Implement Governance with the exact prototype boundary, illustrated role responsibilities, lifecycle rules, audit-evidence limits, privacy/print/contact rules, and an Identification Policy panel that displays `Pending local governance`, `No approved threshold count`, `No approved threshold lookback`, and `Manual referral enabled`.
- [ ] Never render a candidate numeric policy, default, slider, comparison line, configuration control, or activity-to-eligibility mapping.
- [ ] Implement History as one chronological semantic list joining plan-version actions, Safety Plan actions, ED Presentation recordings/amendments, print intents, contact intents, contact verification, and identification referrals. Label intent evidence accurately and allow type filters.
- [ ] Implement System states cards and query links for every `PrototypeScenario`. `apply-scenario` reconstructs fixtures from the URL; `normal` clears scenario query. Include normal, empty, no Current, overdue, withdrawn, unverified contact, identity uncertainty, conflict, offline, permission unavailable, launch failure, and print failure.
- [ ] Each degraded state says what happened, what it means, and the available action. Offline/permission/identity/conflict states keep readable synthetic data only where specified and make every mutation unavailable with a reason.
- [ ] Add prototype-role selection to the shell from the exact synthetic users. It changes only interaction-model permission state and never claims authentication or RBAC enforcement.
- [ ] Wire Reviews, Team, Governance, History, and System states in `routable-suite.tsx`; remove all remaining Task 3 route-purpose surfaces.
- [ ] Complete DOM tests for queue membership/order, manual referral, trigger resolution, contact verification, team contacts, governance null policy, history evidence language, role selection, every scenario URL, recovery, blocked mutation, and empty state.
- [ ] Run `npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-route-files.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx tests/proxy.test.ts`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 8 files, rerun the checks, and inspect the full route map to ensure no route-purpose specimen remains.
- [ ] Commit Task 8 with `feat(ed-care-plans): complete review and governance workspace`. Do not push.

## Task 9: Browser Journeys, Responsive and Accessibility Proof, Documentation, and Handoff Gate

**Outcome:** The complete route family has repository-wrapped Chromium proof at the required widths/modes, generated documentation is current, clinical/privacy constraints have deterministic evidence, and the final unpushed branch is ready for user review.

Task 9 adds cross-layer acceptance evidence, not new clinical product behaviour. Every production behaviour it exercises must already have completed a RED/GREEN reducer or DOM cycle in Tasks 1–8; do not manufacture an artificial browser failure. The Playwright project-registration change itself still follows RED/GREEN through `tests/playwright-project-isolation.test.ts`.

**Files:**

- Create: `tests/ui-ed-care-plans-mockup.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/playwright-project-isolation.test.ts`
- Modify: `package.json`
- Modify: `docs/codebase-index.md`
- Modify: `docs/site-map.md`
- Modify: generated documentation produced by `npm run docs:update`
- Create: `docs/ed-care-plans/interaction-matrix.md`
- Create: `docs/ed-care-plans/clinical-language-trace.md`
- Create: `docs/ed-care-plans/accessibility-acceptance.md`
- Create: `docs/ed-care-plans/implementation-handoff.md`
- Create: `docs/ed-care-plans/verification-report.md`

- [ ] Modify `tests/playwright-project-isolation.test.ts` first so it requires `ui-ed-care-plans-mockup` in the mockup project and rejects it from production projects.
- [ ] Run `npm run test -- tests/playwright-project-isolation.test.ts`. Confirm RED because the current Playwright matchers do not register the new spec.
- [ ] Add `ui-ed-care-plans-mockup` to the mockup test regex in both `testMatch` and `mockupSpecPattern`, then add the package script exactly:

```json
"test:e2e:ed-care-plans-mockup": "node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-ed-care-plans-mockup.spec.ts"
```

- [ ] Add the browser spec with `@mockup` and helper functions `gotoRoute`, `expectNoHorizontalOverflow`, `expectSyntheticBoundary`, `expectPhoneDockClearance`, and `expectSinglePageHeading`. Its stable route table must use `ED_CARE_PLANS_BASE` literals, not real patient data.
- [ ] Write browser journeys for: direct reconstruction of all 17 routes; search-to-Current Plan; Current plus Awaiting Approval hierarchy; create/submit/compare/return/approve version; record ED Presentation and Review Trigger; amend outcome; edit/publish/print Safety Plan; safe CMHT mailto/tel; manual Identification Review; resolve Review Trigger; verify contact; audit chronology; and all degraded scenarios.
- [ ] Add layout checks at 320, 390, 768, 1024, and 1440 px. At each width assert no page overflow, heading/action wrapping, Current Plan readability, CMHT/Safety access, 48 px primary targets, and phone dock clearance where applicable.
- [ ] Add keyboard traversal, Escape/focus restoration for Sheet/ConfirmDialog, reduced-motion, forced-colours, dark mode, 200% equivalent reflow, and print-media assertions. Browser automation is Chromium evidence; do not claim physical iPhone Safari or installed-PWA acceptance.
- [ ] Add optional screenshot capture behind `ED_CARE_PLANS_CAPTURE_EVIDENCE=1`, writing only ignored files under `.local/ed-care-plans/atlas`. Capture Home/patient/plan/review/presentation/Safety Print/Reviews/System states at 320, 390, and 1440 plus dark/forced-colour specimens.
- [ ] Rerun `npm run test -- tests/playwright-project-isolation.test.ts`. Expected GREEN: the new browser spec is collected only by `chromium-mockups`.
- [ ] Carry forward the reviewed Task 3 design-sweep evidence into the verification report. Do not rerun an unchanged design preflight; rerun it only if later work changed a shared UI foundation outside the ED Care Plans namespace.
- [ ] Run `npm run workflow:clinical-proof -- --files src/app/mockups/ed-care-plans,src/components/ed-care-plans/mockups,tests/ed-care-plans-domain.test.ts,tests/ed-care-plans-prototype-state.test.ts,tests/ed-care-plans-linked-routes.dom.test.tsx --write-evidence`. Record privacy, clinical-language, source, failure-mode, and rollback/prototype-boundary evidence from the ignored `.local/workflow-evidence` output. Do not run provider-backed workflows.
- [ ] Run `npm run ensure` and use only the printed URL after `/api/local-project-id` confirms this Database project. Leave unrelated local servers untouched.
- [ ] Run `npm run test:e2e:ed-care-plans-mockup`. Expected GREEN: all focused Chromium journeys pass. If a browser failure reveals a behaviour defect, first add the smallest failing reducer/DOM regression test, then fix production code and rerun the focused browser case through the wrapper.
- [ ] Run the browser command once with `ED_CARE_PLANS_CAPTURE_EVIDENCE=1` if the environment supports screenshot writing; record captured paths separately from pass/fail evidence. Screenshots are visual evidence, not correctness proof.
- [ ] Add the five handoff documents. `clinical-language-trace.md` maps every consequential label to the approved glossary/spec; `interaction-matrix.md` lists trigger/action/state/result for every control; `accessibility-acceptance.md` records viewport/input/media evidence; `implementation-handoff.md` records routes, reset boundary, fixtures, and limits; `verification-report.md` contains exact commands, exit codes, counts, failures, and unrun/provider-gated checks.
- [ ] Update `docs/codebase-index.md` with the ED Care Plans component/route family and add `/mockups/ed-care-plans` to the Developer-area gate description. Run `npm run docs:update`, then review `docs/site-map.md`, `docs/scripts-index.md`, and any other generated diff.
- [ ] Run the complete focused unit/DOM set:

```powershell
npm run test -- tests/ed-care-plans-domain.test.ts tests/ed-care-plans-prototype-state.test.ts tests/ed-care-plans-route-files.test.ts tests/ed-care-plans-linked-routes.dom.test.tsx tests/proxy.test.ts tests/playwright-project-isolation.test.ts
```

Expected GREEN: zero failed files and zero failed tests.

- [ ] Run the exact privacy/source scans and record their output:

```powershell
rg -n -i "frequent flyer|high utili[sz]er|problem patient|risk score|automatic enrol|automatically identif" src/components/ed-care-plans src/app/mockups/ed-care-plans
rg -n "localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\s*\(" src/components/ed-care-plans src/app/mockups/ed-care-plans
rg -n -i "\b(sent|delivered|read|replied|contact completed)\b" src/components/ed-care-plans src/app/mockups/ed-care-plans
```

Expected result: the first two scans have no matches; the evidence-language scan has only explicit negations or test assertions and each match is manually classified.

- [ ] Run a small Node/Vitest privacy assertion that every `mailto:` returned for every patient/contact pair equals the contact-only builder output and contains none of that patient's name, preferred name, aliases, MRN, DOB, presentation text, or plan text.
- [ ] Run `npm run typecheck`. Expected GREEN.
- [ ] Run `npm run check:production-readiness`. This is local source/config evidence only; passing does not make the prototype production-ready.
- [ ] Run `npm run build`. Expected GREEN: all routes compile and `check:bundle-budget` accepts the separate mockup-only chunk total. If the build guard reports an active task-owned dev server, verify project identity, stop only that listener, build, and restart only if browser work remains.
- [ ] Run `npm run verify:pr-local -- --dry-run --files <comma-separated changed paths>` and record the selected gate. Then run `npm run verify:pr-local` once because this is a complete cross-cutting handoff. Classify any environment/baseline failure accurately; do not repeat an unchanged failing aggregate.
- [ ] Run `npm run format`, inspect all formatting diffs for unrelated changes, and rerun only the checks whose inputs formatting changed. Run `git diff --check` and inspect `git status --short`.
- [ ] Re-read the approved specification and mark every acceptance criterion with direct code/test/browser evidence in `verification-report.md`. Do not infer requirement completion from a green test suite alone.
- [ ] Dispatch the most capable available final reviewer with the full branch review package, approved spec, SDD ledger rulings/parked findings, and exact verification report. Fix Critical/Important findings through one SDD fix wave and one scoped re-review.
- [ ] Commit Task 9 with `test(ed-care-plans): verify complete synthetic workflow`. Do not push, open a PR, deploy, or publish.

## Final Acceptance Matrix

The final reviewer and controller must verify these observable facts, not merely component presence:

| Requirement                            | Direct proof                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Search and identity                    | Domain search tests plus search-to-plan browser journey                          |
| Current/Draft separation               | Reducer invariant plus DOM and browser hierarchy assertions                      |
| Named senior approval                  | Permission/refusal tests plus compare-and-approve journey                        |
| One Current version                    | Pure reducer count assertion after approval                                      |
| Overdue remains readable               | DOM and 320/390/desktop browser checks                                           |
| Withdrawal restores nothing            | Reducer and patient workspace assertions                                         |
| Concise ED Presentation                | Form validation and detail/timeline browser journey                              |
| Append-only amendment                  | Original-value reducer assertion plus detail DOM/browser view                    |
| Review Trigger without auto-change     | Reducer before/after plan equality plus Reviews queue assertion                  |
| Separate Safety Plan                   | Independent reducer transition and distinct route/heading assertions             |
| Printable seven-step plan              | DOM section count, print-media browser check, and content-minimisation assertion |
| CMHT email/call                        | Exact href privacy tests and intent-only audit history                           |
| Manual Identification Review           | Null policy test plus manual-referral journey showing no new plan                |
| No encoded numeric identification rule | Policy null types/fixtures, governance UI, and source inspection                 |
| Synthetic/offline boundary             | Recursive namespace scan, route marker checks, reset-on-refresh browser journey  |
| Accessibility/responsiveness           | Keyboard/focus/media/320/390/768/1024/1440 evidence                              |
| Production boundary                    | Governance and handoff copy plus no-provider verification report                 |

## Execution Handoff

Local task commits are authorised. The controller must:

1. Run the SDD `scripts/sdd-workspace` helper for this exact plan file and create the plan-identified `progress.md` ledger.
2. Read this plan and the approved spec once, write the required file/interface conflict table to the ledger, and rule on any conflict before Task 1.
3. Use `scripts/task-brief` for each task, dispatch one fresh implementer with the brief/report paths and explicit model, then create a review package and dispatch a separate task reviewer.
4. Complete each review/fix loop before starting the next implementer; never parallelise implementation writes.
5. Preserve every local verification result and ruling in the ledger and final handoff.
6. Stop at the Stage A Checkpoint after Task 5, report to the user, and wait. Resume at Task 6 only on the user's word.
7. Stop after the unpushed local branch is fully reviewed and verified. Commit permission does not authorise push, PR, merge, deployment, provider access, or any production action.
