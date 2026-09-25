import { describe, expect, it } from "vitest";

import formsCatalog from "../data/forms-catalog.json";
import mhaSectionSummaries from "../data/mha-2014-sections.json";
import mhaSectionSource from "../data/mha-2014-sections.source.json";
import mhaTimeframes from "../data/mha-timeframes.json";
import {
  normaliseActText,
  timeframeContractProblems,
  type MhaTimeframeEntry,
  type MhaTimeframesFile,
} from "@/lib/mha-timeline";

/**
 * The owner's rule for the Mental Health Act timeline: a statutory time limit may appear only
 * as a verbatim quote from the pinned Act text, and every figure the engine counts with must
 * be written, digit for digit, inside that quote. Nothing in this file may be paraphrased
 * from memory. These tests are the gate that makes that rule mechanical.
 */

const file = mhaTimeframes as MhaTimeframesFile;
const sourceSections = mhaSectionSource.sections.map(({ section, text }) => ({ section, text }));
const knownFormCodes = formsCatalog.forms.map((form) => form.form);

function drafted(overrides: Partial<MhaTimeframeEntry> = {}): MhaTimeframeEntry {
  return {
    id: "test-entry",
    formCodes: ["2"],
    trigger: "Test trigger",
    section: "34",
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
      const singular = entry.duration.unit.replace(/s$/, "");
      expect(entry.quote).toMatch(new RegExp(`(^|[^\\d])${entry.duration.value}(\\s+${singular}s?|-${singular})\\b`));
      for (const code of entry.formCodes) expect(knownFormCodes).toContain(code);
    },
  );

  it("records no sign-off: every entry an agent wrote is drafted with empty reviewer fields", () => {
    for (const entry of file.entries) {
      expect(entry.status).toBe("drafted");
      expect(entry.reviewedBy).toBeNull();
      expect(entry.reviewedAt).toBeNull();
      expect(entry.reviewedContentSha256).toBeNull();
    }
  });

  it("keeps entry ids unique", () => {
    const ids = file.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
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
    expect(check(drafted({ duration: { value: 8, unit: "hours" } })).join("\n")).toMatch(/does not state/);
    expect(check(drafted({ duration: { value: 6, unit: "days" } })).join("\n")).toMatch(/does not state/);
  });

  it("does not let a longer number satisfy a shorter one", () => {
    const quote = "(b)if the place where the referral is made is outside a metropolitan area — 144 hours";
    const entry = drafted({ section: "28", formCodes: ["3A"], quote, duration: { value: 44, unit: "hours" } });
    expect(check(entry).join("\n")).toMatch(/does not state/);
  });

  it("rejects a section that is not in the pinned Act text", () => {
    expect(check(drafted({ section: "9999" })).join("\n")).toMatch(/not in the pinned Act text/);
  });

  it("rejects an unknown form code", () => {
    expect(check(drafted({ formCodes: ["99Z"] })).join("\n")).toMatch(/unknown form code/);
  });

  it("rejects a drafted entry that carries reviewer fields", () => {
    expect(check(drafted({ reviewedBy: "Someone" })).join("\n")).toMatch(/drafted entry must not carry/);
    expect(check(drafted({ reviewedAt: "2026-09-25" })).join("\n")).toMatch(/drafted entry must not carry/);
  });

  it("rejects a reviewed entry with no named reviewer", () => {
    expect(check(drafted({ status: "reviewed" })).join("\n")).toMatch(/reviewed entry needs/);
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
