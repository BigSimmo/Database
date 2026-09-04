import { describe, expect, it } from "vitest";

import {
  deriveTopicBrowseSummaries,
  derivePublisherBrowseSummaries,
  matchesBrowseQuery,
  sortBrowseSummaries,
  sourceTopicLabel,
  totalSourceCount,
} from "@/lib/sources/browse-facets";
import { SOURCE_RATING_WEIGHTS, type ClinicalSourceCatalogueEntry } from "@/lib/sources/catalogue-types";

function sourceEntry(
  overrides: Partial<ClinicalSourceCatalogueEntry> & Pick<ClinicalSourceCatalogueEntry, "id" | "title">,
): ClinicalSourceCatalogueEntry {
  const { id, title, ...rest } = overrides;
  return {
    id,
    sourceId: id,
    title,
    aliases: [],
    version: "1",
    publisher: "RANZCP",
    publisherCode: "RANZCP",
    sourceType: "guideline",
    canonicalLocation: { kind: "url", href: "https://www.ranzcp.org/example" },
    geography: { scope: "australian_national", label: "Australia" },
    topics: ["perinatal_mental_health"],
    publicationDate: "2024-01-01",
    reviewDate: "2025-06-01",
    expiryDate: null,
    documentStatus: "current",
    validationStatus: "approved",
    contentMode: "link_only",
    lifecycleStatus: "active",
    supersedes: [],
    supersededBy: [],
    usedBy: [{ modeId: "dictionary", recordId: "record", recordLabel: "Record", field: "definition" }],
    rating: {
      score: 90,
      band: "A",
      weights: SOURCE_RATING_WEIGHTS,
      dimensions: {
        accuracyAssurance: 25,
        reliability: 20,
        evidenceQuality: 20,
        currency: 15,
        australianApplicability: 10,
        traceability: 0,
      },
      reasons: [],
    },
    warnings: [],
    ...rest,
  };
}

const preferred = sourceEntry({ id: "src_a", title: "Perinatal mental health guideline" });
const reviewRequired = sourceEntry({
  id: "src_b",
  title: "Legacy perinatal reference",
  publisher: "Legacy Publisher",
  sourceType: "professional_reference",
  topics: ["perinatal_mental_health", "assessment"],
  publicationDate: "2019-03-02",
  reviewDate: null,
  documentStatus: "outdated",
  validationStatus: "unverified",
  geography: { scope: "unknown", label: "Unknown jurisdiction" },
  rating: {
    score: 40,
    band: "D",
    weights: SOURCE_RATING_WEIGHTS,
    dimensions: {
      accuracyAssurance: 5,
      reliability: 5,
      evidenceQuality: 10,
      currency: 5,
      australianApplicability: 10,
      traceability: 5,
    },
    reasons: [],
  },
});
const waSource = sourceEntry({
  id: "src_c",
  title: "WA perinatal pathway",
  publisher: "WA Health",
  geography: { scope: "wa", label: "Western Australia" },
  topics: ["assessment"],
  reviewDate: "2026-02-01",
  rating: {
    score: 80,
    band: "B",
    weights: SOURCE_RATING_WEIGHTS,
    dimensions: {
      accuracyAssurance: 20,
      reliability: 18,
      evidenceQuality: 15,
      currency: 12,
      australianApplicability: 15,
      traceability: 0,
    },
    reasons: [],
  },
  usedBy: [{ modeId: "factsheets", recordId: "depression", recordLabel: "Depression", field: "sources" }],
});

const entries = [preferred, reviewRequired, waSource];

describe("sourceTopicLabel", () => {
  it("turns a stored topic value into a readable heading", () => {
    expect(sourceTopicLabel("perinatal_mental_health")).toBe("Perinatal Mental Health");
  });

  it("reads kebab-case values without title-casing the joining words", () => {
    // Stored values are a mix of the two casings; blanket title-casing produced
    // "Conditions-Risk-And-Safety", which is a heading nobody wrote.
    expect(sourceTopicLabel("conditions-risk-and-safety")).toBe("Conditions Risk and Safety");
    expect(sourceTopicLabel("community-and-models-of-care")).toBe("Community and Models of Care");
  });

  it("keeps a leading joining word capitalised", () => {
    expect(sourceTopicLabel("the-mental-health-act")).toBe("The Mental Health Act");
  });
});

