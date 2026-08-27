## Task 9: Patient Plan — Deterministic Transformation, Clinician Approval, Resources, and Print

**Outcome:** An approved Management Plan Version can be turned into a patient-facing edition in the person's own voice, with gaps the transformation refused to guess at, clinician approval before the patient receives it, resources chosen for that person, and a printable copy that stays truthful when the clinical plan moves on.

**Files:**

- Create: `src/components/care-plan/mockups/patient-plan-transform.ts`
- Create: `src/components/care-plan/mockups/patient-plan-pages.tsx`
- Create: `src/components/care-plan/mockups/patient-plan-form.tsx`
- Create: `tests/care-plan-patient-plan.test.ts`
- Modify: `src/components/care-plan/mockups/types.ts`
- Modify: `src/components/care-plan/mockups/fixtures.ts`
- Modify: `src/components/care-plan/mockups/prototype-state.ts`
- Modify: `src/components/care-plan/mockups/routable-suite.tsx`
- Modify: `tests/care-plan-linked-routes.dom.test.tsx`

- [ ] Write `tests/care-plan-patient-plan.test.ts` first, against the pure transformation only. It has no DOM and no provider.

```ts
it("never auto-converts the agreed approach and leaves it as a clinician gap", () => {
  const version = getCurrentManagementPlanVersion(createInitialPrototypeState(), "SYN-PATIENT-001")!;
  const draft = buildPatientPlanDraft(version, syntheticPatients[0]!, syntheticResources);
  const agreed = draft.sections.find(({ key }) => key === "whatWeAgreedWillHappen")!;

  expect(agreed.gap).toBe(true);
  expect(agreed.body).toEqual([]);
  expect(agreed.gapReason).toMatch(/written by a clinician/i);
});

it("is a pure function of the version and never reaches outside itself", () => {
  const version = getCurrentManagementPlanVersion(createInitialPrototypeState(), "SYN-PATIENT-001")!;
  const a = buildPatientPlanDraft(version, syntheticPatients[0]!, syntheticResources);
  const b = buildPatientPlanDraft(version, syntheticPatients[0]!, syntheticResources);
  expect(a).toEqual(b);
});
```

- [ ] Run `npm run test -- tests/care-plan-patient-plan.test.ts`. A module-resolution error is setup evidence, not RED. Add the export signature with a throwing body, rerun, and confirm the gap assertion fails for the intended reason before implementing.
- [ ] Add `PatientPlan`, `PatientPlanVersion`, `PatientPlanSection`, `PatientPlanSectionKey`, `PatientResource`, `PatientResourceCategory`, and `PATIENT_PLAN_SECTION_KEYS` to `types.ts`, and the four patient-plan actions and four audit event types to their existing unions. Add `patientPlans` and `patientPlanVersions` to prototype state.
- [ ] Implement `buildPatientPlanDraft(version, patient, resources)` in `patient-plan-transform.ts` as a pure function. It performs no network, storage, timer, random, wall-clock, or model call, and imports nothing from outside this namespace. `tests/care-plan-route-files.test.ts` already rejects those; extend it to name this module explicitly.
- [ ] Implement the transformation as a field-to-heading mapping over the eleven known clinical fields plus a curated `PLAIN_LANGUAGE_TERMS` dictionary, shifting to second person, present tense, and strengths-based framing. It never attempts free rewriting of arbitrary prose.
- [ ] Emit `gap: true` with a `gapReason` wherever conversion is not confident: any sentence containing a term absent from the dictionary, any clinical negation, and — unconditionally, regardless of content — `whatWeAgreedWillHappen`. Gaps carry an empty `body`; the transformation never guesses.
- [ ] Implement the reducer transitions: `create-patient-plan-draft` derives from the Current Management Plan Version and refuses when there is none; `save-patient-plan-draft` replaces sections and resources whole; `approve-patient-plan-version` requires any clinical role, requires zero unfilled gaps, supersedes the prior Current patient version, and stamps the approving clinician and time; `record-patient-plan-print-intent` appends intent evidence only. Approval must not consult senior-approval state.
- [ ] Implement staleness as a derived selector, never stored: a Current patient version whose `derivedFromManagementVersionId` is not the plan's `currentVersionId` is stale. Approving a newer Management Plan Version raises one deduplicated Review Trigger. Nothing is regenerated, hidden, or withdrawn automatically.
- [ ] Add synthetic `PatientResource` fixtures per patient covering care team, local service, housing, financial, transport, carer support, alcohol and other drugs, cultural or peer, the already-verified crisis contacts, and self-help reading. Only the crisis contacts are real; everything else is fictional and `SYN-` identified. Housing and financial entries are present for at least one patient because those are frequently the actual reason someone keeps presenting.
- [ ] Implement the view page with the eight headings in `PATIENT_PLAN_SECTION_KEYS` order, patient-voice language, the version, the approving clinician and date, the resources grouped by category, and the staleness notice when it applies.
- [ ] Implement `PatientPlanForm`: create from Current, show each gap prominently with its reason, allow editing of every section, and add or remove resources. `Approve patient copy` is unavailable with a stated reason while any gap is unfilled.
- [ ] Implement the print route on the shared `PrintOutput` primitive generalised in Task 5. It carries preferred name, version, approval date, the eight sections, the resources, the verified crisis contacts, the synthetic watermark, and a printed-at stamp. It omits navigation, clinical vocabulary, audit history, ED presentation data, and Management Plan internal metadata.
- [ ] Wire the three patient-plan paths in `routable-suite.tsx`; remove their Task 3 route-purpose surfaces.
- [ ] Complete tests for every section mapping, dictionary substitution, each gap trigger, gap-blocked approval, non-senior approval succeeding, supersession, staleness derivation and its trigger, resource grouping, print content minimisation, and the absence of any network, storage, or model reference in the namespace.
- [ ] Run `npm run test -- tests/care-plan-patient-plan.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx`. Expected GREEN.
- [ ] Run `npm run typecheck`, format Task 9 files, rerun the checks, and read the generated patient copy end to end as a patient would. If any converted sentence reads as clinical, blaming, or hopeless, the dictionary or the gap rules are wrong — fix those, not the fixture.
- [ ] Commit Task 9 with `feat(care-plan): add patient-facing plan and resources`. Do not push.
