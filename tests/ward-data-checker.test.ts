/**
 * The checker's own tests.
 *
 * `scripts/check-ward-data.mjs` exists so that a wrong bed number produces a sentence the product
 * owner can act on. Two things therefore have to be true of it, and only the second is usually
 * tested: it has to stay quiet on data that is right, and it has to go RED — with a readable
 * message — on data that is wrong. So every test below asserts the MESSAGE TEXT, not merely that a
 * problem was counted: a checker that fails with "invariant violated" has failed at the only job it
 * has.
 *
 * Every failing case is built from a constructed fixture, never by editing a real data file. That
 * is not only tidiness: the real files are owned by other work in flight, and a check proved red by
 * mutating one is a check proved once and never again.
 *
 * The fixture uses the app's OWN `unitCapacity` and `bedIsOccupied`, exactly as the script does, so
 * these tests cannot pass against a second, drifting copy of the arithmetic.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { TRAVEL_BANDS } from "@/components/ward-management/ward-travel-bands";

import {
  checkWardData,
  closestMatch,
  formatReport,
  navReferences,
  readTextParsedFacts,
} from "../scripts/check-ward-data.mjs";

const SITES_FILE = "src/components/ward-management/ward-sites.ts";
const SEED_FILE = "src/components/ward-management/ward-admissions-seed.ts";

type AnyRecord = Record<string, unknown>;

function capacityFigure(value: number) {
  return { value, source: "feed", confirmedAt: 600, staleAfterMinutes: 15 };
}

/** Nine women and nine men in the beds of `rph-adult-secure`, one entry each. */
function occupants(unitId: string, female: number, male: number) {
  const people: AnyRecord[] = [];
  for (let index = 0; index < female; index += 1) {
    people.push({ id: `${unitId}-f-${index}`, unitId, sex: "Female", state: "occupied" });
  }
  for (let index = 0; index < male; index += 1) {
    people.push({ id: `${unitId}-m-${index}`, unitId, sex: "Male", state: "occupied" });
  }
  return people;
}

/**
 * A tiny network that is entirely consistent. Every test below takes this and breaks exactly one
 * thing, so the problem it asserts on can only have come from the change it made.
 *
 * The numbers are the real `rph-adult-secure` ones: 20 beds, 2 empty, 1 of those allocatable,
 * nothing out of service, 18 people split 9/9.
 */
function consistentData(overrides: AnyRecord = {}) {
  const unit = {
    id: "rph-adult-secure",
    siteCode: "RPH",
    name: "RPH Adult Secure",
    cohort: "Adult",
    security: "Secure",
    authorised: true,
    beds: 20,
    empty: capacityFigure(2),
    allocatable: capacityFigure(1),
    held: 1,
    blocked: 0,
    sexMix: { Female: 9, Male: 9 },
    speciallingCapacity: 2,
    sexDesignation: "Undesignated",
    forensic: false,
  };
  const site = {
    code: "RPH",
    name: "Royal Perth Hospital",
    service: "East Metro",
    emergencyDepartment: { id: "rph-ed", siteCode: "RPH", name: "Royal Perth Hospital Emergency Department" },
    units: [unit],
  };
  return {
    sites: [site],
    admissions: occupants("rph-adult-secure", 9, 9),
    homeRegions: ["Perth Metropolitan", "Peel"],
    communityTeams: {
      "Perth Metropolitan": "Perth Metropolitan Community Mental Health Team (placeholder)",
      Peel: "Peel Community Mental Health Team (placeholder)",
    },
    travelBands: { "Perth Metropolitan": { RPH: "under_an_hour" } },
    travelBandNames: [...TRAVEL_BANDS],
    serviceOrder: ["East Metro"],
    columnServices: { left: ["East Metro"], right: [] },
    unitReferences: [
      {
        unitId: "rph-adult-secure",
        where: "Navigation menu",
        detail: "/mockups/ward-flow/ward/rph-adult-secure",
        label: "Ward — RPH Adult Secure",
        file: "src/components/ward-management/ward-nav.ts",
      },
    ],
    edReferences: [
      {
        edId: "rph-ed",
        where: "Navigation menu",
        detail: "/mockups/ward-flow/ed/rph-ed",
        file: "src/components/ward-management/ward-nav.ts",
      },
    ],
    unitCapacity,
    bedIsOccupied,
    ...overrides,
  } as AnyRecord;
}

