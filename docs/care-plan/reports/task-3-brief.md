## Task 3: Gated Route Family, Literal Navigation, and Responsive Clinical Shell

**Outcome:** All approved URLs compile, validate finite synthetic parameters, share one provider, remain directly reconstructable, use the existing Developer-area authorization boundary, and render a responsive Clinical Snapshot shell without global mockup search chrome.

**Files:**

- Create: `src/components/care-plan/mockups/routes.ts`
- Create: `src/components/care-plan/mockups/care-plan-shell-frame.tsx`
- Create: `src/components/care-plan/mockups/care-plan.module.css`
- Create: `src/components/care-plan/mockups/routable-suite.tsx`
- Create: `src/components/care-plan/mockups/index.ts`
- Create: `src/app/mockups/care-plan/layout.tsx`
- Create: `src/app/mockups/care-plan/loading.tsx`
- Create: `src/app/mockups/care-plan/route-page.tsx`
- Create: every `page.tsx` listed below
- Modify: `src/lib/developer-area/headers.ts`
- Modify: `src/proxy.ts` comments describing gated prefixes
- Modify: `src/app/mockups/mockups-layout-client.tsx`
- Modify: `src/app/mockups/development/page.tsx`
- Modify: `tests/proxy.test.ts`
- Create: `tests/care-plan-route-files.test.ts`
- Create: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Add route-file tests first. Pin the exact route registry and every expected file path:

```ts
expect(CARE_PLAN_ROUTES).toEqual({
  home: "/mockups/care-plan",
  patients: "/mockups/care-plan/patients",
  patient: "/mockups/care-plan/patients/SYN-PATIENT-001",
  managementPlan: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan",
  managementPlanEdit: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan/edit",
  managementPlanReview: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan/review",
  managementPlanPrint: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan/print",
  patientPlan: "/mockups/care-plan/patients/SYN-PATIENT-001/patient-plan",
  patientPlanEdit: "/mockups/care-plan/patients/SYN-PATIENT-001/patient-plan/edit",
  patientPlanPrint: "/mockups/care-plan/patients/SYN-PATIENT-001/patient-plan/print",
  safetyPlan: "/mockups/care-plan/patients/SYN-PATIENT-001/safety-plan",
  safetyPlanEdit: "/mockups/care-plan/patients/SYN-PATIENT-001/safety-plan/edit",
  safetyPlanPrint: "/mockups/care-plan/patients/SYN-PATIENT-001/safety-plan/print",
  presentations: "/mockups/care-plan/patients/SYN-PATIENT-001/presentations",
  newPresentation: "/mockups/care-plan/patients/SYN-PATIENT-001/presentations/new",
  presentation: "/mockups/care-plan/patients/SYN-PATIENT-001/presentations/SYN-PRESENTATION-001",
  history: "/mockups/care-plan/patients/SYN-PATIENT-001/history",
  reviews: "/mockups/care-plan/reviews",
  team: "/mockups/care-plan/team",
  governance: "/mockups/care-plan/governance",
  systemStates: "/mockups/care-plan/system-states",
});
```

- [ ] In the same test file, recursively read only the new route/component namespaces and reject `fetch(`, storage APIs, cookies, OpenAI/Supabase/analytics imports, route handlers, and non-mockup application routes.
- [ ] Add proxy tests that expect production access to pass through to `DeveloperAreaGate` for the base, patient deep route, and presentation deep route; expect similarly prefixed archive paths to remain blocked.
- [ ] Add initial DOM tests that render `CarePlanRouteSurface` with an injected `navigate` spy, then assert one `<h1>`, the synthetic boundary, desktop rail links, phone navigation, active destination, and route headings.
- [ ] Run `npm run test -- tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx tests/proxy.test.ts`. The file-existence and proxy assertions must fail directly. If the DOM import cannot resolve, add only the route-surface export signature returning `null`, rerun, and confirm its landmark/navigation assertion fails before implementing the shell.
- [ ] Run `npm run workflow:design-sweep -- --files src/app/mockups/care-plan,src/components/care-plan/mockups,src/app/mockups/mockups-layout-client.tsx --write-evidence` before UI implementation, review the ignored `.local/workflow-evidence` output, and record the result in the SDD report. This is the repository UI skill's design-system preflight, not product verification.
- [ ] Run `npm run ensure`, use only the repository-printed URL, and confirm `/api/local-project-id` identifies this Database project. Do not attach to or stop another project's server.
- [ ] Create `routes.ts` with `CARE_PLAN_BASE`, the exact `CARE_PLAN_ROUTES` object above, `carePlanRoute.patient(patientId)`, `managementPlan(patientId)`, `safetyPlan(patientId)`, `presentations(patientId)`, `presentation(patientId, presentationId)`, `scenario(name, route?)`, and `withQuery(route, key, value)`.
- [ ] Export finite `SYNTHETIC_PATIENT_PARAMS` and `SYNTHETIC_PRESENTATION_PARAMS` aligned to fixtures plus `isSyntheticPatientId` and `isSyntheticPresentationForPatient`. Unknown dynamic parameters must call `notFound()` in the server page.
- [ ] Create these twenty-one page files; static pages return `<CarePlanRoutePage />`, patient pages await `params: Promise<{ patientId: string }>`, and the episode page awaits both IDs:

