import type { Instant } from "@/components/ward-management/ward-clock";
import type { LegalStatusChangeReason, UrgencyChangeReason } from "@/components/ward-management/ward-change-reasons";
import type { Cohort, DeclineReason, LegalStatus, Security, Sex } from "@/components/ward-management/ward-model";
import type { WardScenario } from "@/components/ward-management/ward-scenarios";

/**
 * Who may raise an event. `demo` is the jump-forward / reset control on the coordinator screen —
 * it belongs to nobody's clinical role, which is exactly why it needs its own gate rather than
 * being nodded through as "coordinator".
 */
export type WardFlowRole = "coordinator" | "ed" | "ward" | "officer" | "demo";

/** The short form an ED fills in to raise a brand-new referral. */
export type ReferralDraft = {
  cohort: Cohort;
  security: Security;
  sex: Sex;
  specialling: boolean;
  legalStatus: LegalStatus;
  urgency: 1 | 2 | 3;
  /**
   * The legal form the clinician selected, as a code from `SELECTABLE_LEGAL_FORMS`, or `null`
   * for no form at all. Explicitly nullable rather than optional or an empty string so that
   * "this patient is on no form" is a first-class choice the clinician made, indistinguishable
   * from neither a field the caller forgot to fill in nor a blank that could be read as a
   * default. Nothing derives this from `legalStatus` any more (product owner, 2026-08-24).
   */
  legalFormCode: string | null;
};

/**
 * One variant per row of spec §6. Every event carries `role` (checked against `EVENT_ROLE`
 * before anything else happens) and `now` (the reducer never reads a clock itself).
 */
export type WardFlowEvent =
  | { type: "RAISE_REFERRAL"; role: WardFlowRole; now: Instant; edId: string; draft: ReferralDraft }
  | {
      type: "RECORD_EXAMINATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      outcome: "inpatient_order" | "community_order" | "revoked";
    }
  | { type: "REFER_TO_UNITS"; role: WardFlowRole; now: Instant; movementId: string; unitIds: string[] }
  | { type: "ACCEPT_IN_PRINCIPLE"; role: WardFlowRole; now: Instant; movementId: string; unitId: string }
  | { type: "HOLD_BED"; role: WardFlowRole; now: Instant; movementId: string; unitId: string }
  | {
      type: "DECLINE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      reason: DeclineReason;
      note?: string;
    }
  | { type: "HANDOVER_READY"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "TRANSPORT_ACCEPTED"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "TRANSPORT_EN_ROUTE"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "PATIENT_COLLECTED"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "PATIENT_ARRIVED"; role: WardFlowRole; now: Instant; movementId: string }
  | {
      type: "CONFIRM_CAPACITY";
      role: WardFlowRole;
      now: Instant;
      /** The unit whose allocatable count is being restated. */
      unitId: string;
      /**
       * The unit the caller stated it was acting as. The ward screen is routed as
       * `/ward-management/ward/[unitId]`, so a caller always has one to state; the reducer
       * refuses the event when this and `unitId` differ.
       *
       * This is a claim the caller makes about itself, recorded and compared. It is **not** an
       * authenticated identity and this model has none: nothing here verifies that the caller
       * really is that unit, and anything able to dispatch an event can state whichever acting
       * unit it likes. Required rather than optional so a caller cannot omit it and skip the
       * comparison silently.
       */
      actingUnitId: string;
      value: number;
    }
  | {
      type: "RECORD_ESCALATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      triedUnitIds: string[];
      contact: string;
    }
  | { type: "ADVANCE_CLOCK"; role: WardFlowRole; now: Instant; minutes: number }
  | { type: "RESET_SCENARIO"; role: WardFlowRole; now: Instant }
  | { type: "SET_SCENARIO"; role: WardFlowRole; now: Instant; scenario: WardScenario }
  | {
      type: "CHANGE_URGENCY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      urgency: 1 | 2 | 3;
      reason: UrgencyChangeReason;
    }
  | {
      type: "CHANGE_LEGAL_STATUS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      legalStatus: LegalStatus;
      reason: LegalStatusChangeReason;
    };

/**
 * One table, read by the reducer's role check, rather than a `switch` repeated at every call
 * site. Adding an event here without an entry is a compile error, which is the point.
 *
 * Widened from one role per event to a non-empty list of permitted roles (this task, spec D2).
 * `CHANGE_URGENCY` and `CHANGE_LEGAL_STATUS` are the first events with more than one — both a
 * coordinator and the referring ED clinician may record either change — and Task 3's events need
 * the same shape, so the table is widened here rather than special-cased per event.
 */
export const EVENT_ROLE: Record<WardFlowEvent["type"], readonly WardFlowRole[]> = {
  RAISE_REFERRAL: ["ed"],
  RECORD_EXAMINATION: ["ed"],
  REFER_TO_UNITS: ["coordinator"],
  ACCEPT_IN_PRINCIPLE: ["ward"],
  HOLD_BED: ["ward"],
  DECLINE: ["ward"],
  HANDOVER_READY: ["ed"],
  TRANSPORT_ACCEPTED: ["officer"],
  TRANSPORT_EN_ROUTE: ["officer"],
  PATIENT_COLLECTED: ["officer"],
  PATIENT_ARRIVED: ["officer"],
  CONFIRM_CAPACITY: ["ward"],
  RECORD_ESCALATION: ["coordinator"],
  ADVANCE_CLOCK: ["demo"],
  RESET_SCENARIO: ["demo"],
  SET_SCENARIO: ["demo"],
  CHANGE_URGENCY: ["coordinator", "ed"],
  CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
};
