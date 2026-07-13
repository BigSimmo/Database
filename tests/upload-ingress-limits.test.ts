import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const envSource = readFileSync(new URL("../src/lib/env.ts", import.meta.url), "utf8");

describe("upload ingress budgets", () => {
  it("caps chunked proxy buffering and declared multipart bodies", () => {
    expect(nextConfig).toContain('proxyClientMaxBodySize: "151mb"');
    expect(proxySource).toContain('request.nextUrl.pathname === "/api/upload"');
    expect(proxySource).toContain("declaredLength > uploadEnvelopeBytes");
    expect(proxySource).toContain("status: 413");
    expect(envSource).toContain("MAX_UPLOAD_MB: z.coerce.number().int().positive().max(150).default(150)");
  });
});
