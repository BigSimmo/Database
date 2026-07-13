import { describe, expect, it, vi } from "vitest";
import {
  annotateChunkAssertions,
  assertionMetadataValue,
  defaultAssertionTargets,
  parseAssertionPayload,
  type AssertionScriptRunner,
} from "../worker/assertion-tagging";

// TS-side contract tests for flag-gated assertion tagging. The Python half
// (worker/python/analyze_assertions.py) is exercised by `npm run eval:assertions`
// locally — CI has no medspaCy, so every test here injects a fake runner.
// The load-bearing invariant is FAIL-OPEN: tagging must never throw into the
// ingestion job, whatever the subprocess does.

const VALID_PAYLOAD = JSON.stringify({
  assertions: [
    { id: "0", negated_terms: ["chest pain"], uncertain_terms: [], family_terms: [], historical_terms: [] },
    { id: "1", negated_terms: [], uncertain_terms: ["serotonin syndrome"], family_terms: [], historical_terms: [] },
  ],
  version: "1.3.1",
  warnings: [],
});

const CHUNKS = [
  { id: "0", text: "No chest pain reported." },
  { id: "1", text: "Query serotonin syndrome." },
];
const TARGETS = ["chest pain", "serotonin syndrome"];

describe("parseAssertionPayload", () => {
  it("parses a valid payload and defaults omitted arrays", () => {
    const parsed = parseAssertionPayload(JSON.stringify({ assertions: [{ id: "0" }] }));
    expect(parsed.assertions[0]).toEqual({
      id: "0",
      negated_terms: [],
      uncertain_terms: [],
      family_terms: [],
      historical_terms: [],
    });
    expect(parsed.warnings).toEqual([]);
  });

  it("throws on non-JSON and on shape violations", () => {
    expect(() => parseAssertionPayload("not json")).toThrow();
    expect(() => parseAssertionPayload(JSON.stringify({ assertions: [{ id: 5 }] }))).toThrow();
  });
});

describe("annotateChunkAssertions", () => {
  it("maps assertions by chunk id and stamps the medspaCy version", async () => {
    const runner: AssertionScriptRunner = vi.fn(async () => VALID_PAYLOAD);
    const result = await annotateChunkAssertions(CHUNKS, TARGETS, runner);

    expect(runner).toHaveBeenCalledWith({ chunks: CHUNKS, targets: TARGETS });
    expect(result.size).toBe(2);
    expect(result.get("0")).toEqual({
      negated_terms: ["chest pain"],
      uncertain_terms: [],
      family_terms: [],
      historical_terms: [],
      medspacy_version: "1.3.1",
    });
    expect(result.get("1")?.uncertain_terms).toEqual(["serotonin syndrome"]);
  });

  it("fails open to an empty map when the runner throws", async () => {
    const runner: AssertionScriptRunner = vi.fn(async () => {
      throw new Error("python exploded");
    });
    await expect(annotateChunkAssertions(CHUNKS, TARGETS, runner)).resolves.toEqual(new Map());
  });

  it("fails open to an empty map on garbage output", async () => {
    const runner: AssertionScriptRunner = vi.fn(async () => "Traceback (most recent call last): ...");
    await expect(annotateChunkAssertions(CHUNKS, TARGETS, runner)).resolves.toEqual(new Map());
  });

  it("skips the subprocess entirely for empty chunks or targets", async () => {
    const runner: AssertionScriptRunner = vi.fn(async () => VALID_PAYLOAD);
    await expect(annotateChunkAssertions([], TARGETS, runner)).resolves.toEqual(new Map());
    await expect(annotateChunkAssertions(CHUNKS, [], runner)).resolves.toEqual(new Map());
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("assertionMetadataValue", () => {
  it("normalizes a missing version to null for the jsonb column", () => {
    const value = assertionMetadataValue(
      { id: "0", negated_terms: ["x"], uncertain_terms: [], family_terms: [], historical_terms: [] },
      undefined,
    );
    expect(value.medspacy_version).toBeNull();
  });
});

describe("defaultAssertionTargets", () => {
  it("supplies lowercase vocabulary terms and excludes typo entries", () => {
    const targets = defaultAssertionTargets();
    expect(targets.length).toBeGreaterThan(50);
    expect(targets).toContain("clozapine");
    expect(targets).toContain("neuroleptic malignant syndrome");
    expect(targets.every((term) => term === term.toLowerCase())).toBe(true);
  });
});
