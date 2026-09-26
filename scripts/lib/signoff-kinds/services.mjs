/**
 * Sign-off kinds registered with npm run clinical:review. See ./index.mjs for the interface.
 *
 *   service   data/service-records-review.json  `entries`, one row per curated WA service record
 *             that no published site-content release carries yet. The records themselves are
 *             TypeScript data modules in src/lib/services-canonical-data/part-*.ts, so, like the
 *             `differential` kind, the review state lives in a JSON sidecar written only by
 *             npm run clinical:review, and `loadContext` imports the modules to read the text.
 *
 * WHICH RECORDS (ledger #3E42FH). The rows are the curated records that (a) are served as a
 * record of their own rather than merged into a legacy catalogue row, so every word the
 * Services page shows for them comes from the curated record and nothing else, and (b) were
 * added after the 2026-08-24 site-content freeze, so the only governance the site gives them
 * is the `unverified` label the bundled-catalogue stopgap pins (src/lib/site-content/
 * bundled-service-catalogue.ts). That is the 17 records PR #2814 added (part-03, part-04,
 * part-05) plus the two stand-alone records part-08 added (Legal Yarn, TIS National).
 * Curated records merged into a legacy row are left out on purpose: part of what the page
 * shows for them (cost, legacy tags and acuity) comes from data/services-snapshot.json, which
 * a pin over the curated record cannot cover. tests/signoff-services.test.ts derives this set
 * from the app's own catalogue and fails if the sidecar drifts from it.
 *
 * WHAT THE PIN COVERS: the review row's id PLUS the whole curated record for that id, exactly
 * as the module exports it: name, aliases, search keys, category, groups, tier, status and
 * status note, catchments, population, ages, best use, not-for, referral routes, contacts,
 * hours, website, verification and dates, intents, supersededBy, open issues, and every
 * source with its URL, dates and limitations. Every field the Services page renders is
 * derived from those, so an edit to any of them makes the sign-off stale.
 *
 * WHY A DYNAMIC IMPORT OF THE PART FILES: src/lib/service-governance.ts, which assembles the
 * catalogue, imports the parts through the `@/` alias that plain Node cannot resolve. The
 * part files themselves are pure data (`export default [...] as const`, no imports), so Node
 * 24 loads them directly by stripping the type assertion, as the differential loader does.
 *
 * Owner rule 2026-09-26: Indigenous content is never signed off. The contract's central guard
 * scans the attested content, which is the full record, so Aboriginal-specific services are
 * held out of the queue there; this module does not duplicate it.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SERVICE_REVIEW_PATH = "data/service-records-review.json";
const CANONICAL_DATA_DIRECTORY = ["src", "lib", "services-canonical-data"];

const REVIEW_METADATA_KEYS = Object.freeze(["status", "reviewedBy", "reviewedAt", "reviewedContentSha256"]);

const isPlainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const withoutMetadata = (record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !REVIEW_METADATA_KEYS.includes(key)));

function curatedService(context, id) {
  const services = context?.services;
  if (!isPlainRecord(services)) {
    throw new TypeError("A service sign-off needs the curated records (src/lib/services-canonical-data/part-*.ts).");
  }
  const service = services[id];
  if (!isPlainRecord(service)) {
    throw new Error(`Service ${id} has no curated record in src/lib/services-canonical-data.`);
  }
  return service;
}

/**
 * The acuity chip the Services page shows for a curated record: src/lib/service-governance.ts
 * `canonicalTags` maps the tier to one acuity flag, and src/lib/service-catalog-mapper.ts
 * `acuityLabel` names it. tests/signoff-services.test.ts compares this with the app's chips.
 */
export function shownAcuityFlag(tier) {
  if (tier === "A_immediate") return "crisis_high";
  if (tier === "B_common_referral") return "moderate";
  return "supportive";
}

const ACUITY_LABELS = Object.freeze({
  crisis_high: "Crisis / urgent",
  high: "High acuity",
  moderate: "Moderate acuity",
  supportive: "Supportive",
});

export const acuityLabel = (flag) => ACUITY_LABELS[flag] ?? String(flag).replace(/_/g, " ");

const AVAILABILITY_LABELS = Object.freeze({
  active: "Active",
  planned: "Planned - not open",
  temporarily_unavailable: "Temporarily unavailable",
  closed: "Closed",
  superseded: "Superseded",
  unknown: "Availability unverified",
});

