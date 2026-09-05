import type { ServiceRecord, ServiceSearchMatch } from "@/lib/service-ranker";

export type ServiceUrgentIntent =
  | "emergency"
  | "camhs_crisis"
  | "regional_after_hours"
  | "adult_metro_crisis"
  | "suicide_aftercare"
  | "suicide_postvention";

const CRISIS = /\b(?:suicid\w*|crisis|acute|unsafe|self[- ]?harm|mental health emergency)\b/i;
const IMMEDIATE_DANGER =
  /\b(?:actively suicidal|immediate danger|life[- ]?threatening|severe injury|overdose|about to (?:kill|harm)|cannot keep (?:myself|them|him|her|the patient) safe|emergency (?:now|in progress))\b/i;
const CHILD_OR_YOUTH =
  /\b(?:child|teen(?:ager)?|adolescent|young person|(?:[0-9]|1[0-7])\s*[- ]?\s*(?:year|yr)s?[- ]?old)\b/i;
const REGIONAL_WA =
  /\b(?:regional|rural|remote|bunbury|albany|geraldton|kalgoorlie|karratha|broome|port hedland|esperance|great southern|pilbara|kimberley|south west|wheatbelt|mid west|goldfields)\b/i;
const AFTER_HOURS = /\b(?:after[- ]?hours|tonight|overnight|weekend|public holiday)\b/i;
const METRO_OR_PEEL = /\b(?:perth|metro(?:politan)?|peel|mandurah)\b/i;
const ADULT = /\b(?:adult|18\s*[- ]?\s*(?:year|yr)s?[- ]?old|[2-9][0-9]\s*[- ]?\s*(?:year|yr)s?[- ]?old)\b/i;
const AFTERCARE =
  /(?:\baftercare\b.*\bsuicid\w*\b|\bsuicid\w*\b.*\baftercare\b|\bdischarg\w*\b.*\b(?:suicide attempt|suicidal crisis)\b|\b(?:suicide attempt|suicidal crisis)\b.*\bdischarg\w*\b)/i;
const POSTVENTION =
  /(?:\bpostvention\b|\bbereav(?:ed|ement)\b.*\bsuicid\w*\b|\b(?:died|death|lost|loss)\b.*\bsuicid\w*\b|\bsuicid\w*\b.*\b(?:bereavement|death|died|loss)\b)/i;

export function detectServiceUrgentIntents(query: string): ServiceUrgentIntent[] {
  const clean = query.trim();
  if (!clean) return [];

  const intents: ServiceUrgentIntent[] = [];
  const crisis = CRISIS.test(clean);
  const immediateDanger = IMMEDIATE_DANGER.test(clean);
  const postvention = POSTVENTION.test(clean);
  const childOrYouth = CHILD_OR_YOUTH.test(clean);

  if (immediateDanger) intents.push("emergency");
  if (crisis && childOrYouth) intents.push("camhs_crisis");
  if (crisis && REGIONAL_WA.test(clean) && (AFTER_HOURS.test(clean) || immediateDanger)) {
    intents.push("regional_after_hours");
  }
  if (crisis && !childOrYouth && (ADULT.test(clean) || METRO_OR_PEEL.test(clean))) {
    intents.push("adult_metro_crisis");
  }
  if (!immediateDanger && !postvention && AFTERCARE.test(clean)) intents.push("suicide_aftercare");
  if (postvention) intents.push("suicide_postvention");

  return intents;
}

const TITLE_MATCHERS: Record<ServiceUrgentIntent, RegExp[]> = {
  emergency: [/^Emergency services$/i],
  camhs_crisis: [/^CAMHS Crisis Connect$/i],
  regional_after_hours: [/^Rurallink$/i],
  adult_metro_crisis: [/Mental Health Emergency Response Line|\bMHERL\b/i],
  suicide_aftercare: [/Aftercare/i],
  suicide_postvention: [/postvention/i, /StandBy/i, /support after suicide/i, /suicide bereavement/i],
};

const TAG_MATCHERS: Record<ServiceUrgentIntent, RegExp[]> = {
  emergency: [/Immediate life-threatening danger/i, /severe medical emergency/i],
  camhs_crisis: [/child.*crisis/i, /youth.*crisis/i],
  regional_after_hours: [/regional WA after hours/i, /regional.*mental-health crisis/i],
  adult_metro_crisis: [/Adult mental-health crisis - Perth metro/i, /Mental-health crisis - Peel/i],
  suicide_aftercare: [/aftercare/i, /post-discharge.*suicid/i],
  suicide_postvention: [/postvention/i, /bereavement.*suicid/i, /support after suicide/i],
};

function serviceIsCurrentlyUsable(service: ServiceRecord, intent: ServiceUrgentIntent): boolean {
  const status = service.verification?.availabilityStatus;
  if (status && status !== "active") {
    // "unknown" means the record has not yet been re-verified — it is not the same signal as
    // a confirmed non-active status (planned/closed/superseded/temporarily_unavailable). Don't
    // let that verification gap silently drop an urgent CAMHS-crisis match; every other urgent
    // intent still requires a fully active, confirmed status.
    const isUnverifiedCamhsCrisis = status === "unknown" && intent === "camhs_crisis";
    if (!isUnverifiedCamhsCrisis) return false;
  }

  const labels = (service.statusChips ?? []).map((chip) => chip.label?.toLowerCase() ?? "");
  return !labels.some((label) =>
    /\b(?:planned|closed|superseded|temporarily unavailable|legacy unverified)\b/.test(label),
  );
}

function findFirstUsable(records: readonly ServiceRecord[], intent: ServiceUrgentIntent): ServiceRecord | undefined {
  const titleMatchers = TITLE_MATCHERS[intent];
  const tagMatchers = TAG_MATCHERS[intent];
  return records.find((service) => {
    if (!serviceIsCurrentlyUsable(service, intent)) return false;
    if (titleMatchers.some((pattern) => pattern.test(service.title))) return true;
    return (service.tags ?? []).some((tag) => tagMatchers.some((pattern) => pattern.test(tag)));
  });
}

export function rankServiceUrgentRoutes(records: readonly ServiceRecord[], query: string): ServiceSearchMatch[] {
  const intents = detectServiceUrgentIntents(query);
  if (intents.length === 0) return [];

  const seen = new Set<string>();
  const matches: ServiceSearchMatch[] = [];

  intents.forEach((intent, index) => {
    const service = findFirstUsable(records, intent);
    if (!service || seen.has(service.slug)) return;
    seen.add(service.slug);
    matches.push({
      service,
      score: 1_000_000 - index,
      reasons: ["urgent route", intent.replace(/_/g, " ")],
    });
  });

  return matches;
}
