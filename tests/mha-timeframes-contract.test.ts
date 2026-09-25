import { describe, expect, it } from "vitest";

import formsCatalog from "../data/forms-catalog.json";
import mhaSectionSummaries from "../data/mha-2014-sections.json";
import mhaSectionSource from "../data/mha-2014-sections.source.json";
import mhaTimeframes from "../data/mha-timeframes.json";
import {
  normaliseActText,
  timeframeContentSha256,
  timeframeContractProblems,
  timelineFor,
  type MhaTimeframeEntry,
  type MhaTimeframesFile,
} from "@/lib/mha-timeline";

/**
 * The owner's rule for the Mental Health Act timeline: a statutory time limit may appear only
 * as a verbatim quote from the pinned Act text, and the one figure the engine counts with must
 * be written, digit for digit, inside that quote. Nothing in this file may be paraphrased
 * from memory. These tests are the gate that makes that rule mechanical.
 */

const file = mhaTimeframes as MhaTimeframesFile;
const sourceSections = mhaSectionSource.sections.map(({ section, text, textSha256 }) => ({
  section,
  text,
  textSha256,
}));
const knownFormCodes = formsCatalog.forms.map((form) => form.form);
const sectionSha = (section: string) => sourceSections.find((entry) => entry.section === section)!.textSha256;

function drafted(overrides: Partial<MhaTimeframeEntry> = {}): MhaTimeframeEntry {
  return {
    id: "test-entry",
    formCodes: ["2"],
    trigger: "Test trigger",
    section: "34",
    sourceTextSha256: sectionSha("34"),
    quote: "for up to 6 hours from the time when the order was made",
    duration: { value: 6, unit: "hours" },
    anchor: "The time the order was made",
    status: "drafted",
    reviewedBy: null,
    reviewedAt: null,
    reviewedContentSha256: null,
    ...overrides,
  };
}

/** Sign an entry the way `npm run clinical:review` does (the pin is proven against it below). */
function signed(entry: MhaTimeframeEntry): MhaTimeframeEntry {
  const next: MhaTimeframeEntry = {
    ...entry,
    status: "reviewed",
    reviewedBy: "Fixture Reviewer",
    reviewedAt: "2026-09-25T02:00:00Z",
    reviewedContentSha256: null,
  };
  return { ...next, reviewedContentSha256: timeframeContentSha256(next) };
}

describe("data/mha-timeframes.json contract", () => {
  it("has the agreed export metadata, pinned to the same Act version as the section summaries", () => {
    expect(file.exportMetadata.format).toBe("mha-timeframes");
    expect(file.exportMetadata.formatVersion).toBe(1);
    expect(file.exportMetadata.actVersion).toBe(mhaSectionSummaries.exportMetadata.actVersion);
    expect(file.exportMetadata.actAsAt).toBe(mhaSectionSummaries.exportMetadata.actAsAt);
    expect(file.exportMetadata.actVersion).toBe(mhaSectionSource.exportMetadata.actVersion);
  });

  it("has at least one entry, every one of them passing the contract", () => {
    expect(file.entries.length).toBeGreaterThan(0);
    expect(timeframeContractProblems(file.entries, sourceSections, knownFormCodes)).toEqual([]);
  });

  it.each(file.entries.map((entry) => [entry.id, entry] as const))(
    "%s quotes its pinned section verbatim and states its duration inside the quote",
    (_id, entry) => {
      const section = mhaSectionSource.sections.find((candidate) => candidate.section === entry.section);
      expect(section, `section ${entry.section} is not in the pinned Act text`).toBeDefined();
      expect(normaliseActText(section!.text)).toContain(normaliseActText(entry.quote));
      expect(entry.sourceTextSha256).toBe(section!.textSha256);
      expect(entry.quote).toContain(`${entry.duration.value}`);
      for (const code of entry.formCodes) expect(knownFormCodes).toContain(code);
    },
  );

  it("carries a valid pin on every reviewed entry, and empty reviewer fields on every drafted one", () => {
    for (const entry of file.entries) {
      if (entry.status === "reviewed") {
        expect(entry.reviewedBy, entry.id).toEqual(expect.any(String));
        expect(entry.reviewedAt, entry.id).toMatch(/Z$/);
        expect(entry.reviewedContentSha256, entry.id).toBe(timeframeContentSha256(entry));
      } else {
        expect(entry.status, entry.id).toBe("drafted");
        expect(entry.reviewedBy, entry.id).toBeNull();
        expect(entry.reviewedAt, entry.id).toBeNull();
        expect(entry.reviewedContentSha256, entry.id).toBeNull();
      }
    }
  });

  it("keeps entry ids unique", () => {
    const ids = file.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every s 28 limit (the 24-hour order and both ceilings) quote-only, with the s 28(11) caveat", () => {
    // Controller ruling: each is also ended by referral expiry (s 28(11)), which the single
    // "When was this made?" time cannot see. The owner may relax this later.
    const s28 = file.entries.filter((entry) => entry.section === "28");
    expect(s28.map((entry) => entry.id).sort()).toEqual([
      "form-3a-continuous-limit-metropolitan",
      "form-3a-continuous-limit-non-metropolitan",
      "form-3a-detention-to-take-person",
    ]);
    for (const entry of s28) {
      expect(entry.computeAllowed).toBe(false);
      expect(entry.caveat?.quote).toMatch(/^The person cannot continue to be detained if the referral expires/);
    }
  });

  it("never yields a deadline for a computeAllowed:false entry, even once it is signed off", () => {
    const blocked = file.entries.filter((entry) => entry.computeAllowed === false);
    expect(blocked.length).toBeGreaterThan(0);
    const signedOff = blocked.map(signed);
    for (const entry of signedOff) {
      expect(timeframeContractProblems([entry], sourceSections, knownFormCodes)).toEqual([]);
      for (const code of entry.formCodes) {
        for (const item of timelineFor(code, new Date("2026-09-25T02:00:00Z"), signedOff)) {
          expect(item).toEqual(expect.objectContaining({ quoteOnly: true, reason: "not-calculable" }));
          expect(item).not.toHaveProperty("deadline");
        }
      }
    }
  });

  it("states the Form 5A and section 62 conditions on the entries they limit", () => {
    const byId = new Map(file.entries.map((entry) => [entry.id, entry]));
    expect(byId.get("form-5a-confirmation")?.condition).toMatch(
      /^Only if this community treatment order was made under section 75/,
    );
    expect(byId.get("form-3d-6b-continuous-limit")?.trigger).toMatch(/if a section 62 order is made/);
    expect(byId.get("form-3d-6b-detention-to-take-person")?.condition).toMatch(/section 62\(1\)/);
  });
});

