// src/components/caring-contacts/workspace/plan-wizard/role-labels.ts
//
// Plain words for the role identifiers a clinician would otherwise be shown raw.
//
// Round 1, finding M-2. Stage 1 read "Acting as: demo-coordinator (coordinator)" and stage 2 read
// "Approved by clinicalProgrammeLead and livedExperienceRepresentative". Those are internal
// identifiers on a clinical screen, and `plan-start-state.tsx`'s `REFERRAL_STATE_LABELS` is this
// workspace's own answer to exactly that. It also passed the interface-vocabulary scan only by
// luck: `\blead\b` finds no word boundary inside `ProgrammeLead`, so a rename to `programme_lead`
// would have turned a display defect into a scan failure.
//
// BOTH MAPS ARE `Record`s OVER THE DOMAIN'S OWN UNIONS, so a role added to either union and left
// unlabelled stops this file compiling rather than reaching a clinician as an identifier.
//
// WHY THIS IS RESOLVED ON THE SERVER. Only `src/app/caring-contacts/plans/new/page.tsx` imports it;
// the wizard receives finished strings. That keeps two domain modules out of the workspace's one
// client bundle (Ruling 13), and keeps the wizard's module graph — which
// `tests/caring-contacts-explained-automation.dom.test.tsx` walks in full — as small as it was.
import type { PathwayApprovalRole } from "@/lib/caring-contacts/pathway-versions";
import type { CaringContactRole } from "@/lib/caring-contacts/permissions";

/** The two governance seats that approve a pathway version, as a clinician would say them. */
export const PATHWAY_APPROVAL_ROLE_LABELS: Record<PathwayApprovalRole, string> = {
  clinicalProgrammeLead: "the clinical programme lead",
  livedExperienceRepresentative: "the lived-experience representative",
};

/** The role a person is acting in, as a clinician would say it. */
export const CARING_CONTACT_ROLE_LABELS: Record<CaringContactRole, string> = {
  coordinator: "coordinator",
  teamLead: "team lead",
  auditor: "auditor",
  clinicalProgrammeLead: "clinical programme lead",
  livedExperienceRepresentative: "lived-experience representative",
};
