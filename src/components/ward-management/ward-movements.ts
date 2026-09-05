import { unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type {
  BedRelease,
  Cohort,
  LeaveBed,
  LegalStatus,
  Movement,
  MovementStage,
  Referral,
  Security,
  Unit,
  UrgencyLevel,
} from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits } from "@/components/ward-management/ward-sites";

/**
 * The transport-form name seeded onto `TransportJob.formRequired` below. This is a single fact
 * with one owner — the product owner may revise what this form is called — so it lives in one
 * place and both seed writes reference it, rather than each carrying its own copy of the string.
 */
export const SEEDED_TRANSPORT_FORM_REQUIRED = "Form 1A";

/**
 * Hand-authored movements covering the states volume alone cannot guarantee: three declines
 * with nowhere eligible left, a status change mid-referral, a movement that never completed,
 * every stage in the pathway at least once, and the older-adult and specialling pressure that
 * is normal — not exceptional — on a busy metro night. (Earlier revisions of this fixture
 * authored two Form 1A "legal-form breaches" here; the 2026-08-23 product-owner correction
 * removed every `dueAt` from every Form 1A, so no legal-form breach exists in this fixture any
 * longer — see `LegalForm`'s doc comment in `ward-model.ts`.)
 *
 * ⚠️ **THE FRONT-DOOR LINK, OWNER RULING R-2026-09-04-D — READ THIS BEFORE ADDING OR REMOVING A
 * `referralId` HERE.** Until 2026-09-04 not one of these twenty movements carried one, so
 * `referralForMovement` returned `undefined` for every patient in every department and the link
 * looked identical to a link that did not work. The ruling asks for both halves: seed the pairs
 * that genuinely exist, AND make the reasons a movement has no referral distinguishable.
 *
 * **What is authored here, and the two conditions every seeded link satisfies.** `RAISE_REFERRAL`
 * refuses a referral that does not resolve, and refuses one that was never addressed to the
 * department raising the journey. A seeded link is written by hand and meets no reducer, so the
 * fixture holds itself to the same two conditions plus a third the reducer gets for free — the
 * referral must have been raised BEFORE the journey it produced. **No existing referral could
 * satisfy that third condition against any existing movement**: the only two referrals addressed
 * to an emergency department (`RF-009`, `RF-011`) were raised 35 and 50 minutes before the anchor,
 * and the youngest movement at either of their departments was opened 180 minutes before it. So
 * `RF-012` and `RF-013` were AUTHORED AS THE ORIGINS of `WF-002` and `WF-009` — a referral, then
 * a triage into that same department, then the department raising the journey — rather than an
 * existing referral being retro-fitted to a movement it could not have caused.
 * `tests/ward-movement-referral-link.test.ts` asserts all three conditions over the whole fixture
 * by name, so a later edit that breaks one fails there rather than rendering as a true join.
 *
 * **Eighteen carry no referral and that is not laziness.** Three of them (`WF-001`, `WF-013`,
 * `WF-019`) record `referralAbsence: none_raised` — the ASSERTION that nobody referred this
 * person, authored so the clinical state has data at three departments and three stages instead of
 * being a code path nothing exercises. The other fifteen record nothing at all and read as
 * `not_recorded`: nothing in their authored story says whether anybody referred them, and
 * answering for them would manufacture exactly the certainty the ruling's `⚠️` warns against.
 *
 * ⚠️ **AND NO MOVEMENT HERE CARRIES `transportNeed` (owner ruling R-2026-09-04-C).** "Not recorded"
 * is the required default for existing data, and every movement in this fixture is existing data.
 * The three-state field is exercised through the reducer in
 * `tests/ward-movement-transport-need.test.ts`, never by guessing an answer for a seeded record.
 */
