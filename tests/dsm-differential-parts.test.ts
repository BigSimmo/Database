import { describe, expect, it } from "vitest";

import { dsmDiagnoses, dsmDifferentialParts, resolveDsmDifferential } from "@/lib/dsm";

/*
 * The discriminator shown under each differential is pasted-adjacent clinical
 * text: a reader separating two candidate diagnoses acts on it. Wrong text here
 * is worse than no text, so these cases pin the split against the real corpus
 * rather than against invented strings.
 */

describe("dsmDifferentialParts", () => {
  it("splits the authored reason out of a trailing parenthetical", () => {
    expect(dsmDifferentialParts("Social anxiety disorder (expected attacks in social situations)")).toEqual({
      name: "Social anxiety disorder",
      discriminator: "expected attacks in social situations",
    });
    expect(dsmDifferentialParts("Bipolar I disorder (full manic episode present - reclassify)")).toEqual({
      name: "Bipolar I disorder",
      discriminator: "full manic episode present - reclassify",
    });
  });

  it("leaves a bare differential whole", () => {
    expect(dsmDifferentialParts("Adjustment disorder")).toEqual({
      name: "Adjustment disorder",
      discriminator: "",
    });
  });

  it("treats an abbreviation as part of the name, not a discriminator", () => {
    // "Premenstrual dysphoric disorder (PMDD)" is a name. Splitting it would
    // render "PMDD" as though it were the reason the differential is raised, and
    // would also break the abbreviation lookup in resolveDsmDifferential.
    expect(dsmDifferentialParts("Premenstrual dysphoric disorder (PMDD)")).toEqual({
      name: "Premenstrual dysphoric disorder (PMDD)",
      discriminator: "",
    });
    expect(dsmDifferentialParts("Attention-deficit/hyperactivity disorder (ADHD)").discriminator).toBe("");
  });

  it("never invents, reorders, or drops words from the source string", () => {
    // Every differential in the corpus must be reconstructible from its parts,
    // which is what rules out a split that quietly rewrites clinical text.
    for (const diagnosis of dsmDiagnoses) {
      for (const differential of diagnosis.differentials) {
        const { name, discriminator } = dsmDifferentialParts(differential);
        const rebuilt = discriminator ? `${name} (${discriminator})` : name;
        expect(rebuilt, `${diagnosis.title} -> ${differential}`).toBe(differential.trim());
      }
    }
  });

  it("keeps the name resolvable to a diagnosis wherever the whole string was", () => {
    // The sidebar links the NAME after this change. If splitting cost a link the
    // whole string used to earn, the change would have removed navigation.
    for (const diagnosis of dsmDiagnoses) {
      for (const differential of diagnosis.differentials) {
        if (!resolveDsmDifferential(differential)) continue;
        expect(
          resolveDsmDifferential(dsmDifferentialParts(differential).name),
          `${diagnosis.title} -> ${differential} resolved whole but not by name`,
        ).toBeDefined();
      }
    }
  });

  it("covers a majority of the corpus, so the sidebar is not mostly empty subtitles", () => {
    const rows = dsmDiagnoses.flatMap((diagnosis) => diagnosis.differentials.slice(0, 6));
    const withDiscriminator = rows.filter((row) => dsmDifferentialParts(row).discriminator).length;
    // Measured 534/688 = 77.6% on 2026-09-07. A floor, not a target: a drop
    // below this means the corpus changed shape and the feature stopped paying.
    expect(withDiscriminator / rows.length).toBeGreaterThan(0.7);
  });
});
