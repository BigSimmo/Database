import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildDiscriminators,
  cleanDifferentialItem,
  curatedContentNote,
  detailTabCounts,
  doNowStepsAreCurated,
  formatDifferentialCopyText,
  groupCurrentPresentation,
  isDetailTabId,
  isRedundantSafetySummary,
  resolveDoNowSteps,
  resolveSafetyFacts,
  sectionBadgeLabel,
  visibleSectionItems,
} from "@/lib/differential-detail";
import { curatedDifferentials, curatedEntryFor } from "@/lib/differential-curated";
import {
  differentialRecords,
  getDifferentialDetailContext,
  getDifferentialRecord,
  type DifferentialRecord,
  type DifferentialSection,
} from "@/lib/differentials";

function buildSection(overrides: Partial<DifferentialSection> = {}): DifferentialSection {
  return {
    id: "why-it-fits",
    title: "Why it fits",
    summary: "Summary line",
    items: [],
    tone: "fit",
    ...overrides,
  };
}

function buildRecord(overrides: Partial<DifferentialRecord> = {}): DifferentialRecord {
  return {
    slug: "test-diagnosis",
    title: "Test diagnosis",
    status: "urgent",
    subtitle: "Subtitle line",
    clinicalHinge: "The clinical hinge.",
    safetySnapshot: { summary: "Safety summary.", tags: ["Sepsis"] },
    sections: [],
    related: [],
    currentPresentation: [],
    investigations: [],
    immediateActions: [],
    ...overrides,
  };
}

describe("cleanDifferentialItem", () => {
  it("strips the lone trailing full stop from short fragments", () => {
    expect(cleanDifferentialItem("medication toxicity.")).toBe("medication toxicity");
  });

  it("keeps sentence punctuation and internal periods", () => {
    const sentence = "Do vitals, BGL, sats. Then attention testing follows in every unwell patient today.";
    expect(cleanDifferentialItem(sentence)).toBe(sentence);
    expect(cleanDifferentialItem("e.g.")).toBe("e.g.");
  });

  it("collapses whitespace", () => {
    expect(cleanDifferentialItem("  spaced \n out   text ")).toBe("spaced out text");
  });
});

describe("visibleSectionItems", () => {
  it("drops duplicates of the summary and clinical hinge case-insensitively", () => {
    const section = buildSection({
      summary: "Fluctuating attention.",
      items: ["Fluctuating attention.", "FLUCTUATING ATTENTION", "The clinical hinge.", "Unique item", "unique item"],
    });
    const record = buildRecord({ sections: [section] });
    expect(visibleSectionItems(section, record)).toEqual(["Unique item"]);
  });

  it("keeps action sections diagnosis-scoped", () => {
    const section = buildSection({ id: "immediate-action", tone: "action", items: ["Diagnosis-specific step"] });
    const record = buildRecord({ sections: [section], immediateActions: ["Step one", "Step two", "Step one"] });
    expect(visibleSectionItems(section, record)).toEqual(["Diagnosis-specific step"]);
  });

  it("sources test sections from record.investigations with fallback to section items", () => {
    const section = buildSection({ id: "investigations", tone: "test", items: ["ECG"] });
    expect(visibleSectionItems(section, buildRecord({ investigations: ["Blood glucose"] }))).toEqual(["Blood glucose"]);
    expect(visibleSectionItems(section, buildRecord({ investigations: [] }))).toEqual(["ECG"]);
  });
});

describe("sectionBadgeLabel", () => {
  it("uses cleaned counts with the tone suffix", () => {
    const section = buildSection({
      tone: "warning",
      summary: "Sepsis summary",
      items: ["Sepsis", "sepsis", "Hypoxia"],
    });
    expect(sectionBadgeLabel(section, buildRecord())).toBe("2 possible");
  });

  it("returns null when nothing remains after cleaning", () => {
    const section = buildSection({ summary: "Only item", items: ["Only item."] });
    expect(sectionBadgeLabel(section, buildRecord())).toBeNull();
  });
});