/** The single unit inside a fixture, so a test can break one field without rebuilding the tree. */
function theUnit(data: AnyRecord) {
  return (data.sites as AnyRecord[])[0].units as AnyRecord[];
}

function messages(data: AnyRecord): string[] {
  return checkWardData(data).problems.map((entry: { text: string }) => entry.text);
}

/** The one message a test expects, refusing quietly to pass when several or none came back. */
function onlyMessage(data: AnyRecord): string {
  const found = messages(data);
  expect(found.length, `expected exactly one problem, got:\n${found.join("\n---\n")}`).toBe(1);
  return found[0];
}

describe("the ward data checker is a check that can fail", () => {
  // If the baseline fixture were itself broken, or the checker returned nothing whatever it was
  // given, every "goes red" test below would still pass. These two are what make them mean something.
  it("finds no problems in a consistent network", () => {
    expect(messages(consistentData())).toEqual([]);
  });

  it("has data to check — a fixture that shrank to nothing would pass every rule by scanning nothing", () => {
    const data = consistentData();
    expect((data.sites as unknown[]).length).toBeGreaterThan(0);
    expect((data.admissions as unknown[]).length).toBe(18);
    expect(checkWardData(data).counts).toMatchObject({ hospitals: 1, wards: 1, people: 18 });
  });

  it("says so in the summary line whether or not anything is wrong", () => {
    expect(formatReport(checkWardData(consistentData()))).toContain("No problems found.");
    const broken = consistentData();
    theUnit(broken)[0].beds = 26;
    expect(formatReport(checkWardData(broken))).toContain("1 problem found.");
  });
});

describe("check 1 — the bed numbers on a ward add up", () => {
  it("explains a bed count that no longer matches the parts, and offers both ways out", () => {
    const data = consistentData();
    theUnit(data)[0].beds = 26;
    const message = onlyMessage(data);

    expect(message).toContain("RPH Adult Secure (rph-adult-secure) at Royal Perth Hospital");
    expect(message).toContain("beds says 26, but the parts only add up to 20.");
    expect(message).toContain("18 with someone in them + 2 empty + 0 out of service = 20");
    expect(message).toContain("change beds to 20");
    expect(message).toContain("currently 9 female + 9 male = 18");
    expect(message).toContain(`add 6 more occupants for this ward in ${SEED_FILE}`);
    expect(message).toContain(`File to edit: ${SITES_FILE}`);
    // The thing this whole script exists to avoid.
    expect(message).not.toMatch(/invariant|assert|deep equal|undefined|NaN/i);
  });

  it("says when there are more empty beds than beds", () => {
    const data = consistentData();
    theUnit(data)[0].empty = capacityFigure(30);
    const found = messages(data);
    const message = found.find((entry) => entry.includes("empty says")) ?? "";
    expect(message).toContain("empty says 30 beds, but the ward only has 20 beds.");
    expect(message).toContain("A ward cannot have more empty beds than beds.");
    expect(message).toContain("lower empty to 20 or less");
    expect(message).toContain("raise beds to at least 30");
  });

  it("says when the ward claims more allocatable beds than it has empty ones, and that the extra is silently ignored", () => {
    const data = consistentData();
    theUnit(data)[0].allocatable = capacityFigure(5);
    const message = onlyMessage(data);
    expect(message).toContain("allocatable says 5 beds can be offered, but only 2 beds are empty.");
    expect(message).toContain("The screens will quietly show 2, not 5");
    expect(message).toContain("the extra 3 is ignored");
    expect(message).toContain("lower allocatable to 2 or less");
  });

  it("says when more beds are marked out of service than could possibly be", () => {
    const data = consistentData();
    theUnit(data)[0].blocked = 25;
    const found = messages(data).join("\n---\n");
    expect(found).toContain("blocked says 25 beds out of service, but only 18 beds are not already counted as empty.");
    expect(found).toContain("The screens will quietly show 18, not 25");
  });

  it("says when a bed figure is not a whole number", () => {
    const data = consistentData();
    theUnit(data)[0].beds = 20.5;
    const found = messages(data).join("\n---\n");
    expect(found).toContain("beds is 20.5, which is not a whole number of beds.");
    expect(found).toContain("Every bed figure has to be 0 or more, with no decimal point.");
    expect(found).toContain(`File to edit: ${SITES_FILE}`);
  });

  it("says when the male/female split is not two whole numbers", () => {
    const data = consistentData();
    theUnit(data)[0].sexMix = { Female: 9 };
    const found = messages(data).join("\n---\n");
    expect(found).toContain("the male/female split is");
    expect(found).toContain("which is not two whole numbers of people");
    expect(found).toContain("sexMix: { Female: 9, Male: 9 }");
  });
});

