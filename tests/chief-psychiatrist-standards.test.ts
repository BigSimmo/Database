import { describe, expect, it } from "vitest";

import chiefPsychiatristStandards from "../data/chief-psychiatrist-standards.json";
import { safeCanonicalSourceUrl } from "@/lib/sources/source-url-policy";

type Standard = {
  id: string;
  title: string;
  summary: string;
  sourceId: string;
  sourceUrl: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

const data = chiefPsychiatristStandards as {
  exportMetadata: {
    format: string;
    formatVersion: number;
    sourceIds: string[];
    generatedAt: string;
  };
  standards: Standard[];
};

describe("chief-psychiatrist-standards.json", () => {
  it("carries the drafted-summary export metadata shape", () => {
    expect(data.exportMetadata.format).toBe("chief-psychiatrist-standards");
    expect(data.exportMetadata.formatVersion).toBe(1);
    expect(Array.isArray(data.exportMetadata.sourceIds)).toBe(true);
    expect(data.exportMetadata.sourceIds.length).toBeGreaterThan(0);
    expect(() => new Date(data.exportMetadata.generatedAt).toISOString()).not.toThrow();
  });

  it("has at least one standard and no duplicate ids", () => {
    expect(data.standards.length).toBeGreaterThan(0);
    const ids = data.standards.map((standard) => standard.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every standard is drafted, unreviewed, and cites a registered source id", () => {
    for (const standard of data.standards) {
      expect(standard.status).toBe("drafted");
      expect(standard.reviewedBy).toBeNull();
      expect(standard.reviewedAt).toBeNull();
      expect(standard.title.length).toBeGreaterThan(0);
      expect(standard.summary.length).toBeGreaterThan(0);
      expect(data.exportMetadata.sourceIds).toContain(standard.sourceId);
    }
  });

  it("every standard's sourceUrl resolves to an official, governed host", () => {
    for (const standard of data.standards) {
      expect(safeCanonicalSourceUrl(standard.sourceUrl)).toBe(standard.sourceUrl);
      expect(new URL(standard.sourceUrl).hostname).toBe("www.chiefpsychiatrist.wa.gov.au");
    }
  });

  it("includes the Clinical Risk Assessment and Management standard", () => {
    const riskStandard = data.standards.find((standard) => standard.id === "cp-standard-risk-assessment-management");
    expect(riskStandard).toBeDefined();
    expect(riskStandard?.title).toMatch(/Risk Assessment and Management/i);
  });
});
