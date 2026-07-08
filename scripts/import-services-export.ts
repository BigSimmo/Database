import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_SOURCE_JSON = "C:/Dev/Apps/Services/catalog/services.catalog.json";
const DEFAULT_SOURCE_ZIP = "C:/Dev/Apps/Services/services-information.zip";
const OUTPUT_PATH = path.join(process.cwd(), "data", "services-snapshot.json");
const EXPECTED_SERVICE_COUNT = 219;

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
  if (existsSync(DEFAULT_SOURCE_JSON)) return DEFAULT_SOURCE_JSON;
  throw new Error(
    `No services export found. Pass --source <path> or place services-information.zip at ${DEFAULT_SOURCE_ZIP}.`,
  );
}

function findCatalogInDirectory(directory: string) {
  const candidates = [
    path.join(directory, "catalog", "services.catalog.json"),
    path.join(directory, "services.catalog.json"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function extractZip(zipPath: string) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "services-import-"));
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force"`,
        { stdio: "pipe" },
      );
    } else {
      execSync(`unzip -oq ${JSON.stringify(zipPath)} -d ${JSON.stringify(tempDir)}`, { stdio: "pipe" });
    }
    const catalogPath = findCatalogInDirectory(tempDir);
    if (!catalogPath) {
      throw new Error("catalog/services.catalog.json not found inside export zip.");
    }
    return readFileSync(catalogPath, "utf8");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function loadExportJson(sourcePath: string) {
  if (sourcePath.toLowerCase().endsWith(".zip")) {
    return extractZip(sourcePath);
  }
  return readFileSync(sourcePath, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolveSourcePath(args.source);
  console.log(`[services:import] source ${sourcePath}`);

  const raw = loadExportJson(sourcePath);
  const parsed = JSON.parse(raw) as { service_count?: number; services?: unknown[] };
  if (!Array.isArray(parsed.services)) {
    throw new Error("Expected services export to include a services[] array.");
  }

  const serviceCount = parsed.service_count ?? parsed.services.length;
  if (serviceCount !== EXPECTED_SERVICE_COUNT || parsed.services.length !== EXPECTED_SERVICE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SERVICE_COUNT} services (service_count=${serviceCount}, services.length=${parsed.services.length}).`,
    );
  }

  console.log(`[services:import] ${parsed.services.length} services parsed`);

  if (!args.write) {
    console.log(`[services:import] Dry run. Re-run with --write to update ${OUTPUT_PATH}.`);
    return;
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`[services:import] Wrote ${parsed.services.length} services to ${OUTPUT_PATH}.`);
}

main().catch((error) => {
  console.error(`[services:import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
