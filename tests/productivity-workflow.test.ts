import { describe, expect, it } from "vitest";

import {
  analyzeFailureText,
  buildWorkflowPlan,
  classifyRisks,
  extractOperatorItemsFromText,
  providerCommandPattern,
} from "../scripts/productivity-core.mjs";
import { resolveExternalWorkflow, workflowRootCandidates } from "../scripts/external-workflow.mjs";

describe("productivity workflow planning", () => {
  it("classifies UI, retrieval, clinical, and privacy risk from changed paths", () => {
    const risks = classifyRisks([
      "src/components/ClinicalDashboard.tsx",
      "src/lib/retrieval-selection.ts",
      "src/lib/owner-scope.ts",
    ]);

    expect(risks.ui).toBe(true);
    expect(risks.retrieval).toBe(true);
    expect(risks.clinical).toBe(true);
    expect(risks.privacy).toBe(true);
  });

  it("never places provider commands in the executable local plan", () => {
    const plan = buildWorkflowPlan("flightplan", [
      "src/app/api/answer/route.ts",
      "supabase/migrations/20260717000000_example.sql",
    ]);

    expect(plan.localChecks.some((item: { command: string }) => providerCommandPattern.test(item.command))).toBe(false);
    expect(plan.approvalRequired.map((item: { command: string }) => item.command)).toContain(
      "npm run check:supabase-project",
    );
    expect(plan.approvalRequired.map((item: { command: string }) => item.command)).toContain(
      "npm run eval:retrieval:quality",
    );
  });

  it("keeps the design sweep local and covers the established breakpoint proof", () => {
    const plan = buildWorkflowPlan("design-sweep", ["src/components/ClinicalDashboard.tsx"]);

    expect(plan.approvalRequired).toEqual([]);
    expect(plan.localChecks.map((item: { command: string }) => item.command)).toContain("npm run verify:ui");
    expect(plan.proof.join(" ")).toContain("320, 390, 639, 768, 1440, and 1920");
  });

  it("rejects unknown lifecycle phases", () => {
    expect(() => buildWorkflowPlan("lifecycle", [], { phase: "publish-everything" })).toThrow(
      "Unknown lifecycle phase",
    );
  });

  it("classifies common failure signatures", () => {
    expect(analyzeFailureText("Error: Cannot find module 'workflow-status.mjs'").category).toBe("environment");
    expect(analyzeFailureText("OPENAI_API_KEY missing").category).toBe("provider-or-configuration");
    expect(analyzeFailureText("AssertionError: expected 2 received 3").category).toBe("probable-regression");
  });

  it("extracts only actionable operator markers", () => {
    const items = extractOperatorItemsFromText(
      "# Heading\n| Live gate | ⏳ pending | run later |\n- Operator-only: rotate key\n- completed",
      "docs/example.md",
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ source: "docs/example.md", line: 2 });
  });
});

describe("external workflow portability", () => {
  it("derives the shared workflow directory from the Git common directory", () => {
    const candidates = workflowRootCandidates(
      "C:\\Users\\example\\.codex\\worktrees\\1234\\Database",
      "C:\\Dev\\Apps\\Database\\.git",
      { NODE_ENV: "test" },
    );

    expect(candidates.some((candidate) => candidate.replaceAll("\\", "/").endsWith("/Dev/Apps/.local-dev"))).toBe(true);
  });

  it("rejects unknown shared workflow names", () => {
    expect(() => resolveExternalWorkflow("unknown", process.cwd(), "", { NODE_ENV: "test" })).toThrow(
      "Unknown external workflow",
    );
  });
});
