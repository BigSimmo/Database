import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import formulationContent from "@/data/formulation-content.json";
import formulationMechanismIndexJson from "@/data/formulation-mechanism-index.json";
import { formulationMechanisms, searchFormulationMechanisms } from "@/lib/formulation";
import {
  formulationDomains,
  formulationMechanismIndex,
  formulationQualityPrompts,
  formulationSections,
  formulationTemplates,
  searchFormulationMechanismIndex,
} from "@/lib/formulation-mechanism-index";

/**
 * `src/lib/formulation.ts` statically imports the whole 108,724-byte content
 * bundle, and five client components imported that module — so every visitor to
 * Formulation downloaded the structured evidence citations (20,467 bytes,
 * 22.3% of the file), the caveats, the case examples and the review metadata.
 * None of it is read in the browser: `evidence` has exactly one consumer, the
 * server-rendered mechanism page.
 *
 * The client reads `formulation-mechanism-index.json` instead. Like
 * `formulation-concept-index.json` it is hand-maintained, with no generator
 * script, so this file is the only thing keeping it honest: it pins every
 * carried field against the full record, pins that every held field stays out,
 * and pins that the two record sets rank identically.
 */

const CARRIED_FIELDS = [
  "id",
  "name",
  "definition",
  "summary",
  "coreProcess",
  "formulationUse",
  "symptoms",
  "diagnosticContexts",
  "domains",
  "tags",
  "clinicalClues",
  "patientPhrases",
  "fitIndicators",
  "poorFitIndicators",
  "maintainingCycles",
  "predisposing",
  "precipitating",
  "perpetuating",
  "protective",
  "treatmentImplications",
  "treatmentLeverage",
  "exampleSentence",
] as const;

/** Server-only. Adding one of these to the index is the regression this pins. */
const HELD_FIELDS = [
  "evidence",
  "caveats",
  "caseExample",
  "development",
  "treatmentTargetExample",
  "comparisonNotes",
  "sources",
  "conceptId",
  "reviewStatus",
  "sourceStatus",
  "sourceConfidence",
  "version",
] as const;

describe("formulation mechanism index", () => {
  it("keeps the client index in step with the full records", () => {
    expect(formulationMechanismIndex).toHaveLength(formulationMechanisms.length);
    expect(formulationMechanismIndex.map((entry) => entry.id)).toEqual(
      formulationMechanisms.map((mechanism) => mechanism.id),
    );

    for (const [position, entry] of formulationMechanismIndex.entries()) {
      const full = formulationMechanisms[position] as unknown as Record<string, unknown>;
      for (const field of CARRIED_FIELDS) {
        expect(entry[field], `${entry.id}.${field}`).toEqual(full[field]);
      }
      // Nothing server-only may leak into the client index.
      for (const field of HELD_FIELDS) {
        expect(entry, `${entry.id}.${field}`).not.toHaveProperty(field);
      }
      expect(Object.keys(entry).sort()).toEqual([...CARRIED_FIELDS].sort());
    }
  });

  it("carries the shared taxonomy and builder scaffolding unchanged", () => {
    expect(formulationDomains).toEqual(formulationContent.domains);
    expect(formulationTemplates).toEqual(formulationContent.formulationTemplates);
    expect(formulationSections).toEqual(formulationContent.formulationSections);
    expect(formulationQualityPrompts).toEqual(formulationContent.formulationQualityPrompts);
    expect(formulationMechanismIndexJson.comparisonGuidance).toEqual(formulationContent.comparisonGuidance);
  });

  it("ranks identically to the full records, so the browser's order is the server's", () => {
    for (const query of [
      "",
      "rumination",
      "I keep going over it",
      "avoidance",
      "what if something goes wrong",
      "zzzznothing",
    ]) {
      const full = searchFormulationMechanisms(query, { interpretNaturalLanguage: true });
      const indexed = searchFormulationMechanismIndex(query, { interpretNaturalLanguage: true });
      expect(
        indexed.map((result) => [result.mechanism.id, result.score]),
        `query ${query || "(none)"}`,
      ).toEqual(full.map((result) => [result.mechanism.id, result.score]));
    }
  });

  it("measurably shrinks what the browser downloads", () => {
    const content = readFileSync("src/data/formulation-content.json");
    const index = readFileSync("src/data/formulation-mechanism-index.json");
    expect(index.length).toBeLessThan(content.length * 0.6);
    expect(index.toString("utf8")).not.toContain('"evidence"');
  });
});

/**
 * The saving only holds while no client component reaches the full module, by
 * any path. A single value import anywhere in a client subgraph pulls the whole
 * bundle back into the browser, which is exactly how it got there.
 */
describe("formulation client bundle", () => {
  const SRC = path.resolve("src");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
    });
  }

  /** Runtime imports only: `import type` and `export type` are erased. */
  function runtimeImports(code: string) {
    const withoutTypeOnly = code
      .replace(/\bimport\s+type\s+[\s\S]*?from\s*["'][^"']+["']/g, "")
      .replace(/\bexport\s+type\s+\{[\s\S]*?\}\s*from\s*["'][^"']+["']/g, "");
    return [...withoutTypeOnly.matchAll(/from\s*["'](@\/[^"']+)["']/g)].map((match) => match[1]);
  }

  function resolveAlias(specifier: string) {
    const base = path.join(SRC, specifier.slice("@/".length));
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // Not this extension.
      }
    }
    return null;
  }

  it("never reaches the full mechanism bundle from a client component", () => {
    const files = sourceFiles(SRC);
    const code = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
    const target = path.join(SRC, "lib", "formulation.ts");

    const seen = new Set<string>();
    const trail = new Map<string, string>();
    const queue = files.filter((file) => /^\s*["']use client["']/m.test(code.get(file) ?? ""));
    for (const entry of queue) seen.add(entry);

    while (queue.length) {
      const file = queue.shift()!;
      for (const specifier of runtimeImports(code.get(file) ?? "")) {
        const resolved = resolveAlias(specifier);
        if (!resolved || seen.has(resolved)) continue;
        seen.add(resolved);
        trail.set(resolved, file);
        queue.push(resolved);
      }
    }

    // The crawl is only evidence if it reaches library modules at all: the
    // trimmed index is imported by four client pages, so its absence would mean
    // the traversal, not the bundle, is what changed.
    expect(seen.has(path.join(SRC, "lib", "formulation-mechanism-index.ts"))).toBe(true);

    const chain: string[] = [];
    for (let step: string | undefined = target; step; step = trail.get(step)) chain.push(path.relative(SRC, step));
    expect(seen.has(target), `client subgraph reaches src/lib/formulation.ts via ${chain.join(" <- ")}`).toBe(false);
  });
});
