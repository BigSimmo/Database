/**
 * The Chief Psychiatrist's official forms register, and the one lookup that turns a form code
 * into its official title.
 *
 * **A LEAF MODULE ON PURPOSE.** This file has exactly one import, `import type
 * { FormAvailability }` from `@/lib/form-ranker` — a TYPE-ONLY import, erased by the compiler,
 * so it emits no `require`/`import` and pulls nothing into any bundle at runtime. It must stay
 * that way: a single value import here would undo the whole reason the file exists. It was split
 * out of `form-catalog.ts` on 2026-08-24 so that Ward Flow — whose surfaces are `"use client"`
 * components — can be a single source of official titles without dragging
 * `data/forms-catalog.json` (174 KB) and `data/forms-pdf-manifest.json` (17 KB) into the ward
 * client bundle. `form-catalog.ts` builds module-level `Map`s and arrays from both JSON files at
 * import time, so those side effects cannot be tree-shaken away by importing one named export
 * from it. `form-catalog.ts` imports and re-exports what is here; **there is still exactly one
 * copy of the register.**
 *
 * The register is transcribed from
 * https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/
 * (see `officialFormsRegisterUrl` / `officialFormsReviewedDate` in `form-catalog.ts`). Nothing
 * here may be invented, inferred or "corrected": a code the register does not list has no title,
 * and `formTitleForCode` returns `null` for it rather than guessing.
 */

import type { FormAvailability } from "@/lib/form-ranker";

export type OfficialForm = {
  code: string;
  title: string;
  category: string;
  availability?: FormAvailability;
};

export const officialForms: OfficialForm[] = [
  { code: "1A", title: "Referral for examination by a psychiatrist", category: "Referral and detention" },
  {
    code: "1A attachment",
    title: "Information provided by another person in confidence",
    category: "Referral and detention",
  },
  { code: "1B", title: "Variation of referral", category: "Referral and detention" },
  {
    code: "2",
    title: "Order to detain voluntary inpatient in authorised hospital for assessment",
    category: "Referral and detention",
  },
  { code: "3A", title: "Detention order", category: "Referral and detention" },
  { code: "3B", title: "Continuation of detention", category: "Referral and detention" },
  {
    code: "3C",
    title: "Continuation of detention to enable a further examination by a psychiatrist",
    category: "Referral and detention",
  },
  {
    code: "3D",
    title: "Order authorising reception and detention in an authorised hospital for further examination",
    category: "Referral and detention",
  },
  { code: "3E", title: "Order that person cannot continue to be detained", category: "Referral and detention" },
  { code: "4A", title: "Transport order", category: "Transport and transfer" },
  { code: "4B", title: "Extension of transport order", category: "Transport and transfer" },
  { code: "4C", title: "Transfer order", category: "Transport and transfer" },
  { code: "4D", title: "Interstate transfer order", category: "Transport and transfer", availability: "unavailable" },
  {
    code: "4E",
    title: "Approval of interstate transfer order",
    category: "Transport and transfer",
    availability: "unavailable",
  },
  { code: "5A", title: "Community Treatment Order", category: "Community treatment orders" },
  { code: "5B", title: "Continuation of Community Treatment Order", category: "Community treatment orders" },
  { code: "5C", title: "Variation of terms of Community Treatment Order", category: "Community treatment orders" },
  {
    code: "5D",
    title:
      "Request made by a supervising psychiatrist for a practitioner to conduct the monthly examination of a patient",
    category: "Community treatment orders",
  },
  {
    code: "5E",
    title: "Notice and record of breach of Community Treatment Order",
    category: "Community treatment orders",
  },
  { code: "5F", title: "Order to attend", category: "Community treatment orders" },
  { code: "6A", title: "Inpatient treatment order in authorised hospital", category: "Inpatient treatment orders" },
  { code: "6B", title: "Inpatient treatment order in general hospital", category: "Inpatient treatment orders" },
  {
    code: "6B attachment",
    title: "Inpatient treatment order in a general hospital: report to Chief Psychiatrist",
    category: "Inpatient treatment orders",
  },
  { code: "6C", title: "Continuation of inpatient treatment order", category: "Inpatient treatment orders" },
  { code: "6D", title: "Confirmation of inpatient treatment order", category: "Inpatient treatment orders" },
  { code: "7A", title: "Grant of leave to involuntary inpatient", category: "Leave and absence without leave" },
  { code: "7B", title: "Extension and/or variation of leave", category: "Leave and absence without leave" },
  { code: "7C", title: "Cancellation of grant of leave", category: "Leave and absence without leave" },
  { code: "7D", title: "Apprehension and return order", category: "Leave and absence without leave" },
  { code: "8A", title: "Record of search and seizure", category: "Search and seizure" },
  { code: "8B", title: "Record dealing with seized article", category: "Search and seizure" },
  { code: "9A", title: "Record of emergency psychiatric treatment", category: "Treatments" },
  {
    code: "9B",
    title: "Report to Chief Psychiatrist about provision of urgent non-psychiatric treatment",
    category: "Treatments",
  },
  { code: "10A", title: "Record of oral authorisation of bodily restraint", category: "Restraint" },
  { code: "10B", title: "Written bodily restraint order", category: "Restraint" },
  {
    code: "10C",
    title: "Record of informing medical practitioner and treating psychiatrist of bodily restraint",
    category: "Restraint",
  },
  { code: "10D", title: "Record of observations made of restrained person", category: "Restraint" },
  {
    code: "10E",
    title: "Record of examination of restrained person and possible extension of bodily restraint",
    category: "Restraint",
  },
  { code: "10F", title: "Variation of bodily restraint order", category: "Restraint" },
  { code: "10G", title: "Revocation or expiry of bodily restraint order", category: "Restraint" },
  { code: "10H", title: "Review of bodily restraint order by a psychiatrist", category: "Restraint" },
  { code: "10I", title: "Record of post-bodily restraint examination", category: "Restraint" },
  { code: "11A", title: "Record of oral authorisation of seclusion", category: "Seclusion" },
  { code: "11B", title: "Written seclusion order", category: "Seclusion" },
  {
    code: "11C",
    title: "Record of informing medical practitioner and treating psychiatrist of seclusion",
    category: "Seclusion",
  },
  { code: "11D", title: "Record of observations made of secluded person", category: "Seclusion" },
  {
    code: "11E",
    title: "Record of examination of secluded person and possible extension of seclusion",
    category: "Seclusion",
  },
  { code: "11F", title: "Revocation or expiry of seclusion order", category: "Seclusion" },
  { code: "11G", title: "Record of post-seclusion examination", category: "Seclusion" },
  { code: "12A", title: "Nomination of nominated person", category: "Access to information and communication" },
  {
    code: "12B",
    title: "Record of refusal of patient’s request to access document",
    category: "Access to information and communication",
  },
  {
    code: "12C",
    title: "Restriction on freedom of communication",
    category: "Access to information and communication",
  },
  {
    code: "12C attachment",
    title: "Record of confirmation, amendment or revocation of restriction of freedom of communication",
    category: "Access to information and communication",
  },
  { code: "13", title: "Statistics about ECT", category: "Electroconvulsive therapy", availability: "contact_ocp" },
];

export function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The official title for a form code, or `null` when the register does not list that code.
 *
 * `null` is a real answer and callers must render it as such — the bare code, never a
 * substituted or locally-invented title. Ward Flow's `legalFormName` is built on exactly that
 * contract.
 */
export function formTitleForCode(code: string) {
  const normalized = normalizeCode(code);
  return officialForms.find((form) => normalizeCode(form.code) === normalized)?.title ?? null;
}
