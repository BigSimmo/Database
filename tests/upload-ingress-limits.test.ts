import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_MB_CEILING } from "../src/lib/upload-limits";

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const envSource = readFileSync(new URL("../src/lib/env.ts", import.meta.url), "utf8");

describe("upload ingress budgets", () => {
  it("caps chunked proxy buffering and declared multipart bodies", () => {
    expect(nextConfig).toContain('proxyClientMaxBodySize: "151mb"');
    expect(proxySource).toContain('request.nextUrl.pathname === "/api/upload"');
    expect(proxySource).toContain("declaredLength > uploadEnvelopeBytes");
    expect(proxySource).toContain("status: 413");
    // The 151mb proxy envelope is the ceiling plus 1mb of multipart overhead,
    // and the browser pre-check rejects above the same ceiling — so pin both
    // the value and that env derives its cap from it rather than a second literal.
    expect(MAX_UPLOAD_MB_CEILING).toBe(150);
    expect(envSource).toContain(
      "MAX_UPLOAD_MB: z.coerce.number().int().positive().max(MAX_UPLOAD_MB_CEILING).default(MAX_UPLOAD_MB_CEILING)",
    );
  });
});
