import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adversarialCategories,
  buildReport,
  collectCanaryTokens,
  findCanaryLeaks,
  findRealSourceMentions,
  reportKeyFields,
  requiredBaselineGateIds,
  validateAdversarialDataset,
  validateBaselineRecord,
} from "../scripts/rag-adversarial-contract.mjs";

const datasetPath = "scripts/fixtures/rag-adversarial-cases.v1.json";
const baselinePath = "scripts/fixtures/rag-adversarial-baseline.v1.json";
const schemaPath = "scripts/fixtures/rag-adversarial-cases.schema.json";

const readJson = (relativePath: string) => JSON.parse(readFileSync(relativePath, "utf8"));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const dataset = readJson(datasetPath);
const baseline = readJson(baselinePath);
const schema = readJson(schemaPath);
const promptVersion =
  readFileSync("src/lib/rag/rag-versioning.ts", "utf8").match(/ragAnswerPromptVersion\s*=\s*"([^"]+)"/)?.[1] ?? "";

describe("RAG adversarial fixture contract", () => {
  it("accepts the committed dataset and baseline", () => {
    expect(validateAdversarialDataset(dataset)).toEqual([]);
    expect(validateBaselineRecord(baseline, { promptVersion, datasetVersion: dataset.datasetVersion })).toEqual([]);
  });

  it("covers every adversarial category the programme guide names", () => {
    const covered = new Set(dataset.cases.map((item: { category: string }) => item.category));
    expect([...covered].sort()).toEqual([...adversarialCategories].sort());
  });

  // The schema is the published contract and this module is the enforcer; nothing
  // else stops them drifting apart, so every key the schema calls required must
  // actually be rejected when it is missing.
  it("rejects every field the published schema marks required", () => {
    for (const field of schema.required) {
      const broken = clone(dataset);
      delete broken[field];
      expect(validateAdversarialDataset(broken)).toContain(`dataset: missing required field '${field}'`);
    }
    for (const field of schema.$defs.case.required) {
      const broken = clone(dataset);
      delete broken.cases[0][field];
      const label = field === "id" ? "cases[0]" : `cases[0] (${dataset.cases[0].id})`;
      expect(validateAdversarialDataset(broken)).toContain(`${label}: missing required field '${field}'`);
    }
    for (const field of schema.$defs.evidence.required) {
      const broken = clone(dataset);
      delete broken.cases[0].evidence[0][field];
      expect(validateAdversarialDataset(broken)).toContain(
        `cases[0] (${dataset.cases[0].id}).evidence[0]: missing required field '${field}'`,
      );
    }
    for (const field of schema.$defs.expect.required) {
      const broken = clone(dataset);
      delete broken.cases[0].expect[field];
      expect(validateAdversarialDataset(broken)).toContain(
        `cases[0] (${dataset.cases[0].id}).expect: missing required field '${field}'`,
      );
    }
  });

  // Gitleaks and GitGuardian both flagged the first version of these tokens as
  // high-entropy secrets because they carried MRN- and phone-shaped digit runs.
  // Keeping them digit-free is what stops that CI failure coming back.
  it("keeps every canary token digit-free so secret scanners cannot flag it", () => {
    for (const token of collectCanaryTokens(dataset)) expect(token).toMatch(/^CANARY-[A-Z]+(?:-[A-Z]+)+$/);

    // A single digit is enough to prove the rule. Built from two literals
    // rather than one contiguous string so the digit-bearing token this test
    // deliberately constructs never appears as a single scannable literal in
    // source — GitGuardian repeatedly flagged the earlier one-literal form.
    const digitBearing = clone(dataset);
    digitBearing.canaryRegistry[0].token = ["CANARY-PHI-MRN", "1"].join("-");
    expect(validateAdversarialDataset(digitBearing).join("\n")).toContain("canaryRegistry[0]: token must match");
  });

  it("rejects a canary that is planted but not declared, and one declared but not planted", () => {
    const token = collectCanaryTokens(dataset)[0]!;

    const undeclared = clone(dataset);
    undeclared.cases[0].evidence[0].text += ` Contact ${token}.`;
    expect(validateAdversarialDataset(undeclared)).toContain(
      `cases[0] (${dataset.cases[0].id}): canary ${token} is planted but not declared`,
    );

    const unplanted = clone(dataset);
    unplanted.cases[0].canaries = [token];
    expect(validateAdversarialDataset(unplanted)).toContain(
      `cases[0] (${dataset.cases[0].id}): canary ${token} is declared but never planted in the case`,
    );
  });

  it("refuses to let a canary be written into an assertion list a runner would echo", () => {
    const token = collectCanaryTokens(dataset)[0]!;
    const broken = clone(dataset);
    broken.cases[0].expect.forbiddenOutputSubstrings.push(token);
    expect(validateAdversarialDataset(broken)).toContain(
      `cases[0] (${dataset.cases[0].id}).expect: forbiddenOutputSubstrings must not contain canary ${token}`,
    );
  });

  it("rejects a fixture that names a real clinical source", () => {
    const broken = clone(dataset);
    broken.cases[0].evidence[0].text = "The EMHS protocol requires weekly bloods.";
    expect(validateAdversarialDataset(broken)).toContain(
      `cases[0] (${dataset.cases[0].id}): names real clinical source 'EMHS' — fixtures are synthetic only`,
    );
    expect(findRealSourceMentions("nice weather in a synthetic note")).toEqual([]);
  });

  it("rejects an excerpt without synthetic provenance and a citation the case never retrieved", () => {
    const spoofedTitle = clone(dataset);
    spoofedTitle.cases[0].evidence[0].documentTitle = "Community Mental Health Protocol";
    expect(validateAdversarialDataset(spoofedTitle)).toContain(
      `cases[0] (${dataset.cases[0].id}).evidence[0]: documentTitle must start with 'SYNTHETIC ' to assert synthetic provenance`,
    );

    const fabricatedCitation = clone(dataset);
    fabricatedCitation.cases[0].expect.allowedCitationChunkIds.push("syn-never-retrieved");
    expect(validateAdversarialDataset(fabricatedCitation)).toContain(
      `cases[0] (${dataset.cases[0].id}).expect: allowedCitationChunkIds references syn-never-retrieved, which the case never retrieves`,
    );
  });

  it("keeps every canary out of the reportable output", () => {
    const tokens = collectCanaryTokens(dataset);
    expect(tokens.length).toBeGreaterThan(0);
    expect(findCanaryLeaks(buildReport(dataset, baseline), tokens)).toEqual([]);
    // The scan itself has to work, or the assertion above is vacuous.
    expect(findCanaryLeaks(`prefix ${tokens[0]} suffix`, tokens)).toEqual([tokens[0]]);
  });

  it("never puts excerpt text or a query into the report", () => {
    const report = buildReport(dataset, baseline);
    for (const item of dataset.cases) {
      expect(report).not.toContain(item.query);
      for (const excerpt of item.evidence) expect(report).not.toContain(excerpt.text);
    }
  });
});

