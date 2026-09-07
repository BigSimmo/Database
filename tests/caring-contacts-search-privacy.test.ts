// tests/caring-contacts-search-privacy.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  clearSearchFilterTokenStore,
  createSearchFilterToken,
  isSearchFilterToken,
  resolveSearchFilterToken,
} from "@/lib/caring-contacts/caseload-search-token";
import { readPatientsDirectoryAddress } from "@/lib/caring-contacts/patients-directory-address";
import {
  PATIENTS_DIRECTORY_FILTER_TOKEN_PARAM,
  PATIENTS_DIRECTORY_RECOGNISED_PARAMS,
} from "@/lib/caring-contacts/patients-directory-filter";
import { POST as searchRoutePost } from "@/app/api/caring-contacts/patients/search/route";

describe("Task 1 #HDCF2B: Patient privacy in caseload search (no PHI in URL / access logs)", () => {
  beforeEach(() => {
    clearSearchFilterTokenStore();
  });

  it("generates an opaque session filter token that does NOT expose raw patient names or base64 PHI", () => {
    const rawName = "Jordan Nguyen";
    const token = createSearchFilterToken(rawName);

    expect(token).toMatch(/^sft_[a-f0-9]{32}$/);
    // Raw patient name must NOT appear in the token string in plaintext or trivial encoding
    expect(token).not.toContain("Jordan");
    expect(token).not.toContain("Nguyen");
    expect(token).not.toContain("jordan");
    expect(isSearchFilterToken(token)).toBe(true);

    // Decoding the token string as base64 / utf8 never yields patient name
    const raw = token.slice(4);
    expect(Buffer.from(raw, "base64url").toString("utf8")).not.toContain("Jordan");

    // Resolves back to the query via server-side session store
    const resolved = resolveSearchFilterToken(token);
    expect(resolved).toBe(rawName);
  });

  it("handles empty or whitespace query cleanly", () => {
    expect(createSearchFilterToken("")).toBe("");
    expect(createSearchFilterToken("   ")).toBe("");
    expect(resolveSearchFilterToken("")).toBeNull();
    expect(resolveSearchFilterToken(null)).toBeNull();
    expect(resolveSearchFilterToken("sft_invalid-garbage")).toBeNull();
  });

  it("enforces TTL expiration on search tokens", () => {
    const rawName = "Eleanor Vance";
    const baseTime = 1700000000000;
    const ttlMs = 60 * 1000; // 1 minute

    const token = createSearchFilterToken(rawName, { ttlMs, now: baseTime });
    expect(resolveSearchFilterToken(token, { now: baseTime + 30 * 1000 })).toBe(rawName);

    // After TTL, token must expire and return null
    expect(resolveSearchFilterToken(token, { now: baseTime + 65 * 1000 })).toBeNull();
  });

  it("recognises valid filterToken in address without triggering dropped-parameter redirect", () => {
    expect(PATIENTS_DIRECTORY_RECOGNISED_PARAMS).toContain(PATIENTS_DIRECTORY_FILTER_TOKEN_PARAM);

    const token = createSearchFilterToken("Jordan Nguyen");
    const address = readPatientsDirectoryAddress({
      state: "active",
      [PATIENTS_DIRECTORY_FILTER_TOKEN_PARAM]: token,
    });

    // Valid filterToken is recognised, so droppedUnrecognisedParams must be false
    expect(address.droppedUnrecognisedParams).toBe(false);
    expect(address.searchNotApplied).toBe(false);
    expect(address.searchQuery).toBe("Jordan Nguyen");
    expect(address.canonicalQuery).toContain(`filterToken=${encodeURIComponent(token)}`);
    // Crucially, the canonical query does not contain the raw name
    expect(address.canonicalQuery).not.toContain("Jordan");
    expect(address.canonicalQuery).not.toContain("Nguyen");
  });

  it("drops expired or corrupted filterToken and sets searchNotApplied to clean the URL", () => {
    const corruptedToken = "sft_nonexistent_or_expired_12345";
    const address = readPatientsDirectoryAddress({
      state: "active",
      [PATIENTS_DIRECTORY_FILTER_TOKEN_PARAM]: corruptedToken,
    });

    // Expired/corrupted token must be dropped from canonical query
    expect(address.droppedUnrecognisedParams).toBe(true);
    expect(address.searchNotApplied).toBe(true);
    expect(address.searchQuery).toBeUndefined();
    expect(address.canonicalQuery).not.toContain("filterToken");
    expect(address.canonicalQuery).toBe("state=active&searchNotApplied=1");
  });

  it("drops raw GET query parameters (?q=, ?name=, ?search=) to prevent PHI in URL history", () => {
    const rawParams = [
      { q: "Jordan Nguyen" },
      { name: "Jordan Nguyen" },
      { search: "Jordan Nguyen" },
      { patient: "Jordan Nguyen" },
    ];

    for (const params of rawParams) {
      const address = readPatientsDirectoryAddress(params);
      expect(address.droppedUnrecognisedParams).toBe(true);
      expect(address.searchNotApplied).toBe(true);
      // Canonical query must be clean of the unrecognised parameter
      expect(address.canonicalQuery).not.toContain("Jordan");
      expect(address.canonicalQuery).not.toContain("Nguyen");
      expect(address.canonicalQuery).toBe("searchNotApplied=1");
    }
  });

  it("POST /api/caring-contacts/patients/search receives body payload and returns filterToken", async () => {
    const request = new NextRequest("http://localhost/api/caring-contacts/patients/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "Sarah Connor",
        state: "active",
      }),
    });

    const response = await searchRoutePost(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.hasFilter).toBe(true);
    expect(json.filterToken).toMatch(/^sft_[a-f0-9]{32}$/);
    expect(json.filterToken).not.toContain("Sarah");
    expect(json.destination).toContain("state=active");
    expect(json.destination).toContain("filterToken=");
    expect(json.destination).not.toContain("Sarah");
    expect(json.destination).not.toContain("Connor");

    // Token returned from endpoint resolves to the searched patient
    expect(resolveSearchFilterToken(json.filterToken)).toBe("Sarah Connor");
  });
});
