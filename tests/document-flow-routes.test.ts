import { describe, expect, it } from "vitest";

import {
  documentEvidenceHref,
  documentReaderHref,
  documentSearchRequestBody,
  documentsSearchHref,
} from "@/lib/document-flow-routes";

describe("document flow routes", () => {
  it("builds search links with optional focus and run flags", () => {
    expect(documentsSearchHref()).toBe("/documents/search?mode=documents");
    expect(documentsSearchHref({ query: "lithium", focus: true, run: true })).toBe(
      "/documents/search?mode=documents&q=lithium&focus=1&run=1",
    );
  });

  it("keeps query intent and scope filters in document-search navigation", () => {
    const href = new URL(
      documentsSearchHref({
        query: "lithium monitoring",
        run: true,
        queryMode: "monitoring_schedule",
        scopeFilters: { medications: ["lithium"], locality: "local" },
      }),
      "https://clinical.test",
    );

    expect(href.searchParams.get("queryMode")).toBe("monitoring_schedule");
    expect(href.searchParams.getAll("scope.medications")).toEqual(["lithium"]);
    expect(href.searchParams.get("scope.locality")).toBe("local");
  });

  it("applies routed intent and scope filters to the document-search API body", () => {
    const href = new URL(
      documentsSearchHref({
        query: "lithium monitoring",
        queryMode: "monitoring_schedule",
        scopeFilters: {
          medications: ["lithium"],
          locality: "local",
          sourceStatuses: ["current"],
        },
      }),
      "https://clinical.test",
    );

    expect(documentSearchRequestBody(href.searchParams, "lithium monitoring")).toMatchObject({
      query: "lithium monitoring",
      mode: "documents",
      queryMode: "monitoring_schedule",
      filters: {
        medications: ["lithium"],
        locality: "local",
        sourceStatuses: ["current"],
      },
    });
  });

  it("builds reader and evidence links with defaults", () => {
    expect(documentReaderHref()).toContain("q=clozapine+monitoring+table");
    expect(documentEvidenceHref({ evidence: "renal-table" })).toContain("evidence=renal-table");
    expect(documentEvidenceHref({ query: "  " })).toContain("q=clozapine+monitoring+table");
  });
});
