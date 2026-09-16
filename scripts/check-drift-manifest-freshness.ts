import { readFileSync } from "node:fs";

/**
 * check:drift-manifest-freshness — is supabase/drift-manifest.json actually
 * what `npm run drift:manifest` produces from the current migration chain?
 *
 * The CI step that calls this (`.github/workflows/ci.yml`, "Regenerate and
 * verify drift manifest freshness") used to compare ONLY the top-level
 * `schema_sha256` field between the committed manifest and a freshly
 * regenerated one. That field is a hash of `supabase/schema.sql` text
 * (`normalizedSchemaSha256` in check-drift.ts) — it says nothing about the
 * `snapshot` payload the manifest also carries (function `def_hash`, view
 * `def_hash`, index/policy/constraint definitions, `postgres_image`,
 * `generator`). An agent can hand-set `schema_sha256` correctly while leaving
 * a stale `snapshot.functions[].def_hash` from before a migration edit, and
 * the old check passed it: CI stayed green, the live post-merge `live-drift`
 * workflow (`npm run check:drift`) then found the real function body and went
 * red on `main` — the exact silent-drift shape this manifest exists to catch
 * pre-merge instead of post-merge.
 *
 * Fix: deep-compare the whole manifest except the two fields that are
 * expected to change on every regeneration and carry no schema information —
 * `generated_at` (a timestamp) and `replay_seconds` (how long the replay
 * happened to take). Everything else — `schema_sha256`, `postgres_image`,
 * `generator`, and the full `snapshot` tree — must match exactly.
 */

export type ManifestDiff = { path: string; committed: unknown; generated: unknown };

