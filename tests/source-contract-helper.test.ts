import { describe, expect, it } from "vitest";

import { sourceFrom, sourceSegment } from "./helpers/source-contract";

const file = ["const before = 1;", "function target() {", "  return inner;", "}", "const after = 2;"].join("\n");

describe("sourceSegment", () => {
  it("returns the window between the markers", () => {
    expect(sourceSegment(file, "function target()", "const after")).toContain("return inner;");
    expect(sourceSegment(file, "function target()", "const after")).not.toContain("const before");
  });

  it("throws instead of silently widening to the rest of the file when the end marker is gone", () => {
    // This is the whole point of the helper. The raw idiom
    // `slice(indexOf(start), indexOf(missing))` becomes `slice(n, -1)` — the
    // rest of the file — and every positive assertion in the window then
    // passes for the wrong reason.
    expect(() => sourceSegment(file, "function target()", "const renamed")).toThrow(/end marker not found/);

    // Demonstrating the raw idiom's behaviour so the hazard is pinned, not
    // just described: `slice(n, -1)` reaches the end of the file bar the final
    // character, so content far outside the intended window is now in scope.
    const silentlyWrong = file.slice(file.indexOf("function target()"), file.indexOf("const renamed"));
    expect(silentlyWrong).toContain("const after = 2");
  });

  it("throws instead of returning a vacuous window when the start marker is gone", () => {
    expect(() => sourceSegment(file, "function missing()", "const after")).toThrow(/start marker not found/);
  });

  it("rejects an ambiguous start marker, which would scope the window to the first hit only", () => {
    const twice = ["render(<Panel />);", "const x = 1;", "render(<Panel />);", "const y = 2;"].join("\n");
    expect(() => sourceSegment(twice, "render(<Panel />);", "const y")).toThrow(/occurs more than once/);
    expect(sourceSegment(twice, "render(<Panel />);", "const y", { allowRepeatedStart: true })).toContain("const x");
  });

  it("rejects overlapping repeated start markers", () => {
    expect(() => sourceSegment("aaa END", "aa", " END")).toThrow(/occurs more than once/);
  });

  it("rejects an empty marker instead of returning a misleading window", () => {
    expect(() => sourceSegment(file, "function target()", "")).toThrow(/end marker must not be empty/);
    expect(() => sourceSegment(file, "", "const after")).toThrow(/start marker must not be empty/);
  });

  it("names the contract in the failure when a label is given", () => {
    expect(() => sourceSegment(file, "function missing()", "const after", { label: "mode menu focus" })).toThrow(
      /^mode menu focus: start marker not found/,
    );
  });
});

describe("sourceFrom", () => {
  it("runs to end of file and still guards the start marker", () => {
    expect(sourceFrom(file, "function target()")).toContain("const after = 2;");
    expect(() => sourceFrom(file, "function missing()")).toThrow(/start marker not found/);
  });

  it("rejects overlapping and empty start markers", () => {
    expect(() => sourceFrom("aaa END", "aa")).toThrow(/occurs more than once/);
    expect(() => sourceFrom(file, "")).toThrow(/start marker must not be empty/);
  });
});
