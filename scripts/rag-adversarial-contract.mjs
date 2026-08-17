/**
 * rag-adversarial-contract.mjs — pure validation for the RAG adversarial fixture
 * dataset and its baseline record (programme packet B0,
 * docs/rag-improvement/README.md §B0).
 *
 * Deliberately dependency-free and network-free: every export is a pure function
 * over already-parsed JSON, so the CLI (scripts/check-rag-adversarial-fixtures.mjs)
 * and the unit suite (tests/rag-adversarial-fixtures.test.ts) exercise identical
 * logic. There is no JSON Schema runtime in this repository and none may be added
 * for this file; scripts/fixtures/rag-adversarial-cases.schema.json publishes the
 * shape and this module enforces it.
 *
 * The rules a JSON Schema cannot express are the reason this file exists:
 *  - every declared canary is actually planted, and every planted canary is declared;
 *  - canary tokens never appear in an assertion list a runner would echo;
 *  - excerpts carry synthetic provenance and cannot name a real clinical source;
 *  - allowed citations are a subset of the case's own retrieved chunks;
 *  - a baseline gate result is either recorded with evidence or explicitly pending.
 */

export const adversarialCategories = Object.freeze([
  "prompt_injection",
  "citation_fabrication",
  "unsupported_claim",
  "empty_or_conflicting_evidence",
  "scope_or_tenant",
  "provider_failure",
  "adversarial_metadata",
  "cost_or_timeout_abuse",
]);

export const expectedBehaviours = Object.freeze([
  "answer_from_evidence",
  "answer_with_conflict_surfaced",
  "abstain",
  "refuse",
  "degrade_source_only",
  "error_contained",
]);

export const canaryKinds = Object.freeze([
  "patient_name",
  "medical_record_number",
  "date_of_birth",
  "phone_number",
  "address",
  "email_address",
]);

/**
 * Tokens that identify a real clinical source. A synthetic fixture that names one
 * has stopped being synthetic, so their presence is a hard failure rather than a
 * warning. Matched case-sensitively on word boundaries: the acronyms are only
 * meaningful in upper case, and lowering the match would reject ordinary prose.
 */
export const realSourceDenylist = Object.freeze([
  "EMHS",
  "RANZCP",
  "NICE",
  "Maudsley",
  "eTG",
  "Therapeutic Guidelines",
  "Australian Medicines Handbook",
  "Royal Perth",
  "Fiona Stanley",
  "WA Health",
]);

export const requiredBaselineGateIds = Object.freeze([
  "retrieval_golden",
  "answer_gate",
  "answer_quality",
  "offline_contract",
]);

/** The report-key field set, in the order every programme report must emit them. */
export const reportKeyFields = Object.freeze([
  "commit_sha",
  "dataset_version",
  "eval_config_version",
  "model_version",
  "embedding_version",
  "index_version",
]);

// Letters only, deliberately. A canary shaped like a real identifier — digits in
// an MRN or phone body — reads as a high-entropy secret to the repository's secret
// scanners, and both Gitleaks and GitGuardian flagged exactly that on this file's
// first push. A canary must be conspicuously non-secret, so the category is carried
// in words and no digit may appear in a token.
const CANARY_TOKEN = /^CANARY-[A-Z]+(?:-[A-Z]+)+$/;
const CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHUNK_ID = /^syn-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Required-field check that names the missing key, so drift tests can assert on it. */
function missingFields(value, required, label, failures) {
  for (const field of required) {
    if (!isObject(value) || !(field in value)) failures.push(`${label}: missing required field '${field}'`);
  }
}

/** Every canary token declared in the dataset registry. */
export function collectCanaryTokens(dataset) {
  if (!isObject(dataset) || !Array.isArray(dataset.canaryRegistry)) return [];
  return dataset.canaryRegistry.map((entry) => (isObject(entry) ? entry.token : entry)).filter(hasText);
}

/**
 * Canary tokens that appear literally in `text`. Used both to prove a case plants
 * what it declares and to prove a report leaks nothing.
 */
export function findCanaryLeaks(text, tokens) {
  if (typeof text !== "string") return [];
  return tokens.filter((token) => text.includes(token));
}

/** Real-source tokens appearing in `text`, matched on word boundaries. */
export function findRealSourceMentions(text) {
  if (typeof text !== "string") return [];
  return realSourceDenylist.filter((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text));
}

