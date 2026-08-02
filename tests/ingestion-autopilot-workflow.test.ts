import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workflow = readFileSync(
  join(process.cwd(), ".github", "workflows", "ingestion-autopilot.yml"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("ingestion autopilot workflow secret handling", () => {
  it("does not expose the Supabase service-role key to checkout or install steps", () => {
    expect(workflow).not.toMatch(/env:\n(?:  [^\n]+\n)*  SUPABASE_SERVICE_ROLE_KEY:/);
    expect(workflow).toContain(
      "if: ${{ github.event_name != 'workflow_dispatch' || github.ref_name == github.event.repository.default_branch }}",
    );
    expect(workflow).toContain("ref: ${{ github.event.repository.default_branch }}");

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
