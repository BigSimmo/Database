import { describe, expect, it } from "vitest";

import { resolveMetadataBase } from "../src/lib/metadata-base";

describe("production metadata origin", () => {
  it.each(["http://clinical.test", "https://clinical.test"])(
    "uses a configured HTTP(S) origin: %s",
    (configuredOrigin) => {
      expect(resolveMetadataBase(new Headers(), { configuredSiteUrl: configuredOrigin })?.href).toBe(
        `${configuredOrigin}/`,
      );
    },
  );

  it("uses Railway's trusted deployment domain when configuration is absent", () => {
    expect(resolveMetadataBase(new Headers(), { trustedDeploymentDomain: "clinical-kb.up.railway.app" })?.href).toBe(
      "https://clinical-kb.up.railway.app/",
    );
  });

  it("uses request headers only when the caller explicitly allows a development fallback", () => {
    const requestHeaders = new Headers({
      host: "internal.test:3000",
      "x-forwarded-host": "clinical.example.org, proxy.internal",
      "x-forwarded-proto": "https, http",
    });

    expect(resolveMetadataBase(requestHeaders, { allowRequestOrigin: true })?.href).toBe(
      "https://clinical.example.org/",
    );
  });

  it("falls back to Railway's trusted domain when the configured value is malformed", () => {
    const options = {
      configuredSiteUrl: "not a valid URL",
      trustedDeploymentDomain: "clinical-kb.up.railway.app",
    };

    expect(() => resolveMetadataBase(new Headers(), options)).not.toThrow();
    expect(resolveMetadataBase(new Headers(), options)?.href).toBe("https://clinical-kb.up.railway.app/");
  });

  it("does not trust request-controlled host headers in production", () => {
    const requestHeaders = new Headers({
      host: "internal.test:3000",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    });

    expect(resolveMetadataBase(requestHeaders)).toBeUndefined();
  });
});
