import { deriveGovernanceColumns } from "@/lib/registry-records";
import { serviceRecordSignOff } from "@/lib/service-record-sign-off";
import { getServiceRecord, serviceRecords, type ServiceRecord } from "@/lib/services";
import { isRetainedBootstrapReleaseId } from "@/lib/site-content/site-content-health";

/**
 * Keep Services mode reachable while the served release is still the epoch-zero freeze.
 *
 * WHY THIS EXISTS, measured against production on 2026-09-17.
 * -----------------------------------------------------------
 * `20260916190000` made `read_site_content_public_records` fast again (8,656 ms mean ->
 * 133 ms for a services search). Until it landed, that read was blowing its budget on every
 * call, `readCatalogueWithSeedFallback` was returning the in-bundle catalogue, and the group
 * was flagged `degraded`. The moment the read started completing, search began answering from
 * the frozen 2026-08-24 release — 843 records — and the 17 service records added by #2814
 * stopped appearing at all:
 *
 *     "sexual assault"  ->  Sexual Assault Resource Centre (SARC) was result #1, now absent
 *     "suicide"         ->  StandBy Support After Suicide was result #1, now absent
 *     "1800respect"     ->  no results at all
 *
 * Those are crisis and suicide-postvention services: SARC, 1800RESPECT, Thirrili, Culture Care
 * Connect, ARBOR, CYPRESS, StandBy and the Aftercare Services Program among them. Their detail
 * pages still render (the page is server-rendered from this same in-repo catalogue), so the
 * content was never lost — only its findability was, and Services mode is search-first, so
 * search is the only route to it. Fixing a latency defect should not remove crisis services
 * from a clinician's search results.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a publication, and it does not pretend to be one. Catalogue growth reaches live
 * through the publication pipeline in `docs/site-content-sync-runbook.md` and nowhere else;
 * that pipeline has never been run (zero publications, zero sync events,
 * `site_content_sync_state.initialized = false` as of 2026-09-17), and running it for the first
 * time is a seven-step, administrator-driven job. This is the stopgap that holds until it does.
 *
 * THE GATE IS THE WHOLE DESIGN
 * ----------------------------
 * Everything here is inert unless the served release is a retained epoch-zero bootstrap
 * identity (`isRetainedBootstrapReleaseId`). The moment an operator publishes and activates a
 * real release, that release wins and every function below becomes a no-op — the same gate
 * `preferBundledFormRecord` uses, and for the same reason: otherwise every future
 * clinician-reviewed publish would keep losing to the bundle. A stopgap that removes itself is
 * the only kind worth shipping.
 *
 * TWO DIFFERENT DEFECTS, TWO DIFFERENT FIXES
 * ------------------------------------------
 * `preferBundledServiceRecord` refreshes a record the release already has, and is the exact
 * analogue of `preferBundledFormRecord`. It covers the ~9 services whose contact details were
 * re-verified after the freeze: same slug, stale payload.
 *
 * `bundledServicesMissingFrom` is the genuinely new half, and it is new because the Forms
 * mechanism cannot do it: `preferBundledFormRecord` looks the bundled record up BY the slug of
 * a record the database already returned, so it can only ever swap a payload, never introduce a
 * record the release does not contain. The 17 additions need this instead.
 *
 * GOVERNANCE MUST FOLLOW THE CONTENT
 * ----------------------------------
 * A topped-up record has no canonical governance row, because it has no canonical row at all.
 * `bundledServiceGovernance` derives `sourceStatus` from the record's own source the way the
 * seed path already does — that describes the publisher's page, which is true whether or not
 * this catalogue has been published — and pins `validationStatus` to `unverified` regardless of
 * what the record claims locally. These records have not been through the governed pipeline, so
 * they must never carry a sign-off label they did not earn, and `unverified` is the conservative
 * value the enum already has. Same reasoning, and the same narrowing, as the Forms path. The one
 * exception is a record the clinical owner has signed off with `npm run clinical:review`
 * (`src/lib/service-record-sign-off.ts`): that reads as `locally_reviewed`, and the sign-off is
 * pinned to the record's exact text.
 */

/**
 * The governance a record served from the bundle alone may claim.
 *
 * `unverified` unless the clinical owner has signed this exact record off with
 * `npm run clinical:review` (data/service-records-review.json, ledger #3E42FH): a `reviewed`
 * row naming a reviewer and a parseable timestamp reads as `locally_reviewed`, the label for
 * a local clinician review, never `approved`. The row's content pin is enforced by
 * tests/signoff-services.test.ts, so a record edited after sign-off fails the suite rather than
 * reaching the site still labelled reviewed. This does not publish anything.
 */
export function bundledServiceGovernance(record: ServiceRecord): {
  sourceStatus: string;
  validationStatus: string;
} {
  const derived = deriveGovernanceColumns(record);
  // sourceStatus stays derived: it describes the publisher's page, which publication does not change.
  // validationStatus is pinned rather than derived: nothing here has been published, and only a
  // clinical-owner sign-off of this record may lift it.
  return {
    sourceStatus: derived.source_status,
    validationStatus: serviceRecordSignOff(record) ? "locally_reviewed" : "unverified",
  };
}