describe("timeframeContentSha256 mirrors the sign-off tool", () => {
  it("reproduces a digest computed by scripts/lib/clinical-record-review-contract.mjs (timeframe kind)", () => {
    // Computed by recordContentSha256(fixture, "timeframe") from the sign-off tool on branch
    // claude/sweet-carson-e7ur0s-wa-signoff (commit fafe0abd0). Review fields are excluded; every
    // other field, nested objects included, is key-sorted and hashed.
    const fixture: MhaTimeframeEntry = {
      id: "fixture",
      formCodes: ["X1"],
      trigger: "T",
      section: "1",
      sourceTextSha256: "a".repeat(64),
      leadIn: "Lead —",
      quote: "q 24 hours",
      duration: { value: 24, unit: "hours" },
      anchor: "A",
      caveat: { section: "1", quote: "c" },
      computeAllowed: false,
      status: "reviewed",
      reviewedBy: "Fixture Reviewer",
      reviewedAt: "2026-09-25T02:00:00Z",
      reviewedContentSha256: null,
    };
    const expected = "3a1bf79fefff4f1c8193ff0a5f414b396083da81758951838db81a6b31975c41";
    expect(timeframeContentSha256(fixture)).toBe(expected);
    // The review fields are outside the pin.
    expect(timeframeContentSha256({ ...fixture, status: "drafted", reviewedBy: null, reviewedAt: null })).toBe(
      expected,
    );
    // Key order does not matter; content does.
    const reordered = Object.fromEntries(Object.entries(fixture).reverse()) as MhaTimeframeEntry;
    expect(timeframeContentSha256(reordered)).toBe(expected);
    expect(timeframeContentSha256({ ...fixture, anchor: "B" })).not.toBe(expected);
  });
});

