// Generates src/data/cross-mode-differentials-index.json — a trimmed projection of
// data/differentials-snapshot.json for the cross-mode "Also in your library" strip.
//
// The full ~1.2 MB snapshot backs the Differentials mode. The cross-mode links only
// need a tiny {slug,title,subtitle} diagnosis catalog plus presentation identity
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

// The curated overlay is the single source of truth for which records withhold
// their generated body, so this reads it rather than keeping a second list that
// could drift. Node 24 strips the types on import, and the overlay's only import
// is type-only, so no alias resolution or build step is involved.
// tests/cross-mode-differentials-index.test.ts locks this index to the live
// projection, which applies the same withhold — without this the two diverge and
// the "Also in your library" strip keeps showing the wrong diagnosis's summary.
const { curatedDifferentials } = await import(join(root, "src", "lib", "differential-curated.ts"));
const withheldSlugs = new Set(
  Object.entries(curatedDifferentials)
    .filter(([, entry]) => entry.generatedBodyUnreliable === true)
    .map(([slug]) => slug),
);
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

// Hinges written about a presentation group, keyed by their exact text. A
// diagnosis carrying one of these is repeating its group, not describing itself.
const presentationHinges = new Set(
  snapshot.presentations.map((presentation) => presentation.safetySnapshot?.summary?.trim()).filter(Boolean),
);

const catalog = {
  // `subtitle` is the diagnosis's OWN one-line summary, never its presentation's
  // clinical hinge. The hinge is written about the group — 201 diagnoses share
  // just 31 hinges — so projecting it here made `social-anxiety-disorder` read as
  // panic disorder and `acute-dystonia` read as akathisia. See the note in
  // src/lib/dsm.ts and tests/differentials-presentation-scope.test.ts.
  //
  // This repeats the rule in withPresentationScope() in src/lib/differentials.ts
  // because this generator is plain JS and cannot import it; the index test holds
  // the two to the same answer.
  //
  // The withhold is a second, narrower reason to drop a hinge: a record whose
  // generated body was found to describe a different diagnosis loses it whether
  // or not it is a shared group hinge. The two rules overlap on today's one
  // withheld record — its hinge is also a group hinge — and neither makes the
  // other redundant, so both are applied.
  diagnoses: snapshot.diagnoses.map((diagnosis) => {
    const hinge = diagnosis.clinicalHinge?.trim() ?? "";
    const ownHinge = hinge && !presentationHinges.has(hinge) && !withheldSlugs.has(diagnosis.slug) ? hinge : "";
    return {
      slug: diagnosis.slug,
      title: diagnosis.title,
      subtitle: ownHinge || diagnosis.subtitle?.trim() || "",
    };
  }),
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