describe("resolveSafetyFacts", () => {
  it("returns the curated quartet for delirium", () => {
    const delirium = getDifferentialRecord("delirium");
    expect(delirium).not.toBeNull();
    const labels = resolveSafetyFacts(delirium!, curatedEntryFor(delirium!.slug)).map((fact) => fact.label);
    expect(labels).toEqual(["High risk", "Onset", "Course", "Treatable"]);
  });

  it("derives only honest counts for non-curated records", () => {
    const record = buildRecord({
      sections: [buildSection({ id: "must-not-miss", tone: "warning", summary: "Risks", items: ["Sepsis", "Stroke"] })],
      investigations: ["Blood glucose"],
      immediateActions: ["Do vitals"],
      related: [{ id: "other", label: "Other", likelihood: "possible", note: "" }],
    });
    const facts = resolveSafetyFacts(record, null);
    expect(facts.map((fact) => fact.label)).toEqual([
      "High-risk causes",
      "Core tests",
      "Immediate actions",
      "Related differentials",
    ]);
    expect(facts.map((fact) => fact.value)).toEqual(["2", "1", "1", "1"]);
    expect(facts.some((fact) => ["Onset", "Course", "Treatable"].includes(fact.label))).toBe(false);
  });
});

describe("isRedundantSafetySummary", () => {
  it("treats an exact comma-joined tag list as redundant", () => {
    expect(
      isRedundantSafetySummary("Superimposed delirium, aspiration, falls, abuse/neglect", [
        "Superimposed delirium",
        "aspiration",
        "falls",
        "abuse/neglect",
      ]),
    ).toBe(true);
  });

  it("ignores case and trailing punctuation", () => {
    expect(
      isRedundantSafetySummary("Wandering, exploitation, medication mismanagement.", [
        "wandering",
        "Exploitation",
        "medication mismanagement",
      ]),
    ).toBe(true);
  });

  it("keeps summary tokens that tags do not cover, even at high overlap", () => {
    expect(
      isRedundantSafetySummary("Superimposed delirium, aspiration, falls, abuse/neglect, unsafe living.", [
        "Superimposed delirium",
        "aspiration",
        "falls",
        "abuse/neglect",
      ]),
    ).toBe(false);
  });

  it("does not hide a summary when tags are only a subset of its risks", () => {
    expect(
      isRedundantSafetySummary("Suicide risk, violence risk, unsafe living", ["Suicide risk", "violence risk"]),
    ).toBe(false);
  });

  it("keeps unique prose summaries that tags do not cover", () => {
    expect(
      isRedundantSafetySummary("Acute change needs a delirium workup before attributing decline to dementia alone.", [
        "Superimposed delirium",
        "aspiration",
      ]),
    ).toBe(false);
  });

  it("hides an empty summary and keeps a summary when there are no tags", () => {
    expect(isRedundantSafetySummary("", ["falls"])).toBe(true);
    expect(isRedundantSafetySummary("Falls and aspiration risk.", [])).toBe(false);
  });
});

describe("formatDifferentialCopyText", () => {
  it("produces a deterministic register ending with the disclaimer", () => {
    const record = buildRecord({
      immediateActions: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"],
      investigations: ["Blood glucose"],
    });
    const text = formatDifferentialCopyText(record);
    expect(text.startsWith("Test diagnosis — Urgent differential")).toBe(true);
    expect(text).toContain("Clinical hinge: The clinical hinge.");
    expect(text).toContain("Must-not-miss: Safety summary.");
    expect(text).toContain("- Six");
    expect(text).not.toContain("- Seven");
    expect(text).toContain("- Blood glucose");
    expect(text.endsWith("Clinical reference — not validated decision support. Review before use.")).toBe(true);
    expect(text).not.toContain("undefined");
  });
});

describe("groupCurrentPresentation", () => {
  it("groups strict title/candidates/hinge triplets", () => {
    const view = groupCurrentPresentation([
      "Psychomotor Agitation",
      "Akathisia, Bipolar mania",
      "CLINICAL HINGE: Inattention separates delirium.",
      "Perinatal Acute Psychiatry",
      "Postpartum psychosis",
      "CLINICAL HINGE: Abrupt change from baseline.",
    ]);
    expect(view.kind).toBe("grouped");
    if (view.kind !== "grouped") return;
    expect(view.groups).toHaveLength(2);
    expect(view.groups[0]).toEqual({
      title: "Psychomotor Agitation",
      candidates: "Akathisia, Bipolar mania",
      hinge: "Inattention separates delirium.",
    });
  });

  it("falls back to a flat list with per-item hinge detection", () => {
    const view = groupCurrentPresentation(["Item one", "CLINICAL HINGE: Key separator", "Item two"]);
    expect(view.kind).toBe("flat");
    if (view.kind !== "flat") return;
    expect(view.items).toEqual([
      { text: "Item one", isHinge: false },
      { text: "Key separator", isHinge: true },
      { text: "Item two", isHinge: false },
    ]);
  });
});

