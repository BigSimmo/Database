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

  it("strips unmatched markers instead of leaking markdown", () => {
    expect(parseSafeBoldText("Use **clozapine monitoring")).toEqual([
      { text: "Use clozapine monitoring", bold: false },
    ]);
  });

  it("keeps balanced bold text when later markers are unmatched", () => {
    expect(parseSafeBoldText("Use **lithium** monitoring for **dosin...")).toEqual([
      { text: "Use ", bold: false },
      { text: "lithium", bold: true },
      { text: " monitoring for dosin...", bold: false },
    ]);
  });
});
