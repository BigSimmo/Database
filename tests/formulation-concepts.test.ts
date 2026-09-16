import { describe, expect, it } from "vitest";

import formulationContent from "@/data/formulation-content.json";
import { formulationMechanisms, formulationSourceLibrary } from "@/lib/formulation";
import {
  findFormulationConcept,
  formulationConceptGroups,
  formulationConcepts,
  formulationGuides,
  heldFormulationConcepts,
  publishedFormulationConcepts,
  searchFormulationConcepts,
} from "@/lib/formulation-concepts";

/**
 * The Formulation content handover of 2026-09-16 added 46 contextual concepts
 * and six guide modules beside the 12 existing mechanisms. These regressions
 * pin the parts that are easy to lose in a bulk content import: the native
 * mechanism identities, the review state that keeps unsigned material out of
 * clinical use, and the rule that a citation must resolve to a real source.
 */
describe("formulation concept library", () => {
  it("keeps the 12 native mechanism identities and never duplicates them as concepts", () => {
    const mechanismIds = formulationMechanisms.map((mechanism) => mechanism.id);
    expect(mechanismIds).toEqual([
      "avoidance",
      "splitting",
      "shame",
      "emotional-dysregulation",
      "reassurance-seeking",
      "attachment-avoidance",
      "negative-core-beliefs",
      "projection",
      "rumination",
      "worry",
      "dissociation",
      "perfectionism",
    ]);

    for (const concept of formulationConcepts) {
      expect(mechanismIds).not.toContain(concept.id);
    }
    const conceptIds = formulationConcepts.map((concept) => concept.id);
    expect(new Set(conceptIds).size).toBe(conceptIds.length);
  });

  it("carries the whole supplied concept and guide payload", () => {
    expect(formulationConcepts).toHaveLength(46);
    expect(formulationGuides).toHaveLength(6);
    for (const concept of formulationConcepts) {
      expect(concept.title).toBeTruthy();
      expect(concept.summary).toBeTruthy();
      expect(concept.packageContentId).toMatch(/^psychsift\.formulation\.content\./);
      expect(concept.review.status).toBeTruthy();
    }
  });

  it("resolves every citation to a real source and never invents a link", () => {
    const all = [...formulationConcepts, ...formulationGuides];
    for (const record of all) {
      for (const evidence of record.evidence) {
        expect(evidence.label).toMatch(/^S\d{2}$/);
        expect(evidence.title).toBeTruthy();
        if (evidence.nativeSourceId) {
          expect(formulationSourceLibrary[evidence.nativeSourceId]).toBeTruthy();
        }
        if (evidence.url) {
          expect(evidence.urlStatus).toBe("governed");
          expect(evidence.url).toMatch(/^https:\/\//);
        } else {
          expect(evidence.urlStatus).not.toBe("governed");
        }
      }
    }
  });

  it("strips chat-only source labels out of every display string", () => {
    const displayed = [...formulationConcepts, ...formulationGuides].flatMap((record) => [
      record.title,
      record.summary,
      record.qualification ?? "",
      record.whenApplies ?? "",
      record.whenDoesNotApply ?? "",
    ]);
    for (const value of displayed) {
      expect(value).not.toMatch(/\bS\d{2}\b/);
      expect(value).not.toMatch(/\[S\d{2}\]\(/);
    }
  });

  it("holds Aboriginal and Torres Strait Islander content until First Nations governance signs it off", () => {
    const sewb = findFormulationConcept("first-nations-sewb");
    expect(sewb).toBeTruthy();
    expect(sewb?.release).toBe("held");
    expect(sewb?.releaseNote).toMatch(/First Nations|Aboriginal/i);
    expect(publishedFormulationConcepts.map((concept) => concept.id)).not.toContain("first-nations-sewb");
    expect(heldFormulationConcepts.map((concept) => concept.id)).toContain("first-nations-sewb");
  });

  it("never returns a held record from search", () => {
    for (const concept of heldFormulationConcepts) {
      const hits = searchFormulationConcepts(concept.title);
      expect(hits.map((hit) => hit.concept.id)).not.toContain(concept.id);
    }
  });

  it("matches contextual factors the mechanism catalogue cannot answer", () => {
    expect(searchFormulationConcepts("housing")[0]?.concept.id).toBe("housing-financial");
    expect(searchFormulationConcepts("delirium")[0]?.concept.id).toBe("cognitive-impairment");
    expect(searchFormulationConcepts("loneliness")[0]?.concept.id).toBe("social-isolation");
  });

  it("fills the biological, social and cultural domains the mechanism set leaves empty", () => {
    const declared = new Set(formulationContent.domains);
    for (const domain of ["Biological", "Social", "Cultural"]) {
      expect(declared.has(domain)).toBe(true);
      expect(formulationMechanisms.some((mechanism) => mechanism.domains.includes(domain))).toBe(false);
      expect(publishedFormulationConcepts.some((concept) => concept.domains.includes(domain))).toBe(true);
    }
    for (const concept of formulationConcepts) {
      for (const domain of concept.domains) expect(declared.has(domain)).toBe(true);
    }
  });

  it("groups every published concept under a named browse group", () => {
    const groupIds = new Set(formulationConceptGroups.map((group) => group.id));
    for (const concept of publishedFormulationConcepts) {
      expect(groupIds.has(concept.group)).toBe(true);
    }
    for (const group of formulationConceptGroups) {
      expect(publishedFormulationConcepts.some((concept) => concept.group === group.id)).toBe(true);
    }
  });

  it("keeps guide bodies as structured blocks rather than raw markdown", () => {
    for (const guide of formulationGuides) {
      expect(guide.blocks.length).toBeGreaterThan(0);
      for (const block of guide.blocks) {
        if (block.kind === "heading") {
          expect(block.text).not.toMatch(/^#|\*\*/);
          continue;
        }
        const spans = block.kind === "paragraph" ? block.spans : block.items.flat();
        for (const span of spans) {
          expect(span.text).not.toMatch(/\*\*|\[S\d{2}\]\(/);
        }
      }
    }
  });

  it("never marks unreviewed content as clinically approved", () => {
    for (const record of [...formulationConcepts, ...formulationGuides]) {
      expect(record.review.reviewer).toBeNull();
      expect(record.review.status).toBe("clinical_review_required");
    }
  });
});
