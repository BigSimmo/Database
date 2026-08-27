import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyzeShadowRecords,
  extractShadowRecords,
  formatSummaryReport,
  printHelp,
  runCli,
} from "../scripts/inspect-shadow-extraction";
import type { ShadowExtractionRecord } from "../worker/shadow-extraction";

function mockRecord(partial: Partial<ShadowExtractionRecord> = {}): ShadowExtractionRecord {
  return {
    version: 1,
    extractor: "docling",
    mode: "shadow",
    index_generation_id: "gen-123",
    cohort_percent: 2,
    cohort_bucket: 1,
    cohort_signals: ["tables"],
    outcome: "ok",
    error_kind: null,
    measured_at: new Date().toISOString(),
    docling_version: "2.15.0",
    wall_ms: 10000,
    peak_rss_bytes: 1400000000,
    exit_code: 0,
    docling: {
      page_count: 5,
      text_character_count: 2000,
      table_count: 2,
      table_cell_count: 20,
      numeric_token_count: 50,
    },
    legacy: {
      page_count: 5,
      text_character_count: 2000,
      ocr_page_count: 0,
      table_count: 2,
      table_row_count: 10,
      numeric_token_count: 50,
      wall_ms: 2000,
    },
    delta: {
      page_count: 0,
      text_character_ratio: 1.0,
      table_count: 0,
      numeric_token_ratio: 1.0,
    },
    ...partial,
  };
}