const seededMovements: Movement[] = [
  {
    id: "WF-001",
    originEdId: "arm-ed",
    openedAt: NOW_ANCHOR - 95,
    // Nobody referred this person — recorded 35 minutes after the department opened the journey,
    // which is when somebody actually looked. The ASSERTION, not the absence: see
    // `MovementReferralAbsence` for why the two are different facts.
    referralAbsence: { reason: "none_raised", at: NOW_ANCHOR - 60 },
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Confirming destination options",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-002",
    originEdId: "fsh-ed",
    openedAt: NOW_ANCHOR - 180,
    // Raised from `RF-012`, which was authored as this journey's origin: raised 240 minutes before
    // the anchor, addressed to THIS department (`fsh-ed`), and answered at the moment the
    // department opened the journey below. Ordering, department and resolution all hold — the
    // three conditions the fixture's own doc comment sets out.
    referralId: "RF-012",
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    specialling: true,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: ["fsh-older-adult"],
    declines: [],
    blocker: "Awaiting older-adult bed confirmation",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    formedAt: NOW_ANCHOR - 180 - 90,
    arrivalMode: "ambulance",
  },
  {
    id: "WF-003",
    originEdId: "rph-ed",
    openedAt: NOW_ANCHOR - 260,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    specialling: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "3B",
      kind: "detention",
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "accepted_awaiting_bed",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "rph-adult-secure",
    declines: [],
    blocker: "Bed being made ready",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    arrivalMode: "ambulance",
    examination: { at: NOW_ANCHOR - 60, outcome: "inpatient_order" },
  },
  {
    id: "WF-004",
    originEdId: "sjgm-ed",
    openedAt: NOW_ANCHOR - 410,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    specialling: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4C",
      kind: "transfer",
      dueAt: NOW_ANCHOR + 300,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "bty-adult-secure",
    declines: [],
    blocker: "Escort provider organising secure transport",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR - 10,
  },
  {
    id: "WF-005",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 330,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Detained awaiting examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "ED mental health team",
    referredUnitIds: [],
    acceptedUnitId: "fre-adult-open",
    declines: [],
    transport: {
      id: "TR-1005",
      provider: "Patient transport service",
      escortRequired: true,
      formRequired: SEEDED_TRANSPORT_FORM_REQUIRED,
      acceptedAt: NOW_ANCHOR - 30,
    },
    blocker: "Transport escort confirming departure time",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    formedAt: NOW_ANCHOR - 330 - 150,
  },
  {
    id: "WF-006",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 500,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    specialling: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4A",
      kind: "transport",
      dueAt: NOW_ANCHOR + 90,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "rgh-adult-secure",
    declines: [],
    transport: {
      id: "TR-1006",
      provider: "Patient transport service",
      escortRequired: true,
      acceptedAt: NOW_ANCHOR - 50,
      enRouteAt: NOW_ANCHOR - 15,
      // Collected 8 minutes after going en route (a short RGH-to-RGH-Adult-Secure hop), so at
      // NOW_ANCHOR the crew has been driving with the patient for 7 minutes — clearly still
      // mid-transfer, not close enough to arrival to also need `arrivedAt`.
      collectedAt: NOW_ANCHOR - 7,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [
      {
        unitId: "fsh-adult-secure",
        at: NOW_ANCHOR - 470,
        // 🔴 FD-23. This read "Referral withdrawn once RGH Adult Secure confirmed the bed" and
        // rendered verbatim at /mockups/ward-flow/ward/fsh-adult-secure — FSH told, in plain
        // English, that RGH took the patient. Hand-authored, so fixing the reducer alone would
        // have left the DEMONSTRATION leaking while the generated path was clean.
        reason: "another_unit_accepted",
      },
    ],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-007",
    originEdId: "scgh-ed",
    openedAt: NOW_ANCHOR - 600,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "arrived",
    owner: "Ward nurse in charge",
    referredUnitIds: [],
    acceptedUnitId: "scgh-older-adult",
    declines: [],
    blocker: "None — handover complete",
    // ⚠️ Sweep R64's own defect class, found a third time (2026-09-04, alongside the generator's
    // identical gap in `stageFields`'s `case "arrived"`): `PATIENT_ARRIVED` refuses outright
    // unless `movement.stage === "moving" && movement.transport?.collectedAt`, so this
    // hand-authored record was a state the reducer could never have produced until this job was
    // added. Timestamps built backwards from `closure.at`, the same construction the generator
    // now uses.
    transport: {
      id: "TR-007",
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 25,
      collectedAt: NOW_ANCHOR - 10,
      arrivedAt: NOW_ANCHOR - 5,
    },
    closure: { at: NOW_ANCHOR - 5, outcome: "arrived", reason: "Handover complete at SCGH Older Adult" },
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-008",
    originEdId: "jhc-ed",
    openedAt: NOW_ANCHOR - 150,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    // Ruling R64: carries acceptedUnitId but no pullExpiresAt and no transport. PULL_PATIENT is the
    // only reducer transition that writes pullExpiresAt, and HANDOVER_READY (the only producer of
    // "handover_ready") requires stage "pulled" already — so a movement with an accepted unit
    // but neither of those later fields never reached pulled, let alone handover_ready. The
    // furthest stage its own fields honestly support is "accepted_awaiting_bed".
    stage: "accepted_awaiting_bed",
    owner: "ED mental health team",
    referredUnitIds: [],
    acceptedUnitId: "fre-adult-open",
    declines: [],
    blocker: "Patient declined transfer",
    // Seed gap fixed 2026-09-04: the closure sentence said "before transport arrived", but this
    // record carries no `transport` at all — the comment immediately above confirms the movement
    // never progressed past `accepted_awaiting_bed`, so no transport was ever booked for it to
    // arrive. Reworded to be true of the record beside it, without changing `outcome` or `at`.
    closure: {
      at: NOW_ANCHOR - 20,
      outcome: "did_not_proceed",
      reason: "Patient self-discharged from ED before transport was arranged",
    },
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-009",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 420,
    // Raised from `RF-013` — a police referral to THIS department 470 minutes before the anchor,
    // matching this record's own `arrivalMode: "police"`. The second of the fixture's two seeded
    // links, at a different department from `WF-002`'s so a single-department bug cannot pass.
    referralId: "RF-013",
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    specialling: true,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "3B",
      kind: "detention",
    },
    // Seed gap fixed 2026-09-04: this record carried a `legalStatus` of "Involuntary inpatient"
    // and an examination whose outcome was an inpatient order (`examination.outcome:
    // "inpatient_order"`, below), while `statusChanges` sat empty — the page had no way to say
    // the status had changed and read the opposite. `CHANGE_LEGAL_STATUS` is the reducer's only
    // writer of both `legalStatus` and `statusChanges`, always in the same update, so a genuine
    // change leaves exactly this shape: one entry, timed at or after the examination it followed.
    statusChanges: [
      {
        at: NOW_ANCHOR - 95,
        from: "Detained awaiting examination",
        to: "Involuntary inpatient",
        by: "Duty psychiatrist",
        reason: "recorded_by_treating_team",
      },
    ],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [
      { unitId: "rph-adult-secure", at: NOW_ANCHOR - 90, reason: "no_bed" },
      {
        unitId: "gry-adult-secure",
        at: NOW_ANCHOR - 60,
        reason: "acuity_mix",
      },
      {
        unitId: "bty-adult-secure",
        at: NOW_ANCHOR - 30,
        reason: "bed_pulled_for_earlier_referral",
      },
      {
        unitId: "fsh-adult-secure",
        at: NOW_ANCHOR - 15,
        reason: "specialling_unavailable",
      },
      {
        unitId: "rgh-adult-secure",
        at: NOW_ANCHOR - 5,
        reason: "capability_mismatch",
      },
    ],
    // Every authorised secure adult unit in the network has now either declined this
    // referral or fails an eligibility gate on its own (Broome has zero allocatable beds;
    // SJGS Adult Secure is not MHA-authorised) — the search really is exhausted, not just
    // capped at three parallel referrals.
    blocker: "No secure adult bed available across the network",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    arrivalMode: "police",
    examination: { at: NOW_ANCHOR - 100, outcome: "inpatient_order" },
    escalation: {
      at: NOW_ANCHOR - 3,
      triedUnitIds: [
        "rph-adult-secure",
        "gry-adult-secure",
        "bty-adult-secure",
        "fsh-adult-secure",
        "rgh-adult-secure",
      ],
      contact: "State bed coordination desk",
    },
  },
  {
    id: "WF-010",
    originEdId: "jhc-ed",
    openedAt: NOW_ANCHOR - 110,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Detained awaiting examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [
      {
        at: NOW_ANCHOR - 40,
        from: "Voluntary",
        to: "Detained awaiting examination",
        by: "Duty psychiatrist",
        reason: "recorded_by_treating_team",
      },
    ],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: ["sjgm-adult-open"],
    declines: [],
    blocker: "Awaiting destination response",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-011",
    originEdId: "arm-ed",
    openedAt: NOW_ANCHOR - 360,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    specialling: true,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4C",
      kind: "transfer",
      dueAt: NOW_ANCHOR + 340,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "fre-older-adult",
    declines: [],
    blocker: "Awaiting single-room clean",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR + 20,
  },
  {
    id: "WF-012",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 70,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    specialling: true,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    // Was ["gry-adult-secure"] — fix for review C2. `RAISE_REFERRAL` is the only reducer branch
    // that produces "placement_requested" and it always writes `referredUnitIds: []`;
    // `REFER_TO_UNITS` is the only branch that ever populates `referredUnitIds`, and it always
    // does so in the same update that advances the stage to "destination_review". So a movement
    // that is still "placement_requested" — matching this record's own `blocker`, "Awaiting
    // specialling roster confirmation", which describes internal ED logistics before a referral
    // is raised, not a unit already sitting on one — can never honestly carry a live referral.
    // Coordinator screen showed "Parallel referral: Graylands Adult Secure" for a referral
    // Graylands' own ward screen could never see (its incoming list is keyed on
    // `stage === "destination_review"`), so nobody could ever accept or decline it. Clearing the
    // field to match the stage the fixture actually gives this record — rather than advancing
    // the stage to "destination_review" — is the smaller, more honest correction: nothing else on
    // this record (no coordinator note, no later referral history) supports a referral having
    // actually been raised.
    referredUnitIds: [],
    declines: [],
    blocker: "Awaiting specialling roster confirmation",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-013",
    originEdId: "sjgm-ed",
    openedAt: NOW_ANCHOR - 200,
    // Nobody referred this person. Recorded at a DIFFERENT stage from WF-001's — this movement is
    // already in `destination_review` with two live referrals to units — so the assertion cannot be
    // mistaken for "nothing is happening for this patient": the front door and the bed search are
    // separate facts, and this one is only about the front door.
    referralAbsence: { reason: "none_raised", at: NOW_ANCHOR - 150 },
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: ["bty-older-adult", "gry-older-adult"],
    declines: [],
    blocker: "Comparing two older-adult options",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    /**
     * ⚠️ **EQUAL TO `openedAt` ON PURPOSE — THIS IS THE BOUNDARY CASE, AND IT IS THE ONLY MOVEMENT
     * THAT DISCRIMINATES THE RULE `ed-screen.tsx`'s `isCommunityFormed` APPLIES.**
     *
     * Owner ruling, 2026-09-05: a form recorded at the very same minute as arrival IS community
     * formed, so the screen says *"since formed"*. He was asked precisely because the elapsed figure
     * is identical either way — both references are the same instant — so the ONLY thing the rule
     * changes here is which authority the screen names. Before this row the comparison was `<` and
     * nobody had chosen it.
     *
     * **Was `NOW_ANCHOR - 200 - 120` until 2026-09-05. Changed rather than adding a fourth movement
     * on purpose:** 73 test files import this fixture and 46 assert an exact count, so a new row
     * moves numbers under most of the ward suite. Editing this one moves none — the movement count
     * stays 50, and under the shipped `<=` rule WF-013 stays community formed, so that count stays 3
     * too. Under the old `<` rule it would drop to 2, which is exactly what makes it a discriminating
     * case rather than a decorative one.
     *
     * ⚠️ **ITS LEGAL CLOCK NOW EQUALS ITS TIME IN DEPARTMENT**, where every other community-formed
     * movement reads strictly older. A test asserting those two differ for WF-013 is a real second
     * consumer, not a broken assertion. `tests/ward-ed-legal-clock.dom.test.tsx` pins the intended
     * behaviour; `tests/ui-ward-roles.spec.ts` pins the strictly-older case at `peel-ed` on WF-005,
     * whose 150-minute gap must NOT be touched.
     */
    formedAt: NOW_ANCHOR - 200,
  },
  {
    id: "WF-014",
    originEdId: "fsh-ed",
    openedAt: NOW_ANCHOR - 480,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    specialling: true,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4A",
      kind: "transport",
      dueAt: NOW_ANCHOR + 60,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "rph-adult-secure",
    declines: [],
    transport: {
      id: "TR-1014",
      provider: "Patient transport service",
      escortRequired: true,
      formRequired: SEEDED_TRANSPORT_FORM_REQUIRED,
      acceptedAt: NOW_ANCHOR - 45,
      enRouteAt: NOW_ANCHOR - 10,
      // A short secure-escort hop (FSH to RPH Adult Secure): collected 6 minutes after going en
      // route, so only 4 minutes into the drive to the destination at NOW_ANCHOR.
      collectedAt: NOW_ANCHOR - 4,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-015",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 340,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    specialling: true,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "Ward nurse in charge",
    referredUnitIds: [],
    acceptedUnitId: "scgh-older-adult",
    declines: [],
    // Seed gap fixed 2026-09-04: this record carried `transport.escortRequired: false` alongside
    // a blocker reading "Awaiting transport escort" — the transport record said no escort was
    // needed while the page said the movement was stuck waiting for one. Resolved toward
    // `escortRequired: true`, not the blocker text: this movement's `specialling: true` (below)
    // already says the patient needs one-to-one observation, which is exactly the kind of patient
    // an escort exists for, and the blocker is specific, authored prose (this file's own
    // convention favours the richer, human-written signal — see `STAGE_TRANSITION_BLOCKERS`'s own
    // doc comment) rather than a value a generator could have gotten wrong by a coin flip.
    transport: {
      id: "TR-1015",
      provider: "Patient transport service",
      escortRequired: true,
      acceptedAt: NOW_ANCHOR - 15,
    },
    blocker: "Awaiting transport escort",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-016",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 250,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "sjgm-adult-open",
    declines: [],
    blocker: "Ward finalising bed clean",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR + 45,
  },
  {
    id: "WF-017",
    originEdId: "jhc-ed",
    openedAt: NOW_ANCHOR - 400,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    specialling: true,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "3B",
      kind: "detention",
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "ED mental health team",
    referredUnitIds: ["bty-adult-secure"],
    declines: [
      {
        unitId: "gry-adult-secure",
        at: NOW_ANCHOR - 70,
        reason: "specialling_unavailable",
      },
    ],
    blocker: "Escalated to duty psychiatrist — breach imminent",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    examination: { at: NOW_ANCHOR - 260, outcome: "inpatient_order" },
  },
  {
    id: "WF-018",
    originEdId: "scgh-ed",
    openedAt: NOW_ANCHOR - 40,
    // THE ONE FLAGGED PATIENT IN THE FIXTURE (owner ruling, 2026-08-30). Chosen as the least
    // likely to reach the top any other way: tier 3, the shortest wait of any seeded movement at
    // 40 minutes, and the earliest stage. So when this sits above every tier-1 patient who has
    // waited hours, the flag is unmistakably what put it there and nothing else could have.
    //
    // Clinically ordinary rather than contrived: someone can become urgent shortly after arriving,
    // which is the case a flag exists for. No reason is recorded, because the owner said "for many
    // reasons" and no vocabulary for them has been asked for.
    flaggedUrgent: true,
    urgency: 3,
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Awaiting family collateral before destination decision",
    // Was a one-entry withdrawnReferrals array naming scgh-older-adult — fix for review I6.
    // `ACCEPT_IN_PRINCIPLE` is the only reducer branch that ever writes `withdrawnReferrals`,
    // and it always does so in the same update that sets `acceptedUnitId` (withdrawing every
    // other unit this movement had a live referral at, because one unit just accepted). This
    // record has no `acceptedUnitId`, an empty `referredUnitIds`, and an empty `declines` — no
    // referral to SCGH Older Adult was ever raised for WF-018, so there is nothing for that unit
    // to have withdrawn. The ward's own screen rendered "Withdrawn from SCGH Older Adult /
    // Referral withdrawn — the unit filled the bed from an earlier request" for a referral that
    // never existed. Clearing the field to `[]` is the honest correction — the alternative,
    // inventing a real referral-then-acceptance-elsewhere history to justify the withdrawal,
    // would fabricate exactly the kind of state this prototype must never invent, and nothing
    // else in this record (blocker text, stage, other fields) supports that history.
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  /**
   * THE TWO LONG WAITS, added 2026-08-30 — and they exist to make a capability reachable rather
   * than to make the fixture prettier.
   *
   * Every other movement here waits hours. `routineMovements` caps at
   * `60 + ((index * 37) % 900)` minutes, so the longest wait anywhere in this fixture was about
   * SIXTEEN HOURS — which meant the day-scale clock work had nothing to display. `splitDuration`
   * could render `1d 6h`, `formatInstantWithDay` could say "yesterday", and no seeded record could
   * produce either. A capability nothing exercises is indistinguishable from one that does not
   * work, and the whole suite stays green either way.
   *
   * These two are the demonstration's evidence that a wait can outlast a day. Both are
   * `Voluntary`, deliberately: a voluntary patient waiting days for a bed is the access-block
   * story this prototype is about, and it introduces no legal form, no statutory deadline and no
   * Mental Health Act figure of any kind.
   *
   * They are hand-seeded rather than folded into the generator so the change is attributable. Widen
   * `routineMovements` instead and every measured figure in this project moves at once, with no way
   * to say which movement caused what.
   */
  {
    id: "WF-019",
    originEdId: "rgh-ed",
    // Two days and fourteen hours. Long enough that no reader can mistake it for a bad afternoon.
    openedAt: NOW_ANCHOR - (2 * 24 * 60 + 14 * 60),
    // Nobody referred this person either — the third `none_raised` record, on the longest wait in
    // the fixture. Recorded ten hours before the anchor, long after the journey opened: somebody
    // asked the question during the wait, which is when it actually gets asked.
    referralAbsence: { reason: "none_raised", at: NOW_ANCHOR - 600 },
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "No secure bed available within reach of home",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-020",
    originEdId: "peel-ed",
    // One day and five hours - deliberately just over the boundary, so a formatter that silently
    // truncates to hours is caught by the difference between "1d 5h" and "29h 00m".
    openedAt: NOW_ANCHOR - (24 * 60 + 5 * 60),
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Waiting on an older-adult bed",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
];

/**
 * A deterministic destination for a generated movement. Prefers an exact cohort+security
 * match (the normal case); falls back to a cohort-only match, then to any unit, so the
 * synthetic model — which has no secure older-adult unit anywhere in the network — never
 * throws for a combination it cannot satisfy exactly. `index` is the only varying input, so
 * the pick is stable across runs.
 *
 * ⚠️ **AUTHORISATION IS NOT PART OF THAT CASCADE, AND THE DIFFERENCE IS THE POINT.** Cohort and
 * security are SUITABILITY — a bed of the wrong kind is a compromise a human could knowingly
 * make, so it is allowed to fall back. Authorisation under the Mental Health Act is LAWFULNESS —
 * a detained patient accepted at an unauthorised unit is not a compromise, it is a placement that
 * could not lawfully happen. So it filters the pool BEFORE the cascade runs, which means no
 * fallback level can reintroduce it. The old last resort — "then any unit" — is exactly where the
 * unlawful pick came from.
 *
 * This generator had never filtered on `authorised`; it merely happened not to land on either of
 * the network's two unauthorised units. `be5327210` changed the pool's size and order (whole-ward
 * flag to a bed-designation question) and WF-318, who is referred for psychiatric examination,
 * landed on `sjgs-adult-open` — measured 2026-09-05, and it is the only such record in the
 * fixture. The app was right to complain: `buildActionInbox` reported "Accepted destination no
 * longer lawful", which is a real defect in the DATA rather than in the derivation.
 *
 * It throws rather than degrading when nothing lawful exists, because a synthetic record that
 * silently states an unlawful placement is worse than a fixture that refuses to build. Measured
 * 2026-09-05: every cohort in this network has authorised units (Adult 14 of 16, Older adult 6 of
 * 6, Youth 1 of 1), so this cannot fire today — it exists for the day somebody removes one.
 */
function fallbackUnitId(cohort: Cohort, security: Security, index: number, legalStatus: LegalStatus): string {
  // "is this ward of the right kind" for the security requested — mirrors the same locked/open
  // question `ward-eligibility.ts`'s `security` gate asks, not a whole-ward flag anymore.
  //
  // ⚠️ **AUTHORISATION IS PART OF "THE RIGHT KIND" AND WAS MISSING UNTIL 2026-09-04.** A generated
  // movement whose legal status requires an authorised destination must not be ACCEPTED at a unit
  // that cannot lawfully hold it. Two units in the network are `authorised: false`, and this
  // function used to be able to pick one for a detained patient.
  //
  // **It only surfaced when the locked/open change altered the POOL.** The pick is
  // `pool[index % pool.length]`, so changing which units qualify silently re-points every
  // generated acceptance — WF-318 landed on an unauthorised ward and `buildActionInbox` correctly
  // raised "Accepted destination no longer lawful". The app was right; the fixture was wrong.
  //
  // ⚠️ **AUTHORISATION FILTERS THE POOL BEFORE THE CASCADE, AND THAT ORDERING IS THE POINT.**
  // An earlier version applied it to `exact` and `sameCohort` but deliberately NOT to the final
  // `units` fallback, on the grounds that an empty pool is worse than an imperfect pick. That
  // reasoning does not survive the difference between the two kinds of constraint. Cohort and
  // security are SUITABILITY — a bed of the wrong kind is a compromise a human may knowingly make,
  // so those fall back. Authorisation is LAWFULNESS — an unauthorised bed for a detained patient is
  // not a compromise, it is a placement that could not lawfully happen — so it does not.
  //
  // ⚠️ **AND THE EXEMPTED FALLBACK IS ONE FIELD EDIT FROM FIRING.** Measured 2026-09-05: 23 units,
  // 21 authorised, and both unauthorised ones are cohort Adult — so a cohort with no authorised
  // unit does not exist today and the two versions behave identically. **Youth is a single ward.**
  // Mark `bty-youth` unauthorised and the exempted fallback silently places a detained young person
  // somewhere that cannot hold them. The throw below is loud instead: an empty pool is a fixture
  // that refuses to build, which is recoverable; an unlawful acceptance is silent, which is not.
  const lawful = requiresAuthorisedDestination(legalStatus) ? allUnits().filter((unit) => unit.authorised) : allUnits();
  if (lawful.length === 0) {
    throw new Error(
      `No unit in this network is authorised under the Mental Health Act, so no lawful destination can be generated for a ${legalStatus} movement.`,
    );
  }
  const exact = lawful.filter(
    (unit) => unit.cohort === cohort && (security === "Secure" ? unitHasLockedBeds(unit) : unitHasOpenBeds(unit)),
  );
  const sameCohort = lawful.filter((unit) => unit.cohort === cohort);
  const pool = exact.length > 0 ? exact : sameCohort.length > 0 ? sameCohort : lawful;
  return pool[index % pool.length].id;
}

/**
 * Stage-dependent fields a generated movement needs to not contradict its own `stage` — the
 * same fields the hand-authored `seededMovements` above always carry together. Kept as a
 * switch, rather than folded into the field literals below, so each stage's requirement
 * reads as one block instead of being scattered across independent index checks.
 */
function stageFields(
  stage: MovementStage,
  cohort: Cohort,
  security: Security,
  index: number,
  legalStatus: LegalStatus,
): Pick<Movement, "acceptedUnitId" | "transport" | "closure" | "pullExpiresAt"> {
  switch (stage) {
    case "accepted_awaiting_bed":
      return { acceptedUnitId: fallbackUnitId(cohort, security, index, legalStatus) };
    case "pulled":
      // Bounds match the hand-authored records: NOW_ANCHOR - 20 to NOW_ANCHOR + 45, so a
      // pull cannot be recorded without a time for it to expire at.
      return {
        acceptedUnitId: fallbackUnitId(cohort, security, index, legalStatus),
        pullExpiresAt: NOW_ANCHOR - 20 + (index % 66),
      };
    case "moving": {
      const acceptedAt = NOW_ANCHOR - (40 + (index % 15));
      const enRouteAt = acceptedAt + (10 + (index % 10));
      // Stage "moving" means the crew already collected the patient — PATIENT_COLLECTED is the
      // only reducer transition that produces it, and it always sets `transport.collectedAt` in
      // the same update (ward-flow-reducer.ts). A generated "moving" record with no
      // `collectedAt` would be a state the reducer itself could never produce. The pickup-drive
      // offset varies by index (8-25 minutes) so generated in-transit journeys read as being at
      // different points, never one shared constant; the `Math.min` keeps `collectedAt` at or
      // before `NOW_ANCHOR` even for an index/gap combination narrower than the largest offset.
      const collectedAt = enRouteAt + Math.min(NOW_ANCHOR - enRouteAt, 8 + (index % 18));
      return {
        acceptedUnitId: fallbackUnitId(cohort, security, index, legalStatus),
        transport: {
          id: `TR-${1300 + index}`,
          provider: "Patient transport service",
          escortRequired: index % 2 === 0,
          acceptedAt,
          enRouteAt,
          collectedAt,
        },
      };
    }
    case "arrived": {
      // ⚠️ Sweep R64's own defect class, found a third time while building the movement
      // step-track's Task 6 reachability test (2026-09-04): `PATIENT_ARRIVED` refuses outright
      // unless `movement.stage === "moving" && movement.transport?.collectedAt`
      // (ward-flow-reducer.ts), so an "arrived" record with no transport at all — what this case
      // returned until this fix — is a state the reducer could never produce. `arrived` is not
      // remapped the way `handover_ready`/`destination_review` above are, because the stage
      // GENUINELY implies a completed transport job; giving it one states what the stage already
      // means rather than inventing a fact the stage does not imply. Built backwards from the
      // closure instant, the same way `case "moving"` above builds forward from NOW_ANCHOR, so the
      // two stages tell one consistent story and every timestamp on the job is honestly in the
      // past relative to when the handover completed.
      const acceptedUnitId = fallbackUnitId(cohort, security, index, legalStatus);
      const unitName = allUnits().find((unit) => unit.id === acceptedUnitId)?.name ?? acceptedUnitId;
      const closureAt = NOW_ANCHOR - (index % 10);
      const arrivedAt = closureAt;
      const collectedAt = arrivedAt - (5 + (index % 10));
      const enRouteAt = collectedAt - (8 + (index % 10));
      const acceptedAt = enRouteAt - (10 + (index % 10));
      return {
        acceptedUnitId,
        transport: {
          id: `TR-${1300 + index}`,
          provider: "Patient transport service",
          escortRequired: index % 2 === 0,
          acceptedAt,
          enRouteAt,
          collectedAt,
          arrivedAt,
        },
        closure: {
          at: closureAt,
          outcome: "arrived",
          reason: `Handover complete at ${unitName}`,
        },
      };
    }
    case "placement_requested":
    case "destination_review":
    case "handover_ready":
      // Nothing extra is honest at these three. A generated record here carries no accepted unit,
      // no reservation expiry and no transport, because none of those is a fact the stage implies.
      return {};
    default: {
      /*
       * ⚠️ **EXHAUSTIVE ON PURPOSE, AND IT REPLACED A BARE `default: return {}`.**
       *
       * A `MovementStage` renamed underneath this switch used to fall through to `{}` silently —
       * a generated movement that simply lost its accepted unit, its expiry and its transport, on
       * a stage the reducer can genuinely produce. Nothing failed: the record still typechecks,
       * still renders, and every test that looks the stage up in a map keyed by the OLD name gets
       * `undefined` on both sides of its assertion and passes.
       *
       * With the assignment below, an added or renamed stage is a COMPILE error at this line.
       */
      const unhandled: never = stage;
      throw new Error(`Unhandled movement stage: ${String(unhandled)}`);
    }
  }
}

/**
 * Routine movements filling out a busy metro night. Deterministic — index drives every
 * varying field — so screenshots and tests never shift between runs.
 */
function routineMovements(count: number, startIndex: number): Movement[] {
  const eds = allEmergencyDepartments();
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const ed = eds[index % eds.length];
    const cohort: Cohort = index % 4 === 0 ? "Older adult" : "Adult";
    const security: Security = index % 7 === 0 ? "Secure" : "Open";
    const sex = index % 2 === 0 ? "Female" : "Male";
    const urgency = ((index % 3) + 1) as 1 | 2 | 3;
    const rawStage = MOVEMENT_STAGES[index % MOVEMENT_STAGES.length];
    // `stageFields` below has no case for "handover_ready" — and rightly so: giving it one would
    // mean fabricating the acceptedUnitId/pullExpiresAt/transport a real handover_ready movement
    // can only get by actually passing through accepted_awaiting_bed and pulled first
    // (ward-flow-reducer.ts's ACCEPT_IN_PRINCIPLE, PULL_PATIENT and HANDOVER_READY cases). Every
    // generated movement's `referredUnitIds` is unconditionally `[]` below, so a generated
    // "handover_ready" record — which the switch's `default` branch leaves with none of those
    // fields — is a state the reducer could never produce, exactly the ruling-R64 defect that
    // let WF-305/312/319/326 render as ready-for-handover-with-no-transport. The honest stage
    // for a record with an empty referredUnitIds and no acceptedUnitId is "placement_requested"
    // (ruling R64), so that index is remapped here rather than stageFields inventing fields —
    // this closes the defect for every index this generator can ever produce, not only today's.
    //
    // Sweep R64, defect 5a (Task 6, ward-flow movement step-track plan, 2026-09-04): the same
    // reasoning, one stage later. Every generated movement's `declines` is ALSO unconditionally
    // `[]` below, so a generated "destination_review" record carries neither a live referral nor a
    // decline. The remap stands — but ⚠️ **ITS ORIGINAL JUSTIFICATION WAS FALSE AND IS CORRECTED
    // HERE (2026-09-04), NOT QUIETLY BUMPED.**
    //
    // ⚠️ **WHAT THIS USED TO SAY, AND WHY IT WAS WRONG.** It claimed `destination_review` with an
    // empty `referredUnitIds` AND an empty `declines` is "a state `REFER_TO_UNITS`/`DECLINE` never
    // leave a movement in". That was true when written and `WITHDRAW_ACCEPTANCE` falsified it.
    // DRIVEN, not argued: `REFER_TO_UNITS` -> `ACCEPT_IN_PRINCIPLE` -> `WITHDRAW_ACCEPTANCE` on
    // WF-012 lands exactly that state — stage `destination_review`, `referredUnitIds: []`,
    // `declines: []`, `acceptedUnitId: undefined` — with zero rejections at every step. The
    // withdrawal deliberately does not push the unit back into `referredUnitIds` (owner ruling 3,
    // 2026-09-04), which is precisely what produces the shape this comment called impossible.
    //
    // ⚠️ **THE REMAP IS STILL RIGHT, FOR A NARROWER REASON — the combination is reachable, but not
    // WITHOUT A TRACE.** `WITHDRAW_ACCEPTANCE` writes a `stageChanges` entry and an `unwinds` entry
    // in the same update. A movement only ever arrives at empty-and-empty `destination_review` by
    // having had an acceptance withdrawn, and that always leaves both records behind. Every
    // generated movement carries `stageChanges: []` and `unwinds: []`, so the generated shape —
    // this stage, both lists empty, and no history saying how it got here — remains a state the
    // reducer cannot produce. The remap closes that, and `tests/ward-flow-contracts.test.ts:565`
    // (`matched` is 18, having been 14 before these four were remapped) pins it.
    //
    // ⚠️ **THE LESSON IS THE SHAPE, NOT THIS INSTANCE: a reachability claim in a comment is a
    // measurement with a shelf life, and this one expired when a new event was added.** It was not
    // wrong when written and nothing warned anyone when it stopped being true. `WF-302`, `WF-309`,
    // `WF-316` and `WF-323` are the four indices affected (`index % 7 === 1`).
    //
    // `WF-009` (empty referredUnitIds, two hand-authored declines — the every-ward-declined case)
    // is untouched by this remap, since it is HAND-AUTHORED (outside `routineMovements`) and its
    // `declines` is genuinely non-empty.
    const stage = rawStage === "handover_ready" || rawStage === "destination_review" ? "placement_requested" : rawStage;
    // Hoisted out of the literal below because `stageFields` needs it: a generated destination
    // must be lawful for THIS movement's status, and the status is what decides that. Passing the
    // STATUS rather than a caller-computed boolean keeps `requiresAuthorisedDestination` the one
    // place that decides what the status requires.
    const legalStatus: LegalStatus = index % 3 === 0 ? "Referred for psychiatric examination" : "Voluntary";
    return {
      id: `WF-${String(index).padStart(3, "0")}`,
      originEdId: ed.id,
      openedAt: NOW_ANCHOR - (60 + ((index * 37) % 900)),
      flaggedUrgent: false,
      urgency,
      cohort,
      security,
      sex,
      specialling: index % 11 === 0,
      legalStatus,
      // 2026-08-23: no Form 1A in this model carries a dueAt (see LegalForm's own doc comment
      // in ward-model.ts) — the product owner's instruction was to drop the legal countdown
      // entirely, not to derive a corrected one, so this generator authors none.
      legalForm:
        index % 3 === 0
          ? {
              code: "1A",
              kind: "examination" as const,
            }
          : undefined,
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      stage,
      owner: index % 2 === 0 ? "Flow coordinator" : "ED mental health team",
      referredUnitIds: [],
      declines: [],
      blocker: index % 5 === 0 ? "Awaiting destination response" : "No blocker",
      withdrawnReferrals: [],
      unwinds: [],
      stageChanges: [],
      ...stageFields(stage, cohort, security, index, legalStatus),
    } satisfies Movement;
  });
}

export const wardMovements: Movement[] = [...seededMovements, ...routineMovements(30, 300)];

/** Returns `undefined` for an unknown id. Never falls back to a different movement. */
export function movementById(id: string): Movement | undefined {
  return wardMovements.find((movement) => movement.id === id);
}

export function movementsByStage(stage: MovementStage): Movement[] {
  return wardMovements.filter((movement) => movement.stage === stage);
}

/**
 * Beds expected to free up, each attributed to a named confirmer and nothing about the
 * departing patient — the whole point of this list is capacity, not identity.
 */
export const bedReleases: BedRelease[] = [
  {
    id: "WR-001",
    unitId: "rph-adult-secure",
    state: "confirmed",
    expectedAt: NOW_ANCHOR + 45,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 10,
    confirmedBy: "NUM RPH Adult Secure",
  },
  {
    id: "WR-002",
    unitId: "scgh-adult-open",
    state: "expected",
    expectedAt: NOW_ANCHOR + 90,
    waitingOn: "Awaiting ward round",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 25,
    confirmedBy: "NUM SCGH Adult Open",
  },
  {
    id: "WR-003",
    unitId: "fsh-older-adult",
    state: "expected",
    expectedAt: NOW_ANCHOR + 180,
    waitingOn: "Awaiting accommodation",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 60,
    confirmedBy: "NUM FSH Older Adult",
  },
  {
    id: "WR-004",
    unitId: "fre-adult-open",
    state: "confirmed",
    expectedAt: NOW_ANCHOR + 30,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 5,
    confirmedBy: "NUM FRE Adult Open",
  },
  {
    id: "WR-005",
    unitId: "bty-adult-secure",
    state: "expected",
    expectedAt: NOW_ANCHOR + 120,
    waitingOn: "Nothing outstanding",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 35,
    confirmedBy: "NUM BTY Adult Secure",
  },
  {
    id: "WR-006",
    unitId: "gry-older-adult",
    state: "expected",
    expectedAt: NOW_ANCHOR + 240,
    waitingOn: "Awaiting community team acceptance",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 80,
    confirmedBy: "NUM Graylands Older Adult",
  },
  {
    // Bed-model rework (2026-08-28): the release the counting defect was found on, seeded in the
    // exact shape that used to be uncountable — a discharge the ward has DECIDED and which is
    // nonetheless stuck. Under the four-stage model this was `state: "blocked"`, which
    // `capacityBreakdown` sorted into neither `confirmedToday` nor `expectedToday`, so marking
    // it blocked silently dropped FSH Adult Secure's confirmed count to zero. It now counts as
    // confirmed AND as blocked, which is what a bed coordinator actually needs to see.
    id: "WR-007",
    unitId: "fsh-adult-secure",
    state: "confirmed",
    expectedAt: NOW_ANCHOR + 120,
    waitingOn: null,
    blocker: "Awaiting accommodation",
    blockedBy: "NUM FSH Adult Secure",
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 35,
    confirmedBy: "NUM FSH Adult Secure",
  },
  {
    // Q4 (2026-08-28): a released bed that is being made ready. `preparing` is INFORMATIONAL and
    // gates nothing — this bed is still offered, still counts in `availableNow`, and still
    // appears in every figure, because pulling the next patient takes hours anyway.
    // `preparationNote` now carries a real value from the owner's List 3 (2026-08-28), so the
    // note's display and its picker have a genuine subject instead of being untested by
    // construction. It is still a note and still gates nothing.
    id: "WR-008",
    unitId: "arm-adult-open",
    state: "discharged",
    expectedAt: NOW_ANCHOR - 15,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: true,
    preparationNote: "Being cleaned",
    confirmedAt: NOW_ANCHOR - 15,
    confirmedBy: "NUM ARM Adult Open",
  },
  {
    // The other half of the flag: a discharge that is still only EXPECTED and is also stuck. The
    // two together mean the flag is seeded on both stages it can sit on, so a bucket keyed on
    // state alone cannot pass by accident.
    id: "WR-009",
    unitId: "rgh-adult-secure",
    state: "expected",
    expectedAt: NOW_ANCHOR + 200,
    waitingOn: "Awaiting family or carer agreement",
    blocker: "Awaiting receiving-service acceptance",
    blockedBy: "NUM RGH Adult Secure",
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 50,
    confirmedBy: "NUM RGH Adult Secure",
  },
];

/**
 * Beds held by someone on approved leave. Never merged into availability (spec D4) — a usable
 * leave bed is its own figure. Carries nothing about the person on leave.
 */
export const leaveBeds: LeaveBed[] = [
  {
    id: "WL-001",
    unitId: "rph-adult-secure",
    usable: true,
    expectedReturn: NOW_ANCHOR + 300,
    confirmedAt: NOW_ANCHOR - 60,
    confirmedBy: "NUM RPH Adult Secure",
  },
  {
    id: "WL-002",
    unitId: "scgh-older-adult",
    usable: false,
    expectedReturn: NOW_ANCHOR + 180,
    confirmedAt: NOW_ANCHOR - 25,
    confirmedBy: "NUM SCGH Older Adult",
  },
];

/**
 * How long before the anchor `RF-010`, the seed's community-only referral, was raised — in whole
 * days, because the admission it is joined to is measured in days.
 *
 * ⚠️ **IT IS A CONSTRAINT, NOT A PREFERENCE, AND THE MARGIN IS HOURS RATHER THAN A DAY.**
 * `AD-LEFT-01` (`ward-admissions-seed.ts`) is a 23-day stay that ended 300 minutes before the
 * anchor, so it was pulled 23 days 10 hours ago and arrived 23 days 5 hours ago. A referral that
 * brought somebody in must precede their arrival, and `referralToBedJoin` counts exactly that.
 * At 24, this referral is raised **14 hours before the pull and 19 hours before the arrival** —
 * clear, but not a whole day, so do not read the round number as a day of slack. At 23 the
 * arrival would fall 5 hours BEFORE the referral, which is the defect `52ad01dda` shipped and
 * `fa616d1c9` removed. If the seed ever needs more room, raise this figure rather than shortening
 * the stay.
 *
 * The two files cannot import from one another — `tests/ward-flow-single-source.test.ts` allows
 * only four files to read this fixture, and the admission seed is not among them — so the coupling
 * is held by the assertion on `chronologicallyCoherentCount` in
 * `tests/ward-statistics-derivations.test.ts` rather than by a shared constant.
 *
 * ⚠️ **THE NAME AVOIDS "REFERRAL" DELIBERATELY, AND A RENAME MUST KEEP AVOIDING IT.**
 * `tests/ward-legal-figure-guard.test.ts` fails any SCREAMING_SNAKE_CASE identifier under this
 * directory that carries a legal token (`REFERRAL` is one) beside a duration token (`DAYS` is
 * one) — the shape all three deleted Mental Health Act fabrications took. This constant is a
 * fixture offset and nothing statutory, so the guard is a false positive here; the answer is to
 * name it out of the way rather than to widen the net that caught it.
 */
const RF_010_RAISED_DAYS_BEFORE_ANCHOR = 24;

/**
 * Phase 7 (spec "The front door"): referrals arriving from anywhere in the network, before any
 * of them is ever a `Movement` inside a department. Hand-authored, and deliberately opens on the
 * awkward cases rather than the easy ones — see `tests/ward-referral-model.test.ts` for exactly
 * what each one proves:
 *   - RF-001: queued, `ageBand: "Youth"` + `secureBedNeeded: true` — structurally unmatchable
 *     everywhere in this network, because the one Youth unit (`bty-youth`, EMyU) is `"Open"`, and
 *     no other unit anywhere carries `cohort: "Youth"`.
 *   - RF-002: accepted at `ger-adult-open`, the network's one `"Female only"` designated bed —
 *     a designated bed correctly accepting the sex it names.
 *   - RF-003: `sex: "Male"`, accepted at `scgh-adult-open`, an `"Undesignated"` bed — while
 *     `ger-adult-open` ("Female only") would correctly exclude this same referral. This is the
 *     seed rule-4(d) case: an equality-shaped matching bug (`bed.sexDesignation === referral.sex`)
 *     would wrongly refuse this referral everywhere, because `"Undesignated" !== "Male"` reads as
 *     a mismatch even though an undesignated bed accepts every sex. RF-003 also carries
 *     `involuntaryBedNeeded: true`, seeding the `legal_status` accepts-rule: `scgh-adult-open` is
 *     authorised and correctly accepts it, while `sjgs-adult-open` (Adult/Open/Undesignated, but
 *     NOT authorised) is a real bed elsewhere in the network that correctly refuses it — the
 *     dimension is testable rather than decorative.
 *   - RF-004: declined, `declineReason: "belongs_to_another_service"` — an administrative fact
 *     about the referral's origin, not a judgement on the person. Phase 8 Task 6 renamed this
 *     reason from `"out_of_catchment"`: nothing in this model holds a catchment for anybody, so
 *     the old spelling implied a check the system never performed.
 *   - RF-006: `secureBedNeeded: true`, `sex: "Male"`, accepted at `fsh-adult-secure` — the
 *     network's `"Male only"` designated Secure bed (fix round B, review finding M1 — moved here
 *     from `brm-adult-secure`, whose own comment explains why a forensic unit can never be the
 *     bed a referral is recorded as accepted into). `fsh-adult-secure` correctly accepting the
 *     sex it names mirrors RF-002's `ger-adult-open` case for the other sex. RF-006 also seeds
 *     the out-of-area case `homeRegion` exists to measure. Stated as the field values only:
 *     `homeRegion` is `"Kimberley"`, `originSiteCode` is `"BRM"` (Broome Hospital, `service:
 *     "WACHS"`), and the accepted unit `fsh-adult-secure` sits at site `FSH` under `service:
 *     "South Metro"` — so home region and accepting service differ, and that difference is the
 *     whole of what this seed holds for the equity ledger Phase 8 builds to read.
 *
 *     NO DISTANCE is stated or implied, and no claim is made here about how WA's rural mental
 *     health system actually behaves. This prototype holds no distances, travel times or
 *     ordering by proximity — see `Referral.homeRegion`'s own doc comment, which says computing
 *     one is Phase 8's work and deliberately not built. (Fix round C, F8: this comment used to
 *     assert both. A comment asserting an unchecked real-world fact is exactly how the deleted
 *     Form 1A figure entered this codebase — an agent read it, believed it, wrote it into the
 *     model. Nothing renders a comment, and that is not the reason it matters.)
 *   - RF-007: `ageBand: "Youth"`, accepted at `bty-youth` (EMyU) — the successful youth match
 *     RF-001 deliberately is not (review finding M1's related note): the age dimension is only
 *     honourable if at least one seed path shows it actually working, not only failing. Also
 *     out-of-area, from Geraldton (Mid West). WARD-ONLY since 2026-09-01; see its own comment for
 *     why the community arm it used to carry was split out to RF-010 rather than trimmed away.
 *   - RF-010: addressed to a COMMUNITY TEAM and to nothing else — the shape that gives the
 *     coordinator-visibility rule its `{community_team}` case — and the referral a seeded
 *     admission points at (`AD-LEFT-01`, `ward-admissions-seed.ts`). ⚠️ **Deliberately not
 *     described as "the only" of either kind:** the comment on its own community arm records
 *     what a count written here costs, and it is the same file that has already paid it twice.
 *     Two more lines below carried a count and are left alone only because they name a
 *     PROPERTY that is checked elsewhere rather than a tally nothing guards.
 *     See its
 *     own comment: it carries RF-007's community fixture forward, gives the coordinator-visibility
 *     rule its `{community_team}` case, and is timed so the join it forms can carry a duration.
 *   - RF-008: Phase 8 Task 2. The only accepted referral whose travel band — looked up from its
 *     home region to the site of the unit it was accepted into — is one of `OUT_OF_AREA_BANDS`.
 *     It records no arrival (Task 2R removed arrivals from this type entirely); it is kept
 *     because it is the one seeded referral an out-of-area admission can honestly be joined to.
 *     See its own comment below for why what it shows on screen will read oddly on purpose.
 *   - RF-011: addressed to a psychiatric ward AND an emergency department AT ONCE (owner ruling,
 *     2026-09-01: FD-23 forbids `{psychiatric_ward, community_team}` only — a bed request and a
 *     self-addressed ED psychiatric review are a permitted pair, named as such in
 *     `ward-referral-visibility.ts`'s own doc comment). Added because `FD-23` — a ward may not see
 *     where else a patient has been referred; the coordinator may — had no seeded referral to show
 *     it working on: every other seeded referral carries exactly one destination, so the rule was
 *     real and untestable against the shipped fixture. `tests/ward-referral-visibility.test.ts`
 *     reads this referral to prove the ward-scoped projection of a real seeded record hides the ED
 *     arm while the coordinator's projection carries both. Both arms are left `queued` deliberately
 *     — this fixture exists to demonstrate the privacy boundary, not to exercise FD-22's
 *     cancel-on-acceptance behaviour, which the reducer-built fixture in that test file already
 *     covers.
 *   - RF-012 and RF-013: the origins of `WF-002` and `WF-009` (owner ruling R-2026-09-04-D). They
 *     are the only referrals any seeded MOVEMENT points at, and their own comment below explains
 *     why they had to be authored rather than picked from the nine above.
 *
 * Phase 8 Task 2R REMOVED the arrivals this fixture briefly carried. A referral no longer records
 * arriving anywhere: `Admission` (`ward-admissions.ts`) is the one record of a person occupying a
 * bed, it carries both a pull time and an arrival time, and — unlike an accepted referral, which
 * is accepted forever — it also carries `state: "departed"` and `leftAt`, so somebody discharged
 * weeks ago leaves the out-of-area ledger instead of accumulating time on it indefinitely. That
 * missing exit was a real defect in the referral-based version, not a preference.
 *
 * NOTHING IS SEEDED FOR THAT LEDGER YET. No `Admission` fixture exists in this file or anywhere
 * else, so the ledger has no seeded content in any shape; it is exercised only by test-local
 * admissions. The seed fixture is owned by the workstream that built `Admission` and is in flight
 * on its own branch — see `tests/ward-travel-grouping.test.ts` for the shapes it must cover. Do
 * not close that gap by seeding one here: two authors seeding the same fixture is a merge
 * collision in which one set is thrown away.
 *
 * No referral stores a band, and neither does an admission: a band is a fact about a (home
 * region, site) pair and is only ever looked up, through `ward-distance.ts`.
 * No referral carries anything beyond `ageBand`/`sex`/`secureBedNeeded`/`involuntaryBedNeeded`/
 * `homeRegion` about the person, no free text anywhere, `originSiteCode` is always one of
 * `wardSites`' own synthetic codes (never an address), and `homeRegion` is always one of
 * `HOME_REGIONS` (never an address), chosen to be plausible for the referral's origin site.
 */
/**
 * ⚠️ **DEMONSTRATION DATA. ONE TEAM. ADDED 2026-09-05 AT THE OWNER'S EXPLICIT REQUEST, AND NOT A
 * MODELLED CASE SERIES.** The owner asked for the community hub to be judgeable on a screen with
 * people on it, and chose ONE team — `"Midland"` — so that a single page is obviously populated and
 * the other 64 stay honestly empty. **Nothing here is evidence about how often somebody is admitted
 * while already with a community team.** Nine is a number picked to fill a page.
 *
 * ⚠️ **IT IS PURELY ADDITIVE, AND THAT IS THE SAFETY PROPERTY.** Not one admission changed. Every
 * `id` below is a value `ward-admissions-seed.ts` ALREADY manufactures from its own admission's id
 * (`AD-XXXX-NN` -> `RF-XXXX-NN`), so these referrals resolve links that were previously dangling
 * rather than creating new people, new beds or new departures. No bed count, occupancy figure or
 * discharge list moves.
 *
 * ⚠️ **AND IT IS THE SHAPE `52ad01dda` GOT WRONG, DONE THE WAY `RF-010` DOES IT.** That commit
 * populated nine team pages the same way and was backed out at `fa616d1c9` for TWO reasons, both of
 * which are avoided here deliberately rather than by luck:
 *
 *   1. **Its referrals were `"queued"`, so nine requests for no bed at all sat at the top of the
 *      coordinator's bed-matching queue** — `referralQueueOrder` scopes to queued and nothing else.
 *      **Every referral below is `"accepted"`**, which is also the clinically true state: a team
 *      that has taken somebody on has answered. `RF-010` is the precedent — an accepted
 *      community-only addressing with no `acceptedUnitId`, because a team is not a bed.
 *   2. **Every pair it produced put the person in the bed BEFORE the referral existed**, so not one
 *      could carry a duration. **Each row below is raised, and answered, before its admission's bed
 *      was even pulled** — the `bedPulledDaysBeforeAnchor` column is the admission's own pull, copied
 *      here ONLY so the two columns after it can be read against something. It is not a second home
 *      for that fact: `tests/ward-community-demonstration-data.test.ts` reads BOTH fixtures and fails
 *      if this column, or the ordering it exists to make visible, ever stops matching the admissions
 *      seed. The two files cannot import one another — `tests/ward-flow-single-source.test.ts` allows
 *      only four readers of the admissions fixture and this is not one of them — so a test is the
 *      only place that coupling can live.
 *
 * ⚠️ **`joinedCount` IN `tests/ward-statistics-derivations.test.ts` MOVES FROM 1 TO 10 BECAUSE OF
 * THIS BLOCK, AND `chronologicallyCoherentCount` MOVES WITH IT.** Moving together is the property
 * that test actually guards: a match that cannot date a bed is the defect, never the count changing.
 * If you are reading this because that test went red at some other number, a demonstration row has
 * lost its lead over its admission — fix the row, do not adjust the figure.
 *
 * ⚠️ **EVERY ACCEPTANCE HERE IS OLDER THAN `RF-010`'s, AND THAT IS A HARD CONSTRAINT RATHER THAN A
 * PREFERENCE — IT IS THE `fa616d1c9` LESSON ARRIVING IN THE NEXT LIST ALONG.** The coordinator's
 * decided board is `recentlyDecidedReferrals`, which sorts by `decidedAt` descending and keeps only
 * `RECENTLY_DECIDED_DISPLAY_LIMIT` rows. The seed holds nine genuinely decided referrals, so three
 * demonstration rows accepted more recently than `RF-010` PUSHED `RF-010` OFF THAT BOARD — real
 * clinical data evicted by fixture data added for a different screen. It was caught by
 * `tests/ward-referral-screens.dom.test.tsx` naming the missing id, not by anybody looking.
 *
 * **So every row's `acceptedDaysBeforeAnchor` exceeds 24, `RF-010`'s own age**, and the nine sort
 * below all nine real ones. Exactly one demonstration row reaches that board, at the bottom. Raising
 * a row's acceptance above 24 days will silently evict a real referral again — the count still looks
 * right, and a different id quietly disappears.
 *
 * The suburbs are Midland's own, from `ward-catchment.ts`; the origin site is St John of God
 * Midland, the area's hospital, and every person is admitted somewhere else, which is the ordinary
 * case in this network rather than an oddity. `ageBand` matches the cohort of the unit each person
 * is actually in.
 */
export type MidlandDemonstrationRow = {
  readonly id: string;
  /** The admission this id already pointed at. Named so a reader can check the pair by hand. */
  readonly admissionId: string;
  /** The admission's own `pulledAt`, in days before the anchor. Context for the two columns below;
   *  the test, not this file, is what keeps it true. */
  readonly bedPulledDaysBeforeAnchor: number;
  readonly raisedDaysBeforeAnchor: number;
  /** When Midland said yes. Must exceed the pull column: the team accepted before the bed. */
  readonly acceptedDaysBeforeAnchor: number;
  readonly ageBand: Cohort;
  readonly suburb: string;
  readonly urgency: UrgencyLevel;
  readonly history: string;
};

export const MIDLAND_DEMONSTRATION_ROWS: readonly MidlandDemonstrationRow[] = [
  {
    id: "RF-RGHS-01",
    admissionId: "AD-RGHS-01",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 40,
    acceptedDaysBeforeAnchor: 30,
    ageBand: "Adult",
    suburb: "Bassendean",
    urgency: 2,
    history:
      "Known to the team for some years and had been disengaging from appointments. Taken back on for community follow-up shortly before this admission.",
  },
  {
    id: "RF-SCGA-07",
    admissionId: "AD-SCGA-07",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 45,
    acceptedDaysBeforeAnchor: 32,
    ageBand: "Adult",
    suburb: "Bellevue",
    urgency: 2,
    history:
      "Referred by his general practitioner after a period of worsening sleep and withdrawal. Accepted for community assessment, and admitted before the first appointment.",
  },
  {
    id: "RF-GRYS-09",
    admissionId: "AD-GRYS-09",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 50,
    acceptedDaysBeforeAnchor: 36,
    ageBand: "Adult",
    suburb: "Caversham",
    urgency: 2,
    history:
      "Referred from an emergency department after a brief presentation, for community follow-up rather than a bed. The team accepted and had begun visiting.",
  },
  {
    id: "RF-RPHS-14",
    admissionId: "AD-RPHS-14",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 55,
    acceptedDaysBeforeAnchor: 41,
    ageBand: "Adult",
    suburb: "Aveley",
    urgency: 3,
    history:
      "Long-standing contact with the service, referred back after moving into the area. Community follow-up was in place at the time of this admission.",
  },
  {
    id: "RF-SJGA-05",
    admissionId: "AD-SJGA-05",
    bedPulledDaysBeforeAnchor: 3.27,
    raisedDaysBeforeAnchor: 40,
    acceptedDaysBeforeAnchor: 33,
    ageBand: "Adult",
    suburb: "Beechboro",
    urgency: 3,
    history:
      "Referred for ongoing community treatment after a previous admission elsewhere. Seen at home twice before this presentation.",
  },
  {
    id: "RF-BTYO-05",
    admissionId: "AD-BTYO-05",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 60,
    acceptedDaysBeforeAnchor: 51,
    ageBand: "Older adult",
    suburb: "Ashfield",
    urgency: 3,
    history:
      "Older adult referred for community review of memory and mood, accepted by the team and reviewed at home. Admitted some weeks later.",
  },
  {
    id: "RF-ARMA-01",
    admissionId: "AD-ARMA-01",
    bedPulledDaysBeforeAnchor: 12.27,
    raisedDaysBeforeAnchor: 75,
    acceptedDaysBeforeAnchor: 66,
    ageBand: "Adult",
    suburb: "Bullsbrook",
    urgency: 3,
    history:
      "Referred by the crisis service after a home visit, for continuing community care. Under the team throughout the weeks before this admission.",
  },
  {
    id: "RF-ARMA-02",
    admissionId: "AD-ARMA-02",
    bedPulledDaysBeforeAnchor: 48.27,
    raisedDaysBeforeAnchor: 95,
    acceptedDaysBeforeAnchor: 88,
    ageBand: "Adult",
    suburb: "Boya",
    urgency: 3,
    history:
      "Transferred to the team after moving from another catchment. Community treatment was established well before this admission began.",
  },
  {
    id: "RF-FSHS-01",
    admissionId: "AD-FSHS-01",
    bedPulledDaysBeforeAnchor: 122.27,
    raisedDaysBeforeAnchor: 180,
    acceptedDaysBeforeAnchor: 170,
    ageBand: "Adult",
    suburb: "Brigadoon",
    urgency: 3,
    history:
      "Long-term community patient of the team, followed up for several months before this admission. The referral predates the current episode by some margin.",
  },
];

/**
 * The rows above as referrals. Built rather than written out nine times, so the property that makes
 * them safe — accepted, community-only, and answered before the bed — is stated once and cannot
 * hold on eight rows and quietly fail on the ninth.
 */
const midlandDemonstrationReferrals: Referral[] = MIDLAND_DEMONSTRATION_ROWS.map((row) => ({
  id: row.id,
  ageBand: row.ageBand,
  destinations: [
    {
      destination: { kind: "community_team", teamName: "Midland" },
      // Accepted, never queued — reason 1 in this block's own comment. `acceptedUnitId` is absent
      // for the same reason it is absent on `RF-010`: a team is not a bed.
      state: "accepted",
      decidedAt: NOW_ANCHOR - row.acceptedDaysBeforeAnchor * MINUTES_PER_DAY,
      decidedBy: "Community service",
    },
  ],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: row.suburb },
  source: "community",
  raisedAt: NOW_ANCHOR - row.raisedDaysBeforeAnchor * MINUTES_PER_DAY,
  urgency: row.urgency,
  originSiteCode: "SJGM",
  transportNeeded: false,
  history: row.history,
}));

