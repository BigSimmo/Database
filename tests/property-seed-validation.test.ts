import { describe, expect, it } from "vitest";
import { parsePropertySeed } from "./property-seed";

describe("FAST_CHECK_SEED validation", () => {
  it.each(["123junk", "1.9", "1e3", "", "9007199254740992"])("rejects malformed seed %j", (seed) => {
    expect(() => parsePropertySeed(seed)).toThrow(/must be a safe integer/);
  });

  it("accepts signed safe integers", () => {
    expect(parsePropertySeed("+123")).toBe(123);
    expect(parsePropertySeed("-123")).toBe(-123);
  });
});
