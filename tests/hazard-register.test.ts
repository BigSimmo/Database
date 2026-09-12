import { describe, expect, it } from "vitest";

import {
  buildHazardSnapshot,
  normaliseStatus,
  parseAnalysisTitles,
  parseHazardRows,
  plainCell,
  reviewExpired,
  tableCells,
} from "../scripts/generate-hazard-register-snapshot.mjs";
import {
  loadHazardSnapshot,
  missingRegisters,
  reviewExpiredAtPerth,
  statusBreakdown,
  statusLabel,
  unmitigatedHazards,
  type HazardSnapshot,
} from "../src/lib/developer-area/hazard-register";

// The hazard register is the one developer-hub panel whose failure mode is
// clinical rather than cosmetic: a row silently dropped, a status quietly
// rounded to "controlled", or three registers merged into one list all
// under-report unmitigated risk on a page whose whole purpose is to report it.
// These tests are written around those three failures, not around rendering.

describe("markdown parsing", () => {
  it("reads a hazard row out of a table, stripping the markdown that dresses it", () => {
    const rows = parseHazardRows(
      [
        "| id | hazard | cause | harm | existing control | residual risk | owner | status |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        "| **H-C01** | A contact is delivered after the recipient has died | A late death record | A bereaved family receives it | `hospital-events.ts:93` | Depends on the death reaching this system | H-00 (unfilled) | Controlled — unreviewed |",
      ].join("\n"),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "H-C01",
      hazard: "A contact is delivered after the recipient has died",
      control: "hospital-events.ts:93",
      owner: "H-00 (unfilled)",
      status: "Controlled — unreviewed",
    });
  });

  it("ignores header, alignment, and non-hazard rows rather than emitting blanks for them", () => {
    const rows = parseHazardRows(
      ["| id | hazard |", "| --- | --- |", "| not-an-id | some other table |", "prose that is not a table at all"].join(
        "\n",
      ),
    );

    expect(rows).toEqual([]);
  });

  it("strips code, bold and links from a cell but keeps the words", () => {
    expect(plainCell("**H-00** `file.ts:1` [see doc](../a/b.md)")).toBe("H-00 file.ts:1 see doc");
  });

  it("splits on the inner delimiters only, so a leading or trailing pipe adds no empty cell", () => {
    expect(tableCells("| a | b | c |")).toEqual(["a", "b", "c"]);
  });

  it("keeps an escaped pipe inside its hazard cell instead of shifting later columns", () => {
    const rows = parseHazardRows(
      [
        "| **H-C99** | A parser sees a literal pipe | A markdown cell contains `A \\| B` | A status shifts columns | `rule.ts` | Known gap | owner | UNMITIGATED |",
      ].join("\n"),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        id: "H-C99",
        cause: "A markdown cell contains A | B",
        status: "UNMITIGATED",
      }),
    ]);
  });

  it("fails loud when a hazard row does not have exactly eight cells", () => {
    expect(() =>
      parseHazardRows(
        "| H-C99 | hazard | cause | harm | control | residual | owner | UNMITIGATED | unexpected extra cell |",
      ),
    ).toThrow(/H-C99.*expected 8 cells/i);
  });

  it("takes the first heading for a hazard, not a later narrower one", () => {
    // H5 carries a second heading for one sub-topic; the broad one is its title.
    const titles = parseAnalysisTitles(
      ["### H5 — An answer that should be withheld is presented as trusted", "### H5: Provenance tags"].join("\n"),
    );
    expect(titles.H5).toBe("An answer that should be withheld is presented as trusted");
  });
});

describe("normaliseStatus", () => {
  it("maps the three states the Caring Contacts document defines", () => {
    expect(normaliseStatus("UNMITIGATED")).toBe("unmitigated");
    expect(normaliseStatus("Partial")).toBe("partial");
    expect(normaliseStatus("Controlled — unreviewed")).toBe("controlled-unreviewed");
  });

  it("passes an unknown status through instead of rounding it to the nearest known one", () => {
    // A status this parser has not seen means the document changed. Filing it
    // under "controlled" would be the page quietly overstating coverage.
    expect(normaliseStatus("Accepted by clinical governance")).toBe("Accepted by clinical governance");
  });
});

describe("reviewExpired", () => {
  it("treats a missing or unparseable expiry as expired, never as current", () => {
    expect(reviewExpired(null, new Date("2026-09-08T00:00:00Z"))).toBe(true);
    expect(reviewExpired("not-a-date", new Date("2026-09-08T00:00:00Z"))).toBe(true);
  });

  it("expires the day after the stated date, not on it", () => {
    expect(reviewExpired("2026-11-23", new Date("2026-11-23T12:00:00Z"))).toBe(false);
    expect(reviewExpired("2026-11-23", new Date("2026-11-24T12:00:00Z"))).toBe(true);
  });

  it("uses the Australia/Perth local-day boundary", () => {
    expect(reviewExpired("2026-11-23", new Date("2026-11-23T15:59:59Z"))).toBe(false);
    expect(reviewExpired("2026-11-23", new Date("2026-11-23T16:00:00Z"))).toBe(true);
  });
});

