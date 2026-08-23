import { describe, expect, it } from "vitest";

import {
  authorityDomainsForMode,
  authorityDomainsForProfile,
  clinicalAskFeatureDecision,
  validateAuthorityUrl,
} from "@/lib/clinical-ask/authority-registry";
import { parseClinicalAskDisabledModes } from "@/lib/env";

describe("Clinical Ask authority registry", () => {
  it.each([
    ["services", "https://health.wa.gov.au/services/pathway"],
    ["forms", "https://chiefpsychiatrist.wa.gov.au/forms/current"],
    ["differentials", "https://safetyandquality.gov.au/standards/example"],
    ["services", "https://healthdirect.gov.au/mental-health-services"],
    ["therapy-compass", "https://tga.gov.au/safety/example"],
    ["dsm", "https://ranzcp.org/clinical-guidance/example"],
    ["therapy-compass", "https://nice.org.uk/guidance/example"],
    ["formulation", "https://who.int/publications/example"],
  ] as const)("accepts an allowed %s authority", (mode, rawUrl) => {
    expect(validateAuthorityUrl(mode, rawUrl)?.hostname).toBe(new URL(rawUrl).hostname);
  });

  it.each([
    "http://health.wa.gov.au/path",
    "https://user:pass@health.wa.gov.au/path",
    "https://127.0.0.1/path",
    "https://health.wa.gov.au.evil.example/path",
    "https://unknown.example/path",
    "https://health.wa.gov.au/path#evidence",
    "https://health.wa.gov.au/?utm_source=redirect",
  ])("rejects unsafe authority URL %s", (rawUrl) => {
    expect(validateAuthorityUrl("services", rawUrl)).toBeNull();
  });

  it("canonicalises hosts and strips tracking parameters", () => {
    expect(validateAuthorityUrl("services", "https://WWW.HEALTH.WA.GOV.AU/path?utm_source=x&id=1")?.href).toBe(
      "https://health.wa.gov.au/path?id=1",
    );
  });

  it("keeps mode permissions explicit", () => {
    expect(authorityDomainsForMode("forms")).toContain("chiefpsychiatrist.wa.gov.au");
    expect(authorityDomainsForMode("therapy-compass")).not.toContain("chiefpsychiatrist.wa.gov.au");
  });

  it("intersects registry mode permissions with the selected profile authority classes", () => {
    expect(authorityDomainsForProfile("services", ["official-service-directories"])).toEqual([
      "health.wa.gov.au",
      "chiefpsychiatrist.wa.gov.au",
      "healthdirect.gov.au",
    ]);
    expect(authorityDomainsForProfile("services", ["official-service-directories"])).not.toContain("nice.org.uk");
    expect(authorityDomainsForProfile("forms", ["official-form-publishers"])).toEqual([
      "health.wa.gov.au",
      "chiefpsychiatrist.wa.gov.au",
    ]);
    expect(authorityDomainsForProfile("forms", ["unknown-authority-class"])).toEqual([]);
  });

  it("evaluates master, external, and emergency denylist flags independently", () => {
    expect(
      clinicalAskFeatureDecision("services", { enabled: false, externalEnabled: true, disabledModes: [] }),
    ).toEqual({ modeEnabled: false, externalEnabled: false });
    expect(
      clinicalAskFeatureDecision("services", { enabled: true, externalEnabled: false, disabledModes: [] }),
    ).toEqual({ modeEnabled: true, externalEnabled: false });
    expect(
      clinicalAskFeatureDecision("services", { enabled: true, externalEnabled: true, disabledModes: ["services"] }),
    ).toEqual({ modeEnabled: false, externalEnabled: false });
  });

  it("strictly parses disabled modes", () => {
    expect(parseClinicalAskDisabledModes("services,dsm")).toEqual(["services", "dsm"]);
    expect(() => parseClinicalAskDisabledModes("services,unknown")).toThrow();
    expect(() => parseClinicalAskDisabledModes("services,services")).toThrow();
  });
});