function validateRegistry(dataset, failures) {
  const registry = dataset.canaryRegistry;
  if (!Array.isArray(registry) || registry.length === 0) {
    failures.push("canaryRegistry must be a non-empty array");
    return;
  }
  const seen = new Set();
  registry.forEach((entry, index) => {
    const label = `canaryRegistry[${index}]`;
    missingFields(entry, ["token", "kind", "note"], label, failures);
    if (!isObject(entry)) return;
    if (!hasText(entry.token) || !CANARY_TOKEN.test(entry.token)) {
      failures.push(`${label}: token must match ${CANARY_TOKEN} so detection is an exact literal scan`);
    } else if (seen.has(entry.token)) {
      failures.push(`${label}: duplicate canary token ${entry.token}`);
    } else {
      seen.add(entry.token);
    }
    if (!canaryKinds.includes(entry.kind)) failures.push(`${label}: kind must be one of ${canaryKinds.join(", ")}`);
    if (!hasText(entry.note)) failures.push(`${label}: note is required`);
  });
}

function caseTextFragments(item) {
  const fragments = [item.query, item.title, item.rationale];
  if (Array.isArray(item.evidence)) {
    for (const excerpt of item.evidence) {
      if (!isObject(excerpt)) continue;
      fragments.push(excerpt.documentTitle, excerpt.text);
    }
  }
  return fragments.filter((fragment) => typeof fragment === "string");
}

function validateCase(item, index, tokens, seenIds, failures) {
  const label = isObject(item) && hasText(item.id) ? `cases[${index}] (${item.id})` : `cases[${index}]`;
  missingFields(
    item,
    ["id", "category", "title", "query", "evidence", "canaries", "expect", "rationale"],
    label,
    failures,
  );
  if (!isObject(item)) {
    failures.push(`${label}: case must be an object`);
    return;
  }

  if (!hasText(item.id) || !CASE_ID.test(item.id)) failures.push(`${label}: id must be lowercase kebab-case`);
  else if (seenIds.has(item.id)) failures.push(`${label}: duplicate case id`);
  else seenIds.add(item.id);

  if (!adversarialCategories.includes(item.category)) {
    failures.push(`${label}: category must be one of ${adversarialCategories.join(", ")}`);
  }
  if (!hasText(item.title)) failures.push(`${label}: title is required`);
  if (!hasText(item.query)) failures.push(`${label}: query is required`);
  if (!hasText(item.rationale)) failures.push(`${label}: rationale is required`);

  const chunkIds = new Set();
  if (!Array.isArray(item.evidence)) {
    failures.push(`${label}: evidence must be an array`);
  } else {
    if (item.evidence.length === 0 && item.category !== "empty_or_conflicting_evidence") {
      failures.push(`${label}: only empty_or_conflicting_evidence cases may retrieve no excerpts`);
    }
    item.evidence.forEach((excerpt, excerptIndex) => {
      const excerptLabel = `${label}.evidence[${excerptIndex}]`;
      missingFields(excerpt, ["chunkId", "documentTitle", "text"], excerptLabel, failures);
      if (!isObject(excerpt)) return;
      if (!hasText(excerpt.chunkId) || !CHUNK_ID.test(excerpt.chunkId)) {
        failures.push(`${excerptLabel}: chunkId must match ${CHUNK_ID}`);
      } else if (chunkIds.has(excerpt.chunkId)) {
        failures.push(`${excerptLabel}: duplicate chunkId ${excerpt.chunkId}`);
      } else {
        chunkIds.add(excerpt.chunkId);
      }
      if (!hasText(excerpt.documentTitle) || !excerpt.documentTitle.startsWith("SYNTHETIC ")) {
        failures.push(`${excerptLabel}: documentTitle must start with 'SYNTHETIC ' to assert synthetic provenance`);
      }
      if (!hasText(excerpt.text)) failures.push(`${excerptLabel}: text is required`);
    });
  }

  // Synthetic-only boundary: no fixture may name a real clinical source.
  for (const fragment of caseTextFragments(item)) {
    for (const mention of findRealSourceMentions(fragment)) {
      failures.push(`${label}: names real clinical source '${mention}' — fixtures are synthetic only`);
    }
  }

  // Canaries: declared exactly when planted, in both directions.
  const planted = new Set();
  for (const fragment of caseTextFragments(item)) {
    for (const token of findCanaryLeaks(fragment, tokens)) planted.add(token);
  }
  if (!Array.isArray(item.canaries)) {
    failures.push(`${label}: canaries must be an array`);
  } else {
    for (const token of item.canaries) {
      if (!tokens.includes(token)) failures.push(`${label}: canary ${token} is not in canaryRegistry`);
      else if (!planted.has(token))
        failures.push(`${label}: canary ${token} is declared but never planted in the case`);
    }
    for (const token of planted) {
      if (!item.canaries.includes(token)) failures.push(`${label}: canary ${token} is planted but not declared`);
    }
  }

  const expectation = item.expect;
  missingFields(
    expectation,
    ["behaviour", "allowedCitationChunkIds", "forbiddenOutputSubstrings"],
    `${label}.expect`,
    failures,
  );
  if (!isObject(expectation)) {
    failures.push(`${label}.expect: must be an object`);
    return;
  }
  if (!expectedBehaviours.includes(expectation.behaviour)) {
    failures.push(`${label}.expect: behaviour must be one of ${expectedBehaviours.join(", ")}`);
  }
  if (!Array.isArray(expectation.allowedCitationChunkIds)) {
    failures.push(`${label}.expect: allowedCitationChunkIds must be an array`);
  } else {
    for (const chunkId of expectation.allowedCitationChunkIds) {
      if (!chunkIds.has(chunkId)) {
        failures.push(`${label}.expect: allowedCitationChunkIds references ${chunkId}, which the case never retrieves`);
      }
    }
  }
  if (!Array.isArray(expectation.forbiddenOutputSubstrings)) {
    failures.push(`${label}.expect: forbiddenOutputSubstrings must be an array`);
  } else {
    for (const substring of expectation.forbiddenOutputSubstrings) {
      if (!hasText(substring)) {
        failures.push(`${label}.expect: forbiddenOutputSubstrings contains an empty entry`);
        continue;
      }
      // A runner reporting "output must not contain X" prints X. Canary absence is
      // asserted from the registry precisely so it never needs to be spelled out here.
      for (const token of findCanaryLeaks(substring, tokens)) {
        failures.push(`${label}.expect: forbiddenOutputSubstrings must not contain canary ${token}`);
      }
    }
  }
}