describe("isDetailTabId", () => {
  it("accepts known tabs and rejects everything else", () => {
    expect(isDetailTabId("map")).toBe(true);
    expect(isDetailTabId("overview")).toBe(true);
    expect(isDetailTabId("bogus")).toBe(false);
    expect(isDetailTabId(null)).toBe(false);
  });
});

describe("getDifferentialDetailContext", () => {
  it("links delirium to the acute confusion comparison workspace", () => {
    const delirium = getDifferentialRecord("delirium");
    expect(delirium).not.toBeNull();
    const context = getDifferentialDetailContext(delirium!);
    expect(context.comparePresentation?.slug).toBe("acute-confusion-encephalopathy");
    expect(context.knownRelatedSlugs).toContain("akathisia");
    expect(context.relatedMapDetails.akathisia).toMatchObject({
      slug: "akathisia",
      title: "Akathisia",
    });
    expect(context.relatedMapDetails.akathisia?.clinicalHinge.length).toBeGreaterThan(0);
    expect(context.relatedMapDetails.akathisia?.safetySummary.length).toBeGreaterThan(0);
    expect(context.source.version.length).toBeGreaterThan(0);
    expect(context.source.sourceStatus).toBe("review_due");
  });

  it("omits incomplete owner-catalog clinical summaries instead of falling back across owner scope", () => {
    const delirium = getDifferentialRecord("delirium");
    const akathisia = getDifferentialRecord("akathisia");
    expect(delirium).not.toBeNull();
    expect(akathisia).not.toBeNull();

    const context = getDifferentialDetailContext(delirium!, {
      records: [
        {
          ...akathisia!,
          clinicalHinge: "",
          safetySnapshot: { ...akathisia!.safetySnapshot, summary: "" },
        },
      ],
      presentations: [],
    });

    expect(context.knownRelatedSlugs).toContain("akathisia");
    expect(context.relatedMapDetails.akathisia).toBeUndefined();
  });

  it("produces catalog-consistent context for every record", () => {
    const catalogSlugs = new Set(differentialRecords.map((record) => record.slug));
    for (const record of differentialRecords) {
      const context = getDifferentialDetailContext(record);
      expect(context.comparePresentation, `${record.slug} should belong to a presentation`).not.toBeNull();
      for (const slug of context.knownRelatedSlugs) {
        expect(catalogSlugs.has(slug), `related slug ${slug} on ${record.slug}`).toBe(true);
        expect(context.relatedMapDetails[slug]?.slug, `map detail ${slug} on ${record.slug}`).toBe(slug);
      }
      for (const slug of Object.values(context.termLinks)) {
        expect(getDifferentialRecord(slug), `term link ${slug} from ${record.slug}`).not.toBeNull();
        expect(slug, `term link must not self-link ${record.slug}`).not.toBe(record.slug);
      }
      for (const slug of Object.values(context.overlapLinks)) {
        expect(getDifferentialRecord(slug), `overlap link ${slug} from ${record.slug}`).not.toBeNull();
      }
    }
  });

  it("includes alias-backed termLinks for dementia watch-for tags", () => {
    const dementia = getDifferentialRecord("dementia-apathy-neurocognitive-disorder");
    expect(dementia).not.toBeNull();
    const context = getDifferentialDetailContext(dementia!);
    expect(context.termLinks["Superimposed delirium"]).toBe("delirium");
  });
});

