import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import { NODE_MINIMUM_VERSION, checkNodeRuntime, checkNpmRuntime } from "../scripts/check-runtime";

describe("runtime release gate", () => {
  it("accepts the Node 26 release target", () => {
    expect(checkNodeRuntime("26.8.1")).toMatchObject({
      ok: true,
      expectedMajor: 26,
    });
  });

  it("rejects older and newer major runtimes", () => {
    expect(checkNodeRuntime("25.7.0")).toMatchObject({ ok: false });
    expect(checkNodeRuntime("27.0.0")).toMatchObject({ ok: false });
  });

  it("rejects a matching major below an explicitly supplied floor", () => {
    const result = checkNodeRuntime("26.0.0", 26, "26.0.1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("26.0.1");
    expect(result.message).toContain("Claude Code remote");
    expect(result.message).toContain("export PATH=");
    expect(result.message).toContain("current shell");
  });

  it("accepts runtimes at or above the floor", () => {
    expect(checkNodeRuntime(NODE_MINIMUM_VERSION)).toMatchObject({ ok: true });
    expect(checkNodeRuntime("26.8.1")).toMatchObject({ ok: true });
  });

  it("keeps the floor equal to the package.json engines.node declaration", () => {
    const declared = packageJson.engines.node.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1];
    expect(declared).toBe(NODE_MINIMUM_VERSION);
  });

  // The preinstall hook is COPYed into the Docker image on its own, so it
  // cannot import package.json and restates the range as a literal instead.
  it("keeps the preinstall hook's declared range equal to package.json engines.node", () => {
    const source = readFileSync(new URL("../scripts/check-node-engine.cjs", import.meta.url), "utf8");
    const declared = source.match(/const nodeRange = "([^"]+)"/)?.[1];
    expect(declared).toBe(packageJson.engines.node);
  });

  // The SessionStart hook provisions Node before npm exists, so it restates the
  // bounds in shell. Checking only the floor let a Node 25 container skip
  // provisioning and then fail npm ci against the "<25" half of the range.
  describe("SessionStart hook runtime bounds", () => {
    const hook = readFileSync(new URL("../.claude/hooks/session-start.sh", import.meta.url), "utf8");
    const engineFloor = packageJson.engines.node.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1];
    const engineCeiling = packageJson.engines.node.match(/<\s*(\d+)/)?.[1];

    it("declares the same floor and exclusive ceiling as package.json engines.node", () => {
      expect(hook.match(/^NODE_MINIMUM="([^"]+)"/m)?.[1]).toBe(engineFloor);
      expect(hook.match(/^NODE_MAJOR_CEILING="([^"]+)"/m)?.[1]).toBe(engineCeiling);
    });

    it("pins an install version that is itself inside the supported range", () => {
      const pinned = hook.match(/^NODE_VERSION="([^"]+)"/m)?.[1];
      expect(pinned).toBeDefined();
      expect(checkNodeRuntime(pinned!)).toMatchObject({ ok: true });
      expect(Number(pinned!.split(".")[0])).toBeLessThan(Number(engineCeiling));
    });

    it("uses a Bash-native comparison without GNU sort", () => {
      expect(hook).not.toContain("sort -V");
      expect(hook).toContain("(( actual_patch >= minimum_patch ))");
    });
  });

  it("reports unparsable runtime versions as failures", () => {
    expect(checkNodeRuntime("not-a-version")).toMatchObject({ ok: false });
  });

  it("accepts the npm 11 release package manager", () => {
    expect(checkNpmRuntime("npm/11.12.1 node/v26.8.1 win32 x64")).toMatchObject({
      ok: true,
      expectedMajor: 11,
    });
  });

  it("rejects newer npm majors for release verification", () => {
    expect(checkNpmRuntime("npm/12.0.0 node/v26.8.1 win32 x64")).toMatchObject({ ok: false });
  });
});
