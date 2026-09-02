import { describe, expect, it } from "vitest";

import { deriveDocumentSearchUnavailable } from "@/components/clinical-dashboard/document-search-unavailable-status";

const healthy = {
  apiUnavailable: false,
  authUnavailable: false,
  realDataReady: true,
  setupWarning: null,
  deployedClinicalKb: false,
};

describe("deriveDocumentSearchUnavailable", () => {
  it("returns null when documents mode is healthy", () => {
    expect(deriveDocumentSearchUnavailable(healthy)).toBeNull();
  });

  it("maps an expired session to unauthorized, not error", () => {
    const result = deriveDocumentSearchUnavailable({ ...healthy, authUnavailable: true });
    expect(result?.status).toBe("unauthorized");
    expect(result?.message).toMatch(/Sign in again/i);
  });

  it("keeps an unreachable API above an expired session", () => {
    // Both true: signing back in cannot fix an API that is down, so the
    // message and the status must both stay on the API fault.
    const result = deriveDocumentSearchUnavailable({
      ...healthy,
      apiUnavailable: true,
      authUnavailable: true,
      deployedClinicalKb: true,
    });
    expect(result?.status).toBe("error");
    expect(result?.message).toMatch(/PsychSift could not be reached/i);
  });

  it("distinguishes the deployed and local API messages", () => {
    expect(
      deriveDocumentSearchUnavailable({ ...healthy, apiUnavailable: true, deployedClinicalKb: false })?.message,
    ).toMatch(/local API is unavailable/i);
  });

  it("treats incomplete setup as an error with the supplied warning", () => {
    const result = deriveDocumentSearchUnavailable({
      ...healthy,
      realDataReady: false,
      setupWarning: "Add a Supabase URL first.",
    });
    expect(result).toEqual({ message: "Add a Supabase URL first.", status: "error" });
  });

  it("falls back to default setup copy when no warning is supplied", () => {
    expect(deriveDocumentSearchUnavailable({ ...healthy, realDataReady: false })?.message).toMatch(
      /Complete the search setup/i,
    );
  });

  it("pairs every fault with a status, so the two cannot drift", () => {
    const cases = [
      { ...healthy, apiUnavailable: true },
      { ...healthy, authUnavailable: true },
      { ...healthy, realDataReady: false },
    ];
    for (const input of cases) {
      const result = deriveDocumentSearchUnavailable(input);
      expect(result?.message).toBeTruthy();
      expect(["error", "unauthorized"]).toContain(result?.status);
    }
  });
});
