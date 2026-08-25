// Reserved fictional numbers only. These are ACMA/Ofcom-style numbers that can never
// connect to a real person, so a screenshot, a test failure or a demonstration can show a
// complete message without any possibility of contacting anyone.
export const FICTIONAL_CONTACTS_BY_ROLE = Object.freeze({
  miraPatientMobile: "+61 491 570 006",
  rowanPatientMobile: "+61 491 570 156",
  programmeStaffedLine: "+61 491 570 157",
  crisisSupportContact: "+61 491 570 158",
} as const);

export type FictionalContactRole = keyof typeof FICTIONAL_CONTACTS_BY_ROLE;

export const DESIGNATED_FICTIONAL_MOBILE_NUMBERS = Object.freeze([
  FICTIONAL_CONTACTS_BY_ROLE.miraPatientMobile,
  FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile,
  FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine,
  FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact,
] as const);

/**
 * The two reserved numbers that stand for a PATIENT'S OWN mobile, as opposed to a service line.
 *
 * Published separately because the wider list above is not interchangeable with it: the staffed
 * line and the crisis-support contact are numbers a patient CALLS, and offering either where a
 * recipient's own mobile is entered would put a support line into a recipient field. Derived from
 * the same frozen record rather than restated, so the two cannot drift.
 *
 * Used by the activation wizard's personalisation stage to state, in place, which numbers this
 * prototype's own material uses — never to refuse one. `createPlanSchema.patientMobileNumber` is
 * `z.string().min(1)` and this domain holds no format rule for a mobile number at all, so a screen
 * that refused anything outside this pair would be inventing an authority that does not exist.
 */
export const DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS = Object.freeze([
  FICTIONAL_CONTACTS_BY_ROLE.miraPatientMobile,
  FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile,
] as const);

export type DesignatedFictionalMobileNumber = (typeof DESIGNATED_FICTIONAL_MOBILE_NUMBERS)[number];
export type SyntheticPatientMobile =
  (typeof FICTIONAL_CONTACTS_BY_ROLE)["miraPatientMobile"] | (typeof FICTIONAL_CONTACTS_BY_ROLE)["rowanPatientMobile"];