describe("deriveTopicBrowseSummaries", () => {
  it("tallies quality bands, attention and coverage per topic", () => {
    const summaries = deriveTopicBrowseSummaries(entries);
    expect(summaries.map((summary) => summary.value)).toEqual(["assessment", "perinatal_mental_health"]);

    const perinatal = summaries.find((summary) => summary.value === "perinatal_mental_health");
    expect(perinatal).toBeDefined();
    expect(perinatal?.count).toBe(2);
    expect(perinatal?.bandCounts).toEqual({ A: 1, B: 0, C: 0, D: 1, excluded: 0 });
    // Outdated + unverified are both attention flags, but they belong to one entry.
    expect(perinatal?.attentionCount).toBe(1);
    expect(perinatal?.publishers).toEqual(["Legacy Publisher", "RANZCP"]);
    expect(perinatal?.usedByModes).toEqual(["dictionary"]);
  });

  it("names the source the catalogue would list first as the topic's lead", () => {
    const perinatal = deriveTopicBrowseSummaries(entries).find(
      (summary) => summary.value === "perinatal_mental_health",
    );
    expect(perinatal?.leadEntry).toEqual({ id: "src_a", title: "Perinatal mental health guideline" });
  });

  it("reports the most recent publication or review date and never an expiry", () => {
    const assessment = deriveTopicBrowseSummaries(entries).find((summary) => summary.value === "assessment");
    // WA's 2026 review beats the legacy entry's 2019 publication; the WA entry's
    // absent expiry is not a candidate either way.
    expect(assessment?.latestDate).toBe("2026-02-01");
  });

  it("counts an entry once when it carries the same topic twice", () => {
    const duplicated = sourceEntry({ id: "src_dup", title: "Duplicated tag", topics: ["assessment", "assessment"] });
    const assessment = deriveTopicBrowseSummaries([duplicated]).find((summary) => summary.value === "assessment");
    expect(assessment?.count).toBe(1);
  });

  it("reports the dominant jurisdiction and every jurisdiction present", () => {
    const perinatal = deriveTopicBrowseSummaries(entries).find(
      (summary) => summary.value === "perinatal_mental_health",
    );
    expect(perinatal?.jurisdictions).toEqual(["australian_national", "unknown"]);
    expect(perinatal?.scope).toBe("australian_national");
  });
});

describe("derivePublisherBrowseSummaries", () => {
  it("keeps a publisher's scopes separate so a row's count matches its catalogue link", () => {
    const international = sourceEntry({
      id: "src_intl",
      title: "RANZCP international position",
      geography: { scope: "international", label: "International" },
    });
    const national = derivePublisherBrowseSummaries([...entries, international], "australian_national");
    const abroad = derivePublisherBrowseSummaries([...entries, international], "international");
    expect(national.map((summary) => [summary.value, summary.count])).toEqual([["RANZCP", 1]]);
    expect(abroad.map((summary) => [summary.value, summary.count])).toEqual([["RANZCP", 1]]);
  });

  it("describes what a publisher covers rather than who publishes it", () => {
    const [waHealth] = derivePublisherBrowseSummaries(entries, "wa");
    expect(waHealth.label).toBe("WA Health");
    expect(waHealth.topics).toEqual(["assessment"]);
    expect(waHealth.publishers).toEqual([]);
    expect(waHealth.scope).toBe("wa");
    expect(waHealth.sourceTypes).toEqual(["guideline"]);
  });

  it("omits entries with no recorded publisher rather than inventing one", () => {
    const anonymous = sourceEntry({ id: "src_anon", title: "Unattributed", publisher: null });
    expect(derivePublisherBrowseSummaries([anonymous], "australian_national")).toEqual([]);
  });
});

describe("matchesBrowseQuery", () => {
  const summaries = deriveTopicBrowseSummaries(entries);
  const perinatal = summaries.find((summary) => summary.value === "perinatal_mental_health");

  it("keeps every row when the query is empty", () => {
    expect(summaries.every((summary) => matchesBrowseQuery(summary, "   "))).toBe(true);
  });

  it("matches the heading regardless of case, spacing or stored underscores", () => {
    expect(matchesBrowseQuery(perinatal!, "  PERINATAL   mental ")).toBe(true);
  });

  it("matches a row through its publishers and its lead source title", () => {
    expect(matchesBrowseQuery(perinatal!, "legacy publisher")).toBe(true);
    expect(matchesBrowseQuery(perinatal!, "mental health guideline")).toBe(true);
  });

  it("excludes a row nothing in the group matches", () => {
    expect(matchesBrowseQuery(perinatal!, "electroconvulsive")).toBe(false);
  });
});

describe("sortBrowseSummaries", () => {
  const summaries = deriveTopicBrowseSummaries(entries);

  it("orders by coverage, then alphabetically", () => {
    expect(sortBrowseSummaries(summaries, "coverage").map((summary) => summary.value)).toEqual([
      "assessment",
      "perinatal_mental_health",
    ]);
  });

  it("orders alphabetically by label", () => {
    expect(sortBrowseSummaries(summaries, "alpha").map((summary) => summary.value)).toEqual([
      "assessment",
      "perinatal_mental_health",
    ]);
  });

  it("puts the headings carrying the most attention flags first", () => {
    expect(sortBrowseSummaries(summaries, "attention").map((summary) => summary.value)).toEqual([
      "assessment",
      "perinatal_mental_health",
    ]);
    const heavier = deriveTopicBrowseSummaries([
      reviewRequired,
      sourceEntry({ ...reviewRequired, id: "src_b2", topics: ["perinatal_mental_health"] }),
      waSource,
    ]);
    expect(sortBrowseSummaries(heavier, "attention")[0]?.value).toBe("perinatal_mental_health");
  });

  it("does not mutate the input order", () => {
    const before = summaries.map((summary) => summary.value);
    sortBrowseSummaries(summaries, "coverage");
    expect(summaries.map((summary) => summary.value)).toEqual(before);
  });
});

describe("totalSourceCount", () => {
  it("adds the group counts a filtered browse list is standing behind", () => {
    expect(totalSourceCount(deriveTopicBrowseSummaries(entries))).toBe(4);
  });
});
