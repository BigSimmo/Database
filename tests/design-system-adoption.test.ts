import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("design-system adoption manifest", () => {
  it("is deterministic and records the compatibility-layer baseline", () => {
    execFileSync(process.execPath, ["scripts/generate-design-system-adoption.mjs", "--check"], {
      cwd: root,
      stdio: "pipe",
    });

    const manifest = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.adoption.literalCkbV2RootCount).toBe(0);
    expect(manifest.surfaces.every((surface: { shellState: string }) => surface.shellState === "compatibility")).toBe(
      true,
    );
  });

  it("keeps generated adoption sections synchronized with the manifest", () => {
    const manifest = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const expected = `Registered public components: ${manifest.summary.registeredComponentCount}`;
    expect(read("docs/design-system/COMPONENTS.md")).toContain(expected);
    expect(read("docs/design-system/ADOPTION.md")).toContain(expected);
  });
});
