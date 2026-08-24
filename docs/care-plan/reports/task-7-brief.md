## Task 7: ED Presentation Timeline, Concise Recording, Plan-Use Feedback, and Visible Amendments

**Outcome:** Clinicians can see the longitudinal episode timeline, record a concise ED Presentation, capture plan availability/use/helpfulness, create a human Review Trigger when indicated, and correct outcome/disposition through append-only amendments.

**Files:**

- Create: `src/components/care-plan/mockups/presentation-pages.tsx`
- Create: `src/components/care-plan/mockups/presentation-form.tsx`
- Create: `src/components/care-plan/mockups/presentation-timeline.tsx`
- Modify: `src/components/care-plan/mockups/routable-suite.tsx`
- Modify: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for the chronological timeline, new-presentation validation, current-version linkage, helpfulness feedback, Review Trigger creation, detail view, and amendment preservation.

```tsx
it("records plan-use feedback and creates a Review Suggested item without changing the plan", async () => {
  const user = userEvent.setup();
  renderRoute(carePlanRoute.newPresentation("SYN-PATIENT-001"));
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

- [ ] Run `npm run test -- tests/care-plan-linked-routes.dom.test.tsx -t "ED Presentation|plan-use|amendment"`. Confirm RED because the episode surfaces do not exist.
- [ ] Implement `PresentationTimeline` as a descending semantic list with date/site, indication, outcome, disposition, linked plan version, plan-use summary, CMHT attempt outcome, Review Suggested text, and visible amendment count. Use a line-and-node treatment visually and retain complete text equivalents.
- [ ] Implement the list page with objective rolling counts, explicit observation windows, site filter, disposition filter, and `Record ED presentation` link. Do not add eligibility or severity labels.
- [ ] Implement `PresentationForm` with the required set visible by default and persistent labels: fictional ED, disposition, plan availability, plan use, plan helpfulness, and `Anything worth flagging?` free text. Arrival date and time default to `PROTOTYPE_NOW` and stay editable. Put presenting indication, assessment outcome, CMHT contact attempt/outcome, and the deviation flag behind one `Add more detail` disclosure that is closed on open and never blocks the save.
- [ ] Default the linked Management Plan Version to the Current version at form open; if none exists, show `No Current Plan was available` and submit `managementPlanVersionId: null`. Never link a Draft as the available plan.
- [ ] Require site, disposition, plan availability, plan use, and plan helpfulness; require a review reason whenever review is suggested and a deviation reason whenever a deviation is recorded. Presenting indication and assessment outcome are never required. Use an error summary and focus the first invalid field.
- [ ] On save, call `nextPresentationId(state)`, dispatch `record-presentation` with that ID, announce only local synthetic recording, and navigate to the matching detail route. The reducer validates the caller-provided synthetic ID before appending.
- [ ] Implement the detail page with the original immutable episode, recording clinician/time, linked plan version, plan-use feedback, outcome, Review Trigger, and an `Amend recorded outcome` action.
- [ ] The amendment Sheet permits the six `AmendableField` values, shows each original value, and requires a replacement plus one reason. The three plan-use answers are presented as a single group; changing more than one in that group appends one amendment per changed answer under the same reason. On save, display original and latest amendment together; do not replace the original DOM text.
- [ ] Wire presentation list/new/detail paths in `routable-suite.tsx`; validate that the episode belongs to the patient before rendering and show identity uncertainty rather than another patient's data on mismatch.
- [ ] Complete DOM tests for required fields, no-Current linkage, Current linkage, helpful/no-trigger, mixed/not-helpful trigger, admission trigger, deviation trigger, deduplication, deterministic navigation, original-plus-amendment rendering, and mismatched identity refusal.
- [ ] Run `npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 7 files, rerun the checks, and inspect that no form field duplicates a full ED note, diagnosis list, medication chart, or risk assessment.
- [ ] Commit Task 7 with `feat(care-plan): track ED presentation continuity`. Do not push.

