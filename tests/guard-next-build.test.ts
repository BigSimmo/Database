import { describe, expect, it } from "vitest";

import { evaluateNextBuildRamGuard } from "../scripts/guard-next-build.mjs";

const eightGiB = 8 * 1024 * 1024 * 1024;
const twelveGiB = 12 * 1024 * 1024 * 1024;

describe("evaluateNextBuildRamGuard", () => {
  it("allows hosts with at least 10 GiB total RAM", () => {
    expect(evaluateNextBuildRamGuard({ totalRamBytes: twelveGiB, env: {} })).toBe("ok");
  });

  it("hard-fails low-RAM local/Docker hosts", () => {
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: {} })).toBe("fail");
  });

  it("warns instead of failing under CI when RAM is under 10 GiB", () => {
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { CI: "true" } })).toBe("warn");
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { GITHUB_ACTIONS: "true" } })).toBe("warn");
  });
});