/** Top-level fields that legitimately change on every regeneration. */
export const IGNORED_MANIFEST_KEYS: ReadonlySet<string> = new Set(["generated_at", "replay_seconds"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diffValues(path: string, committed: unknown, generated: unknown, out: ManifestDiff[]): void {
  if (committed === generated) return;

  if (Array.isArray(committed) && Array.isArray(generated)) {
    const length = Math.max(committed.length, generated.length);
    for (let index = 0; index < length; index += 1) {
      diffValues(`${path}[${index}]`, committed[index], generated[index], out);
    }
    return;
  }

  if (isPlainObject(committed) && isPlainObject(generated)) {
    const keys = new Set([...Object.keys(committed), ...Object.keys(generated)]);
    for (const key of keys) {
      diffValues(`${path}.${key}`, committed[key], generated[key], out);
    }
    return;
  }

  // Primitives, a type mismatch (object vs array vs primitive), or a key
  // present on only one side (where the missing side reads as `undefined`).
  if (JSON.stringify(committed) !== JSON.stringify(generated)) {
    out.push({ path, committed, generated });
  }
}

/**
 * Deep-compare two drift-manifest payloads, skipping `IGNORED_MANIFEST_KEYS`
 * at the top level. Returns every differing leaf path, in encounter order —
 * empty means the committed manifest is byte-for-byte the same schema
 * description as a fresh regeneration.
 */
export function diffManifests(committed: Record<string, unknown>, generated: Record<string, unknown>): ManifestDiff[] {
  const out: ManifestDiff[] = [];
  const keys = new Set([...Object.keys(committed), ...Object.keys(generated)]);
  for (const key of keys) {
    if (IGNORED_MANIFEST_KEYS.has(key)) continue;
    diffValues(key, committed[key], generated[key], out);
  }
  return out;
}

/** Render up to `limit` differing paths with both sides' values. */
export function formatDiff(diffs: ManifestDiff[], limit = 20): string {
  const shown = diffs.slice(0, limit);
  const lines = shown.map(
    (diff) =>
      `  - ${diff.path}: committed=${JSON.stringify(diff.committed)} generated=${JSON.stringify(diff.generated)}`,
  );
  if (diffs.length > limit) lines.push(`  ...and ${diffs.length - limit} more`);
  return lines.join("\n");
}

export const STALE_MANIFEST_INSTRUCTION = "Download the drift-manifest artifact from this job and commit it.";

function readManifest(path: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isPlainObject(parsed)) throw new Error(`${label} manifest at ${path} is not a JSON object`);
  return parsed;
}

export function selfTest(): void {
  const failures: string[] = [];
  const expect = (condition: boolean, label: string) => {
    if (!condition) failures.push(label);
  };

  const base = {
    generated_at: "2026-09-16T13:04:14.958Z",
    generator: "scripts/generate-drift-manifest.ts",
    postgres_image: "supabase/postgres:17.6.1.127@sha256:aaa",
    schema_sha256: "sha-1",
    replay_seconds: 20,
    snapshot: {
      functions: [{ signature: "public.f()", def_hash: "hash-a" }],
      views: [{ name: "v", def_hash: "hash-b" }],
    },
  };

  expect(diffManifests(base, { ...base }).length === 0, "identical manifests must report no diff");

  // generated_at and replay_seconds change every regeneration and carry no
  // schema information — they must never be reported as staleness.
  const volatileOnly = { ...base, generated_at: "2026-09-17T00:00:00.000Z", replay_seconds: 999 };
  expect(diffManifests(base, volatileOnly).length === 0, "volatile fields must be ignored");

  // The regression this gate exists to close: schema_sha256 matches (an agent
  // hand-set it) but a nested function def_hash is stale.
  const staleFunctionBody = {
    ...base,
    snapshot: { ...base.snapshot, functions: [{ signature: "public.f()", def_hash: "hash-STALE" }] },
  };
  const functionDiff = diffManifests(base, staleFunctionBody);
  expect(
    functionDiff.length === 1 && functionDiff[0].path === "snapshot.functions[0].def_hash",
    "a stale nested function def_hash must be reported even when schema_sha256 matches",
  );

  // schema_sha256 itself must still be caught — the field the old check covered.
  const staleHash = { ...base, schema_sha256: "sha-DIFFERENT" };
  const hashDiff = diffManifests(base, staleHash);
  expect(
    hashDiff.length === 1 && hashDiff[0].path === "schema_sha256",
    "a changed schema_sha256 must still be reported",
  );

  // postgres_image and generator are compared too — a pinned-image bump with no
  // regeneration must not pass silently.
  const staleImage = { ...base, postgres_image: "supabase/postgres:17.6.1.127@sha256:bbb" };
  expect(diffManifests(base, staleImage).length === 1, "postgres_image must be compared");

  // formatDiff caps output at the given limit and reports the remainder count.
  const manyDiffs: ManifestDiff[] = Array.from({ length: 25 }, (_, index) => ({
    path: `snapshot.functions[${index}].def_hash`,
    committed: "a",
    generated: "b",
  }));
  const rendered = formatDiff(manyDiffs, 20);
  expect(rendered.split("\n").length === 21, "formatDiff must show at most limit+1 lines (entries plus the ellipsis)");
  expect(rendered.includes("...and 5 more"), "formatDiff must report how many entries it truncated");

  if (failures.length > 0) {
    console.error("drift-manifest-freshness self-test FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("drift-manifest-freshness self-test passed.");
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function main(): void {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const committedPath = arg("--committed");
  const generatedPath = arg("--generated");
  if (!committedPath || !generatedPath) {
    throw new Error("Usage: check-drift-manifest-freshness --committed <file> --generated <file> [--self-test]");
  }

  const committed = readManifest(committedPath, "committed");
  const generated = readManifest(generatedPath, "regenerated");
  const diffs = diffManifests(committed, generated);

  if (diffs.length > 0) {
    throw new Error(
      `supabase/drift-manifest.json is stale — ${diffs.length} field(s) differ from a fresh ` +
        `regeneration (schema_sha256 alone matching is not enough):\n${formatDiff(diffs)}\n\n` +
        STALE_MANIFEST_INSTRUCTION,
    );
  }

  console.log("supabase/drift-manifest.json matches a fresh regeneration.");
}

const invokedDirectly = process.argv[1] && /check-drift-manifest-freshness\.(ts|mts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