/** Validate the adversarial fixture dataset. Returns a list of failures. */
export function validateAdversarialDataset(dataset) {
  const failures = [];
  if (!isObject(dataset)) return ["adversarial dataset must be an object"];

  missingFields(
    dataset,
    ["datasetVersion", "synthetic", "description", "canaryRegistry", "cases"],
    "dataset",
    failures,
  );
  if (dataset.datasetVersion !== "rag-adversarial-cases.v1") {
    failures.push("dataset: datasetVersion must be 'rag-adversarial-cases.v1' and match the fixture filename");
  }
  if (dataset.synthetic !== true) failures.push("dataset: synthetic must be exactly true");
  if (!hasText(dataset.description)) failures.push("dataset: description is required");

  validateRegistry(dataset, failures);
  const tokens = collectCanaryTokens(dataset);

  if (!Array.isArray(dataset.cases)) {
    failures.push("dataset: cases must be an array");
    return failures;
  }
  if (dataset.cases.length < 20 || dataset.cases.length > 30) {
    failures.push(`dataset: cases must contain 20-30 entries (found ${dataset.cases.length})`);
  }

  const seenIds = new Set();
  dataset.cases.forEach((item, index) => validateCase(item, index, tokens, seenIds, failures));

  // Category coverage: the eight categories are the contract, not a suggestion.
  const perCategory = new Map(adversarialCategories.map((category) => [category, 0]));
  for (const item of dataset.cases) {
    if (isObject(item) && perCategory.has(item.category))
      perCategory.set(item.category, perCategory.get(item.category) + 1);
  }
  for (const [category, count] of perCategory) {
    if (count < 2) failures.push(`dataset: category ${category} needs at least 2 cases (found ${count})`);
  }

  // Canary breadth: a leak test that only exercises one category proves little, and
  // an unplanted registry entry is dead weight that silently stops testing anything.
  const canaryCategories = new Set();
  const plantedTokens = new Set();
  for (const item of dataset.cases) {
    if (!isObject(item) || !Array.isArray(item.canaries) || item.canaries.length === 0) continue;
    canaryCategories.add(item.category);
    for (const token of item.canaries) plantedTokens.add(token);
  }
  if (canaryCategories.size < 4) {
    failures.push(`dataset: canaries must be planted across at least 4 categories (found ${canaryCategories.size})`);
  }
  for (const token of tokens) {
    if (!plantedTokens.has(token)) failures.push(`dataset: registry canary ${token} is never planted in any case`);
  }

  return failures;
}

/**
 * Validate the baseline record. `context` carries values read from the repository
 * by the CLI so this function stays pure: `{ promptVersion, datasetVersion }`.
 */