describe("check 2 — the people listed match the ward's recorded male/female split", () => {
  it("names the sex that is short, how many by, and both ways to fix it", () => {
    const data = consistentData();
    data.admissions = occupants("rph-adult-secure", 7, 9);
    // Keep the bed totals consistent so this is the only thing wrong.
    theUnit(data)[0].sexMix = { Female: 9, Male: 9 };
    theUnit(data)[0].beds = 20;
    const found = messages(data);
    const message = found.find((entry) => entry.includes("do not match its male/female split")) ?? "";

    expect(message).toContain("RPH Adult Secure (rph-adult-secure) at Royal Perth Hospital");
    expect(message).toContain("female: ward-sites.ts says 9, ward-admissions-seed.ts lists 7");
    expect(message).toContain("male: 9 recorded, 9 listed — these agree");
    expect(message).toContain(`add 2 more female occupants for this ward in ${SEED_FILE}`);
    expect(message).toContain("change sexMix to { Female: 7, Male: 9 }");
    expect(message).toContain("check the bed totals for this ward still add up");
  });

  it("says when there is one occupant too many rather than too few", () => {
    const data = consistentData();
    data.admissions = occupants("rph-adult-secure", 9, 10);
    const found = messages(data).join("\n---\n");
    expect(found).toContain("male: ward-sites.ts says 9, ward-admissions-seed.ts lists 10");
    expect(found).toContain(`remove 1 male occupant for this ward from ${SEED_FILE}`);
  });

  it("counts a pulled bed as occupied, exactly as the ward board does", () => {
    // A `pulled` admission holds a bed although nobody has arrived. If the checker required
    // `state === "occupied"` this ward would read as one person short and the message would be wrong.
    const data = consistentData();
    const people = occupants("rph-adult-secure", 9, 9);
    (people[0] as AnyRecord).state = "pulled";
    data.admissions = people;
    expect(messages(data)).toEqual([]);
  });

  it("does not count somebody who has left", () => {
    const data = consistentData();
    const people = occupants("rph-adult-secure", 9, 9);
    (people[0] as AnyRecord).state = "left";
    data.admissions = people;
    const found = messages(data).join("\n---\n");
    expect(found).toContain("female: ward-sites.ts says 9, ward-admissions-seed.ts lists 8");
  });
});

describe("check 3 — nobody is listed in a ward with too few beds", () => {
  it("says how many people are over, and both ways out", () => {
    const data = consistentData();
    theUnit(data)[0].beds = 10;
    theUnit(data)[0].empty = capacityFigure(0);
    theUnit(data)[0].allocatable = capacityFigure(0);
    theUnit(data)[0].sexMix = { Female: 5, Male: 5 };
    data.admissions = occupants("rph-adult-secure", 9, 9);
    const found = messages(data).join("\n---\n");
    expect(found).toContain("18 people are listed in this ward's beds, but it only has 10 beds.");
    expect(found).toContain(`remove 8 occupants for this ward from ${SEED_FILE}`);
    expect(found).toContain(`raise beds to at least 18 in ${SITES_FILE}`);
  });

  it("says when people are listed in a ward that does not exist, and suggests the ward they probably meant", () => {
    const data = consistentData();
    data.admissions = [...occupants("rph-adult-secure", 9, 9), ...occupants("rph-adult-secur", 0, 1)];
    const message = onlyMessage(data);
    expect(message).toContain('Ward id "rph-adult-secur"');
    expect(message).toContain('1 person in src/components/ward-management/ward-admissions-seed.ts is listed in a ward called "rph-adult-secur"');
    expect(message).toContain('Did you mean "rph-adult-secure"?');
    expect(message).toContain("the ward they should be in reads as emptier than it is");
  });
});

