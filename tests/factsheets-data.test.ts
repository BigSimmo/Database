import { describe, expect, it } from "vitest";

import { factsheets, findFactsheet } from "@/components/factsheets/factsheets-data";

describe("factsheet sample records", () => {
  it("only resolves the explicitly supplied sample factsheets", () => {
    expect(findFactsheet(factsheets[0]!.slug)).toEqual(factsheets[0]!);
    expect(findFactsheet("unknown-factsheet")).toBeUndefined();
  });

  it("labels every record as sample content", () => {
    expect(factsheets.every((factsheet) => factsheet.updated === "Sample content")).toBe(true);
  });
});
