import { createHash } from "node:crypto";

/**
 * The seven explicit decisions required before a Therapy record may be marked
 * reviewed. The five clinical decisions are qualified-clinician attestations;
 * the final two may be performed editorially, but the final record sign-off is
 * still clinician-owned.
 */
export const THERAPY_REVIEW_CHECKS = Object.freeze([
  {
    key: "clinicalAccuracyReviewed",
    label: "Clinical accuracy",
    authority: "qualified clinician",
    fields: Object.freeze([
      "clinicalSummary",
      "bestUsedFor",
      "indications",
      "targetSymptoms",
      "patientPopulation",
      "setting",
      "sessionLength",
      "timeRequired",
      "complexity",
      "mechanism",
      "deliverySteps",
      "briefVersion",
      "fifteenMinuteVersion",
      "fullSessionVersion",
      "homework",
      "materials",
      "alternatives",
      "relatedTherapies",
    ]),
  },
  {
    key: "sourceChecked",
    label: "Source correspondence",
    authority: "qualified clinician",
    fields: Object.freeze(["sourceNotes", "references", "sources", "contentOrigin"]),
  },
  {
    key: "evidenceAppraised",
    label: "Evidence appraisal",
    authority: "qualified clinician",
    fields: Object.freeze(["evidenceLevel", "evidenceNotes", "limitations", "references", "sources"]),
  },
  {
    key: "safetyCautionsChecked",
    label: "Safety and cautions",
    authority: "qualified clinician",
    fields: Object.freeze(["contraindicationsOrCautions", "warnings", "commonPitfalls", "limitations"]),
  },
  {
    key: "patientExplanationChecked",
    label: "Patient-facing explanation",
    authority: "qualified clinician",
    fields: Object.freeze(["patientExplanation", "patientSheetTemplates", "clinicianScripts"]),
  },
  {
    key: "proofread",
    label: "Proofreading",
    authority: "editorial (final sign-off remains clinician-owned)",
    fields: Object.freeze(["all rendered prose"]),
  },
  {
    key: "australianEnglishChecked",
    label: "Australian English",
    authority: "editorial (final sign-off remains clinician-owned)",
    fields: Object.freeze(["all rendered prose"]),
  },
]);

export const THERAPY_REVIEW_CHECK_KEYS = Object.freeze(THERAPY_REVIEW_CHECKS.map(({ key }) => key));

const REVIEW_METADATA_KEYS = new Set([
  "reviewStatus",
  "reviewChecklist",
  "reviewedBy",
  "reviewedAt",
  "reviewedContentSha256",
]);

const TRIVIAL_REVIEWER_VALUES = new Set([
  "anonymous",
  "automated",
  "bot",
  "default",
  "missing",
  "n/a",
  "na",
  "none",
  "null",
  "pending",
  "placeholder",
  "system",
  "tbd",
  "test",
  "testing",
  "todo",
  "unassigned",
  "unattributed",
  "undefined",
  "unknown",
]);

const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const UUID_LIKE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const LONG_NUMERIC_ID = /\d{6,}/;
const PHONE_LIKE = /(?:\+?\d[\d ()-]{6,}\d)/;
const LABELLED_PRIVATE_ID =
  /\b(?:ahpra|(?:employee|provider|registration|staff|user)\s*(?:id|identifier|no\.?|number|#))\s*[:#-]?\s*[a-z0-9-]{4,}\b/i;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
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

/** A content-only digest: changing any non-review field invalidates sign-off. */
export function therapyReviewedContentSha256(record) {
  if (!isPlainRecord(record)) throw new TypeError("Therapy review content must be an object.");
  const content = Object.fromEntries(Object.entries(record).filter(([key]) => !REVIEW_METADATA_KEYS.has(key)));
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(content)))
    .digest("hex");
}

/**
 * `reviewedBy` is shipped in the public Therapy catalogue. It must therefore be
 * a deliberately public professional/governance attribution, never an account,
 * contact address, registration number, provider number, staff id, or UUID.
 */
export function publicReviewerAttributionProblem(value) {
  if (typeof value !== "string" || !value.trim()) return "reviewedBy must be a non-empty public attribution.";
  const trimmed = value.trim();
  if (trimmed.length > 160) return "reviewedBy must be 160 characters or fewer.";
  if (TRIVIAL_REVIEWER_VALUES.has(trimmed.toLowerCase())) {
    return "reviewedBy must identify the clinician or governance owner, not a placeholder.";
  }
  if (CONTROL_CHARACTER.test(trimmed)) return "reviewedBy must be a single display-safe line.";
  if (EMAIL_LIKE.test(trimmed) || trimmed.includes("@")) {
    return "reviewedBy is public and must not contain an email address or account handle.";
  }
  if (
    UUID_LIKE.test(trimmed) ||
    LONG_NUMERIC_ID.test(trimmed) ||
    PHONE_LIKE.test(trimmed) ||
    LABELLED_PRIVATE_ID.test(trimmed)
  ) {
    return "reviewedBy is public and must not contain a private account, registration, provider, or staff identifier.";
  }
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return "reviewedBy must contain a meaningful public name or governance label.";
  return null;
}

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