describe("check 4 — the travel-time table names real hospitals and real regions", () => {
  it("says when a hospital code does not exist, and that nothing else would ever warn", () => {
    const data = consistentData();
    data.travelBands = { "Perth Metropolitan": { RPHH: "under_an_hour" } };
    const message = onlyMessage(data);
    expect(message).toContain('Travel times: hospital code "RPHH" (under Perth Metropolitan)');
    expect(message).toContain('records a travel time to a hospital with the code "RPHH", but no hospital in');
    expect(message).toContain('Did you mean "RPH"?');
    expect(message).toContain('the pair just reads as "travel time not recorded", forever');
  });

  it("says when a region does not exist", () => {
    const data = consistentData();
    data.travelBands = { "Perth Metropolitain": { RPH: "under_an_hour" } };
    const message = onlyMessage(data);
    expect(message).toContain('Travel times: region "Perth Metropolitain"');
    expect(message).toContain('Did you mean "Perth Metropolitan"?');
    expect(message).toContain("Every travel time recorded under it is ignored.");
  });

  it("says when the travel time itself is not one of the four bands", () => {
    const data = consistentData();
    data.travelBands = { "Perth Metropolitan": { RPH: "two_hours_ish" } };
    const message = onlyMessage(data);
    expect(message).toContain('the travel time is written as "two_hours_ish", which is not one of the four bands');
    expect(message).toContain("under_an_hour, one_to_three_hours, three_hours_or_more and air_transport_only");
  });
});

describe("check 5 — every region has a community mental health team", () => {
  it("says which region, what breaks, and the exact line to add", () => {
    const data = consistentData();
    data.communityTeams = { "Perth Metropolitan": "Perth Metropolitan Community Mental Health Team (placeholder)" };
    const message = onlyMessage(data);
    expect(message).toContain('Region "Peel"');
    expect(message).toContain("has no community mental health team recorded.");
    expect(message).toContain("where somebody goes back to when they are discharged");
    expect(message).toContain('"Peel": "Peel Community Mental Health Team (placeholder)",');
  });

  it("says when a team is left behind for a region that no longer exists", () => {
    const data = consistentData();
    (data.communityTeams as AnyRecord).Wheatbelt = "Wheatbelt Community Mental Health Team (placeholder)";
    const message = onlyMessage(data);
    expect(message).toContain('Region "Wheatbelt"');
    expect(message).toContain("That team is never shown to anybody.");
  });

  it("treats a blank team name as missing rather than present", () => {
    const data = consistentData();
    (data.communityTeams as AnyRecord).Peel = "   ";
    expect(onlyMessage(data)).toContain("has no community mental health team recorded.");
  });
});