```text
src/app/mockups/care-plan/page.tsx
src/app/mockups/care-plan/patients/page.tsx
src/app/mockups/care-plan/patients/[patientId]/page.tsx
src/app/mockups/care-plan/patients/[patientId]/management-plan/page.tsx
src/app/mockups/care-plan/patients/[patientId]/management-plan/edit/page.tsx
src/app/mockups/care-plan/patients/[patientId]/management-plan/review/page.tsx
src/app/mockups/care-plan/patients/[patientId]/management-plan/print/page.tsx
src/app/mockups/care-plan/patients/[patientId]/patient-plan/page.tsx
src/app/mockups/care-plan/patients/[patientId]/patient-plan/edit/page.tsx
src/app/mockups/care-plan/patients/[patientId]/patient-plan/print/page.tsx
src/app/mockups/care-plan/patients/[patientId]/safety-plan/page.tsx
src/app/mockups/care-plan/patients/[patientId]/safety-plan/edit/page.tsx
src/app/mockups/care-plan/patients/[patientId]/safety-plan/print/page.tsx
src/app/mockups/care-plan/patients/[patientId]/presentations/page.tsx
src/app/mockups/care-plan/patients/[patientId]/presentations/new/page.tsx
src/app/mockups/care-plan/patients/[patientId]/presentations/[presentationId]/page.tsx
src/app/mockups/care-plan/patients/[patientId]/history/page.tsx
src/app/mockups/care-plan/reviews/page.tsx
src/app/mockups/care-plan/team/page.tsx
src/app/mockups/care-plan/governance/page.tsx
src/app/mockups/care-plan/system-states/page.tsx
```

- [ ] Add `generateStaticParams()` to every dynamic page from the finite parameter lists. Do not duplicate literal IDs across page files.
- [ ] Create `layout.tsx` that nests `DeveloperAreaGate` outside `CarePlanPrototypeProvider`. Create one `loading.tsx`/Suspense fallback that exposes `aria-busy` and no fake patient content.
- [ ] Add `/mockups/care-plan` to `DEVELOPER_GATED_PATH_PREFIXES`, update the proxy's explanatory comment, and update proxy tests. Do not widen access to all `/mockups/**`.
- [ ] Add `isCarePlanMockup` to `mockups-layout-client.tsx`; use the same base-or-descendant test as Caring Contact and exclude the route family from both shared composer and shared chrome.
- [ ] Add an Care Plan surface to `DEVELOPMENT_SURFACES` with a literal home link and deep links for Patients, Reviews, Governance, and System states.
- [ ] Build `CarePlanShellFrame` with desktop `Home`, `Patients`, `Reviews`, `Team`, and `Governance` links; a phone `Home`, `Patients`, `Reviews`, and `More` navigation; one search slot; displayed synthetic user/role; `Synthetic prototype — fictional data only`; page title; and one action slot.
- [ ] Use `Sheet` for phone More navigation and keep the bottom dock outside print. Every link comes from `routes.ts`; every button has a handler. Set `aria-current="page"` from the resolved destination.
- [ ] In `care-plan.module.css`, scope all selectors below `.appRoot`; implement desktop rail plus content, phone single column, top safe-area padding using `max(..., var(--safe-area-top))`, phone dock clearance, reduced-motion overrides, forced-colour borders, and print suppression through `data-print-hide`.
- [ ] Build `CarePlanRouteSurface({ pathname, query, navigate })` and `CarePlanRoutableSuite()`. The testable surface receives strings and a navigation callback; the router wrapper supplies `usePathname`, `useSearchParams`, and `router.push`.
- [ ] For this task only, route content is a semantic `RoutePurposeSurface` containing the approved route heading and purpose copy. It is a working shell specimen, contains no unavailable controls, and is replaced route-by-route in Tasks 4–8.
- [ ] Run the three-test RED command again. Expected GREEN: route files, DOM shell, and proxy boundary all pass.
- [ ] Run `npm run typecheck`. Expected GREEN: Next 16 async params, client/server boundaries, CSS module, and route imports compile.
- [ ] Format all Task 3 files, rerun the three tests and typecheck, and inspect literal links, gate scope, focus names, 48 px targets, and absence of raw patient content in query strings.
- [ ] Commit Task 3 with `feat(care-plan): add gated clinical route shell`. Do not push.
