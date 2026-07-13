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
  // Free-text rationale for non-obvious expectations (JSON has no comments).
  note: z.string().optional(),
  expect: expectationSchema,
});

const fixtureSchema = z.object({
  description: z.string().optional(),
  cases: z.array(goldenCaseSchema).min(1),
});

type Check = {
  caseId: string;
  category: "negated" | "uncertain" | "family" | "historical" | "no-false-negation" | "no-false-uncertainty";
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
  // A mistyped threshold must fail loudly, never silently disable the gate:
  // accuracy < NaN is always false, which would report PASS at any score.
  if (!Number.isFinite(minAccuracy) || minAccuracy < 0 || minAccuracy > 1) {
    throw new Error(`--min-accuracy must be a number between 0 and 1 (got "${argValue("--min-accuracy")}").`);
  }

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
    // False-positive gate: EVERY target the case does not expect in an
    // existence-changing category (negated/uncertain) must be absent from it —
    // an over-broad ConText rule must fail here, not pass silently. Family and
    // historical stay positive-only: they are contextual qualifiers, and cases
    // may legitimately overlap them with asserted mentions.
    const expectedNegated = new Set(goldenCase.expect.negated.map(normalizeTerm));
    const expectedUncertain = new Set(goldenCase.expect.uncertain.map(normalizeTerm));
    for (const term of goldenCase.targets.map(normalizeTerm)) {
      if (!expectedNegated.has(term)) {
        const pass = !negated.includes(term);
        checks.push({
          caseId: goldenCase.id,
          category: "no-false-negation",
          term,
          pass,
          detail: pass ? "ok" : `target "${term}" wrongly flagged negated`,
        });
      }
      if (!expectedUncertain.has(term)) {
        const pass = !uncertain.includes(term);
        checks.push({
          caseId: goldenCase.id,
          category: "no-false-uncertainty",
          term,
          pass,
          detail: pass ? "ok" : `target "${term}" wrongly flagged uncertain`,
        });
      }
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
