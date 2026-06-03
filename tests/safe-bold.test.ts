import { describe, expect, it } from "vitest";
import { parseSafeBoldText } from "../src/lib/safe-bold";

describe("parseSafeBoldText", () => {
  it("parses only balanced bold markers", () => {
    expect(parseSafeBoldText("Use **clozapine** monitoring")).toEqual([
      { text: "Use ", bold: false },
      { text: "clozapine", bold: true },
      { text: " monitoring", bold: false },
    ]);
  });

  it("falls back to plain text for unmatched markers", () => {
    expect(parseSafeBoldText("Use **clozapine monitoring")).toEqual([
      { text: "Use **clozapine monitoring", bold: false },
    ]);
  });
});