describe("Safety Snapshot compact layout", () => {
  it("keeps the full fact label available to assistive tech when the compact label is shown", () => {
    const source = readFileSync(
      new URL("../src/components/differentials/differential-detail-page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("aria-label={fact.label}");
    expect(source).toMatch(/sm:hidden[^>]*>\s*\{[\s\S]*compactLabel/);
  });

  it("keeps four metrics on one row and omits the old review action", () => {
    const source = readFileSync(
      new URL("../src/components/differentials/differential-detail-page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('if (count >= 4) return "grid-cols-4"');
    expect(source).not.toContain("Review must-not-miss causes");
    expect(source).not.toContain('data-testid="differential-safety-cta"');
  });
});

describe("Authored content overlay", () => {
  it("never points a discriminator at a diagnosis the record does not list", () => {
    // The overlay is keyed by slug and edited by hand, so the one way it rots
    // is a related id changing in the export underneath it. A row that names a
    // diagnosis the map does not draw would render as an orphan.
    const offenders: string[] = [];
    for (const [slug, entry] of Object.entries(curatedDifferentials)) {
      const record = getDifferentialRecord(slug);
      if (!record) {
        offenders.push(`${slug}: no such record in the catalogue`);
        continue;
      }
      const related = new Set(record.related.map((node) => node.id));
      for (const discriminator of entry.discriminators ?? []) {
        if (!related.has(discriminator.relatedSlug)) {
          offenders.push(`${slug}: "${discriminator.relatedSlug}" is not one of its related diagnoses`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps authored first moves free of dosing, which governance reserves for validated tooling", () => {
    // docs/clinical-governance.md, "Clinical Use Rules": no dose calculators or
    // automated treatment recommendations without dedicated clinical
    // validation. Authored steps name the action and the escalation point.
    const dosePattern = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|microgram|g|mL|units?)\b/i;
    const offenders = Object.entries(curatedDifferentials).flatMap(([slug, entry]) =>
      (entry.doNow ?? []).filter((step) => dosePattern.test(step)).map((step) => `${slug}: ${step}`),
    );
    expect(offenders).toEqual([]);
  });

  it("replaces the lithium record's non-actionable steps and flags the record itself", () => {
    const record = getDifferentialRecord("lithium-physiological-withdrawal-tremor");
    expect(record).toBeTruthy();
    // The export gives this record four statements about akathisia and
    // parkinsonism in its "immediate action" section; none is an action.
    expect(record!.immediateActions[0]).toMatch(/most commonly missed/);
    const curated = curatedEntryFor(record!.slug);
    expect(doNowStepsAreCurated(curated)).toBe(true);
    expect(resolveDoNowSteps(record!, curated)[0]).toMatch(/Characterise the tremor/);
    expect(curatedContentNote(curated)).toMatch(/mix material from akathisia/);
  });

  it("leaves an uncurated record on its own content", () => {
    const record = differentialRecords.find((entry) => !(entry.slug in curatedDifferentials));
    expect(record).toBeTruthy();
    const curated = curatedEntryFor(record!.slug);
    expect(curated).toBeNull();
    expect(doNowStepsAreCurated(curated)).toBe(false);
    expect(curatedContentNote(curated)).toBeNull();
  });
});

describe("detailTabCounts", () => {
  it("counts the compare queue and the map as the record plus its related diagnoses", () => {
    const record = getDifferentialRecord("delirium")!;
    const counts = detailTabCounts(record);
    expect(counts.compare).toBe(record.related.length + 1);
    expect(counts.map).toBe(record.related.length + 1);
    expect(counts.related).toBe(record.related.length);
  });

  it("shows no number where a number would be about the layout rather than the patient", () => {
    const record = getDifferentialRecord("delirium")!;
    const counts = detailTabCounts(record);
    expect(counts.overview).toBeNull();
    expect(counts.source).toBeNull();
  });

  it("suppresses the related count rather than showing a zero", () => {
    const record: DifferentialRecord = { ...getDifferentialRecord("delirium")!, related: [] };
    expect(detailTabCounts(record).related).toBeNull();
  });
});

describe("buildDiscriminators", () => {
  it("prefers an authored pair and marks it as authored", () => {
    const record = getDifferentialRecord("lithium-physiological-withdrawal-tremor")!;
    const rows = buildDiscriminators(record, getDifferentialDetailContext(record));
    const akathisia = rows.find((row) => row.slug === "akathisia");
    expect(akathisia?.curated).toBe(true);
    expect(akathisia?.favoursRelated).toMatch(/inner restlessness/i);
    expect(akathisia?.favoursFocus).toMatch(/postural tremor/i);
  });

  it("derives a row from the catalogue when nothing is authored, and links only verified slugs", () => {
    const record = getDifferentialRecord("delirium")!;
    const context = getDifferentialDetailContext(record);
    const rows = buildDiscriminators(record, context);
    expect(rows).toHaveLength(record.related.length);
    for (const row of rows) {
      expect(row.href === null || row.href === `/differentials/diagnoses/${row.slug}`).toBe(true);
      if (row.href) expect(context.knownRelatedSlugs).toContain(row.slug);
    }
  });

  it("leaves the second column empty rather than echoing the first", () => {
    const record: DifferentialRecord = {
      ...getDifferentialRecord("delirium")!,
      slug: "uncurated-echo-record",
      clinicalHinge: "Identical hinge.",
      related: [{ id: "mystery", label: "Mystery", likelihood: "possible", note: "Identical hinge." }],
    };
    const [row] = buildDiscriminators(record, { knownRelatedSlugs: [], relatedMapDetails: {} });
    expect(row.favoursRelated).toBe("Identical hinge");
    expect(row.favoursFocus).toBeNull();
  });
});
