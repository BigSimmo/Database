// Generates src/data/therapies-index.json — a trimmed, server-importable projection
// of public/therapy-compass-data/therapies.json (~2.5 MB). The full dataset is fetched
// client-side by the interactive Therapy Compass screens; the server only needs a small
// rankable/metadata projection for routing (generateStaticParams / notFound / metadata)
// and the universal-search "therapies" domain. Re-run after editing the source dataset,
// then run Prettier (which owns the committed file's exact formatting):
//
//   node scripts/build-therapies-index.mjs && npm run format
//
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "therapy-compass-data", "therapies.json");
const target = join(root, "src", "data", "therapies-index.json");

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

writeFileSync(target, `${JSON.stringify(projected, null, 2)}\n`);
console.log(`Wrote ${projected.length} therapy records to ${target}`);
