import { describe, expect, it } from "vitest";
import { coverageGaps } from "../scripts/check-codebase-index-coverage.mjs";

const index = "Modules: `observability/` answer-slo, `validation/`. Routes: /api/answer, /documents.";

describe("coverageGaps", () => {
  it("reports a module whose name is absent from the index", () => {
    const gaps = coverageGaps(index, [{ kind: "lib", dir: "src/lib", name: "ingestion" }]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].full).toBe("src/lib/ingestion");
  });

  it("treats a present name (case-insensitive) as covered", () => {
    const gaps = coverageGaps(index, [
      { kind: "lib", dir: "src/lib", name: "observability" },
      { kind: "lib", dir: "src/lib", name: "validation" },
      { kind: "route", dir: "src/app", name: "documents" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("honours the allowlist", () => {
    const gaps = coverageGaps(index, [{ kind: "route", dir: "src/app", name: "icons" }], new Set(["src/app/icons"]));
    expect(gaps).toEqual([]);
  });
});
