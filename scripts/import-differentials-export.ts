import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { buildDifferentialSnapshot } from "./lib/parse-differentials-export";

const DEFAULT_SOURCE_ZIP = "C:/Users/joshs/AppData/Local/Temp/differentials-data.zip";
const OUTPUT_PATH = path.join(process.cwd(), "data", "differentials-snapshot.json");

type ImportArgs = {
  source?: string;
  write: boolean;
};

function parseArgs(argv: string[]): ImportArgs {
  const args: ImportArgs = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--source") {
      args.source = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function resolveSourcePath(explicit?: string) {
  if (explicit) return path.resolve(explicit);
  if (existsSync(DEFAULT_SOURCE_ZIP)) return DEFAULT_SOURCE_ZIP;
  throw new Error(`No differentials export found. Pass --source <path> or place zip at ${DEFAULT_SOURCE_ZIP}.`);
}

async function readZipDirectory(zipPath: string) {
  const buffer = readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const files = new Map<string, string>();
  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) return;
      files.set(entry.name.replace(/\\/g, "/"), await entry.async("string"));
    }),
  );
  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolveSourcePath(args.source);
  console.log(`[differentials:import] source ${sourcePath}`);

  const files = await readZipDirectory(sourcePath);
  const entryFiles = [...files.entries()]
    .filter(([name]) => name.startsWith("03_individual_entries/") && name.endsWith(".txt"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, content]) => ({ name, content }));

  const snapshot = buildDifferentialSnapshot({
    entryFiles,
    tagIndexMarkdown: files.get("06_tags_and_search/tag_index.md") ?? "",
    presetsMarkdown: files.get("05_scenario_presets/presets.md") ?? "",
    flowsMarkdown: files.get("04_red_flag_flows/flows.md") ?? "",
    aliasesMarkdown: files.get("06_tags_and_search/search_aliases.md") ?? "",
    governanceMarkdown: files.get("07_governance/source_info.md") ?? "",
  });

  console.log(
    `[differentials:import] ${snapshot.presentations.length} presentations, ${snapshot.diagnoses.length} diagnoses, ${snapshot.presets.length} presets, ${snapshot.redFlagFlows.length} flows`,
  );

  if (!args.write) {
    console.log(`[differentials:import] Dry run. Re-run with --write to update ${OUTPUT_PATH}.`);
    return;
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`[differentials:import] Wrote snapshot to ${OUTPUT_PATH}.`);
}

main().catch((error) => {
  console.error(`[differentials:import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
