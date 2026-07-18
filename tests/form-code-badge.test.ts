import { describe, expect, it } from "vitest";

import { splitFormCode } from "@/components/forms/form-code-badge";

describe("splitFormCode", () => {
  it("splits on spaces and other whitespace separators used by pathwayItems", () => {
    expect(splitFormCode("6B attachment")).toEqual({ head: "6B", qualifier: "attachment" });
    expect(splitFormCode("6B\tattachment")).toEqual({ head: "6B", qualifier: "attachment" });
    expect(splitFormCode("6B\nattachment")).toEqual({ head: "6B", qualifier: "attachment" });
    expect(splitFormCode("  10H  ")).toEqual({ head: "10H", qualifier: null });
  });
});
