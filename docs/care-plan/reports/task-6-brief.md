## Task 6: Management Plan Drafting, Comparison, Approval, Review, and Withdrawal

**Outcome:** A replacement version can be drafted and submitted, a named senior clinician can compare and approve or return it, and formal review and withdrawal are explicit, role-gated, and audited. Stage B begins here.

**Files:**

- Create: `src/components/care-plan/mockups/management-plan-form.tsx`
- Create: `src/components/care-plan/mockups/management-plan-diff.tsx`
- Modify: `src/components/care-plan/mockups/management-plan-read.tsx`
- Modify: `src/components/care-plan/mockups/routable-suite.tsx`
- Modify: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for create/edit Draft, validation, submit, version comparison, non-senior refusal, return-for-changes, approval, formal review, and withdrawal.

```tsx
it("requires named senior approval before an awaiting version becomes Current", async () => {
  const user = userEvent.setup();
  renderRoute(carePlanRoute.managementPlanReview("SYN-PATIENT-002"), "scenario=overdue-plan");
  await user.selectOptions(screen.getByRole("combobox", { name: "Prototype role" }), "SYN-USER-SENIOR-001");
  await user.click(screen.getByRole("button", { name: "Approve version 3" }));
  const dialog = screen.getByRole("dialog", { name: "Approve Management Plan version 3" });
  await user.click(within(dialog).getByRole("button", { name: "Approve and make Current" }));

  expect(screen.getByRole("heading", { level: 2, name: "Current Plan" })).toBeInTheDocument();
  expect(screen.getByText(/Current version 3/i)).toBeInTheDocument();
  expect(screen.getByText(/Approved by Dr Taylor Fiction/i)).toBeInTheDocument();
});
```

- [ ] Run `npm run test -- tests/care-plan-linked-routes.dom.test.tsx -t "senior approval|return for changes|withdraw|formal review"`. Confirm RED for the missing authoring surfaces.
- [ ] Use `ManagementPlanForm` for both new Draft and edit Draft. Initialise from Current when creating a replacement. Expose owner, next review date (defaulted from `REVIEW_INTERVAL_MONTHS`, editable), revision reason, participation state, the five first-minute sections, and the six full-plan sections with the optional five clearly marked optional. Preserve unchanged sections from the source version.
- [ ] Validate exactly `MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS` plus owner, next review date, revision reason, and participation state. Render a linked error summary and focus the first invalid field. Do not require the optional five.
- [ ] Reject prohibitive admission wording in `agreedEdApproach` at the form boundary: a field-level validation error naming the banned construction, with `BANNED_ADMISSION_CONSTRUCTIONS` exported from `domain.ts` and unit-tested. This is a wording guard, not clinical interpretation.
- [ ] Add `Save Draft` and `Submit for senior approval`. Submission uses `ConfirmDialog`, changes only Draft to Awaiting Approval, then navigates to the review route. The existing Current remains visible and unchanged throughout.
- [ ] Implement `ManagementPlanDiff` as semantic sections with `Added`, `Changed`, `Removed`, and `Unchanged` labels; compare the submitted version against the Current version without clinical interpretation.
- [ ] On the review page show named author, owner, proposed approver, revision reason, current and proposed versions, participation state, and the change table. Do not allow edits while Awaiting Approval.
- [ ] Return-for-changes opens a Sheet with a required reason; on confirm it dispatches the return action and navigates to edit. Approval is available only to `senior_clinician`, opens a plain-language `ConfirmDialog`, and dispatches the atomic reducer action.
- [ ] Approving a version whose participation is `declined` or `patient_unavailable` states that consequence in the confirmation dialog and raises the involvement Review Trigger.
- [ ] Add formal-review and withdrawal actions on the Current plan. Formal review requires a reason plus a next review date and updates review evidence without changing content or creating a version. Withdrawal is `senior_clinician` only, requires a reason and explicit confirmation, and afterwards the read page shows the withdrawal line built in Task 5.
- [ ] Add a `Record that this plan has been shared with the patient` action that sets `sharedWithPatientAt` and audits it. It does not create a Patient Plan; that is Task 9.
- [ ] Show unavailable actions with the repository's stated-reason pattern when role, offline, permission, identity, or version state blocks them. The reducer remains the final guard, and unavailable controls never crowd the reading surface.
- [ ] Wire the Management Plan edit and review paths in `routable-suite.tsx`; remove their Task 3 route-purpose surfaces.
- [ ] Complete DOM tests for field errors, banned wording, save/submit, read-only Awaiting Approval, Current preservation, diff labels, non-senior refusal for both approval and withdrawal, return reason, approval metadata, exactly one Current, overdue formal review, withdrawal display, offline/version-conflict refusal, and live announcements.
- [ ] Run `npm run test -- tests/care-plan-prototype-state.test.ts tests/care-plan-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 6 files, rerun both checks, and inspect every action label and state transition against the glossary.
- [ ] Commit Task 6 with `feat(care-plan): implement governed management plan authoring`. Do not push.
