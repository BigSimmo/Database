#!/usr/bin/env node
/**
 * One-shot importer for the PsychSift Dictionary + Sources handover package.
 *
 * The handover is editorial evidence, not runtime content: every sense it carries
 * is `clinicalApproval: pending` and `publicationAllowed: false`. This script maps
 * it into the three native draft files under `src/data/` and nothing else. It never
 * touches `dictionary-data.ts`, because promoting a draft into the published
 * dictionary is a clinical sign-off decision, not an import step.
 *
 *   node scripts/import-dictionary-handover.mjs --package <extracted-package-dir>
 *   node scripts/import-dictionary-handover.mjs --package <dir> --check
 *
 * `--check` re-derives the three files and fails if the committed copies differ,
 * so a future re-import cannot silently rewrite reviewed drafts. Without the
 * package the committed files still stand on their own: every record carries the
 * upstream `contentHash` and provenance, and `tests/dictionary-sense-drafts.test.ts`
 * verifies those without needing the package present.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const packageIndex = args.indexOf("--package");
const checkOnly = args.includes("--check");
if (packageIndex === -1 || !args[packageIndex + 1]) {
  console.error("usage: import-dictionary-handover.mjs --package <dir> [--check]");
  process.exit(2);
}
const pkg = resolve(args[packageIndex + 1]);
const repo = resolve(import.meta.dirname, "..");

const read = (relative) => JSON.parse(readFileSync(resolve(pkg, relative), "utf8"));

const content = read("payload/data/content.json");
const sources = read("payload/data/sources.json");
const collisions = read("payload/data/collisions.json");

/** Trim the handover's markdown-ish prose fields to a plain sentence or null. */
const text = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const collisionRule = collisions[0]?.rule ?? null;
const collisionGroups = collisions.map((group) => ({
  tokenKey: group.tokenKey,
  senseIds: [...group.senseIds].sort(),
  rule: group.rule,
}));

const senseDrafts = content
  .filter((item) => item.kind === "sense")
  .map(({ record }) => ({
    id: record.id,
    token: record.token,
    normalizedToken: record.normalizedToken,
    expansion: record.expansion,
    recordType: record.recordType,
    category: record.category,
    subcategory: text(record.subcategory),
    context: record.context,
    jurisdiction: record.jurisdiction,
    meaningNote: text(record.meaningNote),
    documentationStatus: record.documentationStatus,
    documentationNote: text(record.documentationNote),
    warning: text(record.warning),
    // Kept as {value, kind, evidenceStatus} records rather than flattened to
    // strings: the kind and evidence status are what tell a reviewer whether an
    // alias was checked or merely inherited.
    aliases: record.aliases ?? [],
    availabilityNote: text(record.availabilityText),
    linkedSenseIds: record.linkedSenseIds ?? [],
    collisionKeys: record.collisionKeys ?? [],
    sourceIds: record.sourceIds ?? [],
    evidenceNote: record.evidenceText,
    reviewState: record.reviewState,
    editorialPriority: record.editorialPriority,
    unresolvedIssues: record.unresolvedIssues ?? [],
    clinicalApproval: { status: "pending", reviewer: null, reviewedOn: null },
    publicationAllowed: false,
    semanticRevisionDate: record.semanticRevisionDate,
    provenance: record.provenance,
    contentHash: record.contentHash,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const definitionReviews = content
  .filter((item) => item.kind === "definition_review")
  .map(({ record }) => ({
    id: record.id,
    entrySlug: record.slug,
    title: record.title,
    category: record.category,
    repositoryLocation: record.repositoryLocation,
    verdict: record.verdict,
    // The wording the handover saw. Reconciled against the live entry by hash at
    // read time — never used to overwrite it.
    baselineWording: record.currentWording,
    baselineWordingSha256: record.expectedCurrentWordingSha256,
    proposedWording: text(record.proposedWording),
    disposition: record.disposition,
    rationale: record.rationale,
    reviewGate: record.reviewGate,
    legacyCitation: text(record.legacyCitation),
    applyAutomatically: false,
    publicationAllowed: false,
    reviewer: null,
    provenance: record.provenance,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const sourceOutcomes = sources
  .map((record) => ({
    handoverSourceId: record.id,
    title: record.title,
    publisher: record.publisher ?? record.publisherAsReported ?? null,
    publisherCode: record.publisherCode ?? null,
    canonicalUrl: record.canonicalUrl ?? record.canonicalUrlAsReported ?? null,
    jurisdiction: record.jurisdiction ?? record.applicabilityAsReported ?? null,
    version: record.version ?? record.versionAsReported ?? null,
    evidenceType: record.evidenceType,
    lifecycleStatus: record.lifecycleStatus,
    documentStatus: record.documentStatus,
    clinicalValidationStatus: record.clinicalValidationStatus,
    contentMode: record.contentMode,
    dates: record.dates ?? [],
    publicationDate: record.publicationDate ?? null,
    locatorAndScope: text(record.locatorAndScope),
    limitations: text(record.limitations),
    lastCheckedOn: record.priorAccessDate ?? null,
    provenance: record.provenance,
  }))
  .sort((a, b) => a.handoverSourceId.localeCompare(b.handoverSourceId));

const files = {
  "src/data/dictionary-sense-drafts.json": {
    generatedFrom: "PsychSift_Dictionary_Claude_Cloud_2026-09-16",
    inheritedContentReviewBaseline: "c6d677e569ee9faedefa31c96eb927ab5fbd433d",
    publicationAllowed: false,
    note: "Editorial drafts. None is clinically approved and none is served on a public dictionary route.",
    collisionRule,
    collisionGroups,
    senses: senseDrafts,
  },
  "src/data/dictionary-definition-reviews.json": {
    generatedFrom: "PsychSift_Dictionary_Claude_Cloud_2026-09-16",
    note: "Proposals against existing dictionary entries. None is applied; each is reconciled against the live wording by hash.",
    reviews: definitionReviews,
  },
  "src/data/dictionary-source-candidates.json": {
    generatedFrom: "PsychSift_Dictionary_Claude_Cloud_2026-09-16",
    note: "Handover source metadata. Admission to the acquisition ledger is a separate decision recorded per source in `src/data/dictionary-source-dispositions.json`.",
    sources: sourceOutcomes,
  },
};

let failed = false;
for (const [relative, value] of Object.entries(files)) {
  const path = resolve(repo, relative);
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    // Compared as parsed JSON, not bytes: Prettier owns whitespace in `src/data`,
    // and a reformat is not a content change.
    const current = readFileSync(path, "utf8");
    const digest = (text) =>
      createHash("sha256")
        .update(JSON.stringify(JSON.parse(text)))
        .digest("hex");
    const same = digest(current) === digest(next);
    console.log(`${same ? "ok  " : "DIFF"} ${relative}`);
    if (!same) failed = true;
  } else {
    writeFileSync(path, next);
    console.log(`wrote ${relative} (${next.length} bytes)`);
  }
}

console.log(
  `senses=${senseDrafts.length} definitionReviews=${definitionReviews.length} sources=${sourceOutcomes.length} collisionGroups=${collisionGroups.length}`,
);
process.exit(failed ? 1 : 0);
