import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  assertRecoveryReadinessForOperation,
  parseRecoveryReadinessEvidence,
  type RecoveryOperation,
} from "../src/lib/recovery-readiness-evidence";

type CliDependencies = {
  readFile: (path: string) => string;
  now: () => Date;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const MAX_ARTIFACT_BYTES = 65_536;

const defaultDependencies: CliDependencies = {
  readFile: (path) => readFileSync(path, "utf8"),
  now: () => new Date(),
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

function parseArgs(argv: readonly string[]) {
  let file: string | undefined;
  let operation: RecoveryOperation | undefined;
  let projectRef: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--file") file = argv[++index];
    else if (token === "--operation") {
      const value = argv[++index];
      if (value !== "site_release" && value !== "document_generation") {
        throw new Error("--operation must be site_release or document_generation");
      }
      operation = value;
    } else if (token === "--project-ref") projectRef = argv[++index];
    else throw new Error("Unsupported recovery readiness verifier argument.");
  }
  if (!file || !operation || !projectRef) {
    throw new Error("--file, --operation, and --project-ref are required");
  }
  return { file, operation, projectRef };
}

export function runRecoveryReadinessEvidenceCli(
  argv: readonly string[],
  dependencies: CliDependencies = defaultDependencies,
): number {
  try {
    const args = parseArgs(argv);
    const raw = dependencies.readFile(args.file);
    if (Buffer.byteLength(raw, "utf8") > MAX_ARTIFACT_BYTES) throw new Error("Evidence artifact is too large.");
    const input: unknown = JSON.parse(raw);
    const evidence = parseRecoveryReadinessEvidence(input);
    assertRecoveryReadinessForOperation(evidence, args.operation, args.projectRef, { now: dependencies.now });
    dependencies.stdout(
      JSON.stringify({
        status: "pass",
        version: evidence.version,
        operation: evidence.operation,
        projectRefDigest: createHash("sha256").update(evidence.projectRef, "utf8").digest("hex"),
        evidenceDigest: evidence.digest,
        validUntil: evidence.validUntil,
      }),
    );
    return 0;
  } catch {
    dependencies.stderr("FAIL: recovery readiness evidence rejected.");
    return 1;
  }
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) process.exitCode = runRecoveryReadinessEvidenceCli(process.argv.slice(2));
