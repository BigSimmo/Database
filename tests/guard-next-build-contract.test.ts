import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const guardSource = readFileSync(path.join(process.cwd(), "scripts/guard-next-build.mjs"), "utf8");

describe("guard-next-build RAM floor", () => {
  it("keeps the local <10 GiB fail-closed rail", () => {
    expect(guardSource).toContain("totalmem()");
    expect(guardSource).toContain("10 * 1024 * 1024 * 1024");
    expect(guardSource).toMatch(/process\.exit\(1\)/);
  });

  it("does not fail closed on hosted CI runners that report ~7–8 GiB", () => {
    // Private GitHub-hosted ubuntu runners are documented around 7 GB; the
    // guard message is a local/Docker Desktop warning, not a CI blocker.
    expect(guardSource).toContain('process.env.CI === "true"');
    expect(guardSource).toContain('process.env.GITHUB_ACTIONS === "true"');
    expect(guardSource).toContain("Continuing because CI/GITHUB_ACTIONS is set.");
  });
});
