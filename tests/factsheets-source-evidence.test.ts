import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FACTSHEET_EVIDENCE_CHECKED_ON,
  factsheetEvidence,
  factsheetHolds,
  factsheets,
  findFactsheetEvidence,
  printBlocks,
  type FactsheetSourceEvidenceType,
} from "@/components/factsheets/factsheets-data";
import { repositorySourceProviders } from "@/lib/sources/repository-providers";
import type { ClinicalSourceType } from "@/lib/sources/catalogue-types";
import { GOVERNED_SOURCE_HOSTS } from "@/lib/sources/source-url-policy";
import { strictSourceDate } from "@/lib/sources/source-date-policy";

const factsheetReferences = () => {
  const provider = repositorySourceProviders.find((entry) => entry.id === "factsheets");
  expect(provider, "the factsheets source provider must exist").toBeDefined();
  return provider!.references();
};

describe("factsheet source citations", () => {
  it("only links hosts the URL policy already governs", () => {
    // The host list is ranking-adjacent policy. A citation whose host is not on
    // it renders as a plain citation instead — widening the list to make a link
    // openable is a policy change, not a content change.
    const governed = new Set<string>(GOVERNED_SOURCE_HOSTS);
    for (const sheet of factsheets) {
      for (const source of sheet.sources) {
        if (!source.url) continue;
        const host = new URL(source.url).hostname;
        expect(governed.has(host), `${sheet.slug} cites ungoverned host ${host}`).toBe(true);
      }
    }
  });

  it("classifies every citation instead of leaving it in the catalogue's unknown band", () => {
    // Before `evidenceType` existed, any tag outside Consumer/Reference fell
    // through to `unknown`, filing a real source as unclassified purely because
    // the display badge vocabulary is two words long.
    for (const reference of factsheetReferences()) {
      expect(reference.evidenceType, `${reference.title} must declare an evidence type`).not.toBe("unknown");
    }
  });

  it("declares only evidence types the catalogue recognises", () => {
    const allowed: FactsheetSourceEvidenceType[] = [
      "consumer_reference",
      "professional_reference",
      "guideline",
      "regulatory",
      "standard",
    ];
    // Assignability to ClinicalSourceType is the point of the assertion: if the
    // catalogue's union ever drops one of these, this stops compiling.
    const asCatalogueTypes: ClinicalSourceType[] = allowed;
    expect(asCatalogueTypes).toHaveLength(allowed.length);

    for (const sheet of factsheets) {
      for (const source of sheet.sources) {
        if (!source.evidenceType) continue;
        expect(allowed).toContain(source.evidenceType);
      }
    }
  });

  it("never sends an approximate publication date to the catalogue", () => {
    // `year` is a display string ("2025", "Jun 2026"). Only an exact
    // publisher-stated day may reach the catalogue; everything else is null
    // rather than a fabricated 1 January.
    for (const sheet of factsheets) {
      for (const source of sheet.sources) {
        if (!source.publicationDate) continue;
        expect(strictSourceDate(source.publicationDate), `${sheet.slug}: ${source.title}`).toBeTruthy();
      }
    }
    for (const reference of factsheetReferences()) {
      if (reference.publicationDate === null) continue;
      expect(strictSourceDate(reference.publicationDate)).toBeTruthy();
    }
  });

  it("passes an exact date through rather than dropping it", () => {
    // The provider used to hard-code `publicationDate: null`, discarding dates
    // the publisher does state. This proves the passthrough is real.
    const provider = repositorySourceProviders.find((entry) => entry.id === "factsheets")!;
    const withDate = factsheets.flatMap((sheet) => sheet.sources).filter((source) => source.publicationDate);
    if (withDate.length === 0) {
      // No citation carries an exact date yet; assert the mechanism instead of
      // silently passing, so this test cannot rot into a no-op.
      expect(provider.references().every((reference) => reference.publicationDate === null)).toBe(true);
      return;
    }
    const dates = new Set(provider.references().map((reference) => reference.publicationDate));
    for (const source of withDate) expect(dates.has(source.publicationDate!)).toBe(true);
  });
});

describe("factsheet evidence provenance", () => {
  it("covers every sheet and nothing else", () => {
    const slugs = factsheets.map((sheet) => sheet.slug).sort();
    expect(Object.keys(factsheetEvidence).sort()).toEqual(slugs);
    for (const slug of slugs) expect(findFactsheetEvidence(slug)).toBeDefined();
    expect(findFactsheetEvidence("not-a-factsheet")).toBeUndefined();
  });

  it("never claims clinical approval or publication permission", () => {
    // Nothing in this repository can sign off clinical content on a
    // clinician's behalf, so these fields have exactly one honest value.
    for (const [slug, evidence] of Object.entries(factsheetEvidence)) {
      expect(evidence.status, slug).toBe("draft");
      expect(evidence.clinicalReviewer, slug).toBeNull();
      expect(evidence.approvedOn, slug).toBeNull();
      expect(evidence.nextReviewDue, slug).toBeNull();
      expect(evidence.publicationAllowed, slug).toBe(false);
    }
  });

  it("records the evidence check as an exact date distinct from the content month", () => {
    expect(strictSourceDate(FACTSHEET_EVIDENCE_CHECKED_ON)).toBeTruthy();
    for (const sheet of factsheets) {
      // `reviewedOn` is a content month; the evidence check is a day. Keeping
      // them different shapes stops one being read as the other.
      expect(sheet.reviewedOn).not.toBe(FACTSHEET_EVIDENCE_CHECKED_ON);
    }
  });

  it("gives every hold a concrete resolution and an accountable role", () => {
    const holds = factsheetHolds();
    expect(holds.length).toBeGreaterThan(0);
    for (const hold of holds) {
      expect(hold.claimId).toMatch(/^ps-clm-factsheets-/);
      expect(hold.statement.length).toBeGreaterThan(20);
      expect(hold.resolution.length).toBeGreaterThan(20);
      expect(hold.accountableRole).toBeTruthy();
      // "review it again" is not a resolution.
      expect(hold.resolution).not.toMatch(/^review\b/i);
    }
  });

  it("keeps held statements out of every reader-facing projection", () => {
    // A hold explains why something is absent. If its text were rendered, the
    // hold would have published the very claim it withholds.
    for (const sheet of factsheets) {
      const evidence = findFactsheetEvidence(sheet.slug);
      if (!evidence || evidence.holds.length === 0) continue;
      const rendered = JSON.stringify([printBlocks(sheet), printBlocks(sheet, "easy"), sheet]);
      for (const hold of evidence.holds) {
        expect(rendered, `${sheet.slug} renders its own hold text`).not.toContain(hold.statement);
        expect(rendered, `${sheet.slug} renders a hold resolution`).not.toContain(hold.resolution);
      }
    }
  });
});
