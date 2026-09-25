import { createHash } from "node:crypto";

import { publicReviewerAttributionProblem } from "./therapy-review-contract.mjs";

/**
 * The contract behind `npm run clinical:review`: how the clinical owner attests one
 * clinical record, and how a later edit to that record is caught.
 *
 * Three kinds of record carry a clinician sign-off:
 *
 *   form       data/forms-content-review.json  (one row per WA MHA 2014 form)
 *   section    data/mha-2014-sections.json     (one plain-English Act-section summary)
 *   timeframe  data/mha-timeframes.json        (one quoted statutory duration; the file
 *                                               arrives with the MHA timeline work, and
 *                                               every caller treats it as optional)
 *
 * A sign-off is four fields: `status: "reviewed"`, `reviewedBy`, `reviewedAt` and
 * `reviewedContentSha256`. The last is the pin. It is a SHA-256 over the canonical JSON
 * of exactly the content the owner attested, so an edit to that content after sign-off
 * makes `reviewProblems` report "content changed since sign-off" and the `--check` gates
 * turn red, forcing re-review rather than letting a sign-off vouch for text nobody signed.
 *
 * What the pin covers, per kind:
 *
 *   form       the review row (code, sections, contextualSections, basis, and any other
 *              non-review field) PLUS the form's operational guidance in
 *              data/forms-catalog.json -- the fields in FORM_ATTESTED_CATALOG_FIELDS, and
 *              from `sourceFacts` only `timings` and `sectionCue`. Search-index metadata
 *              (aliases, searchTerms, indexedTerms, indexedClock, riskLevel, ids) and PDF
 *              file metadata are deliberately outside it: the owner does not attest them,
 *              and pinning them would force a clinical re-review for a search tweak. The
 *              catalogue's `actSections` summaries are attested separately as `section`.
 *   section    every non-review field of the entry: section, title, summary and
 *              sourceTextSha256 (so re-pointing an attested summary at amended Act text
 *              without rewriting it also breaks the pin).
 *   timeframe  every non-review field of the entry: id, formCodes, trigger, section,
 *              quote, duration and anchor.
 *
 * The runtime rule is unchanged: `formContentReviewStatus` in src/lib/form-catalog.ts
 * still needs status + reviewedBy + reviewedAt. The pin is enforced by the offline
 * `--check` scripts and the unit suite, never at render time.
 */

export { publicReviewerAttributionProblem };

/** Review metadata. Everything else in a record is content, and content is pinned. */
export const REVIEW_METADATA_KEYS = Object.freeze(["status", "reviewedBy", "reviewedAt", "reviewedContentSha256"]);
const ATTESTATION_KEYS = Object.freeze(["reviewedBy", "reviewedAt", "reviewedContentSha256"]);

/** Highest consequence first: the clocks where a wrong reading changes lawful detention. */
export const RECOMMENDED_FORM_ORDER = Object.freeze(["3C", "10B", "10E", "11B", "11E", "6C"]);

/** Operational guidance in data/forms-catalog.json that a form sign-off attests. */
export const FORM_ATTESTED_CATALOG_FIELDS = Object.freeze([
  "name",
  "purpose",
  "maker",
  "involved",
  "threshold",
  "clock",
  "destination",
  "authorises",
  "doesNotAuthorise",
  "boundaries",
  "before",
  "parallel",
  "after",
  "copies",
  "documentationStem",
  "traps",
  "safetyPearl",
  "legalNote",
  "practicePearls",
  "preUseChecks",
  "priorityFacts",
  "sourceFacts",
]);
const FORM_ATTESTED_SOURCE_FACTS = Object.freeze(["timings", "sectionCue"]);

/**
 * The three questions every sign-off asks, for every kind, one record at a time (owner-approved
 * wording). Any answer other than yes leaves the record unsigned.
 */
export const SIGN_OFF_QUESTIONS = Object.freeze([
  Object.freeze({
    key: "wordingMatchesSource",
    label: "Wording",
    question: "The wording matches its source.",
  }),
  Object.freeze({
    key: "clinicalMeaningCorrect",
    label: "Clinical meaning",
    question: "The clinical meaning is correct.",
  }),
  Object.freeze({
    key: "safeToShowAsReviewed",
    label: "Safe to show",
    question: "It is safe to show this as reviewed.",
  }),
]);

