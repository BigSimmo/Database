# Platform contracts and readiness — implementation plan

> **Execution:** use subagent-driven development. One implementer owns each task; a separate adversarial reviewer checks the integrated diff. Do not commit, push, deploy, call providers, or apply migrations.

**Goal:** Make API/model payloads, privacy readiness, alerts, and clinical-hazard evidence machine-checkable without overstating external acceptance.

**Spec:** [`../specs/2026-08-23-clinical-operations-programme-design.md`](../specs/2026-08-23-clinical-operations-programme-design.md)

**Effort:** plan/review `xhigh`; implementation `high`.

### Task 1: Canonical API payload validation

**Files:** `src/lib/http.ts`, `src/lib/api-client-error.ts`, selected model consumers, API contract tests.

- [ ] Add a strict Zod schema and exported type for the existing `{ error, message, code, requestId? }` wire shape.
- [ ] Add a client helper that parses the canonical error and retains an explicit legacy fallback for old endpoints.
- [ ] Add a public-error response helper for expected 4xx/5xx branches and migrate direct error responses without changing success payloads.
- [ ] Convert bounded model consumers that manually parse JSON to `generateParsedTextResult` with canonical schemas.
- [ ] Extend the static API contract so new ad-hoc public error objects or unsafe external-response casts fail focused tests.
- [ ] Run `node scripts/run-vitest.mjs run tests/http-error-response.test.ts tests/api-client-error.test.ts tests/api-validation-contract.test.ts tests/api-route-coverage.test.ts` and focused model-parser tests.

### Task 2: Privacy readiness register

**Files:** `docs/governance/privacy-readiness.v1.json`, `scripts/check-privacy-readiness.mjs`, privacy docs, production-readiness wiring, tests.

- [ ] Define stable requirements with evidence class (`code`, `provider`, `legal`, `clinical`), status, accountable role, evidence reference, review and expiry dates.
- [ ] Encode current truth: technical controls may be verified; DPA/ZDR/APP notice/legal approval remain pending unless the repository contains unambiguous evidence.
- [ ] Validate required IDs, dates, allowed transitions, evidence references, and contradictions. Structural mode succeeds with honest pending items; release mode fails closed.
- [ ] Make the PIA and cross-border record name the manifest as status authority and remove stale contradictory completion language.
- [ ] Wire structural validation into governance checks; do not place agreements or secrets in the repository.
- [ ] Run the checker plus privacy/readiness focused tests.

### Task 3: Operational alert evaluator

**Files:** `scripts/lib/operational-alerts.mjs`, `scripts/ops-digest.mjs`, workflow contract, observability docs/runbooks, tests.

- [ ] Write boundary tests first for hybrid-RPC and degraded-answer warning/page thresholds, missing data, zero denominator, and multiple signals.
- [ ] Return stable alerts with code, severity, observed value, threshold/window, owner, escalation owner, and runbook.
- [ ] Make the digest render alerts and publish `alerting`, highest `severity`, and a compact machine-readable summary.
- [ ] Preserve spend and stale-canary signals; do not claim consecutive-window paging from a single snapshot.
- [ ] Document provider-neutral delivery configuration and an acknowledgement/recovery drill.
- [ ] Run ops-digest, answer-SLO, and workflow-contract tests.

### Task 4: Clinical hazard evidence refresh

**Files:** `docs/clinical-hazard-analysis.md`, `docs/clinical-hazard-controls.json`, checker/test.

- [ ] Map every hazard to `controlled`, `partial`, `open`, or `accepted_decision`, with owner, control symbols, exact tests, residual risk, reviewed commit, and review expiry.
- [ ] Update obsolete findings only where current code and focused tests support the new state.
- [ ] Keep faithful-but-wrong sources, clinical truth/authority, and human risk acceptance open or partial.
- [ ] Add a static contract that verifies IDs, paths, tests, dates, and allowed states without claiming clinical adequacy.
- [ ] Run the contract and focused numeric, claim-support, injection, source-governance, and copy-path tests.
