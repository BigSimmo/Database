## Task 4: Clinical Snapshot, Patient Search, Current Plan Hierarchy, and CMHT Actions

**Outcome:** An authorised synthetic ED clinician can search supported identity fields, select the right patient, recognise Current-versus-Draft state, read first-minute guidance, and launch a privacy-safe CMHT email or call intent.

**Files:**

- Create: `src/components/care-plan/mockups/prototype-ui.tsx`
- Create: `src/components/care-plan/mockups/clinical-snapshot-page.tsx`
- Create: `src/components/care-plan/mockups/patient-directory.tsx`
- Create: `src/components/care-plan/mockups/patient-workspace.tsx`
- Create: `src/components/care-plan/mockups/patient-navigation.tsx`
- Create: `src/components/care-plan/mockups/contact-actions.tsx`
- Modify: `src/components/care-plan/mockups/routable-suite.tsx`
- Modify: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for search, selection, Current hierarchy, overdue/no-plan states, patient tabs, and contact intents before creating any Task 4 component.

```tsx
it("finds a synthetic patient and keeps Current Plan above an awaiting draft", async () => {
  const user = userEvent.setup();
  renderRoute(CARE_PLAN_ROUTES.home, "scenario=overdue-plan");
  await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), "SYN-MRN-0002");
  await user.click(screen.getByRole("button", { name: /Open Mira Example/i }));

  const workspace = screen.getByRole("region", { name: "Mira Example clinical snapshot" });
  expect(within(workspace).getByRole("heading", { level: 2, name: "Current Plan" })).toBeInTheDocument();
  expect(within(workspace).getByText(/Awaiting Approval version 3/i)).toBeInTheDocument();
  expect(within(workspace).getByText(/Current version 2 remains in use/i)).toBeInTheDocument();
});

it("exposes only intent-safe CMHT launch links", () => {
  renderRoute(CARE_PLAN_ROUTES.patient);
  expect(screen.getByRole("link", { name: "Email North River CMHT" })).toHaveAttribute(
    "href",
    "mailto:north-river.cmht@example.org?subject=Care+Plan+%E2%80%94+team+contact+request",
  );
  expect(screen.getByRole("link", { name: "Call North River CMHT" })).toHaveAttribute("href", "tel:+61491570101");
});
```

- [ ] Run `npm run test -- tests/care-plan-linked-routes.dom.test.tsx -t "synthetic patient|CMHT|Current Plan|No Current Plan|patient sections"`. Confirm RED because the product surfaces do not exist.
- [ ] Add Care Plan-specific `StatusMark`, `DefinitionRow`, `SectionFrame`, `SyntheticMarker`, and `ReviewWarning` compositions to `prototype-ui.tsx`. These combine tokens and shared primitives; they must not recreate Button, fields, tabs, dialogs, or sheets.
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
- [ ] Run `npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 4 files, rerun the same checks, and inspect the 30-second snapshot hierarchy against the spec.
- [ ] Commit Task 4 with `feat(care-plan): deliver searchable clinical snapshot`. Do not push.
