import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import {
  interpretSmartSearch,
  isSmartLocalOnlyMode,
  isSmartNaturalSearchMode,
  smartLocalOnlyModeIds,
  smartNaturalSearchModeIds,
  smartSearchContentTerms,
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

  it.each(["documents", "answer", "favourites"] as const)("does not support Smart expansions in %s", (mode) => {
    expect(isSmartNaturalSearchMode(mode)).toBe(false);
    expect(interpretSmartSearch(mode, "Which option fits this presentation?")).toMatchObject({
      naturalLanguage: false,
      expansions: [],
    });
  });

  // Regression: the movement, avoidance, and couples rules each matched ordinary
  // phrasing while missing the clinical phrasing they exist for.
  it.each([
    ["forms", "moving forward with the assessment", "movement"],
    ["forms", "a moving account of the incident", "transfer"],
    ["formulation", "how do I avoid a relapse", "avoidance"],
    ["therapy-compass", "a couple of options for anxiety", "couples"],
    ["therapy-compass", "another couple of sessions", "couples"],
  ] as const)("does not expand incidental wording in %s: %s", (mode, query, term) => {
    expect(interpretSmartSearch(mode, query).expansions).not.toContain(term);
  });

  it.each([
    ["forms", "which form moves a patient to another hospital", "transfer"],
    ["forms", "form for moving a consumer between wards", "transport"],
    ["forms", "transporting an involuntary patient", "movement"],
    ["formulation", "patient avoids social situations", "avoidance"],
    ["formulation", "avoiding work since the assault", "avoidance"],
    ["formulation", "he stays away from crowds", "avoidance"],
    ["therapy-compass", "couples therapy after an affair", "couples"],
    ["therapy-compass", "therapy for relationship difficulties", "relationship"],
  ] as const)("expands the clinical wording in %s: %s", (mode, query, term) => {
    expect(interpretSmartSearch(mode, query).expansions).toContain(term);
  });

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

/**
 * The two-to-three word dead zone.
 *
 * `smartSearchContentTerms` used to return ONLY the curated expansions whenever the query was not
 * classified as natural language, and `naturalLanguage` needs a curated rule, a question mark, a
 * conversational opener, or four tokens. So a plain two- or three-word query that matched no rule
 * produced no terms at all, and every consumer scoring against those terms scored zero.
 *
 * One token still worked, because a single word is a substring of the haystack. Four tokens
 * worked, because they cleared the natural-language bar. Two and three fell in the hole -- which
 * is most of how people actually search.
 *
 * Reported by the 2026-09-17 external audit as a calculators problem ("anxiety screening" finds
 * nothing while "anxiety" finds GAD-7). It was never mode-specific: every mode using this helper
 * had the same hole.
 *
 * Measured before and after on the real calculator catalogue: "anxiety screening" went 0 hits to
 * 2 including GAD-7, "depression screening" 0 to 2, and "GAD-7" stayed at exactly 1.
 */
describe("short plain queries contribute their own subject words", () => {
  it.each([
    ["services", "youth counselling"],
    ["calculators", "anxiety screening"],
    ["tools", "interaction checker"],
  ] as const)("returns subject terms for a two-word %s query", (mode, query) => {
    const terms = smartSearchContentTerms(mode, query);
    expect(terms.length).toBeGreaterThan(0);
    for (const word of query.split(" ")) expect(terms).toContain(word);
  });

  it("still returns nothing extra for a code, which must be matched as written", () => {
    // The guard on the fix. Tokenising an identifier into subject words adds noise the identity
    // matchers already handle better, so `literalIdentifier` keeps these on the old path.
    for (const code of ["GAD-7", "PHQ-9", "F32.1"]) {
      expect(interpretSmartSearch("calculators", code).literalIdentifier).toBe(true);
      expect(smartSearchContentTerms("calculators", code)).toEqual([]);
    }
  });

  it("does not reclassify a short query as a natural-language question", () => {
    // Only the terms changed. `naturalLanguage` still means "read this as a question", and
    // everything keyed off it -- including the curated-term recomputation -- is untouched.
    expect(interpretSmartSearch("calculators", "anxiety screening")).toMatchObject({
      naturalLanguage: false,
      literalIdentifier: false,
    });
  });

  it("keeps curated expansions ahead of the query's own words", () => {
    // The ordering contract the helper's own comment states: a governed phrase outranks an
    // incidental word from the question. Unchanged by the fix.
    const terms = smartSearchContentTerms("services", "young person");
    expect(terms.indexOf("youth")).toBeLessThan(terms.indexOf("person"));
  });

  it("still drops stop words and the mode's own noun", () => {
    // `modeSearchWords` is keyed per mode and only `calculators`, `factsheets` and `dictionary`
    // have an entry, so this is asserted where the mechanism actually applies. Noted while
    // writing it: `services` has no such list, so "service" survives as a subject term there and
    // matches most of the catalogue. Left alone -- filling that list is a relevance decision
    // about the services mode, not part of this fix.
    const terms = smartSearchContentTerms("calculators", "a screening tool for anxiety");
    expect(terms).toContain("anxiety");
    expect(terms).not.toContain("a");
    expect(terms).not.toContain("for");
    expect(terms).not.toContain("tool");
  });
});
