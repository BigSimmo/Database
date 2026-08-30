// tests/ward-catchment.test.ts
//
// The properties that matter for the catchment lookup. Every one of these was mutation-proved:
// the assertion was watched to fail against a deliberate change to the module, and the change
// reversed. A test that cannot fail is not evidence.
import { describe, expect, it } from "vitest";

import {
  CATCHMENT_DOCUMENTS,
  CONTESTED_SUBURBS,
  INTERNALLY_INCONSISTENT_SUBURBS,
  S2015_CATCHMENT_ROWS,
  S2015_STATED_DISTINCT_POSTCODE_COUNT,
  S2015_STATED_DISTINCT_SUBURB_COUNT,
  S2015_STATED_ROW_COUNT,
  SUBURB_ALIASES,
  UNDETERMINED_SUBURB_NAMES,
  catchmentCanRouteAutomatically,
  catchmentRoutingDestinations,
  lookupCatchment,
  normaliseSuburbKey,
  parseFollowUpClinicSet,
  resolveSuburbAlias,
} from "../src/components/ward-management/ward-catchment";

/**
 * Section 4.5 of `docs/ward-flow-catchment-data.md`, Name column, verbatim and in order. The
 * apostrophe in `O'Connor` is the straight one the document's own heading uses.
 */
const SECTION_4_5_NAMES = [
  "Anketell",
  "Paulls Valley",
  "Inglewood",
  "Inglehope",
  "Innaloo",
  "Iluka",
  "Floreat",
  "Mt Richon",
  "Quinns Rocks",
  "Salter Point",
  "Madora Bay",
  "Dudley Park",
  "North Dandalup",
  "Wannanup",
  "Solus / Salus",
  "Alexander Heights",
  "Cockburn Central",
  "O'Connor",
  "Mount Pleasant",
] as const;