/**
 * Swap a canonical service payload for the in-repo one while the release is a retained
 * bootstrap. Mirrors `preferBundledFormRecord`. Returns `mapped` untouched otherwise.
 */
export function preferBundledServiceRecord<
  T extends { record: ServiceRecord; governance?: { validationStatus?: string } },
>(mapped: T, options?: { activeReleaseId?: string | null }): T {
  const activeReleaseId = options?.activeReleaseId;
  if (!activeReleaseId || !isRetainedBootstrapReleaseId(activeReleaseId)) return mapped;
  const bundled = getServiceRecord(mapped.record.slug) ?? getBundledCanonicalServiceRecord(mapped.record.slug);
  if (!bundled) return mapped;
  const swapped = { ...mapped, record: bundled } as T;
  if (!mapped.governance) return swapped;
  // The swapped-in text has not been published, so it cannot keep the release's sign-off label.
  return { ...swapped, governance: { ...mapped.governance, validationStatus: "unverified" } } as T;
}

/**
 * In-repo service records the served release does not contain, while that release is a retained
 * bootstrap. Empty in every other state, including once a real release is active.
 *
 * Slug comparison is on `record.slug` as both sides already store it; callers pass the records
 * they are about to serve, so a record swapped by `preferBundledServiceRecord` is matched by the
 * same slug and is not duplicated.
 */
export function bundledServicesMissingFrom(
  records: readonly ServiceRecord[],
  options?: { activeReleaseId?: string | null },
): ServiceRecord[] {
  const activeReleaseId = options?.activeReleaseId;
  if (!activeReleaseId || !isRetainedBootstrapReleaseId(activeReleaseId)) return [];
  const present = new Set(records.map((record) => record.slug));
  return serviceRecords.filter((record) => !present.has(record.slug));
}

/**
 * Canonical service entries for major Perth metropolitan public acute psychiatric inpatient
 * units and the statewide urgent toxicology resource (WA Poisons Information Centre).
 *
 * Verified against WA Health, NMHS, SMHS, EMHS, and CAHS official service descriptions.
 */
