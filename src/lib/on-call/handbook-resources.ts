export type HandbookResourceGroup = "contacts" | "referrals" | "resources" | "documentation";

export type HandbookResource = {
  readonly id: string;
  readonly group: HandbookResourceGroup;
  readonly title: string;
  readonly jurisdiction: string;
  readonly whyUseful: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly phone?: string;
  readonly accessNote?: string;
  /** Date this catalogue entry was checked against the linked official page. */
  readonly checkedOn: string;
};

/**
 * A small starting shelf of official WA resources.
 *
 * These records link to the publisher's page and say only why someone might
 * open it. They do not restate clinical instructions, turn a policy into local
 * protocol, or imply that a statewide page answers a site-specific question.
 * Local services add and maintain their own contacts and procedures in the
 * service handbook beside this catalogue.
 */
export const handbookResources: readonly HandbookResource[] = [
  {
    id: "wa-mherl",
    group: "contacts",
    title: "Mental Health Emergency Response Line",
    jurisdiction: "Perth metropolitan area and Peel",
    whyUseful: "Official contact page for the 24-hour mental health crisis telephone service and its regional scope.",
    sourceLabel: "East Metropolitan Health Service — MHERL",
    sourceUrl:
      "https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services/MHERL",
    phone: "1300 555 788",
    accessNote: "The official page also lists the Peel number and directs emergencies to 000.",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-poisons",
    group: "contacts",
    title: "WA Poisons Information Centre",
    jurisdiction: "Western Australia, South Australia and Northern Territory",
    whyUseful: "Official 24-hour contact page for clinicians and the public seeking specialist poisons information.",
    sourceLabel: "Sir Charles Gairdner Hospital — WA Poisons Information Centre",
    sourceUrl: "https://www.scgh.health.wa.gov.au/Our-Services/Service-directory/Poisons",
    phone: "13 11 26",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-rurallink",
    group: "contacts",
    title: "Rurallink psychiatric emergency contact",
    jurisdiction: "Regional and remote Western Australia",
    whyUseful: "Official WACHS contact listing for its after-hours psychiatric emergency assessment and advisory line.",
    sourceLabel: "WA Country Health Service — contact us",
    sourceUrl: "https://www.wacountry.health.wa.gov.au/About-us/Contact-us",
    phone: "1800 552 002",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-central-referral-service",
    group: "referrals",
    title: "Central Referral Service",
    jurisdiction: "WA public specialist outpatient services in CRS scope",
    whyUseful:
      "Official scope, submission routes and direct-referral exceptions for first specialist outpatient appointments.",
    sourceLabel: "WA Department of Health — Central Referral Service",
    sourceUrl: "https://www.health.wa.gov.au/Articles/A_E/About-the-Central-Referral-Service",
    accessNote: "Check the page's current scope and exceptions before choosing a referral route.",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-statewide-medicines-formulary",
    group: "resources",
    title: "WA Statewide Medicines Formulary",
    jurisdiction: "WA public health system",
    whyUseful: "Official entry point for the statewide formulary, restrictions, guidance and access information.",
    sourceLabel: "WA Department of Health — Statewide Medicines Formulary",
    sourceUrl: "https://www.health.wa.gov.au/Articles/U_Z/WA-Statewide-Medicines-Formulary",
    accessNote: "The formulary platform may require WA Health staff credentials.",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-mental-health-act-resources",
    group: "resources",
    title: "Mental Health Act 2014 resources",
    jurisdiction: "Western Australia",
    whyUseful: "Official Mental Health Commission starting point for Mental Health Act 2014 information and resources.",
    sourceLabel: "Mental Health Commission — Mental Health Act 2014 resources",
    sourceUrl: "https://www.mhc.wa.gov.au/about-us/our-approach/legislation/mental-health-act-2014-resources",
    accessNote: "Check the official material and your service's current procedures before use.",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-mental-health-act-forms",
    group: "documentation",
    title: "Mental Health Act 2014 forms",
    jurisdiction: "Western Australia",
    whyUseful: "Official Chief Psychiatrist page for Mental Health Act 2014 forms and accompanying information.",
    sourceLabel: "Chief Psychiatrist of Western Australia — Mental Health Act 2014 forms",
    sourceUrl: "https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/",
    accessNote:
      "Use the current official form. This index does not determine legal authority or replace service guidance.",
    checkedOn: "2026-09-23",
  },
  {
    id: "wa-policy-frameworks",
    group: "documentation",
    title: "WA Health policy frameworks",
    jurisdiction: "WA health entities",
    whyUseful: "Official index and search for current mandatory WA health system policy frameworks.",
    sourceLabel: "WA Department of Health — Policy Frameworks",
    sourceUrl: "https://www.health.wa.gov.au/About-us/Policy-frameworks",
    accessNote: "Use the source page to confirm the latest policy version and applicability.",
    checkedOn: "2026-09-23",
  },
  {
    id: "wachs-policy-library",
    group: "documentation",
    title: "WA Country Health Service policy library",
    jurisdiction: "WA Country Health Service",
    whyUseful: "Official WACHS policy library for checking current country-service documents and specialty lists.",
    sourceLabel: "WA Country Health Service — Policies",
    sourceUrl: "https://www.wacountry.health.wa.gov.au/About-us/Publications/Policies",
    checkedOn: "2026-09-23",
  },
] as const;

export const handbookResourceGroupLabels: Record<HandbookResourceGroup, string> = {
  contacts: "Useful contacts",
  referrals: "Referral routes",
  resources: "Clinical resources",
  documentation: "Policy and documentation",
};