const texts = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

/** Text that says the service is not an emergency or crisis service (or line). */
const NOT_CRISIS =
  /\bnot\s+(?:an?\s+)?(?:acute\s+)?(?:emergency|crisis)(?:\s*(?:\/|or|and)\s*(?:emergency|crisis))?\s+(service|line)\b/i;
/** Text recording that two sources, or two statements, disagree. */
const SOURCES_DISAGREE = /\b(?:differ|differs|disagree|disagrees|contradict\w*|conflict\w*|inconsistent)\b/i;
/** Text that rules out self-referral or a direct public intake. */
const NO_SELF_REFERRAL =
  /\b(?:not\s+(?:a\s+)?direct\s+public\s+intake|no\s+self[- ]referral|not\s+(?:a\s+)?self[- ]referral)\b/i;

/**
 * Places where a record's own text contradicts itself or what the page shows for it. Each is
 * a sentence for a WARNING line; an empty list means none was found. Deliberately literal:
 * a flag asks the reviewer to look (and to exclude the record from a batch), it decides
 * nothing.
 *
 * `acuityFlags` defaults to the chip the tier produces; pass a legacy record's own flags to
 * check one that is not curated.
 */
export function serviceContradictions(service, { acuityFlags } = {}) {
  if (!isPlainRecord(service)) return [];
  const warnings = [];
  const flags = acuityFlags ?? [shownAcuityFlag(service.tier)];
  const groups = texts(service.groups);
  const statements = [
    ...texts(service.notFor),
    service.bestUse,
    service.population,
    service.statusNote,
    ...texts(service.exclusions),
  ].filter((value, index, all) => typeof value === "string" && all.indexOf(value) === index);

  for (const statement of statements) {
    const match = NOT_CRISIS.exec(statement);
    if (!match) continue;
    const shownAsCrisis = flags.includes("crisis_high");
    const listedAsUrgent = match[1].toLowerCase() === "service" && groups.includes("urgent_crisis");
    if (shownAsCrisis || listedAsUrgent) {
      warnings.push(
        `It says "${statement}", but the site ${
          shownAsCrisis
            ? `shows it with the "${acuityLabel("crisis_high")}" chip`
            : "lists it among urgent crisis services"
        }. These cannot both be true.`,
      );
    }
  }

  for (const issue of texts(service.issues)) {
    if (SOURCES_DISAGREE.test(issue)) {
      warnings.push(`Its sources disagree, and the record chose one reading: "${issue}"`);
    }
  }

  const selfReferral = (service.routes ?? []).some((route) => route?.self_referral === true);
  const ruledOut = statements.find((statement) => NO_SELF_REFERRAL.test(statement));
  if (selfReferral && ruledOut) {
    warnings.push(`A referral route allows self-referral, but the record also says "${ruledOut}".`);
  }
  return warnings;
}

function routeText(route) {
  const selfReferral =
    route.self_referral === true
      ? "Self-referral: yes"
      : route.self_referral === false
        ? "Self-referral: no"
        : "Self-referral: not stated";
  const documents = texts(route.required_documents);
  return [route.summary, `    ${selfReferral}`, documents.length ? `    What to send: ${documents.join(", ")}` : ""]
    .filter(Boolean)
    .join("\n");
}

