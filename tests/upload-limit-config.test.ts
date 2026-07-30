import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { inspectUploadLimitConfiguration } from "../scripts/check-upload-limit-config.mjs";

describe("upload limit configuration", () => {
  it("runs the parity guard before every production build", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const buildScript = packageJson.scripts["build:internal"] as string;
    expect(buildScript.indexOf("check:upload-limits")).toBeGreaterThanOrEqual(0);
    expect(buildScript.indexOf("check:upload-limits")).toBeLessThan(buildScript.indexOf("next build"));
  });

  it("uses the matching 150 MB defaults when neither value is configured", () => {
    expect(inspectUploadLimitConfiguration()).toEqual({
      ok: true,
      serverMb: 150,
      clientMb: 150,
      errors: [],
    });
  });

  it("accepts matching lowered client and server limits", () => {
    expect(inspectUploadLimitConfiguration({ MAX_UPLOAD_MB: "50", NEXT_PUBLIC_MAX_UPLOAD_MB: "50" })).toMatchObject({
      ok: true,
      serverMb: 50,
      clientMb: 50,
    });
  });

  it("rejects a lowered server limit without the matching build-time client value", () => {
    const result = inspectUploadLimitConfiguration({ MAX_UPLOAD_MB: "50" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "MAX_UPLOAD_MB (50) and NEXT_PUBLIC_MAX_UPLOAD_MB (150) must match before building or releasing.",
    );
  });

  it("rejects a lowered client limit while the server remains at its default", () => {
    const result = inspectUploadLimitConfiguration({ NEXT_PUBLIC_MAX_UPLOAD_MB: "50" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "MAX_UPLOAD_MB (150) and NEXT_PUBLIC_MAX_UPLOAD_MB (50) must match before building or releasing.",
    );
  });

  it("rejects malformed and above-ceiling limits", () => {
    const result = inspectUploadLimitConfiguration({
      MAX_UPLOAD_MB: "zero",
      NEXT_PUBLIC_MAX_UPLOAD_MB: "151",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "MAX_UPLOAD_MB must be an integer from 1 to 150.",
      "NEXT_PUBLIC_MAX_UPLOAD_MB must be an integer from 1 to 150.",
    ]);
  });
});
