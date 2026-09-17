import { describe, expect, it } from "vitest";

import {
  discoverRepositorySkillFiles,
  expectedRepositorySkillSurfaceCounts,
  validateRepositorySkillPolicies,
} from "../scripts/list-database-skills.mjs";

describe("repository skill inventory", () => {
  it("fails closed when a repository skill disappears", () => {
    const files = discoverRepositorySkillFiles().filter(({ relative }) => relative !== ".claude/skills/gates/SKILL.md");
    const result = validateRepositorySkillPolicies(files);

    const expected = expectedRepositorySkillSurfaceCounts.Claude;
    expect(result.surfaceCounts.Claude).toBe(expected - 1);
    expect(result.errors).toContain(
      `Repository skill inventory mismatch for Claude: expected ${expected}, found ${expected - 1}`,
    );
  });
});