function sourceText(source) {
  return [
    `${source.title} (${source.id})`,
    `    ${source.issuer}, ${source.class}`,
    `    ${source.url}`,
    `    Source date: ${source.date}; read ${source.accessed}`,
    source.limitations ? `    Limits: ${source.limitations}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function hoursText(hours) {
  if (!isPlainRecord(hours)) return undefined;
  const checked = hours.verification_status === "verified" ? "verified" : "could not be verified";
  return `${hours.display}\n(Hours ${checked}; time zone ${hours.timezone})`;
}

export const kinds = {
  service: {
    noun: "Service",
    heading: "WA service records not yet published",
    path: SERVICE_REVIEW_PATH,
    collectionKey: "entries",
    optional: true,
    idField: "id",
    statuses: Object.freeze(["drafted", "reviewed"]),
    attested: (record, context) => ({ ...withoutMetadata(record), service: curatedService(context, record.id) }),
  },
};

export const display = {
  service(record, context) {
    const service = context?.services?.[record.id];
    if (!isPlainRecord(service)) {
      return [
        ["WARNING", `No curated record ${record.id} was found in src/lib/services-canonical-data. Do not sign this.`],
      ];
    }
    const warnings = serviceContradictions(service);
    const acuity = shownAcuityFlag(service.tier);
    const urgent = acuity === "crisis_high" || texts(service.groups).includes("urgent_crisis");
    return [
      ...warnings.map((warning) => [
        "WARNING",
        `${warning}\nExclude this record (--exclude ${record.id}) unless you are satisfied the text is right.`,
      ]),
      ["Service", `${service.name} (${service.id})`],
      [
        "On the site today",
        "Shown from the in-repository catalogue, labelled unverified (not clinically reviewed). Once you sign " +
          "it off, the Services pages count it as locally reviewed while they serve that catalogue. " +
          "Publishing it to the live database is a separate step.",
      ],
      ["Also known as", texts(service.aliases)],
      ["Category", service.category],
      [
        "Availability",
        [AVAILABILITY_LABELS[service.status] ?? service.status, service.statusNote]
          .filter((value, index, all) => value && all.indexOf(value) === index)
          .join(". "),
      ],
      [
        "Crisis / urgent",
        urgent
          ? `Yes. Acuity chip: "${acuityLabel(acuity)}"${
              texts(service.groups).includes("urgent_crisis") ? "; listed among urgent crisis services" : ""
            }.`
          : `No. Acuity chip: "${acuityLabel(acuity)}".`,
      ],
      ["What it offers", service.bestUse],
      ["Who it is for (eligibility)", service.population],
      ["Age groups", texts(service.ages)],
      ["Not for", texts(service.notFor)],
      ["Referral", (service.routes ?? []).map(routeText)],
      ["Contact numbers", (service.contacts ?? []).map((contact) => `${contact.label}: ${contact.value}`)],
      ["Hours", hoursText(service.hours)],
      ["Locations / catchment", [...texts(service.catchments), `Jurisdiction: ${service.jurisdiction}`]],
      ["Website", service.website],
      ["Cautions shown on the page (open issues)", texts(service.issues)],
      ["Service groups (filters)", texts(service.groups)],
      ["Quick routes it appears under", texts(service.intents)],
      ["Search keys", texts(service.match)],
      ["Replaced by", service.supersededBy ?? "Not replaced"],
      [
        "Verification",
        `${service.verification}; verified ${service.verified}; next review due ${service.review}` +
          (service.verification === "verified_current_core" ? ' (shown as "High confidence")' : ""),
      ],
      ["Sources (as the page links them)", (service.sources ?? []).map(sourceText)],
      ["Record file", context?.files?.[record.id]],
    ];
  },
};

/**
 * Every curated record, keyed by id, read straight from the part modules. Node 24 strips the
 * modules' type-only syntax; its "module type not specified" notice is noise to a clinician
 * reading the screen, so only that one is muted (the same pattern as the differential loader).
 */
export async function loadCuratedServices(root) {
  const directory = join(root, ...CANONICAL_DATA_DIRECTORY);
  const partFiles = readdirSync(directory)
    .filter((name) => /^part-\d+\.ts$/.test(name))
    .sort();
  const emitWarning = process.emitWarning;
  process.emitWarning = (warning, ...rest) => {
    const code = typeof rest[0] === "object" ? rest[0]?.code : rest[1];
    if (code !== "MODULE_TYPELESS_PACKAGE_JSON") emitWarning.call(process, warning, ...rest);
  };
  const services = {};
  const files = {};
  try {
    for (const name of partFiles) {
      const partModule = await import(pathToFileURL(join(directory, name)).href);
      if (!Array.isArray(partModule.default)) throw new Error(`${name} must export an array of service records.`);
      for (const service of partModule.default) {
        if (Object.hasOwn(services, service.id)) throw new Error(`Service ${service.id} appears in two part files.`);
        services[service.id] = service;
        files[service.id] = `${CANONICAL_DATA_DIRECTORY.join("/")}/${name}`;
      }
    }
  } finally {
    process.emitWarning = emitWarning;
  }
  return { services, files };
}

export async function loadContext(kind, root) {
  if (kind !== "service") return undefined;
  return loadCuratedServices(root);
}
