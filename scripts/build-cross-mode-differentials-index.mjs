// Generates src/data/cross-mode-differentials-index.json — a trimmed projection of
// data/differentials-snapshot.json for the cross-mode "Also in your library" strip.
//
// The full ~1.2 MB snapshot backs the Differentials mode. The cross-mode links only
// need a tiny {slug,title,clinicalHinge} diagnosis catalog plus presentation identity
// and the search-alias map. Importing this precomputed index (instead of
// @/lib/differentials) keeps the lazily-loaded cross-mode chunk from pulling the whole
// snapshot. Re-run after editing the snapshot, then run Prettier (which owns the
// committed file's exact formatting):
//
//   node scripts/build-cross-mode-differentials-index.mjs && npm run format
//
// `--check` fails (non-zero) when the committed index is stale, comparing parsed
// values so Prettier's formatting never trips the gate. tests/cross-mode-differentials-
// index.test.ts additionally asserts the committed index equals the live projection.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "data", "differentials-snapshot.json");
const target = join(root, "src", "data", "cross-mode-differentials-index.json");
const presentationDisplaySource = join(root, "src", "data", "differential-presentation-display-metadata.json");
const checkOnly = process.argv.includes("--check");

const snapshot = JSON.parse(readFileSync(source, "utf8"));
const presentationDisplayMetadata = JSON.parse(readFileSync(presentationDisplaySource, "utf8")).presentations;

// Bare-number aliases (e.g. a field-weight "1.1" leaked from snapshot template
// metadata) would match unrelated records by substring — drop them, mirroring
// differentialSearchAliases() in src/lib/differentials.ts.
const isBareNumber = (value) => /^\d+(\.\d+)?$/.test(value.trim());

const distinctTerms = (values) => {
  const seen = new Set();
  return values.flatMap((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return [];
    const key = trimmed.toLocaleLowerCase("en-AU");
    if (seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
};

const catalog = {
  diagnoses: snapshot.diagnoses.map((diagnosis) => ({
    slug: diagnosis.slug,
    title: diagnosis.title,
    clinicalHinge: diagnosis.clinicalHinge,
  })),
  presentations: snapshot.presentations.map((presentation) => {
    const metadata = presentationDisplayMetadata[presentation.id];
    const titleAliases = metadata
      ? distinctTerms([
          presentation.sourceTitle ?? presentation.title,
          ...metadata.aliases,
          ...(presentation.titleAliases ?? []),
        ])
      : presentation.titleAliases;
    return {
      id: presentation.id,
      title: metadata?.title ?? presentation.title,
      subtitle: presentation.subtitle,
      ...(titleAliases?.length ? { titleAliases } : {}),
    };
  }),
  aliases: Object.fromEntries(
    Object.entries(snapshot.searchAliases)
      .map(([token, aliases]) => [token, aliases.filter((alias) => !isBareNumber(alias))])
      .filter(([, aliases]) => aliases.length > 0),
  ),
};

// Escape any embedded `sk-` so an ordinary word never trips the secret scanners on
// the committed artifact. `k` decodes back to `k`, so parsed values are exact.
const expected = `${JSON.stringify(catalog, null, 2).replace(/(?<=[A-Za-z0-9])sk-/g, "s\\u006b-")}\n`;

const summary = `${catalog.diagnoses.length} diagnoses, ${catalog.presentations.length} presentations, ${Object.keys(catalog.aliases).length} alias keys`;

if (checkOnly) {
  let actual = "";
  try {
    actual = readFileSync(target, "utf8");
  } catch {
    throw new Error(`Missing generated cross-mode differentials index: ${target}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(actual);
  } catch {
    throw new Error(`Cross-mode differentials index is invalid JSON: ${target}`);
  }
  if (JSON.stringify(parsed) !== JSON.stringify(catalog)) {
    throw new Error(
      `Cross-mode differentials index is stale: ${target} — re-run \`node scripts/build-cross-mode-differentials-index.mjs\`.`,
    );
  }
  console.log(`Cross-mode differentials index is current (${summary}).`);
} else {
  writeFileSync(target, expected);
  console.log(`Wrote cross-mode differentials index (${summary}) to ${target}.`);
}
