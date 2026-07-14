import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildClinicalReviewQueue } from "@/lib/clinical-review-queue";

type Args = { input?: string; output?: string; help: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    if (token === "--input") args.input = value;
    else if (token === "--output") args.output = value;
    else throw new Error(`Unknown option: ${token}`);
    index += 1;
  }
  return args;
}

function usage() {
  return [
    "Usage: node scripts/run-tsx.mjs scripts/build-clinical-review-queue.ts --input <eval.json> [--output <queue.json>]",
    "",
    "Builds a deterministic, deduplicated review queue without changing source governance statuses.",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input) throw new Error("--input is required.");
  const input = JSON.parse(await readFile(args.input, "utf8")) as unknown;
  const output = `${JSON.stringify(buildClinicalReviewQueue(input), null, 2)}\n`;
  if (args.output) {
    await writeFile(args.output, output, "utf8");
    console.log(`Wrote clinical review queue to ${args.output}`);
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
