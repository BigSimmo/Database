import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { env } from "../src/lib/env";
import { clinicalVocabularyEntries } from "../src/lib/clinical-vocabulary";

// Flag-gated (WORKER_MEDSPACY_ASSERTION) clinical assertion tagging. Chunk texts are
// batched through worker/python/analyze_assertions.py (medspaCy ConText) and the
// results land as a namespaced `assertion` key inside document_chunks.metadata jsonb.
// Nothing consumes the annotations yet — eval-first via `npm run eval:assertions`.
// Contract: FAIL-OPEN. Assertion tagging must never fail or block an ingestion job.

export const chunkAssertionSchema = z.object({
  id: z.string(),
  negated_terms: z.array(z.string()).default([]),
  uncertain_terms: z.array(z.string()).default([]),
  family_terms: z.array(z.string()).default([]),
  historical_terms: z.array(z.string()).default([]),
});

export const assertionPayloadSchema = z.object({
  assertions: z.array(chunkAssertionSchema),
  version: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});

export type ChunkAssertion = z.infer<typeof chunkAssertionSchema>;
export type AssertionPayload = z.infer<typeof assertionPayloadSchema>;
export type AssertionInputChunk = { id: string; text: string };
export type AssertionMetadata = {
  negated_terms: string[];
  uncertain_terms: string[];
  family_terms: string[];
  historical_terms: string[];
  medspacy_version: string | null;
};

/** Raw script output (file contents or stdout) -> validated payload. Throws on garbage. */
export function parseAssertionPayload(raw: string): AssertionPayload {
  return assertionPayloadSchema.parse(JSON.parse(raw));
}

export function assertionMetadataValue(assertion: ChunkAssertion, version?: string): AssertionMetadata {
  return {
    negated_terms: assertion.negated_terms,
    uncertain_terms: assertion.uncertain_terms,
    family_terms: assertion.family_terms,
    historical_terms: assertion.historical_terms,
    medspacy_version: version ?? null,
  };
}

/** ConText only marks supplied targets; the worker tags the clinical vocabulary. */
export function defaultAssertionTargets(): string[] {
  const targets = new Set<string>();
  for (const entry of clinicalVocabularyEntries()) {
    if (entry.type === "typo") continue;
    targets.add(entry.canonical.toLowerCase());
    for (const alias of entry.aliases) targets.add(alias.toLowerCase());
  }
  return Array.from(targets);
}

export type AssertionScriptRunner = (input: { chunks: AssertionInputChunk[]; targets: string[] }) => Promise<string>;

function extractJsonFromStdout(stdout: string) {
  const first = stdout.indexOf("{");
  const last = stdout.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) {
    throw new Error("Assertion script produced no JSON output.");
  }
  return stdout.slice(first, last + 1);
}

export const runAssertionScript: AssertionScriptRunner = async (input) => {
  const scriptPath = path.join(process.cwd(), "worker", "python", "analyze_assertions.py");
  const workDir = await mkdtemp(path.join(tmpdir(), "clinical-kb-assertions-"));
  const inputPath = path.join(workDir, "input.json");
  const outputPath = path.join(workDir, "output.json");
  try {
    await writeFile(inputPath, JSON.stringify(input), "utf8");
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(env.PYTHON_BIN, [scriptPath, inputPath, outputPath], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => {
        out += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        err += chunk.toString();
      });
      child.on("error", (error) => reject(new Error(`Assertion script failed to start: ${error.message}`)));
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(err.trim() || `Assertion script exited with ${code}`));
          return;
        }
        resolve(out);
      });
    });
    // File first (robust against stray prints), stdout JSON as fallback —
    // same contract as the PDF extractor (src/lib/extractors/document.ts).
    try {
      return await readFile(outputPath, "utf8");
    } catch {
      return extractJsonFromStdout(stdout);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};

/**
 * Tag chunks with assertion metadata, keyed by chunk id. Fail-open: any script,
 * parse, or validation failure logs a warning and returns an empty map so the
 * ingestion job proceeds without annotations.
 */
export async function annotateChunkAssertions(
  chunks: AssertionInputChunk[],
  targets: string[],
  runner: AssertionScriptRunner = runAssertionScript,
): Promise<Map<string, AssertionMetadata>> {
  if (chunks.length === 0 || targets.length === 0) return new Map();
  try {
    const payload = parseAssertionPayload(await runner({ chunks, targets }));
    for (const warning of payload.warnings) {
      console.warn(`Assertion tagging warning: ${warning}`);
    }
    return new Map(
      payload.assertions.map((assertion) => [assertion.id, assertionMetadataValue(assertion, payload.version)]),
    );
  } catch (error) {
    console.warn(
      `Assertion tagging failed; continuing without assertion metadata: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new Map();
  }
}
