import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  analyzeFailureText,
  buildWorkflowPlan,
  classifyRisks,
  extractOperatorItemsFromText,
  providerCommandPattern,
} from "../scripts/productivity-core.mjs";
import { resolveExternalWorkflow, workflowRootCandidates } from "../scripts/external-workflow.mjs";

const workflowScript = path.resolve(process.cwd(), "scripts", "productivity-workflow.mjs");

function runWorkflow(args: string[]) {
  return spawnSync(process.execPath, [workflowScript, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

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
    expect(providerCommandPattern.test("git push origin feature")).toBe(true);
    expect(providerCommandPattern.test("glab mr merge 123")).toBe(true);
  });

  it("treats answer routes as database-scoped without needing a migration path", () => {
    const files = ["src/app/api/answer/route.ts"];
    const plan = buildWorkflowPlan("flightplan", files);

    expect(classifyRisks(files).database).toBe(true);
    expect(plan.approvalRequired.map((item: { command: string }) => item.command)).toContain(
      "npm run check:supabase-project",
    );
  });

  it("keeps the design sweep local and covers the established breakpoint proof", () => {
    const plan = buildWorkflowPlan("design-sweep", ["src/components/ClinicalDashboard.tsx"]);

    expect(plan.approvalRequired).toEqual([]);
    expect(plan.localChecks.map((item: { command: string }) => item.command)).toContain("npm run verify:ui");
    expect(plan.proof.join(" ")).toContain("320, 390, 639, 768, 1440, and 1920");
  });

  it("treats repository skill instructions as workflow changes rather than docs-only", () => {
    const plan = buildWorkflowPlan("flightplan", [".agents/skills/database-flightplan/SKILL.md"]);

    expect(plan.risks).toMatchObject({ workflow: true, docsOnly: false });
    expect(plan.localChecks.map((item: { command: string }) => item.command)).toContain("npm run verify:pr-local");
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
    expect(analyzeFailureText("TypeError: value is not iterable").category).toBe("probable-regression");
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

describe("productivity workflow CLI", () => {
  it("rejects option flags where a required value is missing", () => {
    const result = runWorkflow(["flightplan", "--files", "--json"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Missing value for --files");
  });

  it("rejects JSON execution before any local checks can write mixed output", () => {
    const result = runWorkflow(["flightplan", "--files", "docs/example.md", "--json", "--run"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--json cannot be combined with --run");
  });

  it("keeps JSON evidence output parseable and cleans its test artifact", () => {
    const evidenceDirectory = path.join(process.cwd(), ".local", "workflow-evidence");
    const before = new Set(fs.existsSync(evidenceDirectory) ? fs.readdirSync(evidenceDirectory) : []);

    try {
      const result = runWorkflow(["flightplan", "--files", "docs/example.md", "--json", "--write-evidence"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const payload = JSON.parse(result.stdout);
      expect(payload.evidencePath).toMatch(/workflow-evidence/);
      expect(fs.existsSync(payload.evidencePath)).toBe(true);
    } finally {
      if (fs.existsSync(evidenceDirectory)) {
        for (const entry of fs.readdirSync(evidenceDirectory)) {
          if (!before.has(entry)) fs.rmSync(path.join(evidenceDirectory, entry), { force: true });
        }
      }
    }
  });
});

describe("external workflow portability", () => {
  it("derives the shared workflow directory from the Git common directory", () => {
    const root = path.parse(process.cwd()).root;
    const cwd = path.join(root, "tmp", "codex", "worktrees", "1234", "Database");
    const gitCommonDir = path.join(root, "workspace", "Apps", "Database", ".git");
    const candidates = workflowRootCandidates(cwd, gitCommonDir, { NODE_ENV: "test" });
    const expected = path.join(root, "workspace", "Apps", ".local-dev");

    expect(candidates).toContain(path.normalize(expected));
  });

  it("rejects unknown shared workflow names", () => {
    expect(() => resolveExternalWorkflow("unknown", process.cwd(), "", { NODE_ENV: "test" })).toThrow(
      "Unknown external workflow",
    );
  });
});