describe("ward-catchment — non-vacuity", () => {
  // Without this block every other test in this file could pass over an empty table.
  it("carries the row count the data document states, and is not empty", () => {
    expect(S2015_CATCHMENT_ROWS.length).toBeGreaterThan(0);
    expect(S2015_CATCHMENT_ROWS.length).toBe(537);
    expect(S2015_CATCHMENT_ROWS.length).toBe(S2015_STATED_ROW_COUNT);
  });

  it("carries the distinct suburb and postcode counts the data document states", () => {
    const suburbs = new Set(S2015_CATCHMENT_ROWS.map((row) => normaliseSuburbKey(row.suburb)));
    const postcodes = new Set(S2015_CATCHMENT_ROWS.map((row) => row.postcode));
    expect(suburbs.size).toBe(532);
    expect(suburbs.size).toBe(S2015_STATED_DISTINCT_SUBURB_COUNT);
    expect(postcodes.size).toBe(261);
    expect(postcodes.size).toBe(S2015_STATED_DISTINCT_POSTCODE_COUNT);
  });

  it("every row has a four-digit postcode and a non-empty suburb", () => {
    for (const row of S2015_CATCHMENT_ROWS) {
      expect(row.postcode).toMatch(/^\d{4}$/);
      expect(row.suburb.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * The hospital column is not seeded — spec Part 4 and Part 6. This asserts the shape rather
   * than a value, so a hospital field cannot be reintroduced quietly and left switched off.
   */
  it("carries no admitting-hospital field on any row", () => {
    for (const row of S2015_CATCHMENT_ROWS) {
      expect(Object.keys(row).sort()).toEqual(["followUpClinicVerbatim", "page", "postcode", "suburb"]);
    }
  });
});

describe("ward-catchment — a known suburb", () => {
  it("returns its team with state `reviewed`", () => {
    const found = lookupCatchment("Albany");
    expect(found.state).toBe("reviewed");
    if (found.state !== "reviewed") return;
    expect(found.suburb).toBe("Albany");
    expect(found.matchedVia).toEqual({ kind: "canonical" });
    expect(found.answers).toHaveLength(1);
    expect(found.answers[0].clinics).toEqual(["Lower Great Southern"]);
    expect(found.answers[0].document.id).toBe("S2015");
    expect(found.answers[0].postcodes).toEqual(["6330"]);
    expect(catchmentCanRouteAutomatically(found)).toBe(true);
    expect(catchmentRoutingDestinations(found)).toEqual(["Lower Great Southern"]);
  });

  it("normalises case and surrounding whitespace, and nothing else", () => {
    expect(lookupCatchment("   aLbAnY  ").state).toBe("reviewed");
    // An interior change is not whitespace or case, so it must NOT match.
    expect(lookupCatchment("Alb any").state).toBe("unknown");
    expect(normaliseSuburbKey("  Mount Lawley ")).toBe("mount lawley");
  });
});

describe("ward-catchment — the three internal inconsistencies are `unreviewed`, by name", () => {
  // Section 1's note and spec Part 5. Each is named, not counted.
  it.each([
    ["Belmont", "bentley-vs-mills-street"],
    ["Bentley", "bentley-vs-mills-street"],
    ["East Cannington", "bentley-vs-mills-street"],
    ["Hope Valley", "kwinana-on-two-rows"],
    ["Wongan Hills", "swan-valley-on-two-rows"],
    ["Wundowie", "swan-valley-on-two-rows"],
  ])("%s is unreviewed (%s)", (suburb, inconsistency) => {
    const found = lookupCatchment(suburb);
    expect(found.state).toBe("unreviewed");
    if (found.state !== "unreviewed") return;
    expect(found.inconsistency).toBe(inconsistency);
    expect(found.note.length).toBeGreaterThan(0);
  });

  it("`unreviewed` still routes, with its marker attached", () => {
    const found = lookupCatchment("Hope Valley");
    expect(catchmentCanRouteAutomatically(found)).toBe(true);
    expect(catchmentRoutingDestinations(found)).toEqual(["Rockingham"]);
    expect(found.state).toBe("unreviewed");
  });

  /**
   * Calista is BOTH internally inconsistent (S2015's `Kwinana` hospital on two rows out of 537)
   * and cross-source contested. Contested wins, because it is the state that refuses to route —
   * and the internal marker is still carried rather than lost to the overlap.
   */
  it("Calista, which is both, resolves to contested and keeps the internal marker", () => {
    const found = lookupCatchment("Calista");
    expect(found.state).toBe("contested");
    if (found.state !== "contested") return;
    expect(found.alsoInternallyInconsistent).toBe("kwinana-on-two-rows");
    expect(catchmentCanRouteAutomatically(found)).toBe(false);
    expect(INTERNALLY_INCONSISTENT_SUBURBS.some((entry) => entry.suburb === "Calista")).toBe(true);
  });

  it("the recorded inconsistency list covers exactly the three named inconsistencies", () => {
    expect(new Set(INTERNALLY_INCONSISTENT_SUBURBS.map((entry) => entry.inconsistency))).toEqual(
      new Set(["bentley-vs-mills-street", "kwinana-on-two-rows", "swan-valley-on-two-rows"]),
    );
    // Two rows each for the Kwinana and Swan Valley anomalies — "exactly 2 rows", as stated.
    const byId = (id: string) => INTERNALLY_INCONSISTENT_SUBURBS.filter((entry) => entry.inconsistency === id);
    expect(byId("kwinana-on-two-rows").map((entry) => entry.suburb)).toEqual(["Calista", "Hope Valley"]);
    expect(byId("swan-valley-on-two-rows").map((entry) => entry.suburb)).toEqual(["Wongan Hills", "Wundowie"]);
  });
});

describe("ward-catchment — the five contested suburbs carry both answers and do not route", () => {
  const EXPECTED: ReadonlyArray<readonly [string, readonly string[], readonly string[]]> = [
    ["Halls Head", ["Rockingham"], ["PEEL"]],
    ["Mandurah", ["Rockingham"], ["PEEL"]],
    ["Furnissdale", ["Rockingham", "Peel"], ["PEEL"]],
    ["Birchmont", ["Kwinana", "Peel"], ["PEEL"]],
    ["Calista", ["Peel", "Rockingham"], ["ROCKINGHAM KWINANA"]],
  ];

  it.each(EXPECTED)("%s carries both readings, each attributed to its document and date", (suburb, s2015, s2023) => {
    const found = lookupCatchment(suburb);
    expect(found.state).toBe("contested");
    if (found.state !== "contested") return;

    expect(found.answers).toHaveLength(2);
    const fromS2015 = found.answers.find((answer) => answer.document.id === "S2015");
    const fromS2023 = found.answers.find((answer) => answer.document.id === "S2023");

    expect(fromS2015?.clinics).toEqual(s2015);
    expect(fromS2023?.clinics).toEqual(s2023);

    // Attribution is the point: a date-less answer is a value nobody can go back to.
    expect(fromS2015?.document.date).toBe("22 November 2015");
    expect(fromS2023?.document.date).toBe("November 2023");
    expect(found.withinOneDocument).toBe(false);
  });

  it.each(EXPECTED.map(([suburb]) => suburb))("%s is refused by the routing predicate", (suburb) => {
    const found = lookupCatchment(suburb);
    expect(catchmentCanRouteAutomatically(found)).toBe(false);
    // `null`, not `[]` — an empty array reads as "no teams" and a caller spreading it routes to
    // nothing rather than stopping and asking.
    expect(catchmentRoutingDestinations(found)).toBeNull();
  });

  it("never prefers the newer document — neither answer is dropped or reordered away", () => {
    for (const entry of CONTESTED_SUBURBS) {
      expect(entry.answers).toHaveLength(2);
      expect(new Set(entry.answers.map((answer) => answer.document.id))).toEqual(new Set(["S2015", "S2023"]));
    }
    expect(CONTESTED_SUBURBS.map((entry) => entry.suburb)).toEqual([
      "Halls Head",
      "Mandurah",
      "Furnissdale",
      "Birchmont",
      "Calista",
    ]);
  });

  /**
   * S2015 duplicates two suburb names with rows that disagree, which the data document records as
   * unresolved in the source. Picking either would be the silent guess the spec forbids, so these
   * are contested too — flagged as within one document rather than as a cross-source dispute.
   */
  it.each([
    ["Woodbridge", ["Rockingham"], ["Midland"]],
    ["Karratha", ["North West"], ["West Pilbara"]],
  ])("%s, duplicated inside S2015 with disagreeing rows, is contested and does not route", (suburb, first, second) => {
    const found = lookupCatchment(suburb);
    expect(found.state).toBe("contested");
    if (found.state !== "contested") return;
    expect(found.withinOneDocument).toBe(true);
    expect(found.answers.map((answer) => answer.clinics)).toEqual([first, second]);
    expect(catchmentRoutingDestinations(found)).toBeNull();
  });

  it("a suburb duplicated with identical routing collapses to one answer and still routes", () => {
    // `Bunbury` sits at 6231 and 6230 with the same clinic; that is not a disagreement.
    const found = lookupCatchment("Bunbury");
    expect(found.state).toBe("reviewed");
    if (found.state !== "reviewed") return;
    expect(found.answers).toHaveLength(1);
    expect(found.answers[0].clinics).toEqual(["Bunbury"]);
    expect(found.answers[0].postcodes).toEqual(["6231", "6230"]);
  });
});

describe("ward-catchment — an unknown suburb", () => {
  it("returns `unknown`: never a default, never a nearest match, never an empty string", () => {
    const found = lookupCatchment("Nowhere Vale");
    expect(found.state).toBe("unknown");
    if (found.state !== "unknown") return;
    expect(found.reason).toBe("suburb-not-in-source-table");
    expect(found.suburb).toBeNull();
    expect(found.matchedVia).toBeNull();
    expect(found.namedByDocuments).toEqual([]);
    expect(catchmentCanRouteAutomatically(found)).toBe(false);
    expect(catchmentRoutingDestinations(found)).toBeNull();
    // No clinic field at all on an unknown — not "" and not [].
    expect(Object.keys(found)).not.toContain("answers");
  });

  it("a near-miss spelling is not silently matched to its neighbour", () => {
    // One character from `Albany`, and one from `Midland`. A similarity threshold would take both;
    // the recorded alias table takes neither, which is the whole reason it is a table.
    for (const query of ["Albanyy", "Midlandd", "Rockinghm", "Floreatt"]) {
      expect(lookupCatchment(query).state).toBe("unknown");
    }
  });

  it("`Solus` and `Salus` stay undetermined rather than being guessed into one canonical", () => {
    for (const query of ["Solus", "Salus"]) {
      const found = lookupCatchment(query);
      expect(found.state).toBe("unknown");
      expect(resolveSuburbAlias(query)).toBeNull();
    }
    expect(UNDETERMINED_SUBURB_NAMES.map((entry) => entry.spellings)).toEqual([["Solus", "Salus"]]);
  });

  it("a name the newer documents carry but S2015 does not says so, rather than reading as unheard-of", () => {
    const found = lookupCatchment("Inglehope");
    expect(found.state).toBe("unknown");
    if (found.state !== "unknown") return;
    expect(found.reason).toBe("suburb-not-in-source-table");
    expect(found.namedByDocuments).toEqual(["S2023", "SMETRO"]);
  });

  /**
   * Spec Part 4 outcome 2 — "no catchment for this suburb" — is a different visible outcome from
   * outcome 3, "the suburb is not recognised at all". `6798 Christmas Island` is the only row in
   * all 537 with no follow-up clinic, and it must not render as a blank team name.
   */
  it("a row that exists but records no clinic is `no catchment`, not `not recognised`", () => {
    const found = lookupCatchment("Christmas Island");
    expect(found.state).toBe("unknown");
    if (found.state !== "unknown") return;
    expect(found.reason).toBe("suburb-in-source-table-but-no-follow-up-clinic-recorded");
    expect(found.suburb).toBe("Christmas Island");
    expect(catchmentRoutingDestinations(found)).toBeNull();
  });
});

describe("ward-catchment — the recorded alias table", () => {
  it("is exhaustive over section 4.5 of the data document", () => {
    const covered = new Set<string>();
    for (const alias of SUBURB_ALIASES) {
      covered.add(alias.variant);
      covered.add(alias.canonical);
    }
    for (const entry of UNDETERMINED_SUBURB_NAMES) {
      covered.add(entry.spellings.join(" / "));
    }
    for (const name of SECTION_4_5_NAMES) {
      expect(covered.has(name), `section 4.5 name not covered: ${name}`).toBe(true);
    }
    expect(SECTION_4_5_NAMES).toHaveLength(19);
    expect(SUBURB_ALIASES).toHaveLength(18);
    expect(SUBURB_ALIASES.length + UNDETERMINED_SUBURB_NAMES.length).toBe(19);
  });

  it("every alias names the document(s) that write it", () => {
    const known = new Set(Object.keys(CATCHMENT_DOCUMENTS));
    for (const alias of SUBURB_ALIASES) {
      expect(alias.writtenBy.length, `no source recorded for alias ${alias.variant}`).toBeGreaterThan(0);
      for (const id of alias.writtenBy) expect(known.has(id)).toBe(true);
      expect(alias.note.length).toBeGreaterThan(0);
    }
  });

  it("every alias resolves to its canonical suburb", () => {
    for (const alias of SUBURB_ALIASES) {
      expect(resolveSuburbAlias(alias.variant)?.canonical).toBe(alias.canonical);
    }
  });

  it("no alias variant shadows a different row that is already in the table", () => {
    const tableKeys = new Set(S2015_CATCHMENT_ROWS.map((row) => normaliseSuburbKey(row.suburb)));
    for (const alias of SUBURB_ALIASES) {
      if (normaliseSuburbKey(alias.variant) === normaliseSuburbKey(alias.canonical)) continue;
      expect(tableKeys.has(normaliseSuburbKey(alias.variant)), `alias ${alias.variant} shadows a real row`).toBe(false);
    }
  });

  it.each([
    ["Anketell", "Anketel", ["Kwinana"]],
    ["Florea!", "Floreat", ["Subiaco"]],
    ["Paulis Valley", "Paulls Valley", ["Midland"]],
    ["Salter Point", "Salter Pointer", ["Bentley"]],
    ["lnglewood", "Inglewood", ["Inner City"]],
    ["lnnaloo", "Innaloo", ["Osborne"]],
    ["lluka", "Iluka", ["Joondalup"]],
    ["Mount Pleasant", "Mt Pleasant", ["Alma Street (Melville)"]],
    ["Alexander", "Alexander Heights", ["Mirrabooka"]],
    ["O'Connor", "O’Connor", ["Alma Street (Central)"]],
  ])("looking up the variant %s reaches %s", (variant, canonical, clinics) => {
    const found = lookupCatchment(variant);
    expect(found.state).toBe("reviewed");
    if (found.state !== "reviewed") return;
    expect(found.suburb).toBe(canonical);
    expect(found.matchedVia.kind).toBe("alias");
    expect(found.answers[0].clinics).toEqual(clinics);
  });

  it("aliases whose canonical S2015 never had still end at `unknown`, not at a guess", () => {
    for (const variant of ["lnglehope", "Cockburn central"]) {
      expect(resolveSuburbAlias(variant)).not.toBeNull();
      expect(lookupCatchment(variant).state).toBe("unknown");
    }
  });
});

describe("ward-catchment — a catchment is a SET", () => {
  it("parses a slash-hedged value as two entries, not one", () => {
    expect(parseFollowUpClinicSet("Peel /Rockingham")).toEqual(["Peel", "Rockingham"]);
    expect(parseFollowUpClinicSet("Rockingham/Kwinana")).toEqual(["Rockingham", "Kwinana"]);
    // An unhedged value is a set of one, never a special case.
    expect(parseFollowUpClinicSet("Midland")).toEqual(["Midland"]);
    expect(parseFollowUpClinicSet("")).toEqual([]);
  });

  it("a slash-hedged row yields two clinics through the lookup", () => {
    const hillman = lookupCatchment("Hillman");
    expect(hillman.state).toBe("reviewed");
    if (hillman.state !== "reviewed") return;
    expect(hillman.answers[0].verbatim).toBe("Rockingham/Kwinana");
    expect(hillman.answers[0].clinics).toEqual(["Rockingham", "Kwinana"]);
    expect(hillman.answers[0].clinics).toHaveLength(2);
    expect(catchmentRoutingDestinations(hillman)).toEqual(["Rockingham", "Kwinana"]);

    const barragup = lookupCatchment("Barragup");
    expect(barragup.state).toBe("reviewed");
    if (barragup.state !== "reviewed") return;
    expect(barragup.answers[0].clinics).toEqual(["Peel", "Rockingham"]);
  });

  /**
   * Six rows carry a slash, across five distinct clinic strings. The data document's prose says
   * "Five rows"; its own counts in section 2 sum to six, and six is what the table holds. The
   * count is pinned to the table rather than to the prose.
   */
  it("holds six slash-hedged rows across five distinct hedged strings", () => {
    const hedged = S2015_CATCHMENT_ROWS.filter((row) => row.followUpClinicVerbatim.includes("/"));
    expect(hedged).toHaveLength(6);
    expect(new Set(hedged.map((row) => row.followUpClinicVerbatim))).toEqual(
      new Set(["Peel/Rockingham", "Peel /Rockingham", "Kwinana/Peel", "Rockingham/Kwinana", "Rockingham/Peel"]),
    );
    for (const row of hedged) expect(parseFollowUpClinicSet(row.followUpClinicVerbatim)).toHaveLength(2);
  });

  it("does not split a slash in a SUBURB name", () => {
    // `Yunderup South/North` is one S2015 row naming one place, not two suburbs.
    const found = lookupCatchment("Yunderup South/North");
    expect(found.state).toBe("reviewed");
    if (found.state !== "reviewed") return;
    expect(found.suburb).toBe("Yunderup South/North");
    expect(found.answers[0].clinics).toEqual(["Peel"]);
  });
});
