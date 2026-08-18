import type { Instant } from "@/components/ward-management/ward-clock";

export type HealthService = "North Metro" | "South Metro" | "East Metro" | "WACHS" | "Private";
export type Cohort = "Adult" | "Older adult";
export type Security = "Open" | "Secure";
export type Sex = "Female" | "Male";

export const MOVEMENT_STAGES = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
  "bed_held",
  "handover_ready",
  "moving",
  "arrived",
] as const;
export type MovementStage = (typeof MOVEMENT_STAGES)[number];

export const DECLINE_REASONS = [
  "no_bed",
  "sex_mix",
  "specialling_unavailable",
  "acuity_mix",
  "capability_mismatch",
  "bed_held_for_earlier_referral",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Referring to more than three units at once spams wards and erodes trust between services. */
export const PARALLEL_REFERRAL_CAP = 3;

export type LegalStatus =
  "Voluntary" | "Referred for psychiatric examination" | "Detained awaiting examination" | "Involuntary inpatient";

export type LegalForm = {
  code: string;
  label: string;
  kind: "examination" | "detention" | "transport" | "transfer";
  dueAt: Instant;
};

/**
 * A capacity number is meaningless without where it came from and when.
 * `feed` knows which beds are physically empty; `ward` knows which are actually allocatable
 * once staffing, sex mix, acuity mix, single rooms and holds are accounted for.
 */
export type CapacitySource = "feed" | "ward";

export type CapacityFigure = {
  value: number;
  source: CapacitySource;
  confirmedAt: Instant;
  staleAfterMinutes: number;
};

export type EmergencyDepartment = {
  id: string;
  siteCode: string;
  name: string;
};

export type Unit = {
  id: string;
  siteCode: string;
  name: string;
  cohort: Cohort;
  security: Security;
  /** Authorised under the Mental Health Act 2014 to receive involuntary admissions. */
  authorised: boolean;
  beds: number;
  /** Physically empty beds, per the feed. */
  empty: CapacityFigure;
  /** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */
  allocatable: CapacityFigure;
  held: number;
  blocked: number;
  /** Current occupants by sex, which is what constrains who the next admission can be. */
  sexMix: Record<Sex, number>;
  /** How many 1:1 observation patients this unit can staff beyond its current load. */
  speciallingCapacity: number;
};

export type Site = {
  code: string;
  name: string;
  service: HealthService;
  emergencyDepartment?: EmergencyDepartment;
  units: Unit[];
};

export type Decline = {
  unitId: string;
  at: Instant;
  reason: DeclineReason;
  note?: string;
};

export type StatusChange = {
  at: Instant;
  from: LegalStatus;
  to: LegalStatus;
  by: string;
};

export type TransportJob = {
  id: string;
  provider: string;
  escortRequired: boolean;
  formRequired?: string;
  acceptedAt?: Instant;
  enRouteAt?: Instant;
  collectedAt?: Instant;
  arrivedAt?: Instant;
  cancelledAt?: Instant;
};

export type MovementClosure = {
  at: Instant;
  outcome: "arrived" | "did_not_proceed";
  reason: string;
};

export type Movement = {
  id: string;
  /** Where the patient physically is. Detention here is lawful even when unauthorised. */
  originEdId: string;
  openedAt: Instant;
  urgency: 1 | 2 | 3;
  cohort: Cohort;
  security: Security;
  sex: Sex;
  specialling: boolean;
  legalStatus: LegalStatus;
  legalForm?: LegalForm;
  statusChanges: StatusChange[];
  stage: MovementStage;
  owner: string;
  /** Units currently holding a live referral. Never longer than PARALLEL_REFERRAL_CAP. */
  referredUnitIds: string[];
  acceptedUnitId?: string;
  declines: Decline[];
  transport?: TransportJob;
  blocker: string;
  closure?: MovementClosure;
};

export type BedRelease = {
  id: string;
  unitId: string;
  expectedAt: Instant;
  confidence: "confirmed" | "likely" | "possible";
  blocker: string;
  confirmedAt: Instant;
  confirmedBy: string;
};
