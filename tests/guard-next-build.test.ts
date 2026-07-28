import { describe, expect, it } from "vitest";

import { evaluateNextBuildRamGuard } from "../scripts/guard-next-build.mjs";

const eightGiB = 8 * 1024 * 1024 * 1024;
const twelveGiB = 12 * 1024 * 1024 * 1024;

/** Partial env stub — avoids requiring full NodeJS.ProcessEnv (NODE_ENV). */
type RamGuardEnv = { CI?: string; GITHUB_ACTIONS?: string; ALLOW_LOW_RAM_BUILD?: string };

describe("evaluateNextBuildRamGuard", () => {
  it("allows hosts with at least 10 GiB total RAM", () => {
    const env: RamGuardEnv = {};
    expect(evaluateNextBuildRamGuard({ totalRamBytes: twelveGiB, env })).toBe("ok");
  });

  it("hard-fails low-RAM local/Docker Desktop hosts", () => {
    const env: RamGuardEnv = {};
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env })).toBe("fail");
  });

  it("warns instead of failing under CI or ALLOW_LOW_RAM_BUILD when RAM is under 10 GiB", () => {
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { CI: "true" } })).toBe("warn");
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { GITHUB_ACTIONS: "true" } })).toBe("warn");
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { ALLOW_LOW_RAM_BUILD: "1" } })).toBe("warn");
  });
});
