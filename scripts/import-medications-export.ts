import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type MedicationExportRecord = {
  slug: string;
  name: string;
  class: string;
  subclass: string;
  category: string;
  accent: string;
  tag: string;
  schedule: string;
  stats: unknown[];
  sections: unknown[];
  quick: unknown[];
};

function defaultExportPath() {
  return path.resolve("C:/Dev/Apps/Medications/medications-export.zip");
}

function canonicalSnapshotPath() {
  return path.resolve("C:/Dev/Apps/Medications/scripts/src/drugs-snapshot.json");
}

function outputPath() {
  return path.resolve(process.cwd(), "data/medications-snapshot.json");
}

function normalizeRecord(record: MedicationExportRecord): MedicationExportRecord {
  return {
    slug: String(record.slug).trim().toLowerCase(),
    name: String(record.name).trim(),
    class: String(record.class ?? "").trim(),
    subclass: String(record.subclass ?? "").trim(),
    category: String(record.category ?? "").trim(),
    accent: String(record.accent ?? "#0f766e").trim(),
    tag: String(record.tag ?? "").trim(),
    schedule: String(record.schedule ?? "").trim(),
    stats: Array.isArray(record.stats) ? record.stats : [],
    sections: Array.isArray(record.sections) ? record.sections : [],
    quick: Array.isArray(record.quick) ? record.quick : [],
  };
}

function loadFromCanonicalSnapshot(): MedicationExportRecord[] {
  const snapshotPath = canonicalSnapshotPath();
  if (!existsSync(snapshotPath)) {
    throw new Error(`Canonical snapshot not found at ${snapshotPath}`);
  }
  const records = JSON.parse(readFileSync(snapshotPath, "utf8")) as MedicationExportRecord[];
  if (!Array.isArray(records)) {
    throw new Error(`Canonical snapshot is not an array: ${snapshotPath}`);
  }
  return records.map(normalizeRecord);
}

function loadFromZip(zipPath: string): MedicationExportRecord[] {
  const script = `
import json, zipfile, sys
zip_path = sys.argv[1]
records = []
with zipfile.ZipFile(zip_path) as zf:
    for name in zf.namelist():
        if not name.startswith("all-medications/") or not name.endswith(".json"):
            continue
        records.append(json.loads(zf.read(name).decode("utf-8")))
records.sort(key=lambda item: item["name"].lower())
print(json.dumps(records))
`;
  const output = execFileSync("python", ["-c", script, zipPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(output) as MedicationExportRecord[]).map(normalizeRecord);
}

function main() {
  const zipArg = process.argv.find((token) => token.startsWith("--zip="))?.slice("--zip=".length);
  const zipPath = zipArg ? path.resolve(zipArg) : defaultExportPath();
  const out = outputPath();
  mkdirSync(path.dirname(out), { recursive: true });

  let records: MedicationExportRecord[];
  let source: string;
  if (existsSync(canonicalSnapshotPath())) {
    records = loadFromCanonicalSnapshot();
    source = canonicalSnapshotPath();
  } else if (existsSync(zipPath)) {
    records = loadFromZip(zipPath);
    source = zipPath;
  } else {
    throw new Error(`No canonical snapshot and zip not found at ${zipPath}`);
  }

  const slugs = new Set<string>();
  for (const record of records) {
    if (!record.slug) throw new Error(`Medication missing slug: ${record.name}`);
    if (slugs.has(record.slug)) throw new Error(`Duplicate slug: ${record.slug}`);
    slugs.add(record.slug);
  }

  writeFileSync(out, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  console.log(`[medications:import] Wrote ${records.length} medications from ${source}`);
  console.log(`[medications:import] Output: ${out}`);
}

main();
