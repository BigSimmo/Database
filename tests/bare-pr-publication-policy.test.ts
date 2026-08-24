import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
const uploadPath = join(repoRoot, ".agents", "skills", "upload", "SKILL.md");
const uploadSkill = existsSync(uploadPath) ? readFileSync(uploadPath, "utf8") : "";
const releaseSkill = readFileSync(join(repoRoot, ".agents", "skills", "release", "SKILL.md"), "utf8");
const handoverSkill = readFileSync(join(repoRoot, ".agents", "skills", "handover", "SKILL.md"), "utf8");
const prHandoffHook = readFileSync(join(repoRoot, ".claude", "hooks", "pr-handoff-stop.sh"), "utf8");
const processHardening = readFileSync(join(repoRoot, "docs", "process-hardening.md"), "utf8");

describe("bare PR publication policy", () => {
  it("separates an explicit open-PR request from local readiness work", () => {
    expect(agents).toContain("Bare publication routes to `$upload`");
    expect(uploadSkill).toContain("Do not run format, tests, builds, readiness checks, or CI observation");
    expect(uploadSkill).toContain("`git commit --no-verify`");
    expect(uploadSkill).toContain("Never use `git push --no-verify`");
    expect(uploadSkill).toContain("skip the push hook wholesale");
    expect(uploadSkill).toContain("Do not babysit CI unless the user explicitly asks");

    const expectedPushOverrides = [
      "SKIP_FORMAT_GUARD=1 git push",
      "SKIP_DRIFT_GUARD=1 git push",
      "SKIP_STATIC_GUARD=1 git push",
      "SKIP_LEDGER_WRITE_GUARD=1 git push",
    ];
    const namedOverrides = [...new Set(uploadSkill.match(/SKIP_[A-Z_]+_GUARD/g) ?? [])].sort();
    expect(namedOverrides).toEqual(
      ["SKIP_DRIFT_GUARD", "SKIP_FORMAT_GUARD", "SKIP_LEDGER_WRITE_GUARD", "SKIP_STATIC_GUARD"].sort(),
    );
    for (const override of expectedPushOverrides) {
      expect(uploadSkill).toContain(override);
      expect(processHardening).toContain(override);
    }
    expect(uploadSkill).not.toMatch(/SKIP_[A-Z_]+_GUARD=1 git commit/u);
    expect(uploadSkill).toContain("in-flight CI guard");
    expect(uploadSkill).toContain("auto-merge ownership guard");
  });

  it("keeps normal formatting policy from overriding bare publication", () => {
    expect(uploadSkill).toContain("For ordinary upload or handoff, run `npm run format`");
    expect(uploadSkill).toContain("Bare publication is the exception");
  });

  it("prevents the release workflow from being selected for bare publication", () => {
    expect(releaseSkill).toContain("Do not use this skill merely because the user asks to open or publish a PR.");
    expect(releaseSkill).toContain("publish without local readiness work");
    expect(handoverSkill).toContain("Do not use this skill merely because the user asks to open or publish a PR.");
  });

  it("makes handoff the post-PR default instead of inviting CI babysitting", () => {
    expect(prHandoffHook).toContain("hand over its URL and stop");
    expect(prHandoffHook).toContain("unless the user expressly asks to babysit or continue PR work");
  });
});
