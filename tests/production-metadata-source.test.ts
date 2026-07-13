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

  it("uses the trusted deployment domain as-is when it already carries an explicit scheme", () => {
    expect(
      resolveMetadataBase(new Headers(), { trustedDeploymentDomain: "http://staging.up.railway.app" })?.href,
    ).toBe("http://staging.up.railway.app/");
  });

  it("rejects a configured origin with a non-HTTP(S) protocol and falls through", () => {
    expect(
      resolveMetadataBase(new Headers(), {
        configuredSiteUrl: "ftp://clinical.test",
        trustedDeploymentDomain: "clinical-kb.up.railway.app",
      })?.href,
    ).toBe("https://clinical-kb.up.railway.app/");
  });

  it("treats a whitespace-only configured site URL as absent", () => {
    expect(
      resolveMetadataBase(new Headers(), {
        configuredSiteUrl: "   ",
        trustedDeploymentDomain: "clinical-kb.up.railway.app",
      })?.href,
    ).toBe("https://clinical-kb.up.railway.app/");
  });

  it("falls back to the bare host header when x-forwarded-host is absent", () => {
    const requestHeaders = new Headers({ host: "clinical.example.org" });

    expect(resolveMetadataBase(requestHeaders, { allowRequestOrigin: true })?.href).toBe(
      "https://clinical.example.org/",
    );
  });

  it("defaults to https when x-forwarded-proto is missing or not http/https", () => {
    const missingProto = new Headers({ host: "clinical.example.org" });
    const invalidProto = new Headers({ host: "clinical.example.org", "x-forwarded-proto": "ws" });

    expect(resolveMetadataBase(missingProto, { allowRequestOrigin: true })?.href).toBe(
      "https://clinical.example.org/",
    );
    expect(resolveMetadataBase(invalidProto, { allowRequestOrigin: true })?.href).toBe(
      "https://clinical.example.org/",
    );
  });

  it("returns undefined when the dev fallback is allowed but no host header is present", () => {
    expect(resolveMetadataBase(new Headers(), { allowRequestOrigin: true })).toBeUndefined();
  });
});