export function validateBaselineRecord(record, context = {}) {
  const failures = [];
  if (!isObject(record)) return ["baseline record must be an object"];

  missingFields(
    record,
    ["baselineVersion", "capturedAt", "promptVersion", "semanticRerankEnabled", "reportKey", "gates"],
    "baseline",
    failures,
  );

  if (record.baselineVersion !== "rag-adversarial-baseline.v1") {
    failures.push("baseline: baselineVersion must be 'rag-adversarial-baseline.v1'");
  }
  if (!hasText(record.capturedAt)) failures.push("baseline: capturedAt is required");
  if (record.semanticRerankEnabled !== false) {
    failures.push("baseline: semanticRerankEnabled must be false — issue #001 keeps the semantic reranker off");
  }
  if (hasText(context.promptVersion) && record.promptVersion !== context.promptVersion) {
    failures.push(
      `baseline: promptVersion '${record.promptVersion}' does not match src/lib/rag/rag-versioning.ts ('${context.promptVersion}')`,
    );
  }

  const key = record.reportKey;
  if (!isObject(key)) {
    failures.push("baseline: reportKey must be an object");
  } else {
    const actual = Object.keys(key);
    if (actual.length !== reportKeyFields.length || actual.some((field, index) => field !== reportKeyFields[index])) {
      failures.push(`baseline.reportKey: fields must be exactly ${reportKeyFields.join(", ")} in that order`);
    }
    for (const field of reportKeyFields) {
      if (!hasText(key[field])) failures.push(`baseline.reportKey: ${field} is required`);
    }
    if (hasText(key.commit_sha) && !COMMIT_SHA.test(key.commit_sha)) {
      failures.push("baseline.reportKey: commit_sha must be a full 40-character lowercase SHA");
    }
    if (hasText(context.datasetVersion) && key.dataset_version !== context.datasetVersion) {
      failures.push(
        `baseline.reportKey: dataset_version '${key.dataset_version}' does not match the fixture dataset ('${context.datasetVersion}')`,
      );
    }
  }

  if (!Array.isArray(record.gates) || record.gates.length === 0) {
    failures.push("baseline: gates must be a non-empty array");
    return failures;
  }
  const seenGateIds = new Set();
  record.gates.forEach((gate, index) => {
    const label = isObject(gate) && hasText(gate.id) ? `baseline.gates (${gate.id})` : `baseline.gates[${index}]`;
    missingFields(gate, ["id", "caseCount", "status"], label, failures);
    if (!isObject(gate)) return;
    if (hasText(gate.id)) {
      if (seenGateIds.has(gate.id)) failures.push(`${label}: duplicate gate id`);
      seenGateIds.add(gate.id);
    }
    if (!Number.isInteger(gate.caseCount) || gate.caseCount < 1)
      failures.push(`${label}: caseCount must be a positive integer`);
    // A number without a run behind it is the failure mode this record exists to
    // prevent, so a gate is either recorded with evidence or explicitly pending.
    if (gate.status === "recorded") {
      if (!hasText(gate.result)) failures.push(`${label}: a recorded gate must carry its result`);
      if (!hasText(gate.evidence)) failures.push(`${label}: a recorded gate must cite the run or file it came from`);
    } else if (gate.status === "pending_owner_run") {
      if (!hasText(gate.blockedReason)) failures.push(`${label}: a pending gate must state why it has not run`);
      if ("result" in gate) failures.push(`${label}: a pending gate must not carry a result`);
      // `priorRun` is history from another commit, never a stand-in for a result at
      // this one — so it is optional, but it must say which run it refers to.
      if ("priorRun" in gate && !hasText(gate.priorRun))
        failures.push(`${label}: priorRun must name the run it refers to`);
    } else {
      failures.push(`${label}: status must be 'recorded' or 'pending_owner_run'`);
    }
  });
  for (const required of requiredBaselineGateIds) {
    if (!seenGateIds.has(required)) failures.push(`baseline.gates: missing required gate '${required}'`);
  }

  return failures;
}

/**
 * Build the human-readable report. Only ids, counts and gate statuses are emitted —
 * never case text, excerpt text, or a canary. The caller asserts that separately
 * with `findCanaryLeaks`, so a future edit that widens this output fails loudly.
 */
export function buildReport(dataset, baseline) {
  const lines = [];
  const perCategory = new Map(adversarialCategories.map((category) => [category, 0]));
  for (const item of dataset.cases) perCategory.set(item.category, (perCategory.get(item.category) ?? 0) + 1);

  lines.push(
    `Adversarial fixture contract passed (${dataset.cases.length} synthetic cases, ` +
      `${adversarialCategories.length} categories, ${collectCanaryTokens(dataset).length} canaries).`,
  );
  for (const [category, count] of perCategory) lines.push(`- ${category}: ${count} case(s)`);
  lines.push(
    `Baseline ${baseline.baselineVersion} captured ${baseline.capturedAt} at ${baseline.reportKey.commit_sha}.`,
  );
  for (const gate of baseline.gates) lines.push(`- gate ${gate.id} (${gate.caseCount} cases): ${gate.status}`);
  return lines.join("\n");
}
