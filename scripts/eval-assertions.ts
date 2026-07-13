// Offline eval for medspaCy assertion tagging (worker/python/analyze_assertions.py).
// No providers, no Supabase — local Python only. This is the acceptance gate that must
// be reviewed before WORKER_MEDSPACY_ASSERTION is ever enabled, and before any future
// PR consumes chunk metadata.assertion in the answer pipeline.
//
// Usage: npm run eval:assertions [-- --fixture path --min-accuracy 0.8 --json-out path]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { annotateChunkAssertions } from "../worker/assertion-tagging";

const expectationSchema = z.object({
  negated: z.array(z.string()).default([]),
  uncertain: z.array(z.string()).default([]),
  family: z.array(z.string()).default([]),
  historical: z.array(z.string()).default([]),
  asserted: z.array(z.string()).default([]),
});

const goldenCaseSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  targets: z.array(z.string()).min(1),
  expect: expectationSchema,
});

const fixtureSchema = z.object({
  description: z.string().optional(),
  cases: z.array(goldenCaseSchema).min(1),
});

type Check = {
  caseId: string;
  category: "negated" | "uncertain" | "family" | "historical" | "asserted";
  term: string;
  pass: boolean;
  detail: string;
};

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function normalizeTerm(term: string) {
  return term.trim().toLowerCase();
}

async function main() {
  const fixturePath = argValue("--fixture") ?? path.join("scripts", "fixtures", "assertion-golden.json");
  const minAccuracy = Number(argValue("--min-accuracy") ?? "0.8");
  const jsonOut = argValue("--json-out");

  const fixture = fixtureSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));

  // One Python invocation for the whole fixture: union the targets (extra targets are
  // harmless — they only match if present in a text) and key chunks by case id.
  const targets = Array.from(new Set(fixture.cases.flatMap((c) => c.targets.map(normalizeTerm))));
  const assertions = await annotateChunkAssertions(
    fixture.cases.map((c) => ({ id: c.id, text: c.text })),
    targets,
  );
  if (assertions.size === 0) {
    console.error(
      "Assertion tagging returned no results — is medspacy installed? (pip install -r worker/python/requirements.txt)",
    );
    process.exit(1);
  }

  const checks: Check[] = [];
  for (const goldenCase of fixture.cases) {
    const tagged = assertions.get(goldenCase.id);
    const negated = (tagged?.negated_terms ?? []).map(normalizeTerm);
    const uncertain = (tagged?.uncertain_terms ?? []).map(normalizeTerm);
    const family = (tagged?.family_terms ?? []).map(normalizeTerm);
    const historical = (tagged?.historical_terms ?? []).map(normalizeTerm);

    const membership: Array<[Check["category"], string[], string[]]> = [
      ["negated", goldenCase.expect.negated, negated],
      ["uncertain", goldenCase.expect.uncertain, uncertain],
      ["family", goldenCase.expect.family, family],
      ["historical", goldenCase.expect.historical, historical],
    ];
    for (const [category, expected, actual] of membership) {
      for (const term of expected.map(normalizeTerm)) {
        const pass = actual.includes(term);
        checks.push({
          caseId: goldenCase.id,
          category,
          term,
          pass,
          detail: pass ? "ok" : `expected "${term}" in ${category}_terms, got [${actual.join(", ")}]`,
        });
      }
    }
    // Asserted terms must NOT be flagged negated or uncertain (family/historical
    // flags are contextual qualifiers, not existence changes, so they don't fail it).
    for (const term of goldenCase.expect.asserted.map(normalizeTerm)) {
      const wrongly = [
        ...(negated.includes(term) ? ["negated"] : []),
        ...(uncertain.includes(term) ? ["uncertain"] : []),
      ];
      const pass = wrongly.length === 0;
      checks.push({
        caseId: goldenCase.id,
        category: "asserted",
        term,
        pass,
        detail: pass ? "ok" : `asserted term "${term}" wrongly flagged: ${wrongly.join(", ")}`,
      });
    }
  }

  const byCategory = new Map<string, { pass: number; total: number }>();
  for (const check of checks) {
    const bucket = byCategory.get(check.category) ?? { pass: 0, total: 0 };
    bucket.total += 1;
    if (check.pass) bucket.pass += 1;
    byCategory.set(check.category, bucket);
  }
  const failures = checks.filter((check) => !check.pass);
  const accuracy = checks.length === 0 ? 0 : (checks.length - failures.length) / checks.length;

  console.log("\nAssertion tagging eval");
  console.log("======================");
  for (const [category, bucket] of byCategory) {
    console.log(`${category.padEnd(11)} ${bucket.pass}/${bucket.total}`);
  }
  console.log(`overall     ${(accuracy * 100).toFixed(1)}% (min ${(minAccuracy * 100).toFixed(0)}%)`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log(`- [${failure.caseId}] ${failure.detail}`);
    }
  }

  if (jsonOut) {
    await writeFile(jsonOut, JSON.stringify({ accuracy, minAccuracy, checks }, null, 2), "utf8");
    console.log(`\nWrote ${jsonOut}`);
  }

  if (accuracy < minAccuracy) {
    console.error(
      `\nFAIL: accuracy ${(accuracy * 100).toFixed(1)}% below threshold ${(minAccuracy * 100).toFixed(0)}%.`,
    );
    process.exit(1);
  }
  console.log("\nPASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