describe("timeframeContractProblems (the checker itself)", () => {
  const check = (entry: MhaTimeframeEntry) => timeframeContractProblems([entry], sourceSections, knownFormCodes);

  it("accepts a well-formed drafted entry", () => {
    expect(check(drafted())).toEqual([]);
  });

  it("rejects an invented quote that is not in the Act text", () => {
    const invented = drafted({
      quote: "The voluntary inpatient can be detained for up to 12 hours from the time when the order was made",
      duration: { value: 12, unit: "hours" },
    });
    expect(check(invented).join("\n")).toMatch(/not a verbatim substring/);
  });

  it("rejects a duration that the quote does not state", () => {
    expect(check(drafted({ duration: { value: 8, unit: "hours" } })).join("\n")).toMatch(/exactly one duration/);
  });

  it("rejects a quote that states more than one duration", () => {
    const quote =
      "The person cannot be detained under orders made under this section for a continuous period of more than — (a)if the place where the referral is made is in a metropolitan area — 72 hours; or (b)if the place where the referral is made is outside a metropolitan area — 144 hours";
    const entry = drafted({
      section: "28",
      sourceTextSha256: sectionSha("28"),
      formCodes: ["3A"],
      quote,
      duration: { value: 144, unit: "hours" },
    });
    expect(check(entry).join("\n")).toMatch(/exactly one duration/);
  });

  it("does not let a longer number satisfy a shorter one", () => {
    const quote = "(b)if the place where the referral is made is outside a metropolitan area — 144 hours";
    const entry = drafted({
      section: "28",
      sourceTextSha256: sectionSha("28"),
      formCodes: ["3A"],
      quote,
      duration: { value: 44, unit: "hours" },
    });
    expect(check(entry).join("\n")).toMatch(/exactly one duration/);
  });

  it("rejects the days unit until the owner rules on day-reckoning", () => {
    expect(check(drafted({ duration: { value: 6, unit: "days" } })).join("\n")).toMatch(
      /"days" is not accepted until the owner rules/,
    );
  });

  it("rejects a section that is not in the pinned Act text", () => {
    expect(check(drafted({ section: "9999" })).join("\n")).toMatch(/not in the pinned Act text/);
  });

  it("rejects a sourceTextSha256 that does not match the pinned section (Act text refreshed)", () => {
    expect(check(drafted({ sourceTextSha256: "0".repeat(64) })).join("\n")).toMatch(/sourceTextSha256 does not match/);
  });

  it("checks a leadIn: verbatim, before the quote, and stating no duration", () => {
    const base = {
      section: "28",
      sourceTextSha256: sectionSha("28"),
      formCodes: ["3A"],
      quote: "(b)if the place where the referral is made is outside a metropolitan area — 144 hours",
      duration: { value: 144, unit: "hours" as const },
    };
    const leadIn =
      "The person cannot be detained under orders made under this section for a continuous period of more than —";
    expect(check(drafted({ ...base, leadIn }))).toEqual([]);
    expect(check(drafted({ ...base, leadIn: "The person may be detained for ever —" })).join("\n")).toMatch(
      /leadIn is not a verbatim substring/,
    );
    expect(
      check(drafted({ ...base, leadIn: "The person cannot continue to be detained if the referral expires" })).join(
        "\n",
      ),
    ).toMatch(/leadIn must come before the quote/);
    expect(
      check(drafted({ ...base, leadIn: "for up to 24 hours from the time when the order is made" })).join("\n"),
    ).toMatch(/leadIn must not state a duration/);
  });

  it("checks a caveat is verbatim from the entry's own section", () => {
    expect(
      check(drafted({ caveat: { section: "34", quote: "The voluntary inpatient cannot continue to be detained" } })),
    ).toEqual([]);
    expect(check(drafted({ caveat: { section: "34", quote: "Invented caveat text" } })).join("\n")).toMatch(
      /caveat is not a verbatim substring/,
    );
    expect(
      check(drafted({ caveat: { section: "28", quote: "The person cannot continue to be detained" } })).join("\n"),
    ).toMatch(/caveat must quote the entry's own section/);
  });

  it("rejects an unknown form code", () => {
    expect(check(drafted({ formCodes: ["99Z"] })).join("\n")).toMatch(/unknown form code/);
  });

  it("rejects a drafted entry that carries reviewer fields", () => {
    expect(check(drafted({ reviewedBy: "Someone" })).join("\n")).toMatch(/drafted entry must not carry/);
    expect(check(drafted({ reviewedAt: "2026-09-25T02:00:00Z" })).join("\n")).toMatch(/drafted entry must not carry/);
  });

  it("accepts a correctly signed entry", () => {
    expect(check(signed(drafted()))).toEqual([]);
  });

  it("rejects a reviewed entry with no named reviewer, a non-UTC time, or no pin", () => {
    expect(check({ ...signed(drafted()), reviewedBy: " " }).join("\n")).toMatch(/needs reviewedBy/);
    expect(check({ ...signed(drafted()), reviewedAt: "2026-09-25" }).join("\n")).toMatch(/UTC ISO timestamp/);
    expect(check({ ...signed(drafted()), reviewedContentSha256: null }).join("\n")).toMatch(
      /reviewedContentSha256 pin/,
    );
  });

  it("rejects a reviewed entry edited after sign-off", () => {
    const edited = { ...signed(drafted()), anchor: "A different start event" };
    expect(check(edited).join("\n")).toMatch(/content changed since sign-off/);
  });

  it("rejects an unsupported unit, a non-positive value and an unknown status", () => {
    expect(check(drafted({ duration: { value: 6, unit: "minutes" as unknown as "hours" } })).join("\n")).toMatch(
      /unit/,
    );
    expect(check(drafted({ duration: { value: 0, unit: "hours" } })).join("\n")).toMatch(/positive whole number/);
    expect(check(drafted({ status: "adopted" as unknown as "drafted" })).join("\n")).toMatch(/status/);
  });

  it("rejects duplicate ids across entries", () => {
    expect(timeframeContractProblems([drafted(), drafted()], sourceSections, knownFormCodes).join("\n")).toMatch(
      /duplicate id/,
    );
  });
});
