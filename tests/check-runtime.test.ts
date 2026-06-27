import { describe, expect, it } from "vitest";

import { checkNodeRuntime, checkNpmRuntime } from "../scripts/check-runtime";

describe("runtime release gate", () => {
  it("accepts the Node 24 release target", () => {
    expect(checkNodeRuntime("24.15.0")).toMatchObject({
      ok: true,
      expectedMajor: 24,
    });
  });

  it("rejects older and newer major runtimes", () => {
    expect(checkNodeRuntime("22.22.3")).toMatchObject({ ok: false });
    expect(checkNodeRuntime("25.1.0")).toMatchObject({ ok: false });
  });

  it("reports unparsable runtime versions as failures", () => {
    expect(checkNodeRuntime("not-a-version")).toMatchObject({ ok: false });
  });

  it("accepts the npm 11 release package manager", () => {
    expect(checkNpmRuntime("npm/11.12.1 node/v24.15.0 win32 x64")).toMatchObject({
      ok: true,
      expectedMajor: 11,
    });
  });

  it("rejects newer npm majors for release verification", () => {
    expect(checkNpmRuntime("npm/12.1.0 node/v24.15.0 win32 x64")).toMatchObject({ ok: false });
  });
});
