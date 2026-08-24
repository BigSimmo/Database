import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverRepositorySkillFiles,
  expectedRepositorySkillSurfaceCounts,
  loadSkillCatalog,
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

  it("keeps plain /issues read-only in its canonical owner and Claude adapter", () => {
    const canonicalPath = path.resolve(import.meta.dirname, "../.agents/skills/issues/SKILL.md");
    const canonical = fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : "";
    const adapter = fs.readFileSync(path.resolve(import.meta.dirname, "../.claude/skills/issues/SKILL.md"), "utf8");
    const plainIssues = canonical.match(/## Plain `\/issues` \(read-only\)([\s\S]*?)(?=\n## |$)/)?.[1] ?? "";

    expect(plainIssues).toContain("npm run issues:report -- --json");
    expect(plainIssues).toContain("Repeat its cached-state warning");
    expect([...plainIssues.matchAll(/npm run ([^`\s]+)/g)].map((match) => match[1])).toEqual(["issues:report"]);
    expect(plainIssues).not.toMatch(/git fetch|git (?:add|commit)/i);
    expect(adapter).toContain("../../../.agents/skills/issues/SKILL.md");
    expect(adapter).toContain("Do not duplicate or extend its authorization");
    expect(adapter).not.toContain("npm run");
  });

  it("keeps Claude handoff as a thin adapter over canonical owners", () => {
    const handoff = fs.readFileSync(path.resolve(import.meta.dirname, "../.claude/skills/handoff/SKILL.md"), "utf8");

    expect(handoff).toContain("../../../.agents/skills/upload/SKILL.md");
    expect(handoff).toContain("../../../.agents/skills/handover/SKILL.md");
    expect(handoff).toContain("Do not duplicate or extend their authorization");
    expect(handoff).not.toContain("npm run");
  });

  it("registers upload and Run PR as canonical Codex procedures", () => {
    const canonical = loadSkillCatalog().categories.flatMap((category: { skills: string[] }) => category.skills);

    expect(canonical).toContain("issues");
    expect(canonical).toContain("upload");
    expect(canonical).toContain("run-pr");
    expect(fs.existsSync(path.resolve(import.meta.dirname, "../.agents/skills/upload/SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.resolve(import.meta.dirname, "../.agents/skills/run-pr/SKILL.md"))).toBe(true);
  });

  it("keeps every new canonical owner trackable", () => {
    const gitignore = fs.readFileSync(path.resolve(import.meta.dirname, "../.gitignore"), "utf8");

    expect(gitignore).toContain("!/.agents/skills/issues/");
  });
});