export const CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES: readonly ServiceRecord[] = [
  {
    slug: "graylands-hospital-and-frankland-centre",
    title: "Graylands Hospital & Frankland Centre",
    subtitle: "Statewide forensic and acute public psychiatric inpatient facility",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "Statewide service", tone: "info" },
      { label: "Forensic & Acute Inpatient", tone: "warning" },
    ],
    primaryContact: {
      label: "Graylands Switchboard",
      value: "(08) 9347 6600",
      kind: "phone",
    },
    contacts: [
      { label: "Graylands Hospital Switchboard", value: "(08) 9347 6600", kind: "phone" },
      { label: "Frankland Centre (State Forensic Mental Health)", value: "(08) 9347 6400", kind: "phone" },
      { label: "Facility Address", value: "Brockway Road, Mount Claremont WA 6010", kind: "text" },
    ],
    route:
      "Referral via authorized public mental health services, State Forensic Mental Health Service (SFMHS), court liaison, or inter-hospital psychiatric transfer. No direct public walk-in.",
    eligibility:
      "Western Australian adults aged 18 and over requiring acute or secure forensic inpatient psychiatric care under the Mental Health Act 2014 or Criminal Law (Mentally Impaired Accused) Act.",
    cost: "Fully funded through Medicare and WA Health for public hospital psychiatric care.",
    referral: "Clinical referral via public psychiatric treating teams or SFMHS forensic liaison.",
    location: "Mount Claremont, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title: "Statewide acute inpatient care and maximum-security forensic psychiatric evaluation and treatment.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title:
          "Referral via authorized mental health service, forensic liaison, or inter-hospital psychiatric transfer.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults aged 18+ requiring specialized acute psychiatric or forensic inpatient admission.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "Authorized psychiatric or forensic clinical referral" },
      { label: "Phone", value: "(08) 9347 6600" },
      { label: "Forensic Unit", value: "(08) 9347 6400" },
      { label: "Provider", value: "North Metropolitan Health Service / Statewide Mental Health" },
      { label: "Region", value: "Statewide Western Australia" },
      { label: "Patient group", value: "Adults 18+ needing acute or forensic psychiatric inpatient care" },
      { label: "Hours", value: "24/7 inpatient facility; administrative inquiries Mon-Fri 8:30am-4:30pm" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Statewide acute psychiatric inpatient care, intensive psychiatric rehabilitation, and maximum-security forensic psychiatric assessment and treatment at the Frankland Centre.",
    criteria: [
      {
        label: "Adults aged 18 and over with severe psychiatric illness or forensic mental health needs",
        tone: "meet",
      },
      { label: "Admission via authorized psychiatric service or State Forensic Mental Health Service", tone: "meet" },
      {
        label: "No direct walk-in emergency presentations; for community crisis use MHERL 1300 555 788 or 000",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: [
      "inpatient",
      "psychiatric_inpatient",
      "forensic_mental_health",
      "acute_care",
      "public_hospital",
      "nmhs",
      "statewide",
      "adult",
    ],
    catchments: ["Statewide", "Western Australia"],
    catalogueLabel: "Statewide forensic and acute inpatient mental health",
    navigatorQuery:
      "Graylands Hospital Frankland Centre Statewide forensic acute psychiatric inpatient Mount Claremont",
    source: {
      label: "NMHS Mental Health - Forensic and Graylands Hospital",
      status: "Source checked",
      url: "https://www.nmhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health/Forensics",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "scgh-mental-health-observation-area-and-inpatient",
    title: "Sir Charles Gairdner Hospital Mental Health Observation Area (MHOA) & Inpatient",
    subtitle: "NMHS acute mental health observation area and acute adult inpatient unit",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Emergency & Acute", tone: "danger" },
      { label: "NMHS Inpatient & MHOA", tone: "info" },
    ],
    primaryContact: {
      label: "SCGH Switchboard",
      value: "(08) 6457 3333",
      kind: "phone",
    },
    contacts: [
      { label: "SCGH Main Switchboard", value: "(08) 6457 3333", kind: "phone" },
      { label: "Facility Address", value: "Hospital Avenue, Nedlands WA 6009", kind: "text" },
    ],
    route:
      "Emergency presentation through SCGH Emergency Department for MHOA assessment, or urgent admission referral via NMHS community mental health assessment and treatment teams.",
    eligibility:
      "Adults aged 18 to 65 presenting with acute psychiatric emergencies, severe distress, or illness requiring observation, stabilization, or hospital admission.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "Emergency department presentation or public mental health clinician referral.",
    location: "Nedlands, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title: "Emergency observation (up to 72 hours in MHOA) and acute adult psychiatric inpatient care.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Emergency presentation via SCGH Emergency Department or NMHS community triage.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults aged 18-65 residing in the North Metropolitan catchment or presenting to SCGH ED.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "SCGH Emergency Department or NMHS community triage" },
      { label: "Phone", value: "(08) 6457 3333" },
      { label: "Provider", value: "North Metropolitan Health Service" },
      { label: "Region", value: "North Metropolitan Perth" },
      { label: "Patient group", value: "Adults 18-65 requiring acute observation or inpatient psychiatric care" },
      { label: "Hours", value: "24/7 emergency and inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Rapid multidisciplinary psychiatric assessment, short-stay crisis stabilization in the MHOA, and comprehensive acute adult inpatient care.",
    criteria: [
      {
        label: "Adults aged 18-65 in acute psychiatric distress requiring observation or inpatient admission",
        tone: "meet",
      },
      { label: "Presentation via SCGH Emergency Department or authorized NMHS mental health team", tone: "meet" },
      { label: "Non-urgent outpatient queries should contact local community mental health clinics", tone: "caution" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: [
      "inpatient",
      "mhoa",
      "observation_unit",
      "acute_care",
      "emergency_psychiatry",
      "nmhs",
      "scgh",
      "adult",
      "public_hospital",
    ],
    catchments: ["North Metropolitan Health Service", "Perth metro"],
    catalogueLabel: "NMHS acute psychiatric inpatient & observation unit",
    navigatorQuery: "Sir Charles Gairdner Hospital SCGH MHOA Mental Health Observation Area acute inpatient Nedlands",
    source: {
      label: "SCGH Mental Health Services",
      status: "Source checked",
      url: "https://www.scgh.health.wa.gov.au/Our-Services/Mental-Health",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "fiona-stanley-hospital-wards-4b-and-4c",
    title: "Fiona Stanley Hospital Wards 4B & 4C",
    subtitle: "SMHS acute adult mental health inpatient units",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Acute Inpatient", tone: "danger" },
      { label: "SMHS Acute Adult", tone: "info" },
    ],
    primaryContact: {
      label: "FSH Mental Health",
      value: "(08) 6152 7999",
      kind: "phone",
    },
    contacts: [
      { label: "FSH Mental Health Unit", value: "(08) 6152 7999", kind: "phone" },
      { label: "FSH General Helpdesk", value: "(08) 6152 2222", kind: "phone" },
      { label: "Facility Address", value: "11 Robin Warren Drive, Murdoch WA 6150", kind: "text" },
    ],
    route:
      "Presentation via Fiona Stanley Hospital Emergency Department or acute referral through SMHS Assessment and Treatment Teams (ATT).",
    eligibility:
      "Adults aged 18 to 65 residing within the South Metropolitan Health Service catchment requiring acute psychiatric inpatient admission.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "FSH Emergency Department presentation or SMHS clinical mental health referral.",
    location: "Murdoch, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title:
          "Acute adult psychiatric inpatient treatment, crisis stabilization, and intensive multidisciplinary care.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Presentation through FSH Emergency Department or SMHS community mental health triage.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults aged 18-65 residing in South Metropolitan Perth requiring acute psychiatric hospital care.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "FSH Emergency Department or SMHS mental health triage" },
      { label: "Phone", value: "(08) 6152 7999" },
      { label: "Switchboard", value: "(08) 6152 2222" },
      { label: "Provider", value: "South Metropolitan Health Service" },
      { label: "Region", value: "South Metropolitan Perth" },
      { label: "Patient group", value: "Adults 18-65 requiring acute inpatient psychiatric care" },
      { label: "Hours", value: "24/7 inpatient admissions and nursing care" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Acute psychiatric inpatient admission across Wards 4B and 4C for adults experiencing severe mental illness, acute mood episodes, psychosis, or crisis requiring round-the-clock hospital care.",
    criteria: [
      { label: "Adults aged 18-65 in South Metropolitan catchment requiring hospital inpatient care", tone: "meet" },
      { label: "Admissions arranged via FSH ED Mental Health Assessment Service or SMHS ATT", tone: "meet" },
      {
        label: "Outpatient or routine counseling referrals must be directed to community mental health clinics",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: ["inpatient", "acute_care", "psychiatric_ward", "fsh", "smhs", "adult", "hospital", "public_hospital"],
    catchments: ["South Metropolitan Health Service", "Perth metro"],
    catalogueLabel: "SMHS acute psychiatric inpatient units (Wards 4B & 4C)",
    navigatorQuery: "Fiona Stanley Hospital Wards 4B 4C acute adult mental health inpatient Murdoch SMHS",
    source: {
      label: "SMHS Fiona Stanley Hospital Mental Health Services",
      status: "Source checked",
      url: "https://smhs.health.wa.gov.au/Our-services/Mental-health/Fiona-Stanley-and-Fremantle-Hospitals",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "alma-street-centre-fremantle-hospital",
    title: "Alma Street Centre",
    subtitle: "Fremantle Hospital acute adult and older adult mental health inpatient unit",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "Acute Inpatient", tone: "danger" },
      { label: "SMHS / Fremantle Hospital", tone: "info" },
    ],
    primaryContact: {
      label: "Alma Street Centre",
      value: "(08) 9431 3400",
      kind: "phone",
    },
    contacts: [
      { label: "Alma Street Centre Reception", value: "(08) 9431 3400", kind: "phone" },
      { label: "Fremantle Hospital Switchboard", value: "(08) 9431 3333", kind: "phone" },
      { label: "Facility Address", value: "Alma Street, Fremantle WA 6160", kind: "text" },
    ],
    route:
      "Referral via SMHS community mental health triage, Fremantle Community Mental Health, FSH Emergency Department, or inter-hospital transfer.",
    eligibility:
      "Adults and older adults residing in the Fremantle, Cockburn, and Melville local areas with acute mental health conditions.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "SMHS public mental health triage, Community Mental Health Teams, or ED transfer.",
    location: "Fremantle, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title: "Acute adult and older adult psychiatric inpatient admission, medical stabilization, and therapy.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Referral via SMHS mental health triage, community teams, or ED transfer.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults and older adults in the Fremantle, Melville, and Cockburn catchments.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "SMHS community mental health triage or hospital transfer" },
      { label: "Phone", value: "(08) 9431 3400" },
      { label: "Hospital Switchboard", value: "(08) 9431 3333" },
      { label: "Provider", value: "South Metropolitan Health Service / Fremantle Hospital" },
      { label: "Region", value: "Fremantle and South Metropolitan Perth" },
      { label: "Patient group", value: "Adults and older adults requiring acute inpatient psychiatric care" },
      { label: "Hours", value: "24/7 inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Acute inpatient psychiatric stabilization, multidisciplinary assessment, and recovery-oriented treatment for adults and older adults at the Alma Street Centre, Fremantle Hospital.",
    criteria: [
      {
        label: "Adults or older adults in the Fremantle/SMHS catchment requiring acute psychiatric admission",
        tone: "meet",
      },
      { label: "Referral via SMHS mental health triage or medical transfer", tone: "meet" },
      {
        label:
          "Fremantle Hospital does not have an emergency department; for immediate medical emergencies go to Fiona Stanley Hospital ED",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: [
      "inpatient",
      "acute_care",
      "fremantle_hospital",
      "alma_street",
      "smhs",
      "adult",
      "older_adult",
      "public_hospital",
    ],
    catchments: ["South Metropolitan Health Service", "Fremantle", "Perth metro"],
    catalogueLabel: "Fremantle Hospital acute mental health inpatient unit",
    navigatorQuery: "Alma Street Centre Fremantle Hospital acute adult older adult mental health inpatient SMHS",
    source: {
      label: "SMHS Fremantle Hospital Mental Health Services",
      status: "Source checked",
      url: "https://smhs.health.wa.gov.au/Our-services/Mental-health/Fiona-Stanley-and-Fremantle-Hospitals",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "royal-perth-hospital-ward-2k",
    title: "Royal Perth Hospital Ward 2K",
    subtitle: "EMHS acute adult psychiatric inpatient unit",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Acute Inpatient", tone: "danger" },
      { label: "EMHS Inner City", tone: "info" },
    ],
    primaryContact: {
      label: "RPH Switchboard",
      value: "(08) 9224 2244",
      kind: "phone",
    },
    contacts: [
      { label: "Royal Perth Hospital Switchboard", value: "(08) 9224 2244", kind: "phone" },
      { label: "Facility Address", value: "Victoria Square / Wellington Street, Perth WA 6000", kind: "text" },
    ],
    route:
      "Presentation via Royal Perth Hospital Emergency Department / Mental Health Assessment Unit (MHAU), or clinical referral from EMHS community mental health services.",
    eligibility:
      "Adults aged 18 to 65 presenting with acute mental health crises or severe psychiatric illness requiring hospital admission.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "RPH Emergency Department presentation or EMHS clinical psychiatric referral.",
    location: "Perth City, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title:
          "Acute adult psychiatric inpatient care, crisis stabilization, and complex medical-psychiatric management.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Presentation through RPH Emergency Department or EMHS mental health triage.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults aged 18-65 residing in the East Metropolitan catchment or presenting to RPH.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "RPH Emergency Department or EMHS mental health triage" },
      { label: "Phone", value: "(08) 9224 2244" },
      { label: "Provider", value: "East Metropolitan Health Service" },
      { label: "Region", value: "East Metropolitan Perth / Inner City" },
      { label: "Patient group", value: "Adults 18-65 requiring acute inpatient psychiatric care" },
      { label: "Hours", value: "24/7 emergency and acute inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Acute hospital-based psychiatric care at Ward 2K, Royal Perth Hospital, delivering intensive stabilization, diagnostic formulation, pharmacotherapy, and links to inner-city and EMHS community care.",
    criteria: [
      { label: "Adults aged 18-65 requiring acute psychiatric inpatient admission", tone: "meet" },
      { label: "Admission arranged through RPH Emergency Department / MHAU or EMHS psychiatric triage", tone: "meet" },
      { label: "Non-acute outpatient queries should contact City East Community Mental Health", tone: "caution" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: ["inpatient", "acute_care", "rph", "emhs", "ward_2k", "adult", "emergency_psychiatry", "public_hospital"],
    catchments: ["East Metropolitan Health Service", "Perth City", "Perth metro"],
    catalogueLabel: "EMHS acute psychiatric inpatient unit (Ward 2K)",
    navigatorQuery: "Royal Perth Hospital RPH Ward 2K acute adult mental health inpatient EMHS Perth City",
    source: {
      label: "EMHS Royal Perth Hospital Mental Health Services",
      status: "Source checked",
      url: "https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "bentley-hospital-ward-4",
    title: "Bentley Hospital Ward 4",
    subtitle: "EMHS adult acute psychiatric inpatient unit",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "Acute Inpatient", tone: "danger" },
      { label: "EMHS Bentley Health Service", tone: "info" },
    ],
    primaryContact: {
      label: "Bentley Switchboard",
      value: "(08) 9416 3666",
      kind: "phone",
    },
    contacts: [
      { label: "Bentley Hospital Switchboard", value: "(08) 9416 3666", kind: "phone" },
      { label: "Ward 4 Nursing Station", value: "(08) 9416 3800", kind: "phone" },
      { label: "Facility Address", value: "18-56 Mills Street, Bentley WA 6102", kind: "text" },
    ],
    route:
      "Referral via EMHS community mental health assessment and treatment teams (ATT/CTT), hospital emergency departments, or inter-hospital psychiatric transfer.",
    eligibility:
      "Adults aged 18 to 65 residing in the East Metropolitan catchment who require acute voluntary or involuntary inpatient psychiatric care.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "EMHS psychiatric triage, community mental health teams, or ED transfer.",
    location: "Bentley, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title:
          "Acute adult psychiatric inpatient care, diagnostic evaluation, stabilization, and multidisciplinary therapy.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Referral via EMHS community mental health teams or emergency department transfer.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults aged 18-65 residing in the East Metropolitan Health Service catchment.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "EMHS community mental health teams or emergency department transfer" },
      { label: "Phone", value: "(08) 9416 3666" },
      { label: "Ward 4 Direct", value: "(08) 9416 3800" },
      { label: "Provider", value: "East Metropolitan Health Service / Bentley Health Service" },
      { label: "Region", value: "East Metropolitan Perth" },
      { label: "Patient group", value: "Adults 18-65 requiring acute inpatient psychiatric care" },
      { label: "Hours", value: "24/7 acute inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Specialized acute psychiatric inpatient care at Bentley Health Service Ward 4, offering psychiatric stabilization, multidisciplinary Allied Health therapy, and integrated community discharge coordination.",
    criteria: [
      { label: "Adults aged 18-65 residing in the EMHS catchment needing acute hospital care", tone: "meet" },
      { label: "Referral through authorized EMHS clinical teams or hospital transfer", tone: "meet" },
      {
        label:
          "Bentley Hospital does not have an emergency department; for urgent acute presentations attend RPH or FSH ED",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: ["inpatient", "acute_care", "bentley_hospital", "ward_4", "emhs", "adult", "public_hospital"],
    catchments: ["East Metropolitan Health Service", "Perth metro"],
    catalogueLabel: "EMHS acute psychiatric inpatient unit (Bentley Ward 4)",
    navigatorQuery: "Bentley Hospital Ward 4 acute adult mental health inpatient EMHS Mills Street",
    source: {
      label: "EMHS Bentley Health Service Mental Health Inpatient Units",
      status: "Source checked",
      url: "https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "st-john-of-god-midland-public-hospital-mental-health-inpatient-unit",
    title: "St John of God Midland Public Hospital (Mental Health Inpatient Unit)",
    subtitle: "EMHS / SJG Midland public acute psychiatric inpatient unit",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Acute Inpatient", tone: "danger" },
      { label: "EMHS Swan & Hills", tone: "info" },
    ],
    primaryContact: {
      label: "Midland Switchboard",
      value: "(08) 9462 4000",
      kind: "phone",
    },
    contacts: [
      { label: "St John of God Midland Switchboard", value: "(08) 9462 4000", kind: "phone" },
      { label: "Mental Health Inpatient Unit", value: "(08) 9462 4268", kind: "phone" },
      { label: "Facility Address", value: "1 Clayton Street, Midland WA 6056", kind: "text" },
    ],
    route:
      "Emergency presentation through St John of God Midland Public Hospital Emergency Department, or direct clinical referral via Midland Community Mental Health Service.",
    eligibility:
      "Adults and older adults residing in the Swan, Midland, Mundaring, and Perth Hills catchments needing acute voluntary or involuntary mental health care.",
    cost: "Fully funded through Medicare and WA Health for public hospital patients.",
    referral: "Midland Emergency Department presentation or EMHS community mental health triage.",
    location: "Midland, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title: "Comprehensive acute psychiatric inpatient care, emergency stabilization, and recovery planning.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Emergency presentation via Midland Public Hospital ED or community mental health triage.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults and older adults in the Swan, Midland, and Hills catchments.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      {
        label: "Primary route",
        value: "Midland Public Hospital Emergency Department or community mental health triage",
      },
      { label: "Phone", value: "(08) 9462 4000" },
      { label: "Inpatient Unit", value: "(08) 9462 4268" },
      { label: "Provider", value: "St John of God Midland Public Hospital / EMHS" },
      { label: "Region", value: "Swan, Midland, Hills, and East Metropolitan Perth" },
      { label: "Patient group", value: "Adults and older adults requiring acute inpatient psychiatric care" },
      { label: "Hours", value: "24/7 emergency and acute inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Acute public psychiatric hospitalization for adults and older adults, providing round-the-clock medical care, crisis stabilization, Allied Health interventions, and seamless discharge linkage with local community services.",
    criteria: [
      {
        label: "Adults and older adults in the Swan/Hills/EMHS catchment requiring acute psychiatric admission",
        tone: "meet",
      },
      {
        label: "Admissions arranged via Midland Emergency Department or Midland Community Mental Health",
        tone: "meet",
      },
      {
        label: "Non-urgent outpatient support should be directed to Midland Community Mental Health Service",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: ["inpatient", "acute_care", "midland_hospital", "sjog_midland", "emhs", "adult", "public_hospital"],
    catchments: ["East Metropolitan Health Service", "Swan", "Hills", "Perth metro"],
    catalogueLabel: "SJG Midland Public Hospital acute mental health inpatient unit",
    navigatorQuery: "St John of God Midland Public Hospital MHIU acute mental health inpatient EMHS Clayton Street",
    source: {
      label: "St John of God Midland Public Hospital Mental Health",
      status: "Source checked",
      url: "https://www.sjog.org.au/our-locations/st-john-of-god-midland-public-hospital/our-services/mental-health",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "rockingham-general-hospital-mimidi-park",
    title: "Rockingham General Hospital Mimidi Park",
    subtitle: "SMHS acute adult and older adult mental health inpatient facility",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Acute Inpatient", tone: "danger" },
      { label: "SMHS Rockingham Peel", tone: "info" },
    ],
    primaryContact: {
      label: "Mimidi Park Direct",
      value: "(08) 9599 4600",
      kind: "phone",
    },
    contacts: [
      { label: "Mimidi Park Inpatient Reception", value: "(08) 9599 4600", kind: "phone" },
      { label: "RGH Switchboard", value: "(08) 9599 4000", kind: "phone" },
      { label: "Facility Address", value: "Elanora Drive, Rockingham WA 6168", kind: "text" },
    ],
    route:
      "Emergency presentation through Rockingham General Hospital Emergency Department, or acute referral through Rockingham Peel Community Mental Health teams.",
    eligibility:
      "Adults aged 18 to 65 and older adults residing in Rockingham, Kwinana, Mandurah, and Peel districts requiring inpatient psychiatric care.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "RGH Emergency Department presentation or SMHS community mental health triage.",
    location: "Rockingham, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title:
          "Acute adult and older adult psychiatric inpatient treatment, crisis stabilization, and multidisciplinary care.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Emergency presentation via RGH Emergency Department or Rockingham Peel mental health triage.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Adults and older adults residing in Rockingham, Kwinana, Mandurah, and Peel catchments.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "RGH Emergency Department or Rockingham Peel mental health triage" },
      { label: "Phone", value: "(08) 9599 4600" },
      { label: "Switchboard", value: "(08) 9599 4000" },
      { label: "Provider", value: "South Metropolitan Health Service / Rockingham Peel Group" },
      { label: "Region", value: "Rockingham, Kwinana, Peel, and South Metropolitan Perth" },
      { label: "Patient group", value: "Adults 18-65 and older adults requiring acute inpatient psychiatric care" },
      { label: "Hours", value: "24/7 inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Specialized acute psychiatric inpatient treatment at Mimidi Park, featuring acute adult wards, older adult beds, psychiatric evaluation, round-the-clock nursing care, and discharge coordination with community teams.",
    criteria: [
      {
        label: "Adults and older adults in Rockingham, Kwinana, Mandurah, or Peel requiring hospital care",
        tone: "meet",
      },
      {
        label:
          "Admissions via Rockingham General Hospital Emergency Department or Rockingham Peel Community Mental Health",
        tone: "meet",
      },
      {
        label: "Outpatient and continuing community care referrals should contact local community clinics",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: [
      "inpatient",
      "acute_care",
      "mimidi_park",
      "rockingham_hospital",
      "smhs",
      "adult",
      "older_adult",
      "public_hospital",
    ],
    catchments: ["South Metropolitan Health Service", "Rockingham Peel Group", "Perth metro"],
    catalogueLabel: "SMHS acute psychiatric inpatient facility (Mimidi Park)",
    navigatorQuery:
      "Rockingham General Hospital Mimidi Park acute adult older adult mental health inpatient SMHS Elanora Drive",
    source: {
      label: "SMHS Rockingham Peel Group - Mimidi Park Mental Health",
      status: "Source checked",
      url: "https://smhs.health.wa.gov.au/Our-services/Mental-health/Rockingham-Peel-Group",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "perth-childrens-hospital-ward-5a",
    title: "Perth Children's Hospital Ward 5A",
    subtitle: "CAMHS acute child and adolescent mental health inpatient unit",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Child & Youth Inpatient", tone: "danger" },
      { label: "Statewide CAMHS", tone: "info" },
    ],
    primaryContact: {
      label: "CAMHS Crisis Connect",
      value: "1800 048 636",
      kind: "phone",
    },
    contacts: [
      { label: "CAMHS Crisis Connect (Triage & Access)", value: "1800 048 636", kind: "phone" },
      { label: "Ward 5A Nursing Station", value: "(08) 6456 4300", kind: "phone" },
      { label: "PCH Main Switchboard", value: "(08) 6456 2222", kind: "phone" },
      { label: "Facility Address", value: "15 Hospital Avenue, Nedlands WA 6009", kind: "text" },
    ],
    route:
      "Urgent assessment and referral via CAMHS Crisis Connect (1800 048 636), presentation to the Perth Children's Hospital Emergency Department, or inter-hospital psychiatric transfer.",
    eligibility:
      "Children and adolescents up to age 16 (and eligible adolescents up to 18) residing anywhere in Western Australia with acute and complex psychiatric needs.",
    cost: "Fully funded through Medicare and WA Health for public hospital care.",
    referral: "CAMHS Crisis Connect triage, PCH Emergency Department presentation, or regional hospital transfer.",
    location: "Nedlands, Western Australia",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title:
          "Statewide specialized acute child and adolescent psychiatric inpatient admission, crisis recovery, and family care.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title: "Urgent triage via CAMHS Crisis Connect 1800 048 636 or PCH Emergency Department presentation.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Children and young people under 18 across Western Australia with severe acute psychiatric crises.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Public hospital care funded under Medicare and WA Health.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "CAMHS Crisis Connect 1800 048 636 or PCH Emergency Department" },
      { label: "Triage Phone", value: "1800 048 636" },
      { label: "Ward 5A Phone", value: "(08) 6456 4300" },
      { label: "PCH Switchboard", value: "(08) 6456 2222" },
      { label: "Provider", value: "Child and Adolescent Health Service (CAHS) / CAMHS" },
      { label: "Region", value: "Statewide Western Australia" },
      { label: "Patient group", value: "Children and adolescents up to age 18 with severe acute mental illness" },
      { label: "Hours", value: "24/7 acute child and adolescent inpatient services" },
      { label: "Cost / funding", value: "Free for public patients under Medicare" },
    ],
    bestUse:
      "Statewide acute child and adolescent psychiatric inpatient treatment at Ward 5A, Perth Children's Hospital, providing specialized 24/7 psychiatric crisis stabilization, pediatric medical support, Allied Health therapies, and comprehensive family-inclusive care.",
    criteria: [
      {
        label: "Children and young people under 18 across WA experiencing severe acute psychiatric emergencies",
        tone: "meet",
      },
      { label: "Access via CAMHS Crisis Connect (1800 048 636) or PCH Emergency Department", tone: "meet" },
      { label: "Adult patients aged 18+ must be directed to adult public mental health services", tone: "caution" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: [
      "inpatient",
      "camhs",
      "ward_5a",
      "pch",
      "child_youth",
      "acute_care",
      "statewide",
      "pediatric",
      "public_hospital",
    ],
    catchments: ["Statewide", "Western Australia"],
    catalogueLabel: "CAMHS acute child & adolescent psychiatric inpatient unit (Ward 5A)",
    navigatorQuery:
      "Perth Children's Hospital PCH Ward 5A CAMHS child adolescent acute mental health inpatient Nedlands",
    source: {
      label: "CAHS Child and Adolescent Mental Health Service - Ward 5A PCH",
      status: "Source checked",
      url: "https://cahs.health.wa.gov.au/Our-Services/Mental-Health/Inpatient-Services",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
  {
    slug: "wa-poisons-information-centre",
    title: "WA Poisons Information Centre",
    subtitle: "Statewide 24/7 urgent toxicology, overdose, and poisoning advice service",
    statusChips: [
      { label: "Active", tone: "success" },
      { label: "24/7 Urgent Toxicology", tone: "danger" },
      { label: "Statewide 13 11 26", tone: "info" },
    ],
    primaryContact: {
      label: "Poisons Information Line",
      value: "13 11 26",
      kind: "phone",
    },
    contacts: [
      { label: "Urgent Poisons Line", value: "13 11 26", kind: "phone" },
      { label: "Emergency Services", value: "000", kind: "phone" },
      { label: "Administration & Non-Urgent", value: "(08) 6457 3988", kind: "phone" },
      {
        label: "Host Location",
        value: "Sir Charles Gairdner Hospital, Hospital Avenue, Nedlands WA 6009",
        kind: "text",
      },
    ],
    route:
      "Direct phone call to 13 11 26 available 24 hours a day, 7 days a week, Australia-wide with Western Australian inquiries handled by specialist clinical toxicologists and pharmacists.",
    eligibility:
      "Open to everyone across Western Australia: general public, paramedics, emergency doctors, nurses, pharmacists, and general practitioners.",
    cost: "Free service (local call charge; mobile charges may apply depending on carrier).",
    referral: "Direct telephone call. No referral required.",
    location: "Statewide Western Australia (based at Sir Charles Gairdner Hospital)",
    summaryCards: [
      {
        id: "best-use",
        label: "Best use",
        title:
          "Immediate expert clinical advice on acute poisonings, drug overdoses, envenomations, and toxic chemical exposures.",
      },
      {
        id: "route",
        label: "Referral pathway",
        title:
          "Call 13 11 26 directly 24/7 from anywhere in Western Australia. In life-threatening emergencies call 000.",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Available 24/7 to the public and healthcare clinicians across Western Australia.",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Free public clinical toxicology advice service.",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "13 11 26 (Direct 24/7 telephone access)" },
      { label: "Phone", value: "13 11 26" },
      { label: "Emergency Services", value: "000" },
      { label: "Administrative Phone", value: "(08) 6457 3988" },
      { label: "Provider", value: "WA Poisons Information Centre / Sir Charles Gairdner Hospital" },
      { label: "Region", value: "Statewide Western Australia" },
      {
        label: "Patient group",
        value: "Anyone exposed to or managing suspected poisoning, overdose, or toxic substances",
      },
      { label: "Hours", value: "24 hours a day, 7 days a week, 365 days a year" },
      { label: "Cost / funding", value: "Free telephone service funded by WA Health" },
    ],
    bestUse:
      "Immediate, specialized telephone assessment and management advice for acute poisonings, medication overdoses, accidental chemical ingestions, envenomation (snake, spider, marine bites and stings), and occupational toxic exposures.",
    criteria: [
      { label: "Anyone in WA experiencing or treating acute poisoning, overdose, or toxic exposure", tone: "meet" },
      {
        label: "Healthcare professionals requiring expert clinical toxicology advice and risk assessment",
        tone: "meet",
      },
      {
        label:
          "In life-threatening emergencies with airway compromise, unconsciousness, or severe distress call 000 immediately",
        tone: "caution",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      availabilityStatus: "active",
      lastVerifiedAt: "2026-09-27",
      reviewer: "Inpatient Services and Poisons Specialist",
    },
    tags: [
      "toxicology",
      "poisons",
      "overdose",
      "emergency",
      "urgent_crisis",
      "statewide",
      "24_7",
      "public_health",
      "scgh",
    ],
    catchments: ["Statewide", "Western Australia"],
    catalogueLabel: "Statewide urgent toxicology & poisons information service",
    navigatorQuery: "WA Poisons Information Centre 13 11 26 urgent toxicology poisoning overdose envenomation SCGH",
    source: {
      label: "SCGH WA Poisons Information Centre",
      status: "Source checked",
      url: "https://www.scgh.health.wa.gov.au/Our-Services/Poisons-Information-Centre",
      published: "2026",
      reviewed: "2026-09-27",
    },
  },
] as const;

export const CANONICAL_ACUTE_INPATIENT_SERVICES: readonly ServiceRecord[] =
  CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES.slice(0, 9);

export const WA_POISONS_CENTRE_SERVICE: ServiceRecord = CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES[9];

/**
 * Retrieve a canonical inpatient or poisons service record by its slug.
 */
export function getBundledCanonicalServiceRecord(slug: string): ServiceRecord | null {
  const normalized = slug.trim().toLowerCase();
  return CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES.find((record) => record.slug === normalized) ?? null;
}