describe("RAG adversarial baseline record", () => {
  it("pins the report key field set and its order", () => {
    expect(Object.keys(baseline.reportKey)).toEqual([...reportKeyFields]);

    const reordered = clone(baseline);
    reordered.reportKey = Object.fromEntries(Object.entries(baseline.reportKey).reverse());
    expect(validateBaselineRecord(reordered, { promptVersion, datasetVersion: dataset.datasetVersion })).toContain(
      `baseline.reportKey: fields must be exactly ${reportKeyFields.join(", ")} in that order`,
    );
  });

  it("records every gate the programme baseline requires", () => {
    const ids = baseline.gates.map((gate: { id: string }) => gate.id);
    for (const required of requiredBaselineGateIds) expect(ids).toContain(required);
  });

  // The whole point of the record is that a number in it came from a run.
  it("rejects a pending gate that carries a result and a recorded gate without evidence", () => {
    const pendingWithResult = clone(baseline);
    const pending = pendingWithResult.gates.find((gate: { status: string }) => gate.status === "pending_owner_run");
    pending.result = "36/36";
    expect(
      validateBaselineRecord(pendingWithResult, { promptVersion, datasetVersion: dataset.datasetVersion }),
    ).toContain(`baseline.gates (${pending.id}): a pending gate must not carry a result`);

    const recordedWithoutEvidence = clone(baseline);
    const recorded = recordedWithoutEvidence.gates.find((gate: { status: string }) => gate.status === "recorded");
    delete recorded.evidence;
    expect(
      validateBaselineRecord(recordedWithoutEvidence, { promptVersion, datasetVersion: dataset.datasetVersion }),
    ).toContain(`baseline.gates (${recorded.id}): a recorded gate must cite the run or file it came from`);
  });

  it("goes red when the prompt version or the dataset version drifts", () => {
    expect(validateBaselineRecord(baseline, { promptVersion: "clinical-rag-answer-v99" })).toContain(
      `baseline: promptVersion '${baseline.promptVersion}' does not match src/lib/rag/rag-versioning.ts ('clinical-rag-answer-v99')`,
    );
    expect(validateBaselineRecord(baseline, { promptVersion, datasetVersion: "rag-adversarial-cases.v2" })).toContain(
      `baseline.reportKey: dataset_version '${baseline.reportKey.dataset_version}' does not match the fixture dataset ('rag-adversarial-cases.v2')`,
    );
  });

  it("holds the semantic reranker off, per issue #001", () => {
    expect(baseline.semanticRerankEnabled).toBe(false);
    const flipped = clone(baseline);
    flipped.semanticRerankEnabled = true;
    expect(validateBaselineRecord(flipped, { promptVersion, datasetVersion: dataset.datasetVersion })).toContain(
      "baseline: semanticRerankEnabled must be false — issue #001 keeps the semantic reranker off",
    );
  });
});