describe("check 6 — a health service used by a hospital reaches every screen list", () => {
  it("names both lists, what each one silently drops, and that nothing else warns", () => {
    // The real scenario: a hospital is added (or moved) into a health service nobody added to the
    // two hand-written display lists. Two things are then true and both are reported — the new
    // service reaches no screen, and the old one is now an empty column.
    const data = consistentData();
    (data.sites as AnyRecord[])[0].service = "Central Metro";
    const found = messages(data);
    const message = found.find((entry) => entry.includes('Health service "Central Metro"')) ?? "";
    expect(found.some((entry) => entry.includes('empty column headed "EAST METRO"'))).toBe(true);

    expect(message).toContain('Health service "Central Metro"');
    expect(message).toContain('1 hospital uses the health service "Central Metro"');
    expect(message).toContain("Hospitals affected: Royal Perth Hospital (RPH)");
    expect(message).toContain("wardServiceOrder in src/components/ward-management/ward-derivations.ts");
    expect(message).toContain("the ED screen's ward table and the coordinator flow diagram will skip these wards entirely");
    expect(message).toContain("columnServices in src/components/ward-management/ward-management-network.tsx");
    expect(message).toContain("the network map will never draw a column for these wards");
    expect(message).toContain("the app compiles and runs perfectly with these wards invisible");
    expect(message).toContain('add "Central Metro" to both lists');
  });

  it("names only the list that is actually missing it", () => {
    const data = consistentData();
    data.columnServices = { left: [], right: [] };
    const found = messages(data);
    const message = found.find((entry) => entry.includes('Health service "East Metro"')) ?? "";
    expect(message).toContain("columnServices in src/components/ward-management/ward-management-network.tsx");
    expect(message).not.toContain("wardServiceOrder in");
    expect(message).toContain("add \"East Metro\" to that list");
  });

  it("says when a listed service has no hospitals, because the map draws an empty column for it", () => {
    const data = consistentData();
    data.serviceOrder = ["East Metro", "WACHS"];
    data.columnServices = { left: ["East Metro", "WACHS"], right: [] };
    const message = onlyMessage(data);
    expect(message).toContain('Health service "WACHS"');
    expect(message).toContain("no hospital in src/components/ward-management/ward-sites.ts belongs to it");
    expect(message).toContain('empty column headed "WACHS"');
  });

  it("says when the network map lists the same service twice", () => {
    const data = consistentData();
    data.columnServices = { left: ["East Metro"], right: ["East Metro"] };
    const message = onlyMessage(data);
    expect(message).toContain("appears more than once in columnServices");
    expect(message).toContain("draw two columns for the same wards");
  });
});

describe("check 7 — every ward or department named in a link exists", () => {
  it("says when a menu link points at a ward that is gone, and what the user would see", () => {
    const data = consistentData();
    (data.unitReferences as AnyRecord[])[0].unitId = "rph-adult-secure-2";
    const message = onlyMessage(data);
    expect(message).toContain('Navigation menu: ward "rph-adult-secure-2"');
    expect(message).toContain('there is no ward with that id in src/components/ward-management/ward-sites.ts');
    expect(message).toContain('Did you mean "rph-adult-secure" (RPH Adult Secure)?');
    expect(message).toContain('Anyone following it lands on a "not found" page.');
    expect(message).toContain("correct the id in src/components/ward-management/ward-nav.ts");
  });

  it("says when the morning tour walks through a ward that is gone", () => {
    const data = consistentData();
    (data.unitReferences as AnyRecord[]).push({
      unitId: "scgh-adult-open",
      where: "Morning bed-state tour",
      detail: "the ward the guided tour walks through (TOUR_UNIT_ID)",
      file: "src/components/ward-management/morning/morning-tour.tsx",
    });
    const message = onlyMessage(data);
    expect(message).toContain('Morning bed-state tour: ward "scgh-adult-open"');
    expect(message).toContain("the ward the guided tour walks through (TOUR_UNIT_ID)");
    expect(message).toContain("correct the id in src/components/ward-management/morning/morning-tour.tsx");
  });

  it("says when a link points at an emergency department that does not exist", () => {
    const data = consistentData();
    (data.edReferences as AnyRecord[])[0].edId = "peel-ed";
    const message = onlyMessage(data);
    expect(message).toContain('Navigation menu: emergency department "peel-ed"');
    expect(message).toContain("no hospital in src/components/ward-management/ward-sites.ts has one with that id");
    expect(message).toContain('Anyone following it lands on a "not found" page.');
  });
});

