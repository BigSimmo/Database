// Generates src/data/therapies-index.json — a trimmed, server-importable projection
// of public/therapy-compass-data/therapies.json (~2.5 MB). The full dataset is fetched
// client-side by the interactive Therapy Compass screens; the server only needs a small
// rankable/metadata projection for routing (generateStaticParams / notFound / metadata)
// and the universal-search "therapies" domain. Re-run after editing the source dataset,
// then run Prettier (which owns the committed file's exact formatting):
//
//   node scripts/build-therapies-index.mjs && npm run format
//
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeFalseOpenAiKeySignatures } from "./lib/escape-false-openai-key-signatures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicData = join(root, "public", "therapy-compass-data");
const serverTarget = join(root, "src", "data", "therapies-index.json");
const browserTarget = join(publicData, "therapies-index.json");
const manifestTarget = join(root, "src", "components", "therapy-compass", "data", "generated-assets.ts");
const checkOnly = process.argv.includes("--check");
const currentManifest = existsSync(manifestTarget) ? readFileSync(manifestTarget, "utf8") : "";
const currentFullFilename = currentManifest.match(/full: "([^"]+)"/)?.[1];
const source = existsSync(join(publicData, "therapies.json"))
  ? join(publicData, "therapies.json")
  : currentFullFilename
    ? join(publicData, currentFullFilename)
    : join(publicData, "therapies.json");
if (!existsSync(source)) {
  throw new Error(
    `Missing therapy source dataset. Expected ${join(publicData, "therapies.json")} or the manifest full asset.`,
  );
}

const therapies = JSON.parse(readFileSync(source, "utf8"));

const projected = therapies
  .map((t) => ({
    slug: t.slug,
    name: t.name,
    category: t.category ?? null,
    modality: t.modality ?? null,
    clinicalSummary: t.clinicalSummary ?? null,
    bestUsedFor: t.bestUsedFor ?? null,
    targetSymptoms: t.targetSymptoms ?? null,
    indications: t.indications ?? null,
    reviewStatus: t.reviewStatus ?? "needs_review",
    patientSheetAvailable: Boolean(t.patientSheetAvailable),
    briefInterventionAvailable: Boolean(t.briefInterventionAvailable),
    tags: Array.isArray(t.tags) ? t.tags : [],
    aliases: Array.isArray(t.aliases) ? t.aliases : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const browserProjected = therapies
  .map((therapy) => ({
    slug: therapy.slug,
    name: therapy.name,
    category: therapy.category ?? null,
    modality: therapy.modality ?? null,
    // The browser index is the browse/pathway payload, not the search corpus.
    // Keep only the short subtitle the catalogue cards render. Search loads the
    // full records so removing long clinical prose here cannot change recall.
    bestUsedFor: therapy.bestUsedFor?.split(/(?<=\.)\s+/)[0] ?? null,
    reviewStatus: therapy.reviewStatus ?? "needs_review",
    patientSheetAvailable: Boolean(therapy.patientSheetAvailable),
    briefInterventionAvailable: Boolean(therapy.briefInterventionAvailable),
    tags: Array.isArray(therapy.tags) ? therapy.tags : [],
    aliases: Array.isArray(therapy.aliases) ? therapy.aliases : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// The landing page only renders compact list rows. Keep its first-paint payload
// free of search-only prose; search loads the full records separately.
const browserHomeProjected = therapies
  .map((therapy) => ({
    slug: therapy.slug,
    name: therapy.name,
    category: therapy.category ?? null,
    bestUsedFor: therapy.bestUsedFor?.split(/(?<=\.)\s+/)[0] ?? null,
    reviewStatus: therapy.reviewStatus ?? "needs_review",
    patientSheetAvailable: Boolean(therapy.patientSheetAvailable),
    briefInterventionAvailable: Boolean(therapy.briefInterventionAvailable),
    tags: Array.isArray(therapy.tags) ? therapy.tags : [],
    aliases: Array.isArray(therapy.aliases) ? therapy.aliases : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function syncTarget(target, records) {
  const expected = `${escapeFalseOpenAiKeySignatures(JSON.stringify(records, null, 2))}\n`;
  if (checkOnly) {
    let actual = "";
    try {
      actual = readFileSync(target, "utf8");
    } catch {
      throw new Error(`Missing generated therapy index: ${target}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(actual);
    } catch {
      throw new Error(`Generated therapy index is invalid JSON: ${target}`);
    }
    if (JSON.stringify(parsed) !== JSON.stringify(records)) {
      throw new Error(`Generated therapy index is stale: ${target}`);
    }
    return;
  }
  writeFileSync(target, expected);
  console.log(`Wrote ${records.length} therapy records to ${target}`);
}

syncTarget(serverTarget, projected);
if (!checkOnly) {
  const browserHomeTarget = join(publicData, "therapies-home.json");
  syncTarget(browserTarget, browserProjected);
  syncTarget(browserHomeTarget, browserHomeProjected);
  const hashedAsset = (target, stem) => {
    const contents = readFileSync(target);
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 16);
    const filename = `${stem}.${hash}.json`;
    writeFileSync(join(publicData, filename), contents);
    return filename;
  };
  // Keep the unversioned aliases for clients loaded before this deployment.
  // Content-addressed files remain immutable, while an already-open older client
  // can still fetch the URL embedded in its JavaScript bundle after assets swap.
  const legacyFullTarget = join(publicData, "therapies.json");
  if (source !== legacyFullTarget) writeFileSync(legacyFullTarget, readFileSync(source));
  const fullFilename = hashedAsset(legacyFullTarget, "therapies");
  const indexFilename = hashedAsset(browserTarget, "therapies-index");
  const homeFilename = hashedAsset(browserHomeTarget, "therapies-home");
  writeFileSync(
    manifestTarget,
    `// Generated by scripts/build-therapies-index.mjs. Do not edit.\nexport const THERAPY_CATALOGUE_ASSETS = {\n  full: "${fullFilename}",\n  index: "${indexFilename}",\n  home: "${homeFilename}",\n} as const;\n`,
  );
  console.log(`Wrote content-addressed therapy assets: ${homeFilename}, ${indexFilename}, ${fullFilename}`);
} else {
  if (!existsSync(manifestTarget)) {
    throw new Error(`Missing generated therapy asset manifest: ${manifestTarget}`);
  }
  const manifest = readFileSync(manifestTarget, "utf8");
  for (const [kind, records] of [
    ["full", therapies],
    ["index", browserProjected],
    ["home", browserHomeProjected],
  ]) {
    const filename = manifest.match(new RegExp(`${kind}: "([^"]+)"`))?.[1];
    if (!filename) throw new Error(`Missing ${kind} therapy asset in ${manifestTarget}`);
    const contents = readFileSync(join(publicData, filename));
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 16);
    const stem = kind === "full" ? "therapies" : `therapies-${kind}`;
    const legacyFilename = `${stem}.json`;
    if (filename !== `${stem}.${hash}.json` || JSON.stringify(JSON.parse(contents)) !== JSON.stringify(records)) {
      throw new Error(`Generated therapy asset is stale: ${filename}`);
    }
    const legacyContents = readFileSync(join(publicData, legacyFilename));
    if (!legacyContents.equals(contents)) {
      throw new Error(`Therapy compatibility alias is stale: ${legacyFilename}`);
    }
  }
}
if (checkOnly) console.log(`Therapy indexes are current (${projected.length} records).`);
