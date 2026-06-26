import { describe, expect, it } from "vitest";

import { checkNodeRuntime, checkNpmRuntime } from "../scripts/check-runtime";

describe("runtime release gate", () => {
  it("accepts the Node 22 release target", () => {
    expect(checkNodeRuntime("22.22.3")).toMatchObject({
      ok: true,
      expectedMajor: 22,
    });
  });

  it("rejects older and newer major runtimes", () => {
    expect(checkNodeRuntime("21.7.0")).toMatchObject({ ok: false });
    expect(checkNodeRuntime("24.15.0")).toMatchObject({ ok: false });
  });

  it("reports unparsable runtime versions as failures", () => {
    expect(checkNodeRuntime("not-a-version")).toMatchObject({ ok: false });
  });

  it("accepts the npm 10 release package manager", () => {
    expect(checkNpmRuntime("npm/10.9.8 node/v22.22.3 win32 x64")).toMatchObject({
      ok: true,
      expectedMajor: 10,
    });
  });

  it("rejects newer npm majors for release verification", () => {
    expect(checkNpmRuntime("npm/11.17.0 node/v22.22.3 win32 x64")).toMatchObject({ ok: false });
  });
});
