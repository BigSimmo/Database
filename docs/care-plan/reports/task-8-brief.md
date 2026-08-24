## Task 8: Patient-Owned Personal Safety Plan, Independent Versioning, and Privacy-Aware Print

**Outcome:** The current Personal Safety Plan is clearly separate from the Management Plan, can be co-produced and versioned without senior approval, and prints a patient-facing seven-step copy with minimum necessary synthetic identifiers and verified crisis contacts.

**Files:**

- Create: `src/components/care-plan/mockups/safety-plan-pages.tsx`
- Create: `src/components/care-plan/mockups/safety-plan-form.tsx`
- Modify: `src/components/care-plan/mockups/routable-suite.tsx`
- Modify: `src/components/care-plan/mockups/care-plan.module.css`
- Modify: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Add failing DOM tests for seven patient-voice sections, confirmation state, independent publication, no senior approval, print content minimisation, print intent, and print failure.

```tsx
it("renders a print-only patient copy without ED Presentation or audit content", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const user = userEvent.setup();
  renderRoute(carePlanRoute.safetyPlanPrint("SYN-PATIENT-001"));

  expect(screen.getByRole("heading", { level: 1, name: "My Personal Safety Plan" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
  expect(screen.queryByText(/ED Presentation timeline/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/audit history/i)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Print Personal Safety Plan" }));
  expect(print).toHaveBeenCalledOnce();
});
```

- [ ] Run `npm run test -- tests/care-plan-linked-routes.dom.test.tsx -t "Personal Safety Plan|print"`. Confirm RED because the Safety Plan surfaces do not exist.
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
- [ ] Run `npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 8 files, rerun the checks, and inspect print DOM and CSS for hidden interactive controls and monochrome state clarity.
- [ ] Commit Task 8 with `feat(care-plan): add printable personal safety plans`. Do not push.

