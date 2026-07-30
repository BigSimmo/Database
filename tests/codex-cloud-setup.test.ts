import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Codex Cloud setup contract", () => {
  it("keeps the checked-in Cloud environment reproducible and provider-free", () => {
    const result = spawnSync(process.execPath, ["scripts/check-codex-cloud-setup.mjs"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      shell: false,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("[Codex Cloud Check] PASS:");
  });

  it("keeps the Cloud guide explicit about offline defaults and GitHub authentication", () => {
    const guide = path.resolve(import.meta.dirname, "..", "docs", "codex-cloud.md");
    const contents = readFileSync(guide, "utf8");

    expect(contents).toContain("RAG_PROVIDER_MODE=offline");
    expect(contents).toContain("GitHub connector permission is separate");
  });
});
