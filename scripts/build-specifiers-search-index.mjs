// Generates data/specifiers-search-index.json — a compact, client-safe search
// index derived from data/specifiers-content.json (~658 KB).
//
// The full nested dataset (data/specifiers-content.json) is only ever loaded by
// server components for detail pages. Client search on /specifiers imports this
// pre-flattened index to keep the browser bundle lightweight.
//
// Generated definitions — even on source-verified rows — are deliberately withheld
// pending qualified clinician review, so `meaning` is kept as an empty string ("")
// for all search index items.
//
// Usage:
//   node scripts/build-specifiers-search-index.mjs          # writes index (default)
//   node scripts/build-specifiers-search-index.mjs --write  # writes index
//   node scripts/build-specifiers-search-index.mjs --check  # verifies index is up-to-date
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeFalseOpenAiKeySignatures } from "./lib/escape-false-openai-key-signatures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "data", "specifiers-content.json");
const target = join(root, "data", "specifiers-search-index.json");
const checkOnly = process.argv.includes("--check");

let rawContent = "";
try {
  rawContent = readFileSync(source, "utf8");
} catch {
  throw new Error(`Missing source specifiers content: ${source}`);
}

let content;
try {
  content = JSON.parse(rawContent);
} catch {
  throw new Error(`Source specifiers content is invalid JSON: ${source}`);
}

if (!content?.categories?.length || !content?.stats?.specifierItems) {
  throw new Error(
    `Specifiers content is empty or incomplete: ${content?.categories?.length ?? 0} categories, ${content?.stats?.specifierItems ?? 0} items.`,
  );
}

/** Must match specifierSlug in src/lib/specifiers-content.ts. */
function specifierSlug(rowKey) {
  return rowKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const items = [];
for (const category of content.categories) {
  for (const disorder of category.disorders) {
    for (const group of disorder.groups) {
      for (const item of group.items) {
        items.push({
          slug: specifierSlug(item.review.rowKey),
          label: item.label,
          disorder: disorder.name,
          categoryId: category.id,
          category: category.name,
          group: group.label,
          src: item.review.sourceVerificationStatus,
          def: item.definitionStatus,
          meaning: "", // Generated definitions withheld pending qualified clinician review
        });
      }
    }
  }
}

const generated = {
  meta: {
    appName: content.project.appName,
    version: content.project.version,
    contentVersion: content.project.contentVersion,
    lastUpdated: content.project.lastUpdated,
    reviewStatus: content.project.reviewStatus,
    scope: content.project.scope,
    disclaimer: content.project.disclaimer,
    scopeWarning: content.scopeWarning,
    stats: content.stats,
    sourceVerified: items.filter((i) => i.src === "source-verified").length,
  },
  categories: content.categories.map((cat) => ({ id: cat.id, name: cat.name })),
  items,
};

function serialize(data) {
  let serialized = JSON.stringify(data, null, 2) + "\n";
  serialized = serialized.replace(/  "categories": \[\n([\s\S]*?)\n  \],/, () => {
    const lines = data.categories.map((cat) => `    { "id": "${cat.id}", "name": "${cat.name}" }`).join(",\n");
    return `  "categories": [\n${lines}\n  ],`;
  });
  return escapeFalseOpenAiKeySignatures(serialized);
}

const summary = `${generated.items.length} specifier items across ${generated.categories.length} categories (${generated.meta.sourceVerified} source-verified)`;

if (checkOnly) {
  let actual = "";
  try {
    actual = readFileSync(target, "utf8");
  } catch {
    throw new Error(`Missing generated specifiers search index: ${target}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(actual);
  } catch {
    throw new Error(`Specifiers search index is invalid JSON: ${target}`);
  }
  if (JSON.stringify(parsed) !== JSON.stringify(generated)) {
    throw new Error(
      `Specifiers search index is stale: ${target} — re-run \`node scripts/build-specifiers-search-index.mjs --write\`.`,
    );
  }
  console.log(`Specifiers search index is current (${summary}).`);
} else {
  const output = serialize(generated);
  writeFileSync(target, output);
  console.log(`Wrote specifiers search index (${summary}) to ${target}.`);
}