const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256 = /^[a-f0-9]{64}$/;

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

const normalizeCode = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function pick(source, keys) {
  if (!isPlainRecord(source)) return source;
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

/**
 * The same UTC timestamp rule `npm run therapy:review` enforces (its helper is not
 * exported, and the therapy contract is not ours to change): a real UTC ISO instant,
 * never date-only, never an offset, never in the future.
 */
function utcTimestampProblem(value, now) {
  if (typeof value !== "string" || !UTC_ISO_TIMESTAMP.test(value)) {
    return "reviewedAt must be a UTC ISO timestamp (YYYY-MM-DDTHH:mm:ss[.sss]Z).";
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "reviewedAt must be a real UTC calendar timestamp.";
  const normalized = value.includes(".") ? value : value.replace(/Z$/, ".000Z");
  if (new Date(milliseconds).toISOString() !== normalized) return "reviewedAt must be a real UTC calendar timestamp.";
  if (milliseconds > now.getTime()) return "reviewedAt must not be in the future.";
  return null;
}

/** A content-only digest: any change to a non-review field changes it. */
export function reviewedContentSha256(record) {
  if (!isPlainRecord(record)) throw new TypeError("Reviewed content must be an object.");
  const content = Object.fromEntries(Object.entries(record).filter(([key]) => !REVIEW_METADATA_KEYS.includes(key)));
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(content)))
    .digest("hex");
}

function catalogForms(catalog) {
  if (Array.isArray(catalog)) return catalog;
  if (isPlainRecord(catalog) && Array.isArray(catalog.forms)) return catalog.forms;
  throw new TypeError("A form sign-off needs the forms catalogue (data/forms-catalog.json).");
}

const withoutMetadata = (record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !REVIEW_METADATA_KEYS.includes(key)));

export const recordKinds = Object.freeze({
  form: Object.freeze({
    kind: "form",
    noun: "Form",
    heading: "Forms",
    path: "data/forms-content-review.json",
    collectionKey: "forms",
    idField: "code",
    statuses: Object.freeze(["drafted", "reviewed"]),
    checklist: SIGN_OFF_QUESTIONS,
    attested(record, context) {
      const code = normalizeCode(record.code);
      const entry = catalogForms(context?.catalog).find((form) => normalizeCode(form?.form) === code);
      if (!entry) throw new Error(`Form ${record.code} has no entry in data/forms-catalog.json.`);
      const catalog = pick(entry, FORM_ATTESTED_CATALOG_FIELDS);
      if (isPlainRecord(catalog.sourceFacts))
        catalog.sourceFacts = pick(catalog.sourceFacts, FORM_ATTESTED_SOURCE_FACTS);
      return { ...withoutMetadata(record), catalog };
    },
  }),
  section: Object.freeze({
    kind: "section",
    noun: "Section",
    heading: "Act sections",
    path: "data/mha-2014-sections.json",
    collectionKey: "sections",
    idField: "section",
    statuses: Object.freeze(["pending", "drafted", "reviewed"]),
    checklist: SIGN_OFF_QUESTIONS,
    attested: (record) => withoutMetadata(record),
  }),
  timeframe: Object.freeze({
    kind: "timeframe",
    noun: "Timeframe",
    heading: "Timeframes",
    path: "data/mha-timeframes.json",
    collectionKey: "timeframes",
    idField: "id",
    optional: true,
    statuses: Object.freeze(["drafted", "reviewed"]),
    checklist: SIGN_OFF_QUESTIONS,
    attested: (record) => withoutMetadata(record),
  }),
});

function resolveKind(kind) {
  const resolved = typeof kind === "string" ? recordKinds[kind] : kind;
  if (!resolved || !recordKinds[resolved.kind]) {
    throw new Error(`Unknown record kind: ${String(kind)}. Use one of: ${Object.keys(recordKinds).join(", ")}.`);
  }
  return resolved;
}

