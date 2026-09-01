import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import {
  interpretSmartSearch,
  isSmartLocalOnlyMode,
  isSmartNaturalSearchMode,
  smartLocalOnlyModeIds,
  smartNaturalSearchModeIds,
} from "@/lib/smart-search-intent";

describe("interpretSmartSearch", () => {
  it.each(smartNaturalSearchModeIds)("keeps natural-language questions inside %s search", (mode) => {
    const interpretation = interpretSmartSearch(mode, "Which catalogue result fits this presentation?");
    expect(interpretation.naturalLanguage).toBe(true);
    expect(interpretation.originalQuery).toBe("Which catalogue result fits this presentation?");
  });

  it("adds only mode-scoped catalogue vocabulary", () => {
    expect(interpretSmartSearch("services", "services for young people after discharge").expansions).toEqual(
      expect.arrayContaining(["youth", "adolescent", "community", "post-discharge"]),
    );
    expect(interpretSmartSearch("forms", "which form extends detention?").expansions).toEqual(
      expect.arrayContaining(["extension", "detention"]),
    );
    expect(interpretSmartSearch("differentials", "causes of hearing voices").expansions).toEqual(
      expect.arrayContaining(["hallucinations", "psychosis"]),
    );
    expect(interpretSmartSearch("formulation", "why do I keep going over it?").expansions).toContain("rumination");
    expect(interpretSmartSearch("dsm", "diagnoses involving elevated mood").expansions).toEqual(
      expect.arrayContaining(["mania", "hypomania", "bipolar"]),
    );
    expect(interpretSmartSearch("specifiers", "specifier for anxiety symptoms").expansions).toContain(
      "anxious distress",
    );
    expect(interpretSmartSearch("therapy-compass", "therapy for emotion regulation").expansions).toEqual(
      expect.arrayContaining(["dbt", "dialectical behaviour therapy"]),
    );
    expect(interpretSmartSearch("prescribing", "medicine that needs regular blood tests").expansions).toEqual(
      expect.arrayContaining(["monitoring", "blood tests"]),
    );
    expect(interpretSmartSearch("tools", "where can I check medication interactions?").expansions).toEqual(
      expect.arrayContaining(["prescribing", "interactions"]),
    );
    expect(interpretSmartSearch("calculators", "screen depression severity").expansions).toContain("phq-9");
    expect(interpretSmartSearch("factsheets", "information for someone who worries all the time").expansions).toContain(
      "generalised anxiety disorder",
    );
    expect(interpretSmartSearch("dictionary", "term for hearing a voice that is not there").expansions).toContain(
      "hallucination",
    );
  });

  it("advertises the supported and local-only Smart capability sets", () => {
    expect(smartNaturalSearchModeIds).toEqual([
      "services",
      "forms",
      "differentials",
      "formulation",
      "dsm",
      "specifiers",
      "therapy-compass",
      "prescribing",
      "tools",
      "calculators",
      "factsheets",
      "dictionary",
    ]);
    expect(smartLocalOnlyModeIds).toEqual(["prescribing", "tools", "calculators", "factsheets", "dictionary"]);
    expect(smartLocalOnlyModeIds.every(isSmartLocalOnlyMode)).toBe(true);
  });

  it.each([
    ["forms", "form 4A?"],
    ["dsm", "F31.81?"],
    ["calculators", "PHQ-9?"],
    ["calculators", "GAD-7?"],
    ["calculators", "K10?"],
    ["prescribing", "sertraline"],
    ["tools", "Calculators"],
    ["dictionary", "MSE"],
  ] as const)("keeps exact catalogue identifiers literal: %s %s", (mode, query) => {
    expect(interpretSmartSearch(mode, query)).toMatchObject({ naturalLanguage: false, expansions: [] });
  });

  it.each(["documents", "answer", "favourites"] as const)(
    "does not support Smart expansions in %s",
    (mode) => {
      expect(isSmartNaturalSearchMode(mode)).toBe(false);
      expect(interpretSmartSearch(mode, "Which option fits this presentation?")).toMatchObject({
        naturalLanguage: false,
        expansions: [],
      });
    },
  );

  it("does not leak a mode-scoped rule into another mode", () => {
    const query = "where can I check medication interactions?";
    expect(interpretSmartSearch("tools", query).expansions).toEqual(
      expect.arrayContaining(["prescribing", "interactions"]),
    );
    expect(interpretSmartSearch("prescribing", query).expansions).toEqual([]);
  });

  it.each(appModeIds.filter((mode) => !smartNaturalSearchModeIds.includes(mode as never)))(
    "does not advertise interpretation in unsupported mode %s",
    (mode) => {
      expect(isSmartNaturalSearchMode(mode)).toBe(false);
      expect(interpretSmartSearch(mode, "Which option fits this presentation?")).toMatchObject({
        naturalLanguage: false,
        expansions: [],
      });
    },
  );
});
