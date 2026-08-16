import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseListRows } from "../src/lib/api-list-response";

const rowSchema = z.object({ id: z.string() });

describe("parseListRows", () => {
  it.each([
    { label: "null", data: null },
    { label: "undefined", data: undefined },
  ])("rejects $label list payloads instead of coercing them to an empty array", ({ data }) => {
    expect(() => parseListRows(data, rowSchema)).toThrow("Invalid list data.");
  });

  it("accepts an explicitly empty list", () => {
    expect(parseListRows([], rowSchema)).toEqual([]);
  });
});
