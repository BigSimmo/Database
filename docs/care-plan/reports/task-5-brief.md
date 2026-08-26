## Task 5: Management Plan Reading, Pinned Safety Boundary, and Clinician Print

**Outcome:** The complete reading experience is finished. A clinician can open a patient's full Management Plan, read the five first-minute sections and the full-plan tier, see the pinned safety boundary before any plan content, and print a bedside or handover copy. This task closes Stage A; no authoring surface exists yet.

**Read primacy:** the specification's read-primacy rule governs every choice in this task. Nothing here may reserve space, navigation depth, or attention for the authoring controls that arrive in Task 6.

**Files:**

- Create: `src/components/care-plan/mockups/management-plan-read.tsx`
- Create: `src/components/care-plan/mockups/management-plan-print.tsx`
- Modify: `src/components/ui/print-output.tsx`
- Modify: `src/components/care-plan/mockups/care-plan.module.css`
- Modify: `src/components/care-plan/mockups/routable-suite.tsx`
- Modify: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests before any component. Cover: the summary card renders exactly `FIRST_MINUTE_CONTENT_KEYS` in order; the pinned boundary appears above all plan content; empty optional sections render `Not recorded`; the participation marker appears for a `declined`/`patient_unavailable` version; a withdrawn plan renders its withdrawal line rather than a bare `No Current Plan`; the print route contains the five sections and omits navigation, actions, audit, and drafts.

```tsx
it("pins the safety boundary above all plan content", () => {
  renderRoute(carePlanRoute.managementPlan("SYN-PATIENT-001"));
  const pinned = screen.getByTestId("care-plan-safety-boundary-pinned");
  const firstSection = screen.getByRole("heading", { level: 3, name: "How to approach Rowan Sample" });
  expect(pinned.compareDocumentPosition(firstSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(pinned).toHaveTextContent(/assess afresh/i);
});

it("shows a withdrawn plan as withdrawn, never as no plan at all", () => {
  renderRoute(carePlanRoute.managementPlan("SYN-PATIENT-004"), "scenario=withdrawn-plan");
  expect(screen.getByText(/Plan withdrawn on/i)).toBeInTheDocument();
  expect(screen.getByText(/Dr Taylor Fiction/)).toBeInTheDocument();
  expect(screen.queryByText(/^No Current Plan$/)).not.toBeInTheDocument();
});
```

- [ ] Run `npm run test -- tests/care-plan-linked-routes.dom.test.tsx -t "Management Plan|safety boundary|withdrawn|print"`. Confirm RED because the Management Plan reading surfaces do not exist.
- [ ] Implement the pinned safety boundary as a one-line summary of `whatWouldMakeThisDifferent`, rendered directly beneath the patient identity block and above every other plan element, at all viewports and in print. It links to the full section and never replaces it. Give it a stable `data-testid` and an accessible name.
- [ ] Implement the summary card as exactly `FIRST_MINUTE_CONTENT_KEYS` in order, with section 5 visually distinct and never collapsed, truncated, or clipped. Section 3's heading and helper copy frame it as what the service does, per the specification's language rule.
- [ ] Implement the full-plan tier beneath it: `whyThisPlanExists` then the optional five, each rendering `Not recorded` when empty rather than being omitted.
- [ ] Render version metadata without competing with content: version, Current state, approver and approval date, owner, review state derived through `deriveReviewState`, open Review Triggers, the `Written without this person's involvement` marker where applicable, whether the plan has been shared with the patient, and whether a current Patient Plan exists. A separate Awaiting Approval version is shown as clearly subordinate to the Current one.
- [ ] Implement the withdrawn state: `Plan withdrawn on <date> by <clinician> — <reason>`, with superseded versions still readable. Never render a withdrawn plan identically to a patient who never had one.
- [ ] Read `src/components/ui/print-output.tsx` and the two Therapy Compass printed screens first. Build the print route on `PrintOutput` and `BrowserPrintButton`. Where a capability is genuinely general — per-section page-break control, a monochrome state treatment, a standard confidential-document footer, a printed-at stamp — add it to the shared primitive with its own focused test and consume it here. Do not reimplement print behaviour locally, and do not add a route-scoped rule that duplicates something the primitive should own.
- [ ] The print view carries identifiers, the pinned boundary, the five sections in order, version and approval metadata, the CMHT block, a `check the electronic record` warning, the printed-at stamp, the synthetic watermark, and a confidential footer. It omits navigation, actions, audit history, and drafts. The print button dispatches `record-management-plan-print-intent`, then calls `window.print()`.
- [ ] Wire the Management Plan read and print paths in `routable-suite.tsx`; remove their Task 3 route-purpose surfaces. Leave `/management-plan/edit` and `/management-plan/review` on their route-purpose specimens until Task 6.
- [ ] Complete the DOM tests, including a `@media print` assertion that the pinned boundary and all five sections are present and unclipped.
- [ ] Run `npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 5 files, rerun both checks, and inspect every heading and label against the glossary.
- [ ] Commit Task 5 with `feat(care-plan): add management plan reading and print`. Do not push.

---

## Stage A Checkpoint — stop here for user review

**Do not start Task 6 until the user has reviewed Stage A and asked to continue.**

- [ ] Run the complete Stage A focused test set and record the decisive pass line:

```powershell
npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx tests/proxy.test.ts
```

- [ ] Run `npm run typecheck`. Expected GREEN.
- [ ] Run `npm run ensure`, confirm `/api/local-project-id` identifies this Database project, and use only the printed URL. Do not assume a port and do not disturb another project's server.
- [ ] Walk the Stage A journey in the running app as an ED clinician would: search a synthetic patient, open the Clinical Snapshot, confirm Current versus Draft hierarchy, read the first-minute guidance, check that the pinned safety boundary is above all plan content, open the full plan, see the CMHT contact block, and print the clinician summary. Check it at desktop width, 390 px, and 320 px, and check the print preview.
- [ ] Report to the user in plain language: what works, what is deliberately not built yet, the exact test evidence, and the local URL to look at. State plainly that Chromium/browser, accessibility, print and responsive proof are Task 9 work and have not run.
- [ ] Wait for the user's decision. Do not proceed to Task 6 on your own judgment; this checkpoint is one of the four things that stop an SDD controller.

---
