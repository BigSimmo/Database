import { describe, expect, it } from "vitest";

import { resolveMetadataBase } from "../src/lib/metadata-base";

describe("production metadata origin", () => {
  it.each(["http://clinical.test", "https://clinical.test"])(
    "uses a configured HTTP(S) origin: %s",
    (configuredOrigin) => {
      expect(resolveMetadataBase(new Headers(), configuredOrigin)?.href).toBe(`${configuredOrigin}/`);
    },
  );

  it("derives the origin from forwarded request headers when configuration is absent", () => {
    const requestHeaders = new Headers({
      host: "internal.test:3000",
      "x-forwarded-host": "clinical.example.org, proxy.internal",
      "x-forwarded-proto": "https, http",
    });

    expect(resolveMetadataBase(requestHeaders)?.href).toBe("https://clinical.example.org/");
  });

  it("falls back to the request origin when the configured value is malformed", () => {
    const requestHeaders = new Headers({ host: "clinical.example.org" });

    expect(() => resolveMetadataBase(requestHeaders, "not a valid URL")).not.toThrow();
    expect(resolveMetadataBase(requestHeaders, "not a valid URL")?.href).toBe("https://clinical.example.org/");
  });
});
