import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("worker Python lockfile", () => {
  it("has a requirements.in and a hashed, pinned requirements.txt", () => {
    expect(existsSync("worker/python/requirements.in"), "requirements.in missing").toBe(true);
    expect(existsSync("worker/python/requirements.txt"), "requirements.txt missing").toBe(true);

    const contents = readFileSync("worker/python/requirements.txt", "utf8");
    const lines = contents.split(/\r?\n/);

    expect(lines.some((line) => line.includes("==")), "requirements.txt has no pinned versions").toBe(true);
    expect(lines.some((line) => line.includes("--hash=sha256:")), "requirements.txt has no hashes").toBe(true);
    expect(contents.includes("medspacy"), "medspacy not present in lock").toBe(true);
  });
});
