import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const releaseSkill = readFileSync(join(repoRoot, ".agents", "skills", "release", "SKILL.md"), "utf8");
const handoverSkill = readFileSync(join(repoRoot, ".agents", "skills", "handover", "SKILL.md"), "utf8");
const prHandoffHook = readFileSync(join(repoRoot, ".claude", "hooks", "pr-handoff-stop.sh"), "utf8");

describe("bare PR publication policy", () => {
  it("prevents the release workflow from being selected for bare publication", () => {
    expect(releaseSkill).toContain("Do not use this skill merely because the user asks to open or publish a PR.");
    expect(releaseSkill).toContain("publish without local readiness work");
    expect(handoverSkill).toContain("Do not use this skill merely because the user asks to open or publish a PR.");
  });

  it("tells the model to hand over the PR URL and never park a cron job on it", () => {
    expect(prHandoffHook).toContain("hand over its URL");
    expect(prHandoffHook).toContain("Never park a cron job on this PR");
  });
});
