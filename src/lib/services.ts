export type ServiceChipTone = "danger" | "info" | "warning" | "success" | "neutral";
export type ServiceCriterionTone = "meet" | "caution" | "reject";

export type ServiceStatusChip = {
  label?: string | null;
  tone?: ServiceChipTone | null;
};

export type ServiceContact = {
  label: string;
  value?: string | null;
  detail?: string | null;
  kind: "phone" | "email" | "web" | "text" | "unknown";
};

export type ServiceSummaryCard = {
  id: string;
  label?: string | null;
  title?: string | null;
  detail?: string | null;
};

export type ServiceInfoRow = {
  label: string;
  value?: string | null;
};

export type ServiceCriterion = {
  label: string;
  tone: ServiceCriterionTone;
};

export type ServiceVerification = {
  locallyVerified?: boolean | null;
  confidence?: "High" | "Medium" | "Low" | "Unknown" | null;
  notes?: string[] | null;
};

export type ServiceSource = {
  label?: string | null;
  status?: string | null;
  url?: string | null;
  published?: string | null;
  reviewed?: string | null;
  notes?: string[] | null;
};

export type ServiceRecord = {
  slug: string;
  title: string;
  subtitle?: string;
  statusChips?: ServiceStatusChip[];
  primaryContact?: ServiceContact;
  contacts?: ServiceContact[];
  route?: string;
  eligibility?: string;
  cost?: string;
  referral?: string;
  location?: string;
  summaryCards?: ServiceSummaryCard[];
  referralInfo?: ServiceInfoRow[];
  bestUse?: string;
  criteria?: ServiceCriterion[];
  verification?: ServiceVerification;
  tags?: string[];
  catchments?: string[];
  catalogueLabel?: string;
  navigatorQuery?: string;
  source?: ServiceSource;
};

export type ServiceSearchMatch = {
  service: ServiceRecord;
  score: number;
  reasons: string[];
};