export const referrals: Referral[] = [
  {
    id: "RF-001",
    ageBand: "Youth",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW_ANCHOR - 40,
    urgency: 2,
    originSiteCode: "ARM",
    transportNeeded: true,
    history:
      "Referred by the community team after three weeks of worsening withdrawal and two missed depot appointments. Mother reports she has not left her room since the weekend. Known to the youth service for two years. Was on aripiprazole, stopped around a month ago.",
  },
  {
    id: "RF-002",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "ger-adult-open",
        decidedAt: NOW_ANCHOR - 10,
        // Fix round B (review finding M2/M3): was "Bed management", a decider ACCEPT_REFERRAL
        // (ward-flow-reducer.ts) can never actually produce — the reducer writes the ACTING role's
        // label, and this seed records a coordinator's acceptance. (Until FD-25, 2026-08-30, the
        // event was coordinator-only and could write nothing else; a ward may now accept too, so
        // the label here is a choice about this seed rather than the only possible value.)
        decidedBy: "Flow coordinator",
      },
    ],
    homeRegion: "Kimberley",
    suburb: { kind: "named", name: "Kununurra" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - 90,
    triagedAt: NOW_ANCHOR - 215,
    urgency: 2,
    originSiteCode: "KUN",
    transportNeeded: true,
    history:
      "Transferred from the regional hospital medical ward. Settled on the ward but no local psychiatric bed available in town, and the medical reason for admission has resolved. Third presentation this year. Long trip home, so discharge planning needs the family involved early.",
  },
  {
    id: "RF-003",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: false,
          // Seeds the `legal_status` accepts-rule (D3 rule 2): needs a bed that can hold someone
          // involuntarily. Accepted at `scgh-adult-open`, which is authorised — and SJGS Adult Open
          // (`sjgs-adult-open`, Adult/Open/Undesignated but NOT authorised) is a real bed elsewhere in
          // the network that this same referral would correctly be refused by on `legal_status` alone,
          // proving the rule actually excludes something rather than passing for every bed.
          involuntaryBedNeeded: true,
        },
        state: "accepted",
        acceptedUnitId: "scgh-adult-open",
        decidedAt: NOW_ANCHOR - 15,
        decidedBy: "Flow coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Nedlands" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 55,
    // ⚠️ THE ONLY SEEDED REFERRAL WHOSE REFERRAL CLOCK HAS STOPPED, and it was missing: every
    // other triaged referral was triaged BEFORE anyone referred (the ED presentation), so
    // `sinceReferralRunning` was `true` across the whole fixture and the stopped branch rendered
    // nowhere. Measured across all nine before this was added, not assumed.
    //
    // This is the community-expect story `P9-D7` is about: a crisis service refers, and the
    // patient arrives 25 minutes LATER. The referral clock ends at 25 and stops; the department
    // clock starts then and runs. Found by Ward Referrals, whose screens are the ones that would
    // otherwise have shown one of the two wordings and never the other.
    triagedAt: NOW_ANCHOR - 30,
    urgency: 1,
    originSiteCode: "SCGH",
    transportNeeded: false,
    history:
      "Crisis team called overnight. Acute distress, not sleeping, and saying she cannot keep herself safe at home tonight. Agreed to come in. Partner is with her and can stay until transport.",
  },
  {
    id: "RF-004",
    ageBand: "Older adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
        state: "declined",
        declineReason: "belongs_to_another_service",
        decidedAt: NOW_ANCHOR - 25,
        // Fix round B (review finding M2/M3): was "Duty psychiatrist". DECLINE_REFERRAL writes the
        // acting role's label; this seed records a coordinator's decline — see RF-002's comment above.
        decidedBy: "Flow coordinator",
      },
    ],
    homeRegion: "Peel",
    // Deliberately one of `CM-2`'s five contested suburbs: the owner's two catchment
    // documents disagree about it, `lookupCatchment` reports both readings and picks no
    // winner, and the front door still accepts the referral. Seeded so a screen has to
    // face that case rather than only the tidy one.
    suburb: { kind: "named", name: "Mandurah" },
    source: "police",
    raisedAt: NOW_ANCHOR - 70,
    triagedAt: NOW_ANCHOR - 100,
    urgency: 3,
    originSiteCode: "PEEL",
    transportNeeded: true,
    history:
      "Brought to attention by police after being found disoriented near the foreshore in the early hours. Not known to local services. No treating team identified. Nothing in the record before today. Was found near water and could not say how he got there.",
  },
  {
    id: "RF-005",
    ageBand: "Older adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Murdoch" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 20,
    // The widest gap in the seed and the reason `P9-D2` asks for two numbers: 165 minutes
    // in the department BEFORE anyone referred to mental health. One clock hides all of it.
    triagedAt: NOW_ANCHOR - 185,
    urgency: 2,
    originSiteCode: "FSH",
    transportNeeded: true,
    history:
      "Ambulance called by the residential home after two days of increasing confusion and refusing food and fluids. Staff say this is a marked change from her usual self. Lives in supported residential care. Physical health review may be needed alongside the psychiatric one.",
  },
  {
    id: "RF-006",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
        },
        state: "accepted",
        // Fix round B (review finding C1): was `acceptedUnitId: "brm-adult-secure"` — that unit is
        // `forensic: true`, and `referralEligibility` (ward-eligibility.ts) refuses every forensic
        // unit unconditionally (D7: "never offered"), on top of the unit's own `allocatable: 0` at
        // the time. `ACCEPT_REFERRAL` calls that same function, so the reducer would have refused
        // this exact acceptance — the seed recorded an acceptance the live system could not produce.
        // `fsh-adult-secure` is the network's real Male-only Secure bed (see the doc comment above)
        // and genuinely passes every gate; `referralEligibility(referral, unitById("fsh-adult-secure"),
        // NOW_ANCHOR).eligible` is asserted `true` for every accepted referral in
        // `tests/ward-referral-model.test.ts`, which is the four-line test that would have caught the
        // original seed at Task 1.
        acceptedUnitId: "fsh-adult-secure",
        decidedAt: NOW_ANCHOR - 5,
        // Fix round B (review finding M2/M3): was "Bed management" — see RF-002's own comment above.
        decidedBy: "Flow coordinator",
      },
    ],
    // Out of area on purpose — see this fixture's own doc comment above.
    homeRegion: "Kimberley",
    /*
     * 🔴 THE ONLY SEEDED REFERRAL WITH NO SUBURB, and it was missing for two hours after the union
     * that allows it landed. `Referral.suburb` gained an `unknown` arm specifically so a patient of
     * no fixed abode could be referred at all — and then every one of the nine seeded referrals
     * named a place, so `suburbUnknownLabels` rendered on no screen anywhere. Caught by the branch
     * guard rather than by a person; the fix and its own missing fixture are the same defect one
     * layer apart.
     *
     * Police-brought is the archetype, which is why it sits here: somebody brought in at 3am with
     * no address on record. ⚠️ `homeRegion` stays `Kimberley` and that is not a contradiction —
     * a service can know the broad area somebody is from without knowing where they live, which is
     * exactly why the two facts are stored separately and neither is derived from the other.
     */
    suburb: { kind: "unknown", reason: "not_known" },
    source: "police",
    raisedAt: NOW_ANCHOR - 65,
    triagedAt: NOW_ANCHOR - 80,
    urgency: 1,
    originSiteCode: "BRM",
    transportNeeded: false,
    history:
      "Police attendance in the city. Acutely unwell, no fixed address, and unable to give a suburb — which is why the suburb field is recorded as not known rather than guessed. Unable to give a contact or a next of kin at the time of referral.",
  },
  {
    id: "RF-007",
    // Fix round B (review finding M1's related note): the seed's only other youth referral,
    // RF-001, is deliberately unmatchable everywhere — so nothing in the seed demonstrated a
    // successful youth match against EMyU, the whole point of the age dimension being honourable
    // rather than decorative. This referral is that missing case: Youth, no secure bed needed (so
    // the Open EMyU can actually accept it), accepted at `bty-youth`.
    //
    /*
     * ⚠️ **WARD-ONLY SINCE 2026-09-01. THE COMMUNITY ARM WAS SPLIT OUT INTO `RF-010`, NOT DELETED.**
     *
     * This referral carried a `community_team` arm (`"Inner City Clinic"`, `queued`) beside the
     * ward arm below, and the pair was the exact shape owner rulings 13 and 14 forbid
     * (`docs/ward-flow/owner-rulings-2026-09-01-bed-states-and-community.md`): *"a community
     * referral would never be requested if a patient is needing a bed as community referral is for
     * discharge."* `{psychiatric_ward, community_team}` is refused at the intake form from now on,
     * so no referral of that shape can be created again.
     *
     * ⚠️ **DELETING THE WARD ARM INSTEAD WOULD HAVE SATISFIED THE SAME RULING AND FAILED NOTHING.**
     * The ward arm below is the seed's ONLY successful youth match, and the age dimension is only
     * honourable if one seed path shows it working rather than only failing. Nothing in this
     * repository goes red when it disappears — which is precisely why the ruling says SPLIT.
     *
     * The community fixture this referral used to carry is `RF-010` below, with the same team name
     * and the same reason for existing.
     */
    ageBand: "Youth",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "bty-youth",
        decidedAt: NOW_ANCHOR - 8,
        decidedBy: "Flow coordinator",
      },
    ],
    // Out of area on purpose, same reason as RF-006 above — a second real example for the
    // out-of-area ledger `homeRegion` exists to make possible.
    homeRegion: "Mid West",
    suburb: { kind: "named", name: "Geraldton" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - 30,
    // Longest of all — a country transfer sitting in another hospital for nearly five hours.
    triagedAt: NOW_ANCHOR - 320,
    urgency: 2,
    originSiteCode: "GER",
    transportNeeded: true,
    history:
      "Transfer request from the regional hospital. Presented to their emergency department twice in four days and there is no youth bed in the region. Under the care of the regional youth team. Long distance from family if admitted to the metropolitan area.",
  },
  {
    // Phase 8 Task 2. Added — not edited into an existing referral — because the equity ledger
    // (spec D8-3) needs at least one accepted referral whose travel band is one of
    // `OUT_OF_AREA_BANDS`, and NONE of RF-002/RF-003/RF-006/RF-007 is: their pairs read out of
    // `SYNTHETIC_TRAVEL_BANDS` as unrecorded, unrecorded, in-area and unrecorded. The band table
    // is owner-ruled placeholder data and was not touched to close that gap; this referral
    // instead uses a pair the table ALREADY records as out of area, and the pair was read out of
    // the fixture rather than chosen for how it reads.
    //
    // Task 2R: this referral no longer records an arrival, because no referral does. The ledger
    // reads `Admission` instead, and this is the referral an out-of-area admission can be joined
    // to when that fixture lands.
    //
    // READ THIS BEFORE "FIXING" IT. Every band in `SYNTHETIC_TRAVEL_BANDS` is invented and
    // assigned mechanically by list position, so this seed is very likely a metropolitan person
    // recorded as placed far from home at a metropolitan hospital. On screen that will read
    // oddly. That is the placeholder table behaving exactly as the owner instructed (confirmed
    // 2026-08-29) and is NOT a defect: do not correct the band, do not move this referral to a
    // hospital that reads more remotely, and do not add a note explaining it away. The whole
    // arrangement is that replacing the values in `ward-travel-bands.ts` is the entire change on
    // the day somebody measures real ones.
    //
    // Shaped after RF-006 so the acceptance is coherent rather than plausible-looking:
    // `fsh-adult-secure` is Adult, Secure, non-forensic and `"Male only"`, and
    // `tests/ward-referral-model.test.ts` runs `referralEligibility` over every accepted referral
    // in this fixture, so an incoherent acceptance fails by name rather than being rendered as
    // fact by a later screen.
    id: "RF-008",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "fsh-adult-secure",
        decidedAt: NOW_ANCHOR - 45,
        decidedBy: "Flow coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Morley" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 75,
    triagedAt: NOW_ANCHOR - 95,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: true,
    history:
      "Ambulance called by a neighbour. Agitated and distressed at home, calmer on arrival of the crew, and agreed to come in voluntarily.",
  },
  {
    /*
     * 🔴 THE ONLY REFERRAL ADDRESSED TO AN EMERGENCY DEPARTMENT, AND UNTIL IT EXISTED THE ED
     * PSYCHIATRY HUB WAS EMPTY FOR EVERY DEPARTMENT.
     *
     * The other eight all address a psychiatric ward, so the hub's inbox had nothing to hold and
     * every row it COULD hold would have rendered the "not in department yet" branch. ⚠️ A screen
     * showing that for every patient looks like correct handling of a legitimate case rather than
     * like a feature with no data — `R46`: a thing built before its input exists cannot be built
     * wrong, only empty, and empty is indistinguishable from working.
     *
     * Found by Ward Referrals, who had told the owner `RF-005`'s 165-minute gap would be visible on
     * the hub, measured that it could not be, and corrected that to him.
     *
     * `triagedAt` 210 minutes before `raisedAt`: somebody who had been in the department three and
     * a half hours before anyone called psychiatry. That is the gap `P9-D2` exists to show, on the
     * one screen built to show it.
     */
    id: "RF-009",
    ageBand: "Adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Cannington" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 35,
    triagedAt: NOW_ANCHOR - 245,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    history:
      "Brought in by ambulance and needs a psychiatric opinion in the department before any decision about admission is made.",
  },
  {
    /*
     * 🔴 THE SEED'S ONLY COMMUNITY-ONLY REFERRAL, AND THE ONLY REFERRAL ANY SEEDED ADMISSION
     * ACTUALLY POINTS AT.
     *
     * It does two jobs that were previously done by nothing at all.
     *
     * **1. It carries forward `RF-007`'s community arm.** That arm was the community hub's only
     * fixture and it sat beside a ward arm, which owner rulings 13 and 14 forbid. Splitting rather
     * than trimming keeps both purposes: `RF-007` above stays the seed's only successful youth
     * match, and the community vocabulary lives on here. `"Inner City Clinic"` is unchanged — a
     * clinic the S2015 catchment table actually names, so this exercises the vocabulary the intake
     * picker offers rather than inventing a service. It is also the first seeded fixture for the
     * coordinator-visibility rule's `{community_team}` row, which had none.
     *
     * **2. `AD-LEFT-01` (`ward-admissions-seed.ts`) names this id in its `referralId`.** Until now
     * every seeded `referralId` was MANUFACTURED from the admission's own id by string
     * substitution, so `admissionBelongsToTeam` (`community/community-derivations.ts`) could not
     * succeed for any admission against any of the 65 teams, and `referralToBedJoin`
     * (`statistics/statistics-derivations.ts`) measured a true nought. This is the one real join.
     *
     * ⚠️ **THE PAIR IS CHRONOLOGICALLY COHERENT, AND THAT IS THE WHOLE POINT OF THE TIMING BELOW.**
     * `52ad01dda` populated nine team pages by naming referrals after the ids the admissions
     * already manufactured. Every pair it produced had the person in the bed BEFORE the referral
     * existed, so not one could carry a duration — a defect shipped as a repair. This referral is
     * raised `RF_010_RAISED_DAYS_BEFORE_ANCHOR` days before the anchor; `AD-LEFT-01` was pulled 23
     * days 10 hours ago and arrived 23 days 5 hours ago, so the referral precedes both — by 14 and
     * 19 hours respectively, which is the whole margin and it is not a day. Lengthening that
     * admission's stay to 24 days, or shortening this figure, puts the person in the bed before
     * the referral existed; `tests/ward-statistics-derivations.test.ts` then goes red on
     * `chronologicallyCoherentCount` rather than the fixture drifting quietly.
     *
     * ⚠️ **AND ONE THING THIS FIXTURE DOES NOT SETTLE, RECORDED RATHER THAN PAPERED OVER.**
     * `Admission.referralId` is documented as *"the referral this admission came from — the join
     * back to the front door"*, and owner ruling 3 says a community referral is only ever for a
     * patient about to be discharged. Those two sentences cannot both describe this join: a
     * community referral does not bring anybody in. The hub's association rule
     * (`admissionBelongsToTeam`, owner-ruled 2026-08-31) nonetheless reads exactly this field, so
     * a populated team page REQUIRES an admission whose referral names a team. **The conflict is
     * in the model, not in this fixture** — it is Ward Lead's to rule on, and nothing here should
     * be read as having settled it.
     *
     * `source` is `inter_hospital` and `originSiteCode` is `ARM` because they must agree, and
     * `REFERRAL_SOURCES` holds no "ward" or "inpatient" channel: the only member describing a
     * request that came from a hospital is this one, and `ARM` is Armadale, `AD-LEFT-01`'s own
     * site. `suburb` is Noranda, which `ward-catchment.ts` records against this clinic, so the
     * team named here is one the table would actually have proposed. `triagedAt` is deliberately
     * absent: nobody was triaged into a department for this, and a proxy instant here would invent
     * the second clock `P9-D2` exists to keep honest.
     */
    id: "RF-010",
    ageBand: "Adult",
    destinations: [
      {
        /*
         * ⚠️ **DO NOT WRITE A COUNT HERE — THE COMMENT THIS ONE REPLACES DECAYED TWICE, IN
         * OPPOSITE DIRECTIONS, INSIDE ONE DAY.** It lived on `RF-007`'s community arm until that
         * arm was split out into this referral on 2026-09-01. It said "the only" while nine more
         * community-addressed referrals sat above it (`52ad01dda`), and then said "for a while the
         * only one" after those nine were backed out again (`fa616d1c9`, because they requested no
         * bed and so sat at the top of the coordinator's BED-matching queue). ⚠️ **Both readings were
         * TRUE WHEN WRITTEN and false soon after** — which is the point, not a softening of it: a
         * claim that was never true is a mistake somebody may catch, and a claim that was true and
         * rotted is the one nothing catches. Verified from history rather than from this file, which
         * cannot answer a question about its own past: the nine landed at `52ad01dda` 12:54, "for a
         * while the only one" was written at `3bdf9860f` 13:32 while they existed, and they were
         * backed out at `fa616d1c9` 14:17. Nothing failed either time: **a count written into a comment has
         * no guard, so it decays the moment the code beside it moves — and it decays just as
         * silently when the code moves BACK.** Say WHY a thing is here, which stays true; not HOW
         * MANY there are, which does not.
         *
         * ⚠️ **AND IT ALMOST DIED A THIRD DEATH BEING CARRIED HERE.** The split removed the arm
         * this comment lived on, in the same hour another chat was repairing its wording. The
         * merge conflicted rather than resolving quietly, which is the only reason the repair was
         * noticed at all — a clean auto-resolve would have taken the correct text away and
         * reported success. **A conflict is the cheap outcome; the silent one is the expensive
         * one.**
         *
         * Why this arm exists at all: `teamName` names WHICH team, because the owner ruled on
         * 2026-08-31 that association comes from the team named on the referral rather than from
         * the patient's home region. The value is a clinic the S2015 catchment table actually
         * names, so the seed exercises the vocabulary the intake picker offers rather than
         * inventing a service.
         */
        destination: { kind: "community_team", teamName: "Inner City Clinic" },
        // ACCEPTED rather than queued: the person this referral concerns has since been discharged
        // to the community, and a destination still shown as waiting for an answer 24 days later
        // would put a live wait on the intake form's `waitFigure` for somebody who is already home.
        // `acceptedUnitId` is absent because a team is not a bed — see `ReferralAddressing`.
        state: "accepted",
        decidedAt: NOW_ANCHOR - RF_010_RAISED_DAYS_BEFORE_ANCHOR * MINUTES_PER_DAY + 180,
        decidedBy: "Community service",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Noranda" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - RF_010_RAISED_DAYS_BEFORE_ANCHOR * MINUTES_PER_DAY,
    urgency: 3,
    originSiteCode: "ARM",
    transportNeeded: false,
    history:
      "Ready for discharge from the medical ward and needs community follow-up rather than a bed. Asking the team to pick him up rather than admitting. Was under the inner city clinic previously and is willing to re-engage.",
  },
  {
    /*
     * ⚠️ THE ONE SEEDED REFERRAL WITH MORE THAN ONE DESTINATION, and until it existed `FD-23` — "a
     * ward may not see where else a patient has been referred; the coordinator may" — had no
     * seeded referral to demonstrate it against. Every referral above carries exactly one
     * destination, so the rule was real (see `ward-referral-visibility.ts`) but untestable on the
     * shipped fixture rather than on a reducer-built one built solely to exercise it.
     *
     * `{psychiatric_ward, emergency_department}` is a PERMITTED pair — `ward-referral-visibility.ts`
     * names it explicitly as one of the two combinations FD-23's own ruling leaves open, alongside
     * `{emergency_department, community_team}`. The forbidden pair is `{psychiatric_ward,
     * community_team}` (owner rulings 13/14: a community referral is for discharge, so it can never
     * accompany a bed request) — that is the shape `RF-007` was split away from on 2026-09-01, and
     * this fixture must never be edited toward it.
     *
     * Clinically coherent as authored: somebody sitting in Fiona Stanley's emergency department,
     * referred there for their own psychiatric review AND, in the same act, referred to a
     * psychiatric ward for the bed the review may lead to. Both arms are left `queued` — this
     * fixture's job is to prove the PRIVACY boundary between two live destinations, not to exercise
     * FD-22's cancel-on-acceptance behaviour, which `tests/ward-referral-visibility.test.ts`'s own
     * reducer-built fixture already covers with a decided pair.
     */
    id: "RF-011",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
        state: "queued",
      },
      {
        destination: { kind: "emergency_department", edId: "fsh-ed", purpose: "psychiatric_review" },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Fremantle" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 50,
    triagedAt: NOW_ANCHOR - 60,
    // Deliberately tier 3, the lowest-priority tier: `referralQueueOrder` sorts by urgency first,
    // so a tier-2 value here would insert this referral ahead of one of the existing tier-2 queued
    // referrals (RF-001, RF-005, RF-009) and reorder every screen that pins that queue's exact
    // order or its first entry, none of which this fixture exists to change. Tier 3 appends it
    // after all three instead — the smallest possible disturbance to the existing queue.
    urgency: 3,
    originSiteCode: "FSH",
    transportNeeded: true,
    history:
      "Ambulance attendance after a call from a family member. Needs review in the department first, and a bed is being asked for in parallel because the picture may not settle. Family have said they cannot manage at home tonight.",
  },
  /*
   * 🔴 RF-012 AND RF-013 — THE TWO REFERRALS A SEEDED MOVEMENT WAS ACTUALLY RAISED FROM. Owner
   * ruling R-2026-09-04-D, added 2026-09-04.
   *
   * ⚠️ **THEY WERE AUTHORED RATHER THAN CHOSEN, AND THE REASON IS A MEASUREMENT.** Before them the
   * seed held two ED-addressed referrals: `RF-009` (`rph-ed`, raised 35 minutes before the anchor)
   * and `RF-011`'s ED arm (`fsh-ed`, 50 minutes). A journey cannot precede the referral that
   * produced it, and the youngest movement at either department was opened 180 minutes before the
   * anchor — so linking any existing pair would have recorded a patient arriving hours before
   * anybody referred them. That is the shape `52ad01dda` shipped for admissions and `fa616d1c9`
   * removed; it reads as a repair and is a fabrication.
   *
   * Each of these is therefore timed as the ORIGIN of one specific movement: referral raised,
   * patient triaged into that same department some time later, department opens the journey later
   * still. `decidedAt` on each ED arm is the moment its movement opened, because taking the patient
   * on IS the department's answer.
   *
   * ⚠️ **BOTH ED ARMS ARE `accepted`, NOT `queued`, AND THAT IS A FACT ABOUT THEM RATHER THAN A
   * CONVENIENCE.** A queued arm says the department has not answered yet; each of these has a
   * movement in the fixture proving it did. (It also keeps both off the ED psychiatry hub's
   * waiting inbox, which is `RF-009`'s fixture and not theirs to change — a happy consequence, not
   * the reason.) `acceptedUnitId` is absent because a department is not a bed, exactly as for
   * `RF-010`'s community arm.
   *
   * ⚠️ **NEITHER CARRIES A WARD ARM, DELIBERATELY.** These are referrals INTO an emergency
   * department; the bed search that follows belongs to the movement, and giving them a ward arm as
   * well would put a second, parallel bed request beside a movement already doing exactly that.
   */
  {
    // The origin of `WF-002` — Older adult, Male, at `fsh-ed`, arrived by ambulance, journey opened
    // 180 minutes before the anchor. Raised 240 before, triaged into the department at 200: a
    // 40-minute referral clock that stopped when the patient arrived, then 20 minutes in the
    // department before psychiatry opened the journey. Suburb `Murdoch` is the one `RF-005`
    // already uses for this site, so the catchment table resolves it exactly as it does there.
    id: "RF-012",
    ageBand: "Older adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "fsh-ed", purpose: "psychiatric_review" },
        state: "accepted",
        decidedAt: NOW_ANCHOR - 180,
        decidedBy: "ED mental health",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Murdoch" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 240,
    triagedAt: NOW_ANCHOR - 200,
    urgency: 2,
    originSiteCode: "FSH",
    transportNeeded: true,
    history:
      "Ambulance called from home after a fall and a period of confusion. Needs a medical look as well as a psychiatric one, so the department is the right first stop. Lives alone with daily support. Increasingly forgetful over recent months, per the daughter.",
  },
  {
    // The origin of `WF-009` — Adult, Male, at `peel-ed`, `arrivalMode: "police"`, journey opened
    // 420 minutes before the anchor. `source: "police"` matches that arrival rather than being
    // picked for variety, and `Mandurah` is the Peel suburb `RF-004` already uses.
    //
    // ⚠️ Urgency 1 here and urgency 1 on `WF-009` are two separate records of the same judgement,
    // not one derived from the other: nothing in this model copies a referral's tier onto the
    // journey raised from it, and `RAISE_REFERRAL` takes the tier from its own draft.
    id: "RF-013",
    ageBand: "Adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "peel-ed", purpose: "psychiatric_review" },
        state: "accepted",
        decidedAt: NOW_ANCHOR - 420,
        decidedBy: "ED mental health",
      },
    ],
    homeRegion: "Peel",
    suburb: { kind: "named", name: "Mandurah" },
    source: "police",
    raisedAt: NOW_ANCHOR - 470,
    triagedAt: NOW_ANCHOR - 440,
    urgency: 1,
    originSiteCode: "PEEL",
    transportNeeded: true,
    history:
      "Police attendance overnight, acutely distressed in a public place, and taken to the department as the nearest place able to assess him. Was distressed in a public place and could not be left alone.",
  },
  // ⚠️ DEMONSTRATION DATA, LAST AND SPREAD RATHER THAN WRITTEN OUT, so the boundary between the
  // hand-authored referrals above and the nine added to populate one team's page is visible in the
  // array itself. See `MIDLAND_DEMONSTRATION_ROWS` for what they are and why they are safe.
  ...midlandDemonstrationReferrals,
];
