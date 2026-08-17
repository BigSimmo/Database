import { describe, expect, it } from "vitest";

import {
  filterFormMatches,
  formFilterSelectionFromParams,
  writeFormFilterSelection,
  type FormFilterSelection,
} from "@/lib/form-filters";
import type { FormSearchMatch } from "@/lib/form-ranker";

function match(
  id: string,
  category: string,
  riskLevel: "high" | "medium" | "low",
  availability: "downloadable" | "contact_ocp" | "unavailable",
): FormSearchMatch {
  return {
    service: {
      id,
      slug: id,
      title: id,
      catalogPayload: { form: id, name: id, category, riskLevel, availability },
    },
    score: 1,
    reasons: [],
  } as FormSearchMatch;
}

const matches = [
  match("a", "Orders", "high", "downloadable"),
  match("b", "Orders", "medium", "contact_ocp"),
  match("c", "Notices", "low", "unavailable"),
];

describe("form filters", () => {
  it("uses OR within a facet and AND across facets", () => {
    const selection: FormFilterSelection = {
      categories: new Set(["Orders"]),
      risks: new Set(["high", "medium"]),
      availability: new Set(["downloadable"]),
    };
    expect(filterFormMatches(matches, selection).map((item) => item.service.slug)).toEqual(["a"]);
  });

  it("ignores invalid URL values and writes stable query-preserving state", () => {
    const params = new URLSearchParams("q=transfer&focus=1&category=Unknown,Orders&risk=bogus,high");
    const selection = formFilterSelectionFromParams(params, ["Orders", "Notices"]);
    expect([...selection.categories]).toEqual(["Orders"]);
    expect([...selection.risks]).toEqual(["high"]);
    writeFormFilterSelection(params, selection);
    expect(params.get("q")).toBe("transfer");
    expect(params.get("focus")).toBe("1");
    expect(params.get("category")).toBe("Orders");
    expect(params.get("risk")).toBe("high");
  });
});
