import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverRepositorySkillFiles,
  expectedRepositorySkillSurfaceCounts,
  validateRepositorySkillPolicies,
} from "../scripts/list-database-skills.mjs";

describe("repository skill inventory", () => {
  it("fails closed when a repository skill disappears", () => {
    const files = discoverRepositorySkillFiles().filter(
      ({ relative }) => relative !== ".claude/skills/gates/SKILL.md",
    );
    const result = validateRepositorySkillPolicies(files);

    const expected = expectedRepositorySkillSurfaceCounts.Claude;
    expect(result.surfaceCounts.Claude).toBe(expected - 1);
    expect(result.errors).toContain(
      `Repository skill inventory mismatch for Claude: expected ${expected}, found ${expected - 1}`,
    );
  });

  it("requires staging before an inbox request can be committed", () => {
    const issues = fs.readFileSync(
      path.resolve(import.meta.dirname, "../.claude/skills/issues/SKILL.md"),
      "utf8",
    );

    expect(issues).toContain("git add -- docs/outstanding-issues-inbox/<uuid>.json");
    expect(issues).toContain("git commit --only docs/outstanding-issues-inbox/<uuid>.json");
  });
});