export const serviceRecords: ServiceRecord[] = [
  {
    slug: "13yarn",
    title: "13YARN",
    subtitle: "Urgent contact, crisis response, or acute support pathway.",
    statusChips: [
      { label: "Crisis / urgent", tone: "danger" },
      { label: "Aboriginal and Torres Strait Islander", tone: "info" },
      { label: "Local confirmation", tone: "warning" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "13 92 76",
      detail: "Self phone referral",
      kind: "phone",
    },
    contacts: [
      {
        label: "Phone",
        value: "13 92 76",
        detail: "Available 24/7 across Australia",
        kind: "phone",
      },
      {
        label: "Website",
        value: "https://www.13yarn.org.au/",
        detail: "Official 13YARN public website",
        kind: "web",
      },
    ],
    route: "Self phone referral",
    eligibility: "Aboriginal and Torres Strait Islander callers",
    cost: "Free",
    referral: "Self referral by phone. Escalate emergency medical danger through emergency services.",
    location: "Statewide / national",
    summaryCards: [
      {
        id: "route",
        label: "Route",
        title: "Self phone referral",
        detail: "Call 13 92 76",
      },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Aboriginal and Torres Strait Islander callers",
        detail: "See details",
      },
      {
        id: "confirm",
        label: "Confirm",
        title: "Confirm before use",
        detail: "Hours not public",
      },
      {
        id: "cost",
        label: "Cost",
        title: "Free",
        detail: "No cost to access",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "Contact: 13 92 76\nSelf phone referral" },
      { label: "Phone", value: "13 92 76" },
      { label: "Email", value: "None listed" },
      { label: "Provider", value: "Aboriginal and Torres Strait Islander crisis support service referenced by WACHS" },
      { label: "Region", value: "Statewide / national" },
      { label: "Patient group", value: "Aboriginal and Torres Strait Islander people" },
      { label: "Hours", value: "Not publicly stated" },
      { label: "Cost / funding", value: "Free" },
    ],
    bestUse: "Culturally safe crisis phone support; escalate emergency danger elsewhere.",
    criteria: [
      { label: "Aboriginal and Torres Strait Islander support need", tone: "meet" },
      { label: "Crisis support pathway appropriate", tone: "meet" },
      { label: "Phone referral available", tone: "meet" },
      { label: "Emergency medical danger present", tone: "reject" },
      { label: "Hours not confirmed", tone: "caution" },
    ],
    verification: {
      locallyVerified: false,
      confidence: "Medium",
      notes: ["Verify locally before use", "Hours not public", "Source link requires local confirmation"],
    },
    tags: ["Regional WA", "Metro-wide", "crisis_high", "ATSI"],
    catchments: ["Statewide / national"],
    catalogueLabel: "Catalogue service",
    navigatorQuery: "13YARN crisis support referral 13 92 76",
    source: {
      label: "WACHS referenced service catalogue",
      status: "Local confirmation required",
      url: "https://www.13yarn.org.au/",
      reviewed: "Confirm locally before clinical use",
      notes: ["Source link requires local confirmation", "Use 000 where life is in danger"],
    },
  },
  {
    slug: "mental-health-emergency-response-line",
    title: "Mental Health Emergency Response Line",
    subtitle: "24-hour WA metropolitan and Peel mental health crisis phone triage.",
    statusChips: [
      { label: "Crisis / urgent", tone: "danger" },
      { label: "Phone triage", tone: "info" },
      { label: "WA metro / Peel", tone: "success" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "1300 555 788",
      detail: "Metro phone triage",
      kind: "phone",
    },
    contacts: [
      { label: "Metro phone", value: "1300 555 788", detail: "Perth metropolitan area", kind: "phone" },
      { label: "Peel phone", value: "1800 676 822", detail: "Peel region", kind: "phone" },
      {
        label: "Website",
        value: "https://www.mhc.wa.gov.au/getting-help/helplines/mental-health-emergency-response-line",
        detail: "Mental Health Commission helpline page",
        kind: "web",
      },
    ],
    route: "Phone triage",
    eligibility: "People in the Perth metropolitan area or Peel experiencing a mental health crisis",
    cost: "Phone service; call charges may apply",
    referral: "Call for triage. Emergency medical danger remains an emergency services pathway.",
    location: "Perth metropolitan area and Peel",
    summaryCards: [
      { id: "route", label: "Route", title: "Phone triage", detail: "Metro 1300 555 788; Peel 1800 676 822" },
      { id: "eligibility", label: "Eligibility", title: "Mental health crisis", detail: "Metro and Peel callers" },
      { id: "cost", label: "Cost", title: "Phone service", detail: "Call charges may apply" },
      { id: "confirm", label: "Availability", title: "24 hours", detail: "Not an emergency service" },
    ],
    referralInfo: [
      { label: "Primary route", value: "Metro phone triage: 1300 555 788\nPeel phone triage: 1800 676 822" },
      { label: "Region", value: "Perth metropolitan area and Peel" },
      {
        label: "Patient group",
        value: "People experiencing a mental health crisis; families, carers, public, health and welfare professionals",
      },
      { label: "Hours", value: "24-hour telephone service" },
      { label: "Cost / funding", value: "Phone service; call charges may apply" },
    ],
    bestUse: "Urgent mental health triage where immediate emergency medical response is not the primary need.",
    criteria: [
      { label: "Urgent mental health support required", tone: "meet" },
      { label: "Able to engage by phone", tone: "meet" },
      { label: "Immediate medical danger", tone: "reject" },
      { label: "Metro or Peel catchment fit required", tone: "caution" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: [
        "Official MHC page lists metro and Peel numbers",
        "MHERL is 24-hour",
        "MHERL is not an emergency service",
      ],
    },
    tags: ["Crisis", "Mental health", "Phone triage", "WA metro", "Peel"],
    catchments: ["Perth metropolitan area", "Peel"],
    catalogueLabel: "Source-backed service",
    navigatorQuery: "mental health emergency response line phone triage",
    source: {
      label: "WA Mental Health Commission helpline page",
      status: "Source checked",
      url: "https://www.mhc.wa.gov.au/getting-help/helplines/mental-health-emergency-response-line",
      reviewed: "Official public helpline page checked July 2026",
      notes: ["Use 000 for emergencies"],
    },
  },
  {
    slug: "rurallink",
    title: "Rurallink",
    subtitle: "After-hours rural and regional mental health phone support pathway.",
    statusChips: [
      { label: "After hours", tone: "info" },
      { label: "Regional", tone: "success" },
      { label: "WA", tone: "success" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "1800 552 002",
      detail: "Regional phone support",
      kind: "phone",
    },
    contacts: [
      { label: "Phone", value: "1800 552 002", detail: "After-hours rural and regional support", kind: "phone" },
      {
        label: "Website",
        value: "https://www.mhc.wa.gov.au/getting-help/helplines/mental-health-emergency-response-line",
        detail: "Mental Health Commission helpline page",
        kind: "web",
      },
    ],
    route: "Phone support",
    eligibility: "Rural or regional callers needing mental health advice after hours",
    cost: "Free phone support; call charges may apply",
    referral: "Phone contact. Check local escalation pathways for acute risk.",
    location: "Regional and remote Western Australia",
    summaryCards: [
      { id: "route", label: "Route", title: "Phone support", detail: "Call 1800 552 002" },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Regional WA callers",
        detail: "After-hours mental health support",
      },
      { id: "cost", label: "Cost", title: "Phone service", detail: "Call charges may apply" },
      {
        id: "confirm",
        label: "Availability",
        title: "After hours",
        detail: "Weeknights, weekends, public holidays",
      },
    ],
    referralInfo: [
      { label: "Primary route", value: "Phone support: 1800 552 002" },
      { label: "Region", value: "Regional and remote Western Australia" },
      { label: "Patient group", value: "Rural or regional callers" },
      { label: "Hours", value: "4.30pm to 8.30am weeknights; 24 hours weekends and public holidays" },
      { label: "Cost / funding", value: "Free phone support; call charges may apply" },
    ],
    bestUse: "After-hours rural or regional mental health advice when local services are closed.",
    criteria: [
      { label: "Rural or regional access need", tone: "meet" },
      { label: "After-hours mental health support", tone: "meet" },
      { label: "Local emergency response needed", tone: "reject" },
      { label: "Use daytime local team where available", tone: "caution" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: [
        "Official MHC page lists 1800 552 002",
        "Regional and remote WA after-hours coverage",
        "Hours listed on public source",
      ],
    },
    tags: ["Regional WA", "Mental health", "After hours"],
    catchments: ["Regional and remote WA"],
    catalogueLabel: "Source-backed service",
    navigatorQuery: "Rurallink regional mental health support 1800 552 002",
    source: {
      label: "WA Mental Health Commission helpline page",
      status: "Source checked",
      url: "https://www.mhc.wa.gov.au/getting-help/helplines/mental-health-emergency-response-line",
      reviewed: "Official public helpline page checked July 2026",
      notes: ["Use 000 for emergencies"],
    },
  },
  {
    slug: "head-to-health",
    title: "Medicare Mental Health",
    subtitle: "Free national phone navigation and connection to mental health support.",
    statusChips: [
      { label: "Navigation", tone: "info" },
      { label: "Non-urgent", tone: "neutral" },
      { label: "National", tone: "success" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "1800 595 212",
      detail: "National phone service",
      kind: "phone",
    },
    contacts: [
      {
        label: "Phone",
        value: "1800 595 212",
        detail: "Weekdays 8.30am-5pm, excluding public holidays",
        kind: "phone",
      },
      {
        label: "Website",
        value: "https://www.medicarementalhealth.gov.au/",
        detail: "Official Medicare Mental Health website",
        kind: "web",
      },
    ],
    route: "Phone intake or web service finder",
    eligibility: "People seeking mental health service navigation or intake support",
    cost: "Free",
    referral: "Self contact by phone or web. Use crisis pathways for acute safety risk.",
    location: "National / local service finder",
    summaryCards: [
      { id: "route", label: "Route", title: "Phone or web", detail: "Call 1800 595 212 or browse services" },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Everyone welcome",
        detail: "No referral or mental health plan needed",
      },
      { id: "cost", label: "Cost", title: "Free", detail: "Australian Government funded" },
      { id: "confirm", label: "Hours", title: "Weekdays", detail: "8.30am-5pm, excluding public holidays" },
    ],
    referralInfo: [
      { label: "Primary route", value: "Phone intake: 1800 595 212" },
      { label: "Website", value: "https://www.medicarementalhealth.gov.au/" },
      { label: "Region", value: "National / local service finder" },
      { label: "Patient group", value: "People seeking mental health service navigation" },
      { label: "Hours", value: "Weekdays 8.30am-5pm, excluding public holidays" },
      { label: "Cost / funding", value: "Free" },
    ],
    bestUse: "Navigation and intake when the need is important but not an immediate crisis response.",
    criteria: [
      { label: "Needs service navigation", tone: "meet" },
      { label: "Non-immediate safety risk", tone: "meet" },
      { label: "Crisis or emergency danger", tone: "reject" },
      { label: "After-hours support may need another pathway", tone: "caution" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: [
        "Official Medicare Mental Health site lists 1800 595 212",
        "Free service",
        "No referral or Mental Health Treatment Plan needed",
      ],
    },
    tags: ["Navigation", "Mental health", "Intake"],
    catchments: ["National / local finder"],
    catalogueLabel: "Source-backed service",
    navigatorQuery: "Medicare Mental Health mental health service navigation 1800 595 212",
    source: {
      label: "Medicare Mental Health official website",
      status: "Source checked",
      url: "https://www.medicarementalhealth.gov.au/",
      reviewed: "Official public website checked July 2026",
      notes: ["Head to Health redirects to Medicare Mental Health"],
    },
  },
  {
    slug: "wachs-aboriginal-mental-health",
    title: "State-wide Specialist Aboriginal Mental Health Service",
    subtitle: "Great Southern WACHS service combining cultural and clinical mental health expertise.",
    statusChips: [
      { label: "Aboriginal and Torres Strait Islander", tone: "info" },
      { label: "Regional WA", tone: "success" },
      { label: "Local confirmation", tone: "warning" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "(08) 9892 2440",
      detail: "Albany mental health team contact",
      kind: "phone",
    },
    contacts: [
      { label: "Albany phone", value: "(08) 9892 2440", detail: "Great Southern contact team", kind: "phone" },
      {
        label: "Albany email",
        value: "gs.cmh@health.wa.gov.au",
        detail: "Great Southern community mental health contact",
        kind: "email",
      },
      {
        label: "Katanning phone",
        value: "(08) 9821 6341",
        detail: "Great Southern contact team",
        kind: "phone",
      },
      {
        label: "Website",
        value:
          "https://www.wacountry.health.wa.gov.au/Our-services/Great-Southern/Great-Southern-health-services/Great-Southern-mental-health-services/State-wide-Specialist-Aboriginal-Mental-Health-Service",
        detail: "WACHS public service page",
        kind: "web",
      },
    ],
    route: "Contact Great Southern mental health teams",
    eligibility: "Aboriginal people in the Great Southern experiencing mental health issues",
    cost: "Free",
    referral:
      "Contact the Great Southern teams. Confirm referral process, catchment, and current availability before clinical use.",
    location: "Great Southern, Western Australia",
    summaryCards: [
      { id: "route", label: "Route", title: "Team contact", detail: "Albany or Katanning contacts listed" },
      {
        id: "eligibility",
        label: "Eligibility",
        title: "Aboriginal people",
        detail: "Great Southern mental health support",
      },
      { id: "cost", label: "Cost", title: "Free", detail: "WA Country Health Service" },
      { id: "confirm", label: "Confirm", title: "Referral process", detail: "Check current local pathway" },
    ],
    referralInfo: [
      {
        label: "Primary route",
        value: "Albany: (08) 9892 2440 / gs.cmh@health.wa.gov.au\nKatanning: (08) 9821 6341",
      },
      { label: "Albany phone", value: "(08) 9892 2440" },
      { label: "Albany email", value: "gs.cmh@health.wa.gov.au" },
      { label: "Katanning phone", value: "(08) 9821 6341" },
      { label: "Provider", value: "WA Country Health Service" },
      { label: "Region", value: "Great Southern, Western Australia" },
      { label: "Patient group", value: "Aboriginal people experiencing mental health issues" },
      { label: "Hours", value: "Confirm locally before use" },
      { label: "Cost / funding", value: "Free" },
    ],
    bestUse:
      "Culturally secure Great Southern mental health support where the local referral pathway can be confirmed.",
    criteria: [
      { label: "Aboriginal mental health support need", tone: "meet" },
      { label: "Great Southern pathway appropriate", tone: "meet" },
      { label: "Team contact available", tone: "meet" },
      { label: "Immediate medical danger present", tone: "reject" },
      { label: "Referral process and hours need local confirmation", tone: "caution" },
    ],
    verification: {
      locallyVerified: false,
      confidence: "Medium",
      notes: [
        "Official WACHS page lists Great Southern contacts",
        "Confirm referral process and hours locally",
        "Use crisis helplines or 000 for after-hours immediate risk",
      ],
    },
    tags: ["Great Southern", "WA regional", "community", "referral_support", "ATSI"],
    catchments: ["Great Southern WA"],
    catalogueLabel: "Source-backed service",
    navigatorQuery: "WACHS State-wide Specialist Aboriginal Mental Health Service Albany Katanning referral",
    source: {
      label: "WACHS official service page",
      status: "Local confirmation required",
      url: "https://www.wacountry.health.wa.gov.au/Our-services/Great-Southern/Great-Southern-health-services/Great-Southern-mental-health-services/State-wide-Specialist-Aboriginal-Mental-Health-Service",
      reviewed: "Confirm locally before clinical use",
      notes: ["Public page lists contacts but not full referral criteria or hours"],
    },
  },
];

export function getServiceRecord(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  return serviceRecords.find((service) => service.slug === normalizedSlug) ?? null;
}

export function serviceStaticParams() {
  return serviceRecords.map((service) => ({ slug: service.slug }));
}

export function defaultServiceSlug() {
  return serviceRecords[0]?.slug ?? null;
}

export function serviceNavigatorQuery(service: ServiceRecord) {
  return (
    [service.navigatorQuery, service.title, service.primaryContact?.value, service.subtitle].find((value) =>
      value?.trim(),
    ) ?? service.slug
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function serviceRecordSearchParts(service: ServiceRecord) {
  return [
    service.title,
    service.slug,
    service.subtitle,
    service.route,
    service.eligibility,
    service.cost,
    service.referral,
    service.location,
    service.bestUse,
    service.catalogueLabel,
    service.navigatorQuery,
    service.primaryContact?.value,
    service.primaryContact?.detail,
    service.source?.label,
    service.source?.status,
    service.source?.reviewed,
    ...(service.tags ?? []),
    ...(service.catchments ?? []),
    ...(service.statusChips ?? []).flatMap((chip) => [chip.label, chip.tone]),
    ...(service.contacts ?? []).flatMap((contact) => [contact.label, contact.value, contact.detail, contact.kind]),
    ...(service.summaryCards ?? []).flatMap((card) => [card.label, card.title, card.detail]),
    ...(service.referralInfo ?? []).flatMap((row) => [row.label, row.value]),
    ...(service.criteria ?? []).flatMap((criterion) => [criterion.label, criterion.tone]),
    ...(service.verification?.notes ?? []),
    ...(service.source?.notes ?? []),
    "service",
    "services",
    "source record",
    "pathway",
  ].filter((value): value is string => Boolean(value?.trim()));
}

export function serviceRecordSearchText(service: ServiceRecord) {
  return normalizeSearchText(serviceRecordSearchParts(service).join(" "));
}

export function searchServiceRecords(query: string, limit = serviceRecords.length): ServiceSearchMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const terms = Array.from(new Set(normalizedQuery.split(/\s+/).filter((term) => term.length > 1)));
  const broadServicesQuery = terms.some((term) => ["service", "services", "pathway", "pathways"].includes(term));

  return serviceRecords
    .map((service) => {
      const title = normalizeSearchText(service.title);
      const slug = normalizeSearchText(service.slug);
      const contact = normalizeSearchText(service.primaryContact?.value ?? "");
      const tags = normalizeSearchText([...(service.tags ?? []), ...(service.catchments ?? [])].join(" "));
      const text = serviceRecordSearchText(service);
      const compactText = text.replace(/\s+/g, "");
      const matchedTerms = terms.filter((term) => text.includes(term));
      const titleMatches = terms.filter((term) => title.includes(term) || slug.includes(term));
      const contactMatches = terms.filter((term) => contact.includes(term));
      const tagMatches = terms.filter((term) => tags.includes(term));
      const compactContactMatch = compactQuery.length >= 4 && compactText.includes(compactQuery);

      let score = 0;
      score += titleMatches.length * 6;
      score += contactMatches.length * 5;
      if (compactContactMatch) score += 5;
      score += tagMatches.length * 3;
      score += matchedTerms.length * 2;
      if (broadServicesQuery) score += 1;
      if (normalizedQuery && text.includes(normalizedQuery)) score += 4;

      const reasons = [
        titleMatches.length ? "title" : "",
        contactMatches.length || compactContactMatch ? "contact" : "",
        tagMatches.length ? "tags" : "",
        matchedTerms.length ? "record fields" : "",
        broadServicesQuery ? "services catalogue" : "",
      ].filter(Boolean);

      return { service, score, reasons };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.service.title.localeCompare(right.service.title))
    .slice(0, limit);
}