export const recordId = (record, kind) => String(record?.[resolveKind(kind).idField] ?? "").trim();
export const sameRecordId = (left, right) => normalizeCode(left) === normalizeCode(right);

/** The records inside a kind's data file. Timeframes may be a bare array or `{ timeframes }`. */
export function collectionOf(kind, document) {
  const resolved = resolveKind(kind);
  const records = Array.isArray(document) ? document : document?.[resolved.collectionKey];
  if (!Array.isArray(records)) {
    throw new Error(`${resolved.path} must hold a "${resolved.collectionKey}" array.`);
  }
  return records;
}

/** Exactly what a sign-off of this record attests (and therefore what the pin covers). */
export function attestedContent(record, kind, context = {}) {
  if (!isPlainRecord(record)) throw new TypeError("A clinical record must be an object.");
  return resolveKind(kind).attested(record, context);
}

export function recordContentSha256(record, kind, context = {}) {
  return reviewedContentSha256(attestedContent(record, kind, context));
}

/** `unsigned` (not reviewed, or no pin), `current`, or `stale` (edited since sign-off). */
export function recordPinState(record, kind, context = {}) {
  if (record?.status !== "reviewed" || typeof record.reviewedContentSha256 !== "string") return "unsigned";
  try {
    return recordContentSha256(record, kind, context) === record.reviewedContentSha256 ? "current" : "stale";
  } catch {
    return "stale";
  }
}

