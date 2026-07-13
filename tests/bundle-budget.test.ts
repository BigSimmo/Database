import { describe, expect, it } from "vitest";
import { compareToBudget, measureChunks } from "../scripts/check-bundle-budget.mjs";

const buf = (n: number) => Buffer.alloc(n, "a"); // highly compressible; gzip < raw

describe("measureChunks", () => {
  it("sums raw and gzip bytes and ranks the largest", () => {
    const m = measureChunks([
      { name: "a.js", buffer: buf(1000) },
      { name: "b.js", buffer: buf(4000) },
    ]);
    expect(m.files).toBe(2);
    expect(m.totalRawBytes).toBe(5000);
    expect(m.totalGzipBytes).toBeGreaterThan(0);
    expect(m.totalGzipBytes).toBeLessThan(m.totalRawBytes);
    expect(m.largest[0].name).toBe("b.js");
  });
});

describe("compareToBudget", () => {
  it("warns when there is no baseline", () => {
    const v = compareToBudget({ totalGzipBytes: 1000 }, { enforce: true, tolerancePct: 10, totalGzipBytes: null });
    expect(v.status).toBe("warn");
    expect(v.reason).toMatch(/no baseline/);
  });

  it("passes within tolerance", () => {
    const v = compareToBudget({ totalGzipBytes: 1050 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("ok");
    expect(v.overPct).toBeCloseTo(5, 5);
  });

  it("fails over tolerance when enforcing", () => {
    const v = compareToBudget({ totalGzipBytes: 1200 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("fail");
    expect(v.overPct).toBeCloseTo(20, 5);
  });

  it("only warns over tolerance when not enforcing", () => {
    const v = compareToBudget({ totalGzipBytes: 1200 }, { enforce: false, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("warn");
  });

  it("treats exactly-at-tolerance as ok", () => {
    const v = compareToBudget({ totalGzipBytes: 1100 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("ok");
  });
});
