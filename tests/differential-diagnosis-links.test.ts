import { describe, expect, it } from "vitest";

import {
  DIFFERENTIAL_DIAGNOSIS_TERM_ALIASES,
  buildDiagnosisTitleSlugMap,
  buildTermLinkMap,
  differentialDiagnosisHref,
  isClinicalHingeLabel,
  resolveDiagnosisTerm,
  resolveDiagnosisTermSegments,
} from "@/lib/differential-diagnosis-links";
import { cleanDifferentialItem } from "@/lib/differential-detail";
import {
  differentialRecords,
  getDifferentialDetailContext,
  getDifferentialRecord,
  getPresentationWorkflow,
} from "@/lib/differentials";

describe("differentialDiagnosisHref", () => {
  it("builds the diagnosis info route", () => {
    expect(differentialDiagnosisHref("delirium")).toBe("/differentials/diagnoses/delirium");
  });
});

describe("DIFFERENTIAL_DIAGNOSIS_TERM_ALIASES", () => {
  const catalogSlugs = new Set(differentialRecords.map((record) => record.slug));
  const titleKeys = new Set(
    differentialRecords.map((record) => cleanDifferentialItem(record.title).toLowerCase()).filter(Boolean),
  );

  it("maps every alias to an existing catalog slug", () => {
    for (const [alias, slug] of Object.entries(DIFFERENTIAL_DIAGNOSIS_TERM_ALIASES)) {
      expect(alias.trim().length, `empty alias key`).toBeGreaterThan(0);
      expect(slug.trim().length, `empty slug for ${alias}`).toBeGreaterThan(0);
      expect(catalogSlugs.has(slug), `alias "${alias}" → missing slug "${slug}"`).toBe(true);
    }
  });

  it("does not duplicate exact catalog titles", () => {
    for (const alias of Object.keys(DIFFERENTIAL_DIAGNOSIS_TERM_ALIASES)) {
      expect(titleKeys.has(alias), `alias "${alias}" duplicates an exact catalog title`).toBe(false);
    }
  });
});

describe("resolveDiagnosisTerm", () => {
  it("resolves exact cleaned titles", () => {
    const resolved = resolveDiagnosisTerm("Delirium");
    expect(resolved?.slug).toBe("delirium");
    expect(resolved?.matchedBy).toBe("title");
    expect(resolved?.href).toBe("/differentials/diagnoses/delirium");
  });

  it("resolves curated aliases such as superimposed delirium", () => {
    const resolved = resolveDiagnosisTerm("Superimposed delirium");
    expect(resolved?.slug).toBe("delirium");
    expect(resolved?.matchedBy).toBe("alias");
  });

  it("leaves non-diagnosis risks unlinked", () => {
    expect(resolveDiagnosisTerm("aspiration")).toBeNull();
    expect(resolveDiagnosisTerm("falls")).toBeNull();
    expect(resolveDiagnosisTerm("abuse/neglect")).toBeNull();
  });

  it("never self-links when excludeSlug matches", () => {
    expect(resolveDiagnosisTerm("Delirium", { excludeSlug: "delirium" })).toBeNull();
  });

  it("rejects clinical hinge noise", () => {
    expect(isClinicalHingeLabel("CLINICAL HINGE: Inattention is the key")).toBe(true);
    expect(resolveDiagnosisTerm("CLINICAL HINGE: Inattention is the key")).toBeNull();
  });
});

describe("resolveDiagnosisTermSegments", () => {
  it("splits spaced-slash presentation tags into linked segments", () => {
    const segments = resolveDiagnosisTermSegments("Delirium / medical psychosis");
    expect(segments.map((segment) => segment.text)).toEqual(["Delirium", "medical psychosis"]);
    expect(segments[0]?.slug).toBe("delirium");
    expect(segments[1]?.slug).toBe("acute-psychosis");
  });

  it("splits comma and semicolon lists without rewriting unspaced slash phrases", () => {
    const semicolon = resolveDiagnosisTermSegments("Primary psychosis; dementia");
    expect(semicolon.map((segment) => segment.text)).toEqual(["Primary psychosis", "dementia"]);
    expect(semicolon[0]?.slug).toBe("schizophrenia");
    expect(semicolon[1]?.slug).toBe("dementia-neurocognitive-disorder");

    const compound = resolveDiagnosisTermSegments("Alcohol/benzo withdrawal seizures, aspiration");
    expect(compound.map((segment) => segment.text)).toEqual(["Alcohol/benzo withdrawal seizures", "aspiration"]);
    expect(compound[0]?.slug).toBeNull();
    expect(compound[1]?.slug).toBeNull();
  });

  it("preserves unspaced clinical slash compounds as a single segment", () => {
    expect(resolveDiagnosisTermSegments("alcohol/benzo withdrawal").map((s) => s.text)).toEqual([
      "alcohol/benzo withdrawal",
    ]);
    expect(resolveDiagnosisTermSegments("DVT/PE").map((s) => s.text)).toEqual(["DVT/PE"]);
    expect(resolveDiagnosisTermSegments("food/fluid refusal").map((s) => s.text)).toEqual(["food/fluid refusal"]);
  });

  it("keeps unresolved whole labels as a single unlinked segment", () => {
    const segments = resolveDiagnosisTermSegments("aspiration");
    expect(segments).toEqual([{ text: "aspiration", slug: null, href: null, matchedBy: null }]);
  });
});

describe("buildTermLinkMap + dementia detail context", () => {
  it("links dementia watch-for superimposed delirium and leaves risks unlinked", () => {
    const dementia = getDifferentialRecord("dementia-apathy-neurocognitive-disorder");
    expect(dementia).not.toBeNull();
    const context = getDifferentialDetailContext(dementia!);
    expect(context.termLinks["Superimposed delirium"]).toBe("delirium");
    expect(context.termLinks.aspiration).toBeUndefined();
    expect(context.termLinks.falls).toBeUndefined();

    const tagMap = buildTermLinkMap(dementia!.safetySnapshot.tags, { excludeSlug: dementia!.slug });
    expect(tagMap["Superimposed delirium"]).toBe("delirium");
  });

  it("keeps overlapLinks as a subset of termLinks", () => {
    for (const record of differentialRecords.slice(0, 40)) {
      const context = getDifferentialDetailContext(record);
      for (const [label, slug] of Object.entries(context.overlapLinks)) {
        expect(context.termLinks[label]).toBe(slug);
      }
    }
  });
});

describe("presentation safety tags", () => {
  it("links acute-confusion safety tags for known diagnoses", () => {
    const workflow = getPresentationWorkflow("acute-confusion-encephalopathy");
    expect(workflow).not.toBeNull();
    const linked = workflow!.safetySnapshot.tags
      .flatMap((tag) => resolveDiagnosisTermSegments(tag))
      .filter((segment) => segment.slug);
    const slugs = new Set(linked.map((segment) => segment.slug));
    expect(slugs.has("delirium")).toBe(true);
    expect(slugs.has("substance-intoxication")).toBe(true);
    expect(slugs.has("substance-withdrawal")).toBe(true);
  });
});

describe("buildDiagnosisTitleSlugMap", () => {
  it("uses first-wins for duplicate titles", () => {
    const map = buildDiagnosisTitleSlugMap(differentialRecords);
    expect(map.get("delirium")).toBe("delirium");
    expect(map.size).toBeGreaterThan(50);
  });
});