function recordLabel(record, index) {
  return typeof record?.slug === "string" && record.slug.trim() ? record.slug : `record[${index}]`;
}

/** Return every source-contract problem without mutating the records. */
export function therapyReviewProblems(records, { now = new Date() } = {}) {
  if (!Array.isArray(records)) return ["Therapy source must be an array."];
  const problems = [];
  const requiredKeys = new Set(THERAPY_REVIEW_CHECK_KEYS);

  for (const [index, record] of records.entries()) {
    const label = recordLabel(record, index);
    if (!isPlainRecord(record)) {
      problems.push(`${label}: therapy record must be an object.`);
      continue;
    }
    if (record.reviewStatus !== "reviewed" && record.reviewStatus !== "needs_review") {
      problems.push(`${label}: reviewStatus must be exactly "reviewed" or "needs_review".`);
    }

    const checklist = record.reviewChecklist;
    if (!isPlainRecord(checklist)) {
      problems.push(`${label}: reviewChecklist must contain all seven explicit boolean checks.`);
      continue;
    }
    const actualKeys = Object.keys(checklist);
    for (const key of THERAPY_REVIEW_CHECK_KEYS) {
      if (!Object.hasOwn(checklist, key)) problems.push(`${label}: reviewChecklist is missing ${key}.`);
      else if (typeof checklist[key] !== "boolean") problems.push(`${label}: reviewChecklist.${key} must be boolean.`);
    }
    for (const key of actualKeys) {
      if (!requiredKeys.has(key)) problems.push(`${label}: reviewChecklist contains unknown check ${key}.`);
    }

    if (record.reviewedBy !== undefined && record.reviewedBy !== null) {
      const attributionProblem = publicReviewerAttributionProblem(record.reviewedBy);
      if (attributionProblem) problems.push(`${label}: ${attributionProblem}`);
    }
    if (record.reviewedAt !== undefined && record.reviewedAt !== null) {
      const timestampProblem = utcTimestampProblem(record.reviewedAt, now);
      if (timestampProblem) problems.push(`${label}: ${timestampProblem}`);
    }

    if (record.reviewStatus !== "reviewed") continue;
    for (const key of THERAPY_REVIEW_CHECK_KEYS) {
      if (checklist[key] !== true) problems.push(`${label}: reviewed requires reviewChecklist.${key} to be true.`);
    }
    const attributionProblem = publicReviewerAttributionProblem(record.reviewedBy);
    if (attributionProblem && (record.reviewedBy === undefined || record.reviewedBy === null)) {
      problems.push(`${label}: ${attributionProblem}`);
    }
    const timestampProblem = utcTimestampProblem(record.reviewedAt, now);
    if (timestampProblem && (record.reviewedAt === undefined || record.reviewedAt === null)) {
      problems.push(`${label}: ${timestampProblem}`);
    }
    if (typeof record.reviewedContentSha256 !== "string" || !SHA256.test(record.reviewedContentSha256)) {
      problems.push(`${label}: reviewed requires a lowercase reviewedContentSha256.`);
    } else {
      const expected = therapyReviewedContentSha256(record);
      if (record.reviewedContentSha256 !== expected) {
        problems.push(`${label}: reviewedContentSha256 is stale; content changed after sign-off.`);
      }
    }
  }
  return problems;
}

export function assertValidTherapyReviewRecords(records, options) {
  const problems = therapyReviewProblems(records, options);
  if (problems.length > 0) {
    throw new Error(`Invalid Therapy review data:\n- ${problems.join("\n- ")}`);
  }
  return records;
}

/** Finalize one in-memory record after seven explicit positive answers. */
export function finalizeTherapyReview(record, { answers, reviewedBy, reviewedAt, now = new Date() }) {
  if (!isPlainRecord(record)) throw new TypeError("Therapy record must be an object.");
  if (record.reviewStatus !== "needs_review") {
    throw new Error("Only a needs_review Therapy record can enter the clinician sign-off workflow.");
  }
  if (!isPlainRecord(answers)) throw new Error("All seven Therapy review answers are required.");
  const answerKeys = Object.keys(answers);
  if (
    answerKeys.length !== THERAPY_REVIEW_CHECK_KEYS.length ||
    THERAPY_REVIEW_CHECK_KEYS.some((key) => !Object.hasOwn(answers, key) || answers[key] !== true)
  ) {
    throw new Error("A Therapy record cannot be reviewed unless all seven answers are explicitly yes.");
  }
  const next = {
    ...record,
    reviewStatus: "reviewed",
    reviewChecklist: Object.fromEntries(THERAPY_REVIEW_CHECK_KEYS.map((key) => [key, true])),
    reviewedBy: typeof reviewedBy === "string" ? reviewedBy.trim() : reviewedBy,
    reviewedAt,
  };
  next.reviewedContentSha256 = therapyReviewedContentSha256(next);
  assertValidTherapyReviewRecords([next], { now });
  return next;
}
