// `data/medication-interaction-index.json` is generated from
// `data/medications-snapshot.json` plus the curated lexicon, and the UI reads it
// to decide whether a drug can be shown as clear. The freshness gate
// (`npm run check:medication-interactions`) rebuilds the index and diffs it,
// but until audit M30 it ran in no CI job, and the only unit test compared the
// index against ITSELF (row total versus its own sourceRowCount). A snapshot
// edit merged through the bare-PR route — a renamed drug, a new interaction
// row, a severity token flipped from LOW to HIGH — therefore shipped a stale
// index with every required check green.
//
// This test compares the committed index to the committed snapshot directly,
// without re-implementing the builder: names, row counts per drug, row keys and
// the verbatim row text the reverse-path evaluator renders (`row.note`).

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type SnapshotRecord = {
  slug: string;
  name: string;
  sections?: { type?: string; rows?: { key: string; val?: string }[] }[];
};

type InteractionIndex = {
  generatedFrom: string;
  sourceRowCount: number;
  names: Record<string, string>;
  bySlug: Record<string, { rows: { rowKey: string; rowIndex: number; note: string }[] }>;
};

const SNAPSHOT_PATH = "data/medications-snapshot.json";
const INDEX_PATH = "data/medication-interaction-index.json";

/**
 * Every way the index can disagree with the snapshot it claims to derive from.
 * Pure so the failure shape can be proved below with a mutated record, not by
 * editing committed data.
 */
export function indexSnapshotMismatches(index: InteractionIndex, records: SnapshotRecord[]): string[] {
  const mismatches: string[] = [];
  const snapshotSlugs = new Set(records.map((record) => record.slug));
  let interactionRows = 0;

  for (const record of records) {
    if (index.names[record.slug] !== record.name) {
      mismatches.push(
        `names[${record.slug}]: index says ${JSON.stringify(index.names[record.slug])}, snapshot says ${JSON.stringify(record.name)}`,
      );
    }
    const rows = (record.sections ?? [])
      .filter((section) => section.type === "inter")
      .flatMap((section) => section.rows ?? []);
    interactionRows += rows.length;
    const entry = index.bySlug[record.slug];
    if (rows.length === 0) {
      if (entry)
        mismatches.push(
          `bySlug[${record.slug}]: index carries ${entry.rows.length} row(s) but the snapshot has no interaction rows`,
        );
      continue;
    }
    if (!entry) {
      mismatches.push(
        `bySlug[${record.slug}]: snapshot has ${rows.length} interaction row(s) but the index has no entry`,
      );
      continue;
    }
    if (entry.rows.length !== rows.length) {
      mismatches.push(`bySlug[${record.slug}]: index has ${entry.rows.length} row(s), snapshot has ${rows.length}`);
      continue;
    }
    rows.forEach((row, rowIndex) => {
      const indexed = entry.rows[rowIndex];
      if (indexed.rowIndex !== rowIndex || indexed.rowKey !== row.key) {
        mismatches.push(
          `bySlug[${record.slug}].rows[${rowIndex}]: key ${JSON.stringify(indexed.rowKey)} does not match snapshot key ${JSON.stringify(row.key)}`,
        );
      }
      if (indexed.note !== (row.val ?? "")) {
        mismatches.push(`bySlug[${record.slug}].rows[${rowIndex}]: note text differs from the snapshot row`);
      }
    });
  }

  for (const slug of Object.keys(index.names)) {
    if (!snapshotSlugs.has(slug)) mismatches.push(`names[${slug}]: index names a drug the snapshot no longer has`);
  }
  for (const slug of Object.keys(index.bySlug)) {
    if (!snapshotSlugs.has(slug))
      mismatches.push(`bySlug[${slug}]: index carries rows for a drug the snapshot no longer has`);
  }
  if (index.sourceRowCount !== interactionRows) {
    mismatches.push(
      `sourceRowCount: index says ${index.sourceRowCount}, snapshot has ${interactionRows} interaction rows`,
    );
  }
  return mismatches;
}

const records = JSON.parse(readFileSync(path.resolve(process.cwd(), SNAPSHOT_PATH), "utf8")) as SnapshotRecord[];
const index = JSON.parse(readFileSync(path.resolve(process.cwd(), INDEX_PATH), "utf8")) as InteractionIndex;

describe("medication interaction index freshness (M30)", () => {
  it("declares the committed snapshot as its source", () => {
    expect(index.generatedFrom).toBe(SNAPSHOT_PATH);
  });

  it("matches the committed medication snapshot drug for drug and row for row", () => {
    const mismatches = indexSnapshotMismatches(index, records);
    expect(
      mismatches,
      `data/medication-interaction-index.json is stale — run \`npm run medications:interactions\` and commit the result:\n${mismatches.join("\n")}`,
    ).toEqual([]);
  });

  it("reports a renamed drug, an added row and edited row text as stale", () => {
    const withRows = records.find((record) =>
      (record.sections ?? []).some((section) => section.type === "inter" && (section.rows?.length ?? 0) > 0),
    );
    expect(withRows, "the snapshot has no drug with interaction rows to mutate").toBeDefined();
    const mutated = structuredClone(records) as SnapshotRecord[];
    const target = mutated.find((record) => record.slug === withRows!.slug)!;
    target.name = `${target.name} (renamed)`;
    const section = target.sections!.find((item) => item.type === "inter")!;
    section.rows![0].val = `HIGH — ${section.rows![0].val ?? ""}`;
    section.rows!.push({ key: "Added row", val: "CRITICAL — new interaction nobody indexed" });

    const mismatches = indexSnapshotMismatches(index, mutated);
    expect(mismatches.some((line) => line.startsWith(`names[${target.slug}]`))).toBe(true);
    expect(mismatches.some((line) => line.startsWith(`bySlug[${target.slug}]`))).toBe(true);
    expect(mismatches.some((line) => line.startsWith("sourceRowCount"))).toBe(true);
  });
});
