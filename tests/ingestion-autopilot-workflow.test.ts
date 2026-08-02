import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "ingestion-autopilot.yml"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("ingestion autopilot workflow secret handling", () => {
  it("does not expose the Supabase service-role key to checkout or install steps", () => {
    // Workflow-level and job-level env both use fewer than 10 spaces; only
    // step-scoped env under Preflight / Run autopilot should inject the secret.
    expect(workflow).not.toMatch(/^(?: {0,6})env:\n(?: {2,8}[^\n]+\n)* {2,8}SUPABASE_SERVICE_ROLE_KEY:/m);

    expect(workflow).toContain(
      "if: ${{ github.event_name != 'workflow_dispatch' || github.ref_name == github.event.repository.default_branch }}",
    );
    expect(workflow).toContain("ref: ${{ github.event.repository.default_branch }}");

    const secretLines = workflow.split("\n").filter((line) => line.includes("SUPABASE_SERVICE_ROLE_KEY:"));
    expect(secretLines).toEqual([
      "          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}",
      "          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}",
    ]);

    const installIndex = workflow.indexOf("      - name: Install dependencies");
    const autopilotIndex = workflow.indexOf("      - name: Run autopilot");
    expect(installIndex).toBeGreaterThan(-1);
    expect(autopilotIndex).toBeGreaterThan(installIndex);

    const installBlock = workflow.slice(installIndex, autopilotIndex);
    expect(installBlock).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

    const autopilotBlock = workflow.slice(autopilotIndex);
    expect(autopilotBlock).toContain("SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");
  });
});