describe("check 8 — a menu label names the ward it actually opens", () => {
  it("shows both names side by side and writes out the replacement label", () => {
    const data = consistentData();
    theUnit(data)[0].name = "RPH Adult Intensive Care";
    const found = messages(data);
    const message = found.find((entry) => entry.includes("menu label")) ?? found.join("\n---\n");
    expect(message).toContain('Navigation menu: menu item "Ward — RPH Adult Secure"');
    expect(message).toContain('the menu says this link goes to "RPH Adult Secure", but the ward it actually opens is called "RPH Adult Intensive Care"');
    expect(message).toContain("nothing checks the two against each other");
    expect(message).toContain('"Ward — RPH Adult Intensive Care"');
  });

  it("leaves a label alone when it makes no claim about a ward name", () => {
    const data = consistentData();
    (data.unitReferences as AnyRecord[])[0].label = "Ward";
    theUnit(data)[0].name = "Something Else Entirely";
    expect(messages(data)).toEqual([]);
  });
});

describe("check 9 (added) — the network's own ids and nesting are coherent", () => {
  it("says when a ward was copied and its id was not changed", () => {
    const data = consistentData();
    const [unit] = theUnit(data);
    theUnit(data).push({ ...unit, name: "RPH Adult Open", sexMix: { Female: 0, Male: 0 }, beds: 0, empty: capacityFigure(0), allocatable: capacityFigure(0) });
    const found = messages(data).join("\n---\n");
    expect(found).toContain('Ward id "rph-adult-secure"');
    expect(found).toContain("is used by two wards: RPH Adult Secure and RPH Adult Open.");
    expect(found).toContain("the second is invisible everywhere in the app");
    expect(found).toContain("copying an existing one and the id is not changed");
  });

  it("says when a ward was copied from another hospital and its siteCode was left behind", () => {
    const data = consistentData();
    (data.sites as AnyRecord[]).push({
      code: "SCGH",
      name: "Sir Charles Gairdner Hospital",
      service: "East Metro",
      units: [],
    });
    theUnit(data)[0].siteCode = "SCGH";
    const message = onlyMessage(data);
    expect(message).toContain("RPH Adult Secure (rph-adult-secure) at Royal Perth Hospital");
    expect(message).toContain('is written under Royal Perth Hospital, whose code is "RPH", but its own siteCode says "SCGH"');
    expect(message).toContain("appear under that hospital on the network map, and travel times will be measured to it");
    expect(message).toContain('change siteCode to "RPH"');
  });

  it("says when a ward's siteCode names no hospital at all", () => {
    const data = consistentData();
    theUnit(data)[0].siteCode = "NOPE";
    const message = onlyMessage(data);
    expect(message).toContain("this ward has no hospital at all");
    expect(message).toContain("disappears from the network map and every health-service grouping");
  });

  it("says when two hospitals share a code", () => {
    const data = consistentData();
    (data.sites as AnyRecord[]).push({ code: "RPH", name: "Rockingham Hospital", service: "East Metro", units: [] });
    const message = onlyMessage(data);
    expect(message).toContain('Hospital code "RPH"');
    expect(message).toContain("is used by two hospitals: Royal Perth Hospital and Rockingham Hospital.");
  });

  it("says when an emergency department is filed under the wrong hospital", () => {
    const data = consistentData();
    ((data.sites as AnyRecord[])[0].emergencyDepartment as AnyRecord).siteCode = "SCGH";
    const message = onlyMessage(data);
    expect(message).toContain("Royal Perth Hospital Emergency Department (rph-ed)");
    expect(message).toContain('its own siteCode says "SCGH"');
    expect(message).toContain('change siteCode to "RPH"');
  });
});

