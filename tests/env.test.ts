import { afterEach, describe, expect, it, vi } from "vitest";

describe("developer-area access-key environment parsing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("treats blank and under-strength access keys as unconfigured at module load", async () => {
    // Replacing the schema preprocessor with a direct min(32) validation should
    // make this import reject. The actual app imports this module before proxy
    // authorization can fall back to the administrator gate.
    for (const accessKey of ["", "short", "x".repeat(31)]) {
      vi.resetModules();
      vi.stubEnv("DEVELOPER_AREA_ACCESS_KEY", accessKey);

      await expect(import("@/lib/env")).resolves.toMatchObject({
        env: { DEVELOPER_AREA_ACCESS_KEY: undefined },
      });
    }
  });
});
