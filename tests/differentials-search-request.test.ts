import { describe, expect, it } from "vitest";

import { differentialsSearchRequestBody } from "@/lib/differentials-search-request";

describe("differentials search request", () => {
  it("applies routed intent and scope filters to the source search body", () => {
    const params = new URLSearchParams([
      ["queryMode", "monitoring_schedule"],
      ["scope.sourceStatuses", "current"],
      ["scope.locality", "local"],
    ]);

    expect(differentialsSearchRequestBody(params, "acute confusion")).toMatchObject({
      query: "acute confusion",
      mode: "differentials",
      queryMode: "monitoring_schedule",
      filters: {
        sourceStatuses: ["current"],
        locality: "local",
      },
    });
  });
});
