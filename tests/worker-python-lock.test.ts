import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("worker Python lockfile", () => {
  it("has hashed, pinned locks for production Python 3.11 and Cloud Python 3.12", () => {
    expect(existsSync("worker/python/requirements.in"), "requirements.in missing").toBe(true);
    for (const [file, version] of [
      ["worker/python/requirements.txt", "3.11"],
      ["worker/python/requirements-cloud.txt", "3.12"],
    ]) {
      expect(existsSync(file), `${file} missing`).toBe(true);
      const contents = readFileSync(file, "utf8");
      const lines = contents.split(/\r?\n/);
      expect(contents).toContain(`pip-compile with Python ${version}`);
      expect(
        lines.some((line) => line.includes("==")),
        `${file} has no pinned versions`,
      ).toBe(true);
      expect(
        lines.some((line) => line.includes("--hash=sha256:")),
        `${file} has no hashes`,
      ).toBe(true);
      expect(contents.includes("medspacy"), `medspacy not present in ${file}`).toBe(true);
      if (version === "3.12") expect(contents).toMatch(/^setuptools==/m);
    }
  });
});