describe("buildHazardSnapshot against the real repository documents", () => {
  // The generator is plain JavaScript, so TypeScript infers a loose union of
  // the three register shapes from it. Asserting it to the loader's own type
  // here is what the page consumes, and doubles as a check that the generator
  // still produces that shape.
  const snapshot = buildHazardSnapshot(new Date("2026-09-08T00:00:00Z")) as HazardSnapshot;

  it("keeps the three registers separate and never merges them into one list", () => {
    expect(snapshot.registers.map((register) => register.id)).toEqual([
      "psychsift-answer-pipeline",
      "caring-contacts",
      "ward-flow",
    ]);
  });

  it("reads all six answer-pipeline hazards with the titles from the analysis document", () => {
    const psychsift = snapshot.registers[0];
    expect(psychsift.hazards.map((hazard) => hazard.id)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6"]);
    expect(psychsift.hazards.every((hazard) => hazard.title)).toBe(true);
    // Quoted, not summarised: this sentence is what stops the panel reading as
    // clinical assurance.
    expect(psychsift.authority).toContain("Static evidence register only");
  });

  it("reads the Caring Contacts log as an unsigned draft with its four uncontrolled rows", () => {
    const caringContacts = snapshot.registers[1];
    expect(caringContacts.signedOff).toBe(false);
    expect(caringContacts.authority).toContain("requires clinical sign-off by the owner before any real-patient use");
    expect(caringContacts.authority).toContain("nothing in it constitutes approval of a pilot");
    expect(caringContacts.authority).toContain(
      "No row below has been reviewed, accepted, or signed off by a clinician",
    );
    const uncontrolled = caringContacts.hazards.filter((hazard) => hazard.status === "unmitigated");
    expect(uncontrolled.map((hazard) => hazard.id)).toEqual(["H-00", "H-04", "H-05", "H-44"]);
    expect(uncontrolled.every((hazard) => hazard.hasControl === false)).toBe(true);
  });

  it("records Ward Flow's missing register as a finding, with only its blocking ledger rows beside it", () => {
    const wardFlow = snapshot.registers[2];
    expect(wardFlow.exists).toBe(false);
    expect(wardFlow.hazards).toEqual([]);
    // Never called `hazards`: a summary text match is not a register.
    const mentions = wardFlow.ledgerMentions ?? [];
    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions.every((mention) => mention.priority === "P1")).toBe(true);
    expect(mentions.every((mention) => /ward flow/i.test(mention.summary))).toBe(true);
  });

  it("counts what is NOT controlled, and counts every row exactly once", () => {
    const counted = snapshot.registers.reduce((total, register) => total + register.hazards.length, 0);
    expect(snapshot.counts.hazards).toBe(counted);
    expect(snapshot.counts.unmitigated).toBe(4);
    expect(snapshot.counts.registersMissing).toBe(1);
    expect(snapshot.counts.registersUnsigned).toBe(2);
  });
});

describe("the committed snapshot the page renders", () => {
  it("calculates expiry from the render-time Australia/Perth date, not the snapshot boolean", () => {
    expect(reviewExpiredAtPerth("2026-11-23", new Date("2026-11-23T15:59:59Z"))).toBe(false);
    expect(reviewExpiredAtPerth("2026-11-23", new Date("2026-11-23T16:00:00Z"))).toBe(true);
  });

  it("is in step with the documents, so the page cannot show a stale hazard list", () => {
    const committed = loadHazardSnapshot();
    const rebuilt = buildHazardSnapshot(new Date(`${committed.generatedAt}T00:00:00Z`));

    // Compared on the registers alone: `generatedAt` moves with every
    // regeneration and would make this a test of the clock.
    expect(committed.registers).toEqual(rebuilt.registers);
    expect(committed.counts).toEqual(rebuilt.counts);
  });

  it("surfaces every uncontrolled hazard with the register it came from", () => {
    const snapshot = loadHazardSnapshot();
    const uncontrolled = unmitigatedHazards(snapshot);

    expect(uncontrolled).toHaveLength(snapshot.counts.unmitigated);
    expect(uncontrolled.every((entry) => entry.register.name.length > 0)).toBe(true);
  });

  it("names the areas with no register at all", () => {
    expect(missingRegisters(loadHazardSnapshot()).map((register) => register.name)).toEqual(["Ward Flow"]);
  });

  it("breaks a register down without losing a row to an unrecognised status", () => {
    const snapshot = loadHazardSnapshot();
    for (const register of snapshot.registers) {
      const total = statusBreakdown(register).reduce((sum, entry) => sum + entry.count, 0);
      expect(total).toBe(register.hazards.length);
    }
  });

  it("labels the three known statuses in plain words and leaves an unknown one alone", () => {
    expect(statusLabel("unmitigated")).toBe("No control");
    expect(statusLabel("partial")).toBe("Partial control");
    expect(statusLabel("controlled-unreviewed")).toBe("Controlled, unreviewed");
    expect(statusLabel("something new")).toBe("something new");
  });
});