/** Every sign-off problem in one kind's records, without mutating them. */
export function reviewProblems(records, kind, { now = new Date(), ...context } = {}) {
  const resolved = resolveKind(kind);
  if (!Array.isArray(records)) return [`${resolved.path}: ${resolved.collectionKey} must be an array.`];
  const problems = [];
  const seen = new Set();

  for (const [index, record] of records.entries()) {
    if (!isPlainRecord(record)) {
      problems.push(`${resolved.noun} record[${index}] must be an object.`);
      continue;
    }
    const id = recordId(record, resolved);
    const label = `${resolved.noun} ${id || `record[${index}]`}`;
    if (!id) problems.push(`${label}: ${resolved.idField} must be a non-empty string.`);
    else if (seen.has(normalizeCode(id))) problems.push(`${label}: appears more than once.`);
    seen.add(normalizeCode(id));

    if (!resolved.statuses.includes(record.status)) {
      problems.push(`${label}: status must be one of ${resolved.statuses.join(", ")}.`);
      continue;
    }
    if (record.status !== "reviewed") {
      for (const key of ATTESTATION_KEYS) {
        if (record[key] !== undefined && record[key] !== null) {
          problems.push(
            `${label}: ${record.status} requires ${key} to be null or absent; a partial attestation is not a sign-off.`,
          );
        }
      }
      continue;
    }

    const attributionProblem = publicReviewerAttributionProblem(record.reviewedBy);
    if (attributionProblem) problems.push(`${label}: ${attributionProblem}`);
    const timestampProblem = utcTimestampProblem(record.reviewedAt, now);
    if (timestampProblem) problems.push(`${label}: ${timestampProblem}`);

    if (typeof record.reviewedContentSha256 !== "string" || !SHA256.test(record.reviewedContentSha256)) {
      problems.push(
        `${label}: reviewed requires a lowercase reviewedContentSha256, the content pin written by npm run clinical:review.`,
      );
      continue;
    }
    let expected;
    try {
      expected = recordContentSha256(record, resolved, context);
    } catch (error) {
      problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (expected !== record.reviewedContentSha256) {
      problems.push(
        `${label}: content changed since sign-off. The attested text was edited after it was signed; ` +
          `re-review it with npm run clinical:review.`,
      );
    }
  }
  return problems;
}

/** A record may be signed when it is drafted, or when its earlier sign-off has gone stale. */
export function signOffEligibilityProblem(record, kind, context = {}) {
  const resolved = resolveKind(kind);
  if (record?.status === "drafted") return null;
  if (record?.status === "reviewed" && recordPinState(record, resolved, context) === "stale") return null;
  if (record?.status === "reviewed") {
    return `${resolved.noun} ${recordId(record, resolved)} is already signed off and unchanged since; nothing to do.`;
  }
  return `Only a drafted ${resolved.noun.toLowerCase()} can be signed off; ${resolved.noun} ${recordId(record, resolved)} is ${String(record?.status)}.`;
}

/** The owner confirms one sign-off by typing that record's own code (for example 3C, or 26). */
export function clinicalReviewConfirmation(kind, record) {
  return recordId(record, kind);
}

/** Records still to sign, in walk order: drafted ones, plus signed ones edited since sign-off. */
export function signOffQueue(kind, records, context = {}) {
  const resolved = resolveKind(kind);
  const waiting = records.filter(
    (record) =>
      record?.status === "drafted" ||
      (record?.status === "reviewed" && recordPinState(record, resolved, context) === "stale"),
  );
  if (resolved.kind !== "form") return waiting.map((record) => recordId(record, resolved));
  // Forms: the highest-consequence clocks first, then the rest in catalogue order.
  let catalogOrder = [];
  try {
    catalogOrder = catalogForms(context.catalog).map((entry) => normalizeCode(entry?.form));
  } catch {
    // Without a catalogue, fall back to the review file's own order.
  }
  const rank = (id) => {
    const recommended = RECOMMENDED_FORM_ORDER.findIndex((code) => sameRecordId(code, id));
    if (recommended !== -1) return recommended;
    const position = catalogOrder.indexOf(normalizeCode(id));
    return RECOMMENDED_FORM_ORDER.length + (position === -1 ? catalogOrder.length : position);
  };
  return waiting
    .map((record, index) => ({ id: recordId(record, resolved), index }))
    .sort((left, right) => rank(left.id) - rank(right.id) || left.index - right.index)
    .map(({ id }) => id);
}

/** Build the signed record in memory. Throws rather than return anything short of valid. */
export function finalizeClinicalReview(record, kind, { reviewedBy, reviewedAt, context = {}, now = new Date() }) {
  const resolved = resolveKind(kind);
  if (!isPlainRecord(record)) throw new TypeError("A clinical record must be an object.");
  const attributionProblem = publicReviewerAttributionProblem(reviewedBy);
  if (attributionProblem) throw new Error(attributionProblem);
  const timestampProblem = utcTimestampProblem(reviewedAt, now);
  if (timestampProblem) throw new Error(timestampProblem);
  const eligibility = signOffEligibilityProblem(record, resolved, context);
  if (eligibility) throw new Error(eligibility);

  const next = { ...record, status: "reviewed", reviewedBy: reviewedBy.trim(), reviewedAt };
  next.reviewedContentSha256 = recordContentSha256(next, resolved, context);
  const problems = reviewProblems([next], resolved, { ...context, now });
  if (problems.length > 0) throw new Error(`Sign-off would be invalid:\n- ${problems.join("\n- ")}`);
  return next;
}

/** Replace one record in its data file's document, keeping derived counts consistent. */
export function applyClinicalReview(document, kind, reviewed) {
  const resolved = resolveKind(kind);
  const records = collectionOf(resolved, document);
  const id = recordId(reviewed, resolved);
  const index = records.findIndex((record) => sameRecordId(recordId(record, resolved), id));
  if (index === -1) throw new Error(`${resolved.noun} ${id} is not in ${resolved.path}.`);
  const nextRecords = records.map((record, position) => (position === index ? reviewed : record));
  if (Array.isArray(document)) return nextRecords;

  const next = { ...document, [resolved.collectionKey]: nextRecords };
  if (resolved.kind === "section" && isPlainRecord(document.exportMetadata)) {
    const tally = (status) => nextRecords.filter((record) => record.status === status).length;
    next.exportMetadata = {
      ...document.exportMetadata,
      counts: {
        ...document.exportMetadata.counts,
        sections: nextRecords.length,
        reviewed: tally("reviewed"),
        drafted: tally("drafted"),
        pending: tally("pending"),
      },
    };
  }
  return next;
}
