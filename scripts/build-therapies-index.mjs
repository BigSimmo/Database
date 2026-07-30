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
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
    clinicalSummary: therapy.clinicalSummary ?? null,
    bestUsedFor: therapy.bestUsedFor ?? null,
    indications: therapy.indications ?? null,
    contraindicationsOrCautions: therapy.contraindicationsOrCautions ?? null,
    targetSymptoms: therapy.targetSymptoms ?? null,
    patientPopulation: therapy.patientPopulation ?? null,
    setting: therapy.setting ?? null,
    reviewStatus: therapy.reviewStatus ?? "needs_review",
    patientSheetAvailable: Boolean(therapy.patientSheetAvailable),
    briefInterventionAvailable: Boolean(therapy.briefInterventionAvailable),
    tags: Array.isArray(therapy.tags) ? therapy.tags : [],
    aliases: Array.isArray(therapy.aliases) ? therapy.aliases : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// The landing page only renders compact list rows. Keep its first-paint payload
// free of search-only prose; search/pathway routes retain the complete index.
const browserHomeProjected = therapies
  .map((therapy) => ({
    slug: therapy.slug,
    name: therapy.name,
    category: therapy.category ?? null,
    bestUsedFor: therapy.bestUsedFor ?? null,
    reviewStatus: therapy.reviewStatus ?? "needs_review",
    patientSheetAvailable: Boolean(therapy.patientSheetAvailable),
    briefInterventionAvailable: Boolean(therapy.briefInterventionAvailable),
    tags: Array.isArray(therapy.tags) ? therapy.tags : [],
    aliases: Array.isArray(therapy.aliases) ? therapy.aliases : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function syncTarget(target, records) {
  // Avoid a false OpenAI-key signature when ordinary words contain an embedded
  // `sk-` sequence. JSON decoding restores the exact original string value.
  const expected = `${JSON.stringify(records, null, 2).replace(/(?<=[A-Za-z0-9])sk-/g, "s\\u006b-")}\n`;
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
    renameSync(target, join(publicData, filename));
    return filename;
  };
  const fullFilename = hashedAsset(source, "therapies");
  const indexFilename = hashedAsset(browserTarget, "therapies-index");
  const homeFilename = hashedAsset(browserHomeTarget, "therapies-home");
  writeFileSync(
    manifestTarget,
    `// Generated by scripts/build-therapies-index.mjs. Do not edit.\nexport const THERAPY_CATALOGUE_ASSETS = {\n  full: "${fullFilename}",\n  index: "${indexFilename}",\n  home: "${homeFilename}",\n} as const;\n`,
  );
  console.log(`Wrote content-addressed therapy assets: ${homeFilename}, ${indexFilename}, ${fullFilename}`);
} else {
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
    if (!filename.includes(`.${hash}.json`) || JSON.stringify(JSON.parse(contents)) !== JSON.stringify(records)) {
      throw new Error(`Generated therapy asset is stale: ${filename}`);
    }
  }
}
if (checkOnly) console.log(`Therapy indexes are current (${projected.length} records).`);
