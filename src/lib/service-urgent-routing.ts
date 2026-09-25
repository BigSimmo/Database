import type { ServiceRecord, ServiceSearchMatch } from "@/lib/service-ranker";

export type ServiceUrgentIntent =
  | "emergency"
  | "camhs_crisis"
  | "regional_after_hours"
  | "regional_daytime"
  | "adult_metro_crisis"
  | "aboriginal_crisis"
  | "aod_urgent"
  | "family_violence"
  | "sexual_assault"
  | "suicide_aftercare"
  | "suicide_postvention";

const CRISIS = /\b(?:suicid\w*|crisis|acute|unsafe|self[- ]?harm|mental health emergency)\b/i;
const IMMEDIATE_DANGER =
  /\b(?:actively suicidal|immediate danger|life[- ]?threatening|severe injury|overdose|about to (?:kill|harm)|cannot keep (?:myself|them|him|her|the patient) safe|emergency (?:now|in progress)|strangl\w*|chok(?:ing|ed)?|can[’']?t breathe|cannot breathe)\b/i;
const CHILD_OR_YOUTH =
  /\b(?:child|teen(?:ager)?|adolescent|young person|(?:[0-9]|1[0-7])\s*[- ]?\s*(?:year|yr)s?[- ]?old)\b/i;
const REGIONAL_WA =
  /\b(?:regional|rural|remote|bunbury|albany|geraldton|kalgoorlie|karratha|broome|port hedland|esperance|great southern|pilbara|kimberley|south west|wheatbelt|mid west|goldfields|kununurra|busselton|carnarvon|northam|derby|newman|katanning|merredin|exmouth)\b/i;
// Keyword-only signal. A stated clock time is judged separately, by
// `detectClockTimeUrgency` below — a bare "pm" match here previously misclassified
// genuine business-hours times such as "2pm" as after-hours.
const AFTER_HOURS_KEYWORDS = /\b(?:after[- ]?hours|tonight|overnight|weekend|public holiday)\b/i;
const METRO_OR_PEEL = /\b(?:perth|metro(?:politan)?|peel|mandurah)\b/i;
const ADULT = /\b(?:adult|18\s*[- ]?\s*(?:year|yr)s?[- ]?old|[2-9][0-9]\s*[- ]?\s*(?:year|yr)s?[- ]?old)\b/i;
const AFTERCARE =
  /(?:\baftercare\b.*\bsuicid\w*\b|\bsuicid\w*\b.*\baftercare\b|\bdischarg\w*\b.*\b(?:suicide attempt|suicidal crisis)\b|\b(?:suicide attempt|suicidal crisis)\b.*\bdischarg\w*\b)/i;
const POSTVENTION =
  /(?:\bpostvention\b|\bbereav(?:ed|ement)\b.*\bsuicid\w*\b|\b(?:died|death|lost|loss)\b.*\bsuicid\w*\b|\bsuicid\w*\b.*\b(?:bereavement|death|died|loss)\b)/i;
const ABORIGINAL = /\b(?:aboriginal|torres strait islander|atsi|indigenous|first nations)\b/i;
const AOD_TERMS =
  /\b(?:alcohol|drink(?:ing)?|drunk|intoxicated|substance (?:use|abuse)|drugs?|ice|meth(?:amphetamine)?|opioid|overdose|detox(?:ification)?)\b/i;
// Requires a specific urgency signal, not just any help-seeking word — "alcohol
// counselling referral" is routine, not urgent, so a bare AOD term plus a generic
// word like "advice"/"support"/"counselling" is no longer enough on its own.
const AOD_URGENCY =
  /\b(?:crisis|urgent(?:ly)?|emergency|withdrawal|withdrawing|detox(?:ification)?|overdose|od|can[’']?t stop|seizure)\b/i;
const FAMILY_VIOLENCE_NAMED = /\b(?:domestic violence|family violence|intimate partner violence|dfv|fdv)\b/i;
const FAMILY_VIOLENCE_RELATION = "partner|husband|wife|boyfriend|girlfriend|ex[- ]?partner|ex";
const FAMILY_VIOLENCE_ACT =
  "hit(?:ting)?|hits|assault\\w*|abus\\w*|violent|violence|threat\\w*|control(?:ling)?|strangl\\w*|chok(?:ing|ed)";
// Symmetric: "partner hitting her" (relation, then act) and "abused by her partner"
// (act, then relation) must both match — a relation term can be named either before
// or after the description of what is happening.
const FAMILY_VIOLENCE_DESCRIBED = new RegExp(
  `\\b(?:${FAMILY_VIOLENCE_RELATION})\\b[\\s\\S]{0,40}\\b(?:${FAMILY_VIOLENCE_ACT})\\b|` +
    `\\b(?:${FAMILY_VIOLENCE_ACT})\\b[\\s\\S]{0,40}\\b(?:${FAMILY_VIOLENCE_RELATION})\\b`,
  "i",
);
const SEXUAL_ASSAULT = /\b(?:raped?|sexual(?:ly)?\s*assault(?:ed)?|molested|non[- ]?consensual)\b/i;

// WACHS regional clinics publish 8.30am-4.30pm weekday hours (see the SVC-REG-* records'
// own `hours.display`). A stated clock time counts as after-hours only outside that
// window — at or after 4.30pm, or before 8.30am — never from the bare presence of "pm".
const DAYTIME_START_MINUTE = 8 * 60 + 30; // 8:30am
const AFTER_HOURS_START_MINUTE = 16 * 60 + 30; // 4:30pm

const CLOCK_TIME_AMPM = /\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*([ap])\.?\s*m\.?\b/i;
// "HH:MM" 24-hour time — unambiguous, the colon can't mean anything else.
const CLOCK_TIME_24H_COLON = /\b([01][0-9]|2[0-3]):([0-5][0-9])\b/;
// Four-digit military time ("2230") is NOT matched bare — a bare four-digit number
// is a year, a postcode fragment, or a date component far more often than it is a
// time ("referral dated 14/03/2026" must not read as 20:26 and lose the daytime
// route). It only counts as a clock time when explicitly marked with "h"/"hrs"/
// "hours" ("2230h", "2230hrs", "2230 hours").
const CLOCK_TIME_24H_MILITARY = /\b([01][0-9]|2[0-3])([0-5][0-9])\s?(?:hours?|hrs?|h)\b/i;

function minutesToUrgency(totalMinutes: number): "after_hours" | "daytime" {
  return totalMinutes >= DAYTIME_START_MINUTE && totalMinutes < AFTER_HOURS_START_MINUTE ? "daytime" : "after_hours";
}

/**
 * Classifies a stated clock time (12-hour "11pm"/"4:45pm"/"7am", 24-hour "07:30", explicitly
 * marked military "2230hrs", or the words "noon"/"midday"/"midnight") against WACHS regional
 * clinic hours (8.30am to 4.30pm weekdays). A bare four-digit number ("2026", "6000") is never
 * read as a time — it is far more often a year or postcode — so military time requires an
 * "h"/"hrs"/"hours" marker. Returns "unknown" when the query names no clock time at all —
 * callers must not treat "unknown" as either daytime or after-hours.
 */
export function detectClockTimeUrgency(query: string): "after_hours" | "daytime" | "unknown" {
  const text = query.toLowerCase();

  if (/\bmidnight\b/.test(text)) return "after_hours";
  if (/\b(?:noon|midday)\b/.test(text)) return "daytime";

  const ampm = text.match(CLOCK_TIME_AMPM);
  if (ampm) {
    let hour = Number.parseInt(ampm[1], 10);
    const minute = ampm[2] ? Number.parseInt(ampm[2], 10) : 0;
    const meridiem = ampm[3];
    if (meridiem === "a") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return minutesToUrgency(hour * 60 + minute);
  }

  const colon = text.match(CLOCK_TIME_24H_COLON);
  if (colon) {
    const hour = Number.parseInt(colon[1], 10);
    const minute = Number.parseInt(colon[2], 10);
    return minutesToUrgency(hour * 60 + minute);
  }

  const military = text.match(CLOCK_TIME_24H_MILITARY);
  if (military) {
    const hour = Number.parseInt(military[1], 10);
    const minute = Number.parseInt(military[2], 10);
    return minutesToUrgency(hour * 60 + minute);
  }

  return "unknown";
}

/** True when the query's words or a stated clock time mark it as outside WACHS regional
 * clinic hours. A keyword ("weekend", "public holiday", ...) always wins outright, since
 * those describe the clinic being shut regardless of what time of day is also named. */
function queryIndicatesAfterHours(clean: string): boolean {
  if (AFTER_HOURS_KEYWORDS.test(clean)) return true;
  return detectClockTimeUrgency(clean) === "after_hours";
}

// WACHS regional adult mental health clinics only exist for these four regions
// (SVC-REG-001..004). Goldfields, Wheatbelt and Mid West (including the Gascoyne
// towns Carnarvon and Exmouth) have no matching canonical record, so a place name
// in one of those regions must fall back to existing behaviour rather than pin a
// clinic in the wrong part of the state.
const WA_REGIONAL_DAYTIME_PLACES: Record<string, string | undefined> = {
  bunbury: "South West",
  busselton: "South West",
  albany: "Great Southern",
  katanning: "Great Southern",
  karratha: "Pilbara",
  "port hedland": "Pilbara",
  newman: "Pilbara",
  broome: "Kimberley",
  kununurra: "Kimberley",
  derby: "Kimberley",
  geraldton: undefined,
  kalgoorlie: undefined,
  esperance: undefined,
  carnarvon: undefined,
  exmouth: undefined,
  northam: undefined,
  merredin: undefined,
};

/** The WACHS region name (matching a `SVC-REG-*` record's `catchments`) named by the
 * query, or undefined when no named place is recognised or its region has no
 * canonical regional record. */
function detectWaRegionForDaytime(clean: string): string | undefined {
  for (const [place, region] of Object.entries(WA_REGIONAL_DAYTIME_PLACES)) {
    if (!region) continue;
    if (new RegExp(`\\b${place}\\b`, "i").test(clean)) return region;
  }
  return undefined;
}

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
  if (ABORIGINAL.test(clean) && crisis) intents.push("aboriginal_crisis");
  if (FAMILY_VIOLENCE_NAMED.test(clean) || FAMILY_VIOLENCE_DESCRIBED.test(clean)) intents.push("family_violence");
  if (SEXUAL_ASSAULT.test(clean)) intents.push("sexual_assault");
  if (crisis && REGIONAL_WA.test(clean) && (queryIndicatesAfterHours(clean) || immediateDanger)) {
    intents.push("regional_after_hours");
  } else if (crisis && REGIONAL_WA.test(clean)) {
    // The place is named and the query is urgent, but nothing marks it as
    // after-hours — the system has no notion of what time it actually is, so
    // pin the region's own daytime clinic first and keep RuralLink pinned
    // as a second, always-available fallback rather than assume either way.
    const region = detectWaRegionForDaytime(clean);
    if (region) {
      intents.push("regional_daytime");
      intents.push("regional_after_hours");
    }
  }
  if (crisis && !childOrYouth && (ADULT.test(clean) || METRO_OR_PEEL.test(clean))) {
    intents.push("adult_metro_crisis");
  }
  if (AOD_TERMS.test(clean) && AOD_URGENCY.test(clean)) intents.push("aod_urgent");
  if (!immediateDanger && !postvention && AFTERCARE.test(clean)) intents.push("suicide_aftercare");
  if (postvention) intents.push("suicide_postvention");

  return intents;
}

const TITLE_MATCHERS: Record<ServiceUrgentIntent, RegExp[]> = {
  emergency: [/^Emergency services$/i],
  camhs_crisis: [/^CAMHS Crisis Connect$/i],
  regional_after_hours: [/^Rurallink$/i],
  // regional_daytime is resolved directly by catchment in rankServiceUrgentRoutes
  // (a single title/tag matcher pair can't tell one WACHS region's clinic from
  // another), so it carries no title/tag matchers here.
  regional_daytime: [],
  adult_metro_crisis: [/Mental Health Emergency Response Line|\bMHERL\b/i],
  aboriginal_crisis: [/^13\s*YARN$/i],
  aod_urgent: [/^Alcohol and Drug Support Line$/i],
  family_violence: [/^1800RESPECT$/i],
  sexual_assault: [/Sexual Assault Resource Centre/i, /\bSARC\b/i],
  suicide_aftercare: [/Aftercare/i],
  suicide_postvention: [/postvention/i, /StandBy/i, /support after suicide/i, /suicide bereavement/i],
};

const TAG_MATCHERS: Record<ServiceUrgentIntent, RegExp[]> = {
  emergency: [/Immediate life-threatening danger/i, /severe medical emergency/i],
  camhs_crisis: [/child.*crisis/i, /youth.*crisis/i],
  regional_after_hours: [/regional WA after hours/i, /regional.*mental-health crisis/i],
  regional_daytime: [],
  adult_metro_crisis: [/Adult mental-health crisis - Perth metro/i, /Mental-health crisis - Peel/i],
  aboriginal_crisis: [/Aboriginal\/Torres Strait Islander crisis support/i],
  aod_urgent: [/AOD advice/i],
  family_violence: [/Family and domestic violence/i],
  sexual_assault: [/Recent sexual assault/i, /Sexual violence support/i],
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

/** The active WACHS regional record whose `catchments` cover the given region name
 * (e.g. "Kimberley"), or undefined if none is active/usable. */
function findRegionalDaytimeUsable(records: readonly ServiceRecord[], region: string): ServiceRecord | undefined {
  return records.find(
    (service) =>
      serviceIsCurrentlyUsable(service, "regional_daytime") &&
      (service.catchments ?? []).some((catchment) => catchment.toLowerCase() === region.toLowerCase()),
  );
}

export function rankServiceUrgentRoutes(records: readonly ServiceRecord[], query: string): ServiceSearchMatch[] {
  const intents = detectServiceUrgentIntents(query);
  if (intents.length === 0) return [];

  const seen = new Set<string>();
  const matches: ServiceSearchMatch[] = [];

  intents.forEach((intent, index) => {
    const service =
      intent === "regional_daytime"
        ? (() => {
            const region = detectWaRegionForDaytime(query.trim());
            return region ? findRegionalDaytimeUsable(records, region) : undefined;
          })()
        : findFirstUsable(records, intent);
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
