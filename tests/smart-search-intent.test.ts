import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import { interpretSmartSearch, isSmartNaturalSearchMode, smartNaturalSearchModeIds } from "@/lib/smart-search-intent";

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
  });

  it("keeps compact catalogue codes literal after terminal punctuation", () => {
    expect(interpretSmartSearch("forms", "form 4A?")).toMatchObject({ naturalLanguage: false, expansions: [] });
    expect(interpretSmartSearch("dsm", "F31.81?")).toMatchObject({ naturalLanguage: false, expansions: [] });
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
