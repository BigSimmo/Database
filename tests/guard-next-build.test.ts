import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("next build host guard", () => {
  const source = readFileSync(new URL("../scripts/guard-next-build.mjs", import.meta.url), "utf8");

  it("keeps the local low-RAM hard stop but continues under CI", () => {
    expect(source).toContain("Host system has less than 10 GiB of total RAM");
    expect(source).toContain('process.env.CI === "true"');
    expect(source).toContain('process.env.GITHUB_ACTIONS === "true"');
    expect(source).toContain("CI detected; continuing despite low reported host RAM.");
    expect(source).toMatch(/if \(inContinuousIntegration\) \{\s*console\.warn/);
    expect(source).toMatch(/else \{\s*console\.error\(message\);\s*process\.exit\(1\);/);
  });

  it("documents that Docker CI builds forward CI=true into the image build", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    expect(dockerfile).toContain("ARG CI=");
    expect(dockerfile).toContain("ENV CI=${CI}");
    const workflow = readFileSync(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");
    expect(workflow).toMatch(/build-args:[\s\S]*CI=true/);
  });
});
