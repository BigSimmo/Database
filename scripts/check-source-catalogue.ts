import { canonicalizeSourceReferences } from "../src/lib/sources/catalogue-core";
import {
  repositorySourceCoverageIssues,
  repositorySourceProviders,
  repositorySourceReferenceIssues,
  repositorySourceReferences,
} from "../src/lib/sources/repository-providers";

const errors: string[] = [];
const providerIds = new Set<string>();
const sourcePaths = new Set<string>();

for (const provider of repositorySourceProviders) {
  if (providerIds.has(provider.id)) errors.push(`Duplicate provider id: ${provider.id}`);
  providerIds.add(provider.id);
  for (const sourcePath of provider.sourcePaths) {
    if (sourcePaths.has(sourcePath)) errors.push(`Duplicate registered source path: ${sourcePath}`);
    sourcePaths.add(sourcePath);
  }
  const references = provider.references();
  if (references.length === 0) errors.push(`Provider ${provider.id} returned no references`);
  errors.push(...repositorySourceReferenceIssues(provider.id, references));
}

errors.push(...repositorySourceCoverageIssues());

const references = repositorySourceReferences();
const entries = canonicalizeSourceReferences(references);
const debtWarnings = [
  "missing_publisher",
  "missing_version",
  "missing_dates",
  "unknown_jurisdiction",
  "unknown_evidence_type",
  "verification_unknown",
  "invalid_date",
] as const;

console.log("Source catalogue provider counts:");
for (const provider of repositorySourceProviders) {
  console.log(`- ${provider.id}: ${provider.references().length}`);
}
console.log(`Captured references: ${references.length}`);
console.log(`Canonical repository sources: ${entries.length}`);
console.log(`D-band review debt: ${entries.filter((entry) => entry.rating.band === "D").length}`);
for (const warning of debtWarnings) {
  console.log(`${warning}: ${entries.filter((entry) => entry.warnings.includes(warning)).length}`);
}

if (errors.length > 0) {
  console.error("Source catalogue coverage failed:");
  for (const error of [...new Set(errors)].sort()) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Source catalogue coverage passed.");
}