describe("reading the two facts that cannot be imported", () => {
  /**
   * `columnServices` and the morning tour's ids are module-local constants inside React component
   * files, so they are read as TEXT. A text parse can silently stop matching after an ordinary
   * refactor, and a parser that then returned "nothing found" would turn check 6 and check 7 into
   * checks that cannot fail. These assert it reports instead.
   */
  it("reports loudly when it cannot find columnServices, rather than reporting nothing to check", () => {
    const { columnServices, readingProblems } = readTextParsedFacts(() => "// the file was refactored\n");
    expect(columnServices).toEqual({ left: [], right: [] });
    const text = readingProblems.map((entry: { text: string }) => entry.text).join("\n---\n");
    expect(text).toContain("could not read the columnServices list out of this file, so it could NOT check it");
    expect(text).toContain("treat that as unchecked rather than correct");
  });

  it("reports loudly when it cannot find the morning tour's ward and department", () => {
    const { readingProblems } = readTextParsedFacts(() => "const TOUR_UNIT_ID = someLookup();\n");
    const text = readingProblems.map((entry: { text: string }) => entry.text).join("\n---\n");
    expect(text).toContain("the ward and department the morning tour walks through");
    expect(text).toContain("were not both found as plain string constants");
  });

  /**
   * COLUMN SERVICES IS CURRENTLY UNCHECKED, RECORDED RATHER THAN HIDDEN.
   *
   * At the ward board fold (2026-08-29) this checker met Phase 8's rewritten network screen for the
   * first time. `columnServices` still has `left:` and `right:` keys, but they are no longer literal
   * arrays:
   *
   *   left:  LEFT_COLUMN_SERVICES
   *   right: wardServiceOrder.filter((service) => !LEFT_COLUMN_SERVICES.includes(service))
   *
   * The right-hand side is computed at runtime, and a text parser cannot resolve it. So reteaching
   * the parser is NOT mechanical: it would mean reimplementing that filter in the checker, where it
   * could silently diverge from the screen it is meant to be checking.
   *
   * The rule applied here, and it is the whole point: the checker is NOT loosened to make this pass.
   * It reports "nothing is checking the columnServices list, so treat that as unchecked rather than
   * correct" — an honest failure — and this test now pins that exact state so the gap is visible in
   * the suite rather than absent from it. The morning tour IS still read and still checked.
   *
   * TO CLOSE IT: give `HealthService` a runtime array (it is the only multi-value union in
   * ward-model.ts without one) and derive both columns from it. Then this fact stops needing to be
   * text-parsed at all, and this test goes back to asserting no reading problems.
   */
  it("reads the morning tour out of the real files, and records columnServices as unchecked", () => {
    const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
    const { tour, readingProblems } = readTextParsedFacts(read);

    // The tour is still genuinely read and checked.
    expect(tour.unitId).toBeTruthy();
    expect(tour.edId).toBeTruthy();

    // Exactly one known reading problem, named, so a SECOND one cannot hide behind it.
    expect(readingProblems).toHaveLength(1);
    const text = readingProblems.map((entry: { text: string }) => entry.text).join(" | ");
    expect(text).toContain("ward-management-network.tsx");
    expect(text).toContain("could NOT check it");
    expect(text).toContain("treat that as unchecked rather than correct");
  });

  it("turns nav links into the ward and department references the checks walk", () => {
    const { unitReferences, edReferences } = navReferences([
      { id: "ward", href: "/mockups/ward-flow/ward/rph-adult-secure", label: "Ward — RPH Adult Secure" },
      { id: "board", href: "/mockups/ward-flow/board/rph-adult-secure", label: "Ward board — RPH Adult Secure" },
      { id: "ed", href: "/mockups/ward-flow/ed/peel-ed", label: "Emergency department" },
      { id: "handover", href: "/mockups/ward-flow/handover", label: "Handover" },
    ]);
    expect(unitReferences.map((entry: { unitId: string }) => entry.unitId)).toEqual([
      "rph-adult-secure",
      "rph-adult-secure",
    ]);
    expect(edReferences.map((entry: { edId: string }) => entry.edId)).toEqual(["peel-ed"]);
  });
});

describe('the "did you mean" suggestion', () => {
  it("suggests a near miss", () => {
    expect(closestMatch("rph-adult-secur", ["rph-adult-secure", "fsh-adult-secure"])).toBe("rph-adult-secure");
  });

  it("stays silent rather than suggesting something unrelated", () => {
    expect(closestMatch("bunbury-youth", ["rph-adult-secure", "fsh-adult-secure"])).toBeNull();
  });
});