describe("inspect-shadow-extraction", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "inspect-shadow-test-"));
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("extractShadowRecords - adversarial and edge cases", () => {
    it("extracts shadow records from nested documents metadata or direct records", () => {
      const rawData = [
        {
          id: "doc-1",
          metadata: {
            title: "Doc 1",
            shadow_extraction: mockRecord({ outcome: "ok", wall_ms: 8000 }),
          },
        },
        mockRecord({ outcome: "timeout", wall_ms: 120000 }),
        {
          id: "doc-3",
          metadata: { title: "No shadow" },
        },
      ];

      const extracted = extractShadowRecords(rawData);
      expect(extracted).toHaveLength(2);
      expect(extracted[0].outcome).toBe("ok");
      expect(extracted[1].outcome).toBe("timeout");
    });

    it("handles non-array inputs without throwing (null, undefined, primitives, objects)", () => {
      expect(extractShadowRecords(null as unknown as unknown[])).toEqual([]);
      expect(extractShadowRecords(undefined as unknown as unknown[])).toEqual([]);
      expect(extractShadowRecords(42 as unknown as unknown[])).toEqual([]);
      expect(extractShadowRecords("string" as unknown as unknown[])).toEqual([]);
      expect(extractShadowRecords({} as unknown as unknown[])).toEqual([]);
      expect(extractShadowRecords(true as unknown as unknown[])).toEqual([]);
    });

    it("filters out corrupted, null, undefined, primitive, or empty array elements", () => {
      const dirtyData = [
        null,
        undefined,
        42,
        "malformed string",
        true,
        false,
        Symbol("sym"),
        [],
        {},
        { metadata: null },
        { metadata: "not-an-object" },
        { metadata: { shadow_extraction: null } },
        { metadata: { shadow_extraction: "not-an-object" } },
        { metadata: { shadow_extraction: 12345 } },
        { extractor: "other_extractor", outcome: "ok" },
        { extractor: "docling" }, // missing outcome
        { outcome: "ok" }, // missing extractor
        { outcome: null, extractor: "docling" },
        mockRecord({ outcome: "ok" }),
      ];

      const extracted = extractShadowRecords(dirtyData);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].outcome).toBe("ok");
    });

    it("extracts from direct record with docling extractor and valid outcome", () => {
      const directRecord = mockRecord({ outcome: "process_error", exit_code: 1 });
      const extracted = extractShadowRecords([directRecord]);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].outcome).toBe("process_error");
    });
  });

  describe("analyzeShadowRecords - extreme values and sanitization", () => {
    it("handles empty record sets gracefully (NO_DATA status)", () => {
      const summary = analyzeShadowRecords([]);
      expect(summary.status).toBe("NO_DATA");
      expect(summary.total_records).toBe(0);
      expect(summary.attempted_cohort_runs).toBe(0);
      expect(summary.timeout_rate_pct).toBe(0);
      expect(summary.threshold_breached).toBe(false);
      expect(summary.wall_ms_stats.min).toBeNull();
      expect(summary.wall_ms_stats.p50).toBeNull();
      expect(summary.wall_ms_stats.max).toBeNull();
      expect(summary.peak_rss_stats.max_bytes).toBeNull();
      expect(summary.delta_averages.text_character_ratio).toBeNull();

      const report = formatSummaryReport(summary);
      expect(report).toContain("Status: NO_DATA");
      expect(report).toContain("No shadow extraction records found in the evaluated window.");
    });

    it("handles non-array or dirty inputs without throwing", () => {
      const summaryNull = analyzeShadowRecords(null as unknown as ShadowExtractionRecord[]);
      expect(summaryNull.status).toBe("NO_DATA");
      expect(summaryNull.total_records).toBe(0);

      const summaryDirty = analyzeShadowRecords([
        null,
        undefined,
        {} as unknown,
        mockRecord({ outcome: "ok" }),
      ] as ShadowExtractionRecord[]);
      expect(summaryDirty.total_records).toBe(1);
      expect(summaryDirty.status).toBe("HEALTHY");
    });

    it("handles negative values in wall_ms, peak_rss_bytes, and delta metrics safely", () => {
      const records = [
        mockRecord({
          outcome: "ok",
          wall_ms: -500,
          peak_rss_bytes: -1048576,
          delta: {
            page_count: -10,
            text_character_ratio: -0.5,
            table_count: -2,
            numeric_token_ratio: -1.2,
          },
        }),
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.status).toBe("HEALTHY");
      expect(summary.wall_ms_stats.min).toBe(-500);
      expect(summary.wall_ms_stats.max).toBe(-500);
      expect(summary.wall_ms_stats.avg).toBe(-500);
      expect(summary.peak_rss_stats.max_bytes).toBe(-1048576);
      expect(summary.delta_averages.text_character_ratio).toBe(-0.5);
      expect(summary.delta_averages.numeric_token_ratio).toBe(-1.2);
      expect(summary.delta_averages.page_count_delta).toBe(-10);
      expect(summary.delta_averages.table_count_delta).toBe(-2);

      const report = formatSummaryReport(summary);
      expect(report).toContain("Status: HEALTHY");
      expect(report).toContain("Min: -500 ms");
      expect(report).toContain("Text Character Ratio : -0.5000");
    });

    it("handles zero values across all numeric fields", () => {
      const records = [
        mockRecord({
          outcome: "ok",
          wall_ms: 0,
          peak_rss_bytes: 0,
          delta: {
            page_count: 0,
            text_character_ratio: 0,
            table_count: 0,
            numeric_token_ratio: 0,
          },
        }),
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.status).toBe("HEALTHY");
      expect(summary.wall_ms_stats.min).toBe(0);
      expect(summary.wall_ms_stats.p50).toBe(0);
      expect(summary.wall_ms_stats.max).toBe(0);
      expect(summary.wall_ms_stats.avg).toBe(0);
      expect(summary.peak_rss_stats.max_bytes).toBe(0);
      expect(summary.peak_rss_stats.max_gib).toBe(0);
      expect(summary.delta_averages.text_character_ratio).toBe(0);
      expect(summary.delta_averages.numeric_token_ratio).toBe(0);

      const report = formatSummaryReport(summary);
      expect(report).toContain("Min: 0 ms");
      expect(report).toContain("Max: 0.0 MiB (0.000 GiB)");
      expect(report).toContain("Text Character Ratio : 0.0000");
    });

    it("handles massive numbers: peak RSS > 100 GiB triggering WARNING and proper units", () => {
      // 150 GiB = 150 * 1024 * 1024 * 1024 bytes = 161,061,273,600 bytes
      const bytes150GiB = 150 * 1024 * 1024 * 1024;
      const records = [
        mockRecord({
          outcome: "ok",
          wall_ms: 3600000, // 1 hour wall time
          peak_rss_bytes: bytes150GiB,
        }),
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.status).toBe("WARNING");
      expect(summary.peak_rss_stats.max_bytes).toBe(bytes150GiB);
      expect(summary.peak_rss_stats.max_gib).toBe(150);
      expect(summary.reasons.some((r) => r.includes("Peak RSS exceeded 2.0 GiB (150.00 GiB observed)"))).toBe(true);

      const report = formatSummaryReport(summary);
      expect(report).toContain("Status: WARNING");
      expect(report).toContain("153600.0 MiB (150.000 GiB)");
    });

    it("handles massive datasets without call stack overflow (70,000 records)", () => {
      const count = 70000;
      const records: ShadowExtractionRecord[] = new Array(count);
      for (let i = 0; i < count; i++) {
        records[i] = mockRecord({
          outcome: "ok",
          wall_ms: i % 1000,
          peak_rss_bytes: 1000000000 + i,
        });
      }

      const summary = analyzeShadowRecords(records);
      expect(summary.total_records).toBe(count);
      expect(summary.attempted_cohort_runs).toBe(count);
      expect(summary.status).toBe("HEALTHY");
      expect(summary.wall_ms_stats.min).toBe(0);
      expect(summary.wall_ms_stats.max).toBe(999);
      expect(summary.peak_rss_stats.max_bytes).toBe(1000069999);
    });

    it("filters out NaN, Infinity, -Infinity from all numeric metrics", () => {
      const records = [
        mockRecord({
          outcome: "ok",
          wall_ms: Number.NaN,
          peak_rss_bytes: Number.POSITIVE_INFINITY,
          delta: {
            text_character_ratio: Number.NaN,
            numeric_token_ratio: Number.NEGATIVE_INFINITY,
            page_count: Number.POSITIVE_INFINITY,
            table_count: Number.NaN,
          },
        }),
        mockRecord({
          outcome: "ok",
          wall_ms: 1000,
          peak_rss_bytes: 500000000,
          delta: {
            text_character_ratio: 1.05,
            numeric_token_ratio: 0.98,
            page_count: 0,
            table_count: 1,
          },
        }),
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.status).toBe("HEALTHY");
      expect(summary.wall_ms_stats.min).toBe(1000);
      expect(summary.wall_ms_stats.max).toBe(1000);
      expect(summary.peak_rss_stats.max_bytes).toBe(500000000);
      expect(summary.delta_averages.text_character_ratio).toBe(1.05);
      expect(summary.delta_averages.numeric_token_ratio).toBe(0.98);
      expect(summary.delta_averages.page_count_delta).toBe(0);
      expect(summary.delta_averages.table_count_delta).toBe(1);
    });

    it("handles null and undefined delta, docling, and legacy payloads gracefully", () => {
      const records = [
        mockRecord({
          outcome: "ok",
          docling: null,
          delta: null,
          wall_ms: null,
          peak_rss_bytes: null,
        }),
        mockRecord({
          outcome: "timeout",
          docling: null,
          delta: {
            text_character_ratio: null as unknown as number,
            numeric_token_ratio: 0.85,
            page_count: null as unknown as number,
            table_count: 2,
          },
        }),
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.total_records).toBe(2);
      expect(summary.attempted_cohort_runs).toBe(2);
      expect(summary.delta_averages.text_character_ratio).toBeNull();
      expect(summary.delta_averages.numeric_token_ratio).toBe(0.85);
      expect(summary.delta_averages.table_count_delta).toBe(2);

      const report = formatSummaryReport(summary);
      expect(report).toContain("Numeric Token Ratio  : 0.8500");
      expect(report).toContain("Text Character Ratio : N/A");
    });

    it("falls back to default options when given NaN or non-finite option values", () => {
      const summary = analyzeShadowRecords([mockRecord({ outcome: "ok" })], {
        hours: Number.NaN,
        thresholdPct: Number.POSITIVE_INFINITY,
      });

      expect(summary.window_hours).toBe(24);
      expect(summary.threshold_pct).toBe(10);
    });
  });

  describe("analyzeShadowRecords - exact boundary thresholds", () => {
    it("tests exact 10.00% default threshold boundary (9.99% vs 10.00% vs 10.01%)", () => {
      // 9.99%: 999 timeouts out of 10000 attempted runs
      const records999: ShadowExtractionRecord[] = [
        ...Array.from({ length: 9001 }, () => mockRecord({ outcome: "ok" })),
        ...Array.from({ length: 999 }, () => mockRecord({ outcome: "timeout" })),
      ];
      const summary999 = analyzeShadowRecords(records999, { thresholdPct: 10 });
      expect(summary999.timeout_count).toBe(999);
      expect(summary999.attempted_cohort_runs).toBe(10000);
      expect(summary999.timeout_rate_pct).toBe(9.99);
      expect(summary999.threshold_breached).toBe(false);
      expect(summary999.status).toBe("HEALTHY");

      // 10.00%: 1000 timeouts out of 10000 attempted runs (or 1 out of 10)
      const records1000: ShadowExtractionRecord[] = [
        ...Array.from({ length: 9000 }, () => mockRecord({ outcome: "ok" })),
        ...Array.from({ length: 1000 }, () => mockRecord({ outcome: "timeout" })),
      ];
      const summary1000 = analyzeShadowRecords(records1000, { thresholdPct: 10 });
      expect(summary1000.timeout_count).toBe(1000);
      expect(summary1000.attempted_cohort_runs).toBe(10000);
      expect(summary1000.timeout_rate_pct).toBe(10.0);
      expect(summary1000.threshold_breached).toBe(false);
      expect(summary1000.status).toBe("HEALTHY");

      // 10.01%: 1001 timeouts out of 10000 attempted runs
      const records1001: ShadowExtractionRecord[] = [
        ...Array.from({ length: 8999 }, () => mockRecord({ outcome: "ok" })),
        ...Array.from({ length: 1001 }, () => mockRecord({ outcome: "timeout" })),
      ];
      const summary1001 = analyzeShadowRecords(records1001, { thresholdPct: 10 });
      expect(summary1001.timeout_count).toBe(1001);
      expect(summary1001.attempted_cohort_runs).toBe(10000);
      expect(summary1001.timeout_rate_pct).toBe(10.01);
      expect(summary1001.threshold_breached).toBe(true);
      expect(summary1001.status).toBe("ROLLBACK_RECOMMENDED");
    });

    it("tests custom threshold boundary (e.g. 5.0% threshold)", () => {
      // 5.00%: 5 timeouts out of 100 -> HEALTHY
      const records500 = [
        ...Array.from({ length: 95 }, () => mockRecord({ outcome: "ok" })),
        ...Array.from({ length: 5 }, () => mockRecord({ outcome: "timeout" })),
      ];
      const summary500 = analyzeShadowRecords(records500, { thresholdPct: 5.0 });
      expect(summary500.timeout_rate_pct).toBe(5.0);
      expect(summary500.threshold_breached).toBe(false);
      expect(summary500.status).toBe("HEALTHY");

      // 5.01%: 501 timeouts out of 10000 -> ROLLBACK_RECOMMENDED
      const records501 = [
        ...Array.from({ length: 9499 }, () => mockRecord({ outcome: "ok" })),
        ...Array.from({ length: 501 }, () => mockRecord({ outcome: "timeout" })),
      ];
      const summary501 = analyzeShadowRecords(records501, { thresholdPct: 5.0 });
      expect(summary501.timeout_rate_pct).toBe(5.01);
      expect(summary501.threshold_breached).toBe(true);
      expect(summary501.status).toBe("ROLLBACK_RECOMMENDED");
    });

    it("tests 0% threshold boundary (zero tolerance)", () => {
      // 0 timeouts out of 10 at 0% threshold -> HEALTHY (0.0 > 0 is false)
      const records0 = Array.from({ length: 10 }, () => mockRecord({ outcome: "ok" }));
      const summary0 = analyzeShadowRecords(records0, { thresholdPct: 0 });
      expect(summary0.timeout_rate_pct).toBe(0);
      expect(summary0.threshold_breached).toBe(false);
      expect(summary0.status).toBe("HEALTHY");

      // 1 timeout out of 100 at 0% threshold -> ROLLBACK_RECOMMENDED (1.0 > 0 is true)
      const records1 = [
        ...Array.from({ length: 99 }, () => mockRecord({ outcome: "ok" })),
        mockRecord({ outcome: "timeout" }),
      ];
      const summary1 = analyzeShadowRecords(records1, { thresholdPct: 0 });
      expect(summary1.timeout_rate_pct).toBe(1.0);
      expect(summary1.threshold_breached).toBe(true);
      expect(summary1.status).toBe("ROLLBACK_RECOMMENDED");
    });

    it("tests 100% threshold boundary", () => {
      // 10 timeouts out of 10 at 100% threshold -> HEALTHY (100.0 > 100 is false)
      const records100 = Array.from({ length: 10 }, () => mockRecord({ outcome: "timeout" }));
      const summary100 = analyzeShadowRecords(records100, { thresholdPct: 100 });
      expect(summary100.timeout_rate_pct).toBe(100.0);
      expect(summary100.threshold_breached).toBe(false);
      expect(summary100.status).toBe("HEALTHY");
    });

    it("tests exact 2.0 GiB memory threshold boundary", () => {
      const exact2GiB = 2 * 1024 * 1024 * 1024; // 2,147,483,648 bytes
      const summaryExact = analyzeShadowRecords([mockRecord({ peak_rss_bytes: exact2GiB })]);
      expect(summaryExact.peak_rss_stats.max_gib).toBe(2);
      expect(summaryExact.status).toBe("HEALTHY");

      const justOver2GiB = exact2GiB + 1024 * 1024; // 2.001 GiB
      const summaryOver = analyzeShadowRecords([mockRecord({ peak_rss_bytes: justOver2GiB })]);
      expect(summaryOver.status).toBe("WARNING");
      expect(summaryOver.reasons.some((r) => r.includes("Peak RSS exceeded 2.0 GiB"))).toBe(true);
    });
  });

  describe("analyzeShadowRecords - mixed cohorts and status precedence", () => {
    it("handles all outcome types and properly excludes skipped cohorts from denominator", () => {
      const records: ShadowExtractionRecord[] = [
        mockRecord({ outcome: "ok" }),
        mockRecord({ outcome: "timeout" }),
        mockRecord({ outcome: "runtime_unavailable" }),
        mockRecord({ outcome: "process_error" }),
        mockRecord({ outcome: "skipped_page_cap" }),
        mockRecord({ outcome: "skipped_concurrent" }),
        mockRecord({ outcome: "extraction_failed" }),
        mockRecord({ outcome: "custom_unrecognized_outcome" as unknown as ShadowExtractionRecord["outcome"] }),
      ];

      const summary = analyzeShadowRecords(records, { thresholdPct: 50 });
      expect(summary.total_records).toBe(8);
      // skipped_page_cap (1) + skipped_concurrent (1) = 2 skipped. Attempted = 8 - 2 = 6
      expect(summary.attempted_cohort_runs).toBe(6);
      expect(summary.outcome_counts.ok).toBe(1);
      expect(summary.outcome_counts.timeout).toBe(1);
      expect(summary.outcome_counts.runtime_unavailable).toBe(1);
      expect(summary.outcome_counts.process_error).toBe(1);
      expect(summary.outcome_counts.skipped_page_cap).toBe(1);
      expect(summary.outcome_counts.skipped_concurrent).toBe(1);
      expect(summary.outcome_counts.extraction_failed).toBe(1);
      expect(summary.outcome_counts.custom_unrecognized_outcome).toBe(1);
      // Timeout rate = (1 / 6) * 100 = 16.67%
      expect(summary.timeout_rate_pct).toBe(16.67);
      // runtime_unavailable forces ROLLBACK_RECOMMENDED
      expect(summary.status).toBe("ROLLBACK_RECOMMENDED");
    });

    it("handles cohorts with only skipped records (0 attempted runs)", () => {
      const records = [
        mockRecord({ outcome: "skipped_page_cap" }),
        mockRecord({ outcome: "skipped_concurrent" }),
        mockRecord({ outcome: "skipped_page_cap" }),
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.total_records).toBe(3);
      expect(summary.attempted_cohort_runs).toBe(0);
      expect(summary.timeout_rate_pct).toBe(0);
      expect(summary.threshold_breached).toBe(false);
      expect(summary.status).toBe("HEALTHY");
      expect(summary.reasons).toEqual(["All shadow extraction health checks and metrics within normal parameters."]);
    });

    it("gives ROLLBACK_RECOMMENDED precedence over WARNING when multiple issues occur", () => {
      const records = [
        mockRecord({ outcome: "runtime_unavailable" }),
        mockRecord({ outcome: "process_error" }),
        mockRecord({ outcome: "ok", peak_rss_bytes: 4 * 1024 * 1024 * 1024 }), // 4 GiB
      ];

      const summary = analyzeShadowRecords(records);
      expect(summary.status).toBe("ROLLBACK_RECOMMENDED");
      expect(summary.reasons).toHaveLength(3);
      expect(summary.reasons.some((r) => r.includes("Runtime unavailable recorded"))).toBe(true);
      expect(summary.reasons.some((r) => r.includes("Process errors recorded"))).toBe(true);
      expect(summary.reasons.some((r) => r.includes("Peak RSS exceeded 2.0 GiB"))).toBe(true);
    });

    it("reports WARNING when only process_error occurs (no threshold breach, no runtime_unavailable)", () => {
      const records = [mockRecord({ outcome: "ok" }), mockRecord({ outcome: "process_error" })];

      const summary = analyzeShadowRecords(records, { thresholdPct: 50 });
      expect(summary.status).toBe("WARNING");
      expect(summary.process_error_count).toBe(1);
      expect(summary.reasons.some((r) => r.includes("Process errors recorded on 1 runs"))).toBe(true);
    });

    it("reports HEALTHY when only extraction_failed occurs without process_error or timeout breach", () => {
      const records = [mockRecord({ outcome: "ok" }), mockRecord({ outcome: "extraction_failed" })];

      const summary = analyzeShadowRecords(records, { thresholdPct: 50 });
      expect(summary.status).toBe("HEALTHY");
      expect(summary.total_records).toBe(2);
      expect(summary.attempted_cohort_runs).toBe(2);
      expect(summary.outcome_counts.extraction_failed).toBe(1);
    });
  });

  describe("formatSummaryReport - formatting edge cases", () => {
    it("formats summary report with custom and mixed outcome breakdowns", () => {
      const records = [
        mockRecord({ outcome: "ok", wall_ms: 1200 }),
        mockRecord({ outcome: "unusual_error" as unknown as ShadowExtractionRecord["outcome"], wall_ms: 500 }),
      ];
      const summary = analyzeShadowRecords(records);
      const report = formatSummaryReport(summary);

      expect(report).toContain("unusual_error");
      expect(report).toContain("1200 ms");
    });

    it("formats report when text_character_ratio is null but other deltas exist", () => {
      const summary = analyzeShadowRecords([]);
      summary.delta_averages = {
        text_character_ratio: null,
        numeric_token_ratio: 1.25,
        page_count_delta: 1,
        table_count_delta: 0,
      };

      const report = formatSummaryReport(summary);
      expect(report).toContain("Parity Delta Averages vs Legacy:");
      expect(report).toContain("Text Character Ratio : N/A");
      expect(report).toContain("Numeric Token Ratio  : 1.2500");
      expect(report).toContain("Page Count Delta     : 1.00");
    });
  });

  describe("CLI flags and parseCliArgs", () => {
    it("runs CLI with --help and -h returning 0", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const code1 = await runCli(["--help"]);
      expect(code1).toBe(0);
      const code2 = await runCli(["-h"]);
      expect(code2).toBe(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("printHelp outputs usage documentation", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      printHelp();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("--threshold"));
      spy.mockRestore();
    });

    it("supports --file and --input interchangeably", async () => {
      const filePath = join(tempDir, "file-flag-test.json");
      writeFileSync(filePath, JSON.stringify([mockRecord({ outcome: "ok" })]));

      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const codeFile = await runCli(["--file", filePath]);
      expect(codeFile).toBe(0);

      const codeInput = await runCli(["--input", filePath]);
      expect(codeInput).toBe(0);

      spy.mockRestore();
    });

    it("supports --hours and --threshold flags with valid values and handles invalid values", async () => {
      const filePath = join(tempDir, "threshold-test.json");
      writeFileSync(
        filePath,
        JSON.stringify([
          ...Array.from({ length: 85 }, () => mockRecord({ outcome: "ok" })),
          ...Array.from({ length: 15 }, () => mockRecord({ outcome: "timeout" })),
        ]),
      );

      let output = "";
      const spy = vi.spyOn(console, "log").mockImplementation((msg) => {
        output += msg;
      });

      // Threshold = 20%: 15% timeout rate is HEALTHY (code 0)
      const code20 = await runCli(["--file", filePath, "--threshold", "20", "--hours", "48", "--json"]);
      expect(code20).toBe(0);
      const parsed20 = JSON.parse(output);
      expect(parsed20.threshold_pct).toBe(20);
      expect(parsed20.window_hours).toBe(48);
      expect(parsed20.status).toBe("HEALTHY");

      output = "";
      // Threshold = 10%: 15% timeout rate is ROLLBACK_RECOMMENDED (code 2)
      const code10 = await runCli(["--file", filePath, "--threshold", "10", "--json"]);
      expect(code10).toBe(2);
      const parsed10 = JSON.parse(output);
      expect(parsed10.threshold_pct).toBe(10);
      expect(parsed10.status).toBe("ROLLBACK_RECOMMENDED");

      output = "";
      // Invalid threshold value fallback (not a finite number)
      const codeInvalid = await runCli(["--file", filePath, "--threshold", "notanumber", "--json"]);
      expect(codeInvalid).toBe(2); // fallback to default 10%
      const parsedInvalid = JSON.parse(output);
      expect(parsedInvalid.threshold_pct).toBe(10);

      spy.mockRestore();
    });

    it("outputs valid JSON when --json flag is provided", async () => {
      const filePath = join(tempDir, "json-flag-test.json");
      writeFileSync(filePath, JSON.stringify([mockRecord({ outcome: "ok", wall_ms: 5000 })]));

      let loggedJson = "";
      const spy = vi.spyOn(console, "log").mockImplementation((msg) => {
        loggedJson = msg;
      });

      const code = await runCli(["--file", filePath, "--json"]);
      expect(code).toBe(0);
      const parsed = JSON.parse(loggedJson);
      expect(parsed).toHaveProperty("status", "HEALTHY");
      expect(parsed).toHaveProperty("window_hours", 24);
      expect(parsed).toHaveProperty("wall_ms_stats");
      expect(parsed.wall_ms_stats.min).toBe(5000);

      spy.mockRestore();
    });

    it("parses single object (non-array) from file input", async () => {
      const filePath = join(tempDir, "single-object.json");
      writeFileSync(filePath, JSON.stringify(mockRecord({ outcome: "ok", wall_ms: 3200 })));

      let loggedOutput = "";
      const spy = vi.spyOn(console, "log").mockImplementation((msg) => {
        loggedOutput += msg;
      });

      const code = await runCli(["--file", filePath, "--json"]);
      expect(code).toBe(0);
      const parsed = JSON.parse(loggedOutput);
      expect(parsed.total_records).toBe(1);
      expect(parsed.wall_ms_stats.min).toBe(3200);

      spy.mockRestore();
    });
  });

  describe("runCli exit code contract and error handling", () => {
    it("returns exit code 0 for HEALTHY summary", async () => {
      const filePath = join(tempDir, "healthy.json");
      writeFileSync(filePath, JSON.stringify([mockRecord({ outcome: "ok" })]));
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const code = await runCli(["--file", filePath]);
      expect(code).toBe(0);

      spy.mockRestore();
    });

    it("returns exit code 0 for NO_DATA summary", async () => {
      const filePath = join(tempDir, "no-data.json");
      writeFileSync(filePath, JSON.stringify([]));
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const code = await runCli(["--file", filePath]);
      expect(code).toBe(0);

      spy.mockRestore();
    });

    it("returns exit code 0 for WARNING summary (e.g. peak RSS > 2 GiB)", async () => {
      const filePath = join(tempDir, "warning.json");
      writeFileSync(filePath, JSON.stringify([mockRecord({ outcome: "ok", peak_rss_bytes: 3 * 1024 * 1024 * 1024 })]));
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const code = await runCli(["--file", filePath]);
      expect(code).toBe(0);

      spy.mockRestore();
    });

    it("returns exit code 2 for ROLLBACK_RECOMMENDED due to timeout threshold breach", async () => {
      const filePath = join(tempDir, "rollback-timeout.json");
      writeFileSync(
        filePath,
        JSON.stringify([
          mockRecord({ outcome: "ok" }),
          mockRecord({ outcome: "timeout" }), // 50% timeout rate > 10%
        ]),
      );
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const code = await runCli(["--file", filePath]);
      expect(code).toBe(2);

      spy.mockRestore();
    });

    it("returns exit code 2 for ROLLBACK_RECOMMENDED due to runtime_unavailable", async () => {
      const filePath = join(tempDir, "rollback-runtime.json");
      writeFileSync(filePath, JSON.stringify([mockRecord({ outcome: "runtime_unavailable", exit_code: 20 })]));
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const code = await runCli(["--file", filePath]);
      expect(code).toBe(2);

      spy.mockRestore();
    });

    it("returns exit code 1 for non-existent input file", async () => {
      const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});

      const code = await runCli(["--file", join(tempDir, "does-not-exist.json")]);
      expect(code).toBe(1);
      expect(spyErr).toHaveBeenCalledWith(expect.stringContaining("Failed to read input file"), expect.anything());

      spyErr.mockRestore();
    });

    it("returns exit code 1 for malformed JSON syntax in input file", async () => {
      const filePath = join(tempDir, "bad-syntax.json");
      writeFileSync(filePath, "{ this is not valid JSON }");
      const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});

      const code = await runCli(["--file", filePath]);
      expect(code).toBe(1);
      expect(spyErr).toHaveBeenCalledWith(expect.stringContaining("Failed to read input file"), expect.anything());

      spyErr.mockRestore();
    });

    it("handles --stdin reading valid JSON and invalid JSON", async () => {
      const validJson = JSON.stringify([mockRecord({ outcome: "ok" })]);
      const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
      const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});

      const codeSuccess = await runCli(["--stdin", "--json"], {
        readStdin: () => validJson,
      });
      expect(codeSuccess).toBe(0);

      // Malformed stdin JSON
      const codeFail = await runCli(["--stdin"], {
        readStdin: () => "{ bad json stdin",
      });
      expect(codeFail).toBe(1);
      expect(spyErr).toHaveBeenCalledWith(
        expect.stringContaining("Failed to read JSON from stdin:"),
        expect.anything(),
      );

      spyLog.mockRestore();
      spyErr.mockRestore();
    });

    it("handles database query failure gracefully with exit code 0 and NO_DATA summary", async () => {
      // When no --file, --input, or --stdin is provided, it tries DB loading.
      // With failing DB, it catches and returns 0 with NO_DATA.
      const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});

      const code = await runCli(["--hours", "12"], {
        loadDb: async () => {
          throw new Error("Supabase query failed: connection refused");
        },
      });
      expect(code).toBe(0);
      expect(spyWarn).toHaveBeenCalledWith(
        expect.stringContaining("[inspect-shadow-extraction] Live database query unavailable:"),
      );

      spyWarn.mockRestore();
      spyLog.mockRestore();
    });
  });
});
