import { describe, expect, it } from "vitest";
import { validateRuntime } from "../worker/validate-runtime";

describe("worker runtime validation", () => {
  it("passes when Node, npm, externals, and Python check pass", async () => {
    const externals = ["node:fs"];

    const result = await validateRuntime({ externals, skipPython: true });

    expect(result.nodeVersion).toMatch(/^24\./);
    expect(result.externals).toHaveLength(1);
    expect(result.externals[0].ok).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("fails when an external cannot be resolved", async () => {
    const externals = ["this-package-does-not-exist-12345"];

    const result = await validateRuntime({ externals, skipPython: true });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("this-package-does-not-exist-12345"))).toBe(true);
  });
});
