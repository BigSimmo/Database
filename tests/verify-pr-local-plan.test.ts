import { describe, expect, it } from "vitest";

import { classifyChangedFiles } from "../scripts/lib/ci-change-scope.mjs";
import { buildPrLocalPlan } from "../scripts/lib/pr-local-plan.mjs";

function labels(files: string[], extended = false) {
  return buildPrLocalPlan(classifyChangedFiles(files), { extended }).map((entry) => entry.label);
}

describe("PR-local command planning", () => {
  it("keeps the default gate provider-free and deterministic", () => {
    expect(labels(["docs/operator-note.md"])).toEqual(["npm run format:check", "npm run verify:cheap"]);
    expect(labels(["src/app/api/answer/route.ts"])).toEqual([
      "npm run format:check",
      "npm run verify:cheap",
      "npm run build",
      "npm run eval:rag:offline",
    ]);
    expect(labels(["src/components/ClinicalDashboard.tsx"])).toEqual([
      "npm run format:check",
      "npm run verify:cheap",
      "npm run build",
    ]);
  });

  it("retains broader lanes only for explicitly extended runs", () => {
    expect(labels(["src/app/api/answer/route.ts"], true)).toEqual(
      expect.arrayContaining([
        "npm run test:coverage",
        "npm audit --omit=dev --audit-level=high",
        "npm run check:edge:functions",
        "npm run check:production-readiness:ci",
        "npm run build",
        "npm run eval:rag:offline",
      ]),
    );
    expect(labels(["src/components/ClinicalDashboard.tsx"], true)).toEqual(
      expect.arrayContaining(["npm run ensure", "npm run test:e2e:critical"]),
    );
    expect(labels(["supabase/migrations/20260710000000_example.sql"], true)).toEqual(
      expect.arrayContaining(["docker info", "supabase --version", "supabase start", "supabase db reset"]),
    );
  });
});
