import { describe, expect, it } from "vitest";

import {
  appendSearchNavigationContext,
  readSearchNavigationContext,
  routedSubmissionContextChanged,
  searchNavigationContextSignature,
  searchSubmissionSignature,
} from "@/lib/search-navigation-context";

describe("search navigation context", () => {
  it("round-trips query intent and active scope filters", () => {
    const params = new URLSearchParams();
    appendSearchNavigationContext(params, {
      queryMode: "monitoring_schedule",
      scopeFilters: {
        medications: ["lithium", "clozapine"],
        sourceStatuses: ["current", "review_due"],
        locality: "local",
        importBatchIds: ["f9b71e2a-9548-45df-ae21-e33b20c6f508"],
      },
    });

    expect(readSearchNavigationContext(params)).toEqual({
      queryMode: "monitoring_schedule",
      scopeFilters: {
        medications: ["lithium", "clozapine"],
        sourceStatuses: ["current", "review_due"],
        importBatchIds: ["f9b71e2a-9548-45df-ae21-e33b20c6f508"],
        locality: "local",
      },
    });
  });

  it("drops invalid or duplicate URL values and defaults to automatic intent", () => {
    const params = new URLSearchParams([
      ["queryMode", "not-a-mode"],
      ["scope.medications", " lithium "],
      ["scope.medications", "lithium"],
      ["scope.sourceStatuses", "current"],
      ["scope.sourceStatuses", "invalid"],
      ["scope.locality", "somewhere"],
      ["scope.importBatchIds", "not-a-uuid"],
    ]);

    expect(readSearchNavigationContext(params)).toEqual({
      queryMode: "auto",
      scopeFilters: {
        medications: ["lithium"],
        sourceStatuses: ["current"],
      },
    });
  });

  it("keeps default context out of otherwise clean URLs", () => {
    const params = new URLSearchParams("mode=answer");
    appendSearchNavigationContext(params, { queryMode: "auto", scopeFilters: {} });
    expect(params.toString()).toBe("mode=answer");
  });

  it("changes the submission signature when routed intent or scope changes", () => {
    const current = searchNavigationContextSignature({
      queryMode: "monitoring_schedule",
      scopeFilters: { sourceStatuses: ["current"], locality: "local" },
    });
    const outdated = searchNavigationContextSignature({
      queryMode: "monitoring_schedule",
      scopeFilters: { sourceStatuses: ["outdated"], locality: "local" },
    });

    expect(current).not.toBe(outdated);
    expect(current).toContain("queryMode=monitoring_schedule");
    expect(current).toContain("scope.sourceStatuses=current");
    expect(searchSubmissionSignature("answer", "lithium", { scopeFilters: { sourceStatuses: ["current"] } })).not.toBe(
      searchSubmissionSignature("answer", "lithium", { scopeFilters: { sourceStatuses: ["outdated"] } }),
    );
    expect(
      routedSubmissionContextChanged(
        searchSubmissionSignature("answer", "lithium", { scopeFilters: { sourceStatuses: ["current"] } }),
        "answer",
        "lithium",
        { scopeFilters: { sourceStatuses: ["outdated"] } },
      ),
    ).toBe(true);
    expect(
      routedSubmissionContextChanged(
        searchSubmissionSignature("answer", "lithium", { scopeFilters: { sourceStatuses: ["current"] } }),
        "answer",
        "clozapine",
        { scopeFilters: { sourceStatuses: ["outdated"] } },
      ),
    ).toBe(false);
  });
});
