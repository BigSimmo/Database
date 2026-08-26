# Clinical trust cockpit — implementation plan

> **Execution:** use subagent-driven development. Keep reads privacy-safe and reuse the administrator-gated developer hub.

**Goal:** Give authorised reviewers one place to see content maturity, source-change impact, and quality feedback with explicit ownership and evidence.

**Spec:** [`../specs/2026-08-23-clinical-operations-programme-design.md`](../specs/2026-08-23-clinical-operations-programme-design.md)

**Effort:** plan/review `xhigh`; implementation `high`.

## Task 1: Pure maturity and impact projections

**Files:** `src/lib/clinical-quality-dashboard.ts`, focused unit tests.

- [ ] Define strict snapshot schemas and status vocabularies.
- [ ] Aggregate static catalogue maturity without equating implementation, currency, source support, and human review.
- [ ] Derive source impact from review state, registry links, retrieval reach, feedback reach, affected areas, and deterministic clinical-impact/usage priority.
- [ ] Treat missing aggregates as unknown; expose `asOf` and evidence source for every band.
- [ ] Never select or return query text, answer text, source excerpts, or patient identifiers.

## Task 2: Administrator API and quality triage state

**Files:** `src/app/api/clinical-quality/route.ts`, optional migration/schema/types if persistent triage is required, API tests.

- [ ] Require an authenticated administrator and rate-limit the endpoint.
- [ ] Validate every Supabase row with Zod before projection.
- [ ] Return a versioned snapshot using the shared API error contract.
- [ ] Persist only structured workflow metadata for triage: signal type/ID, status, owner role/user ID, resolution code, retest reference, actor, and timestamps. Do not provide a free-text note field.
- [ ] Add service-role-only grants and fail-closed RLS if a table is introduced; update schema/types/static schema tests but do not apply hosted migration.

## Task 3: One authorised cockpit

**Files:** developer-area hub panel, gated clinical-quality page/components, DOM and reachability tests, generated docs.

- [ ] Link one `Clinical trust` destination from the existing hub; do not add a mode or parallel navigation.
- [ ] Render Quality queue, Source impact, and Content maturity as views of one snapshot.
- [ ] Provide owner/status/resolution/retest controls only for authenticated administrators.
- [ ] Make loading, partial, unknown, empty, stale, error, and permission states explicit and accessible.
- [ ] Keep human review actions explicit and audit-safe; no automatic content status change.
- [ ] Update route documentation and run focused route/DOM/reachability checks.

## Task 4: Product direction record

**Files:** `docs/product/clinical-trust-direction.md` and relevant links.

- [ ] Record the decision to prioritise trustworthy content, review workflows, saved clinical work, and quality feedback before standalone modes.
- [ ] Name the evidence and exit criteria required before reconsidering additional modes.
- [ ] Keep this decision separate from the task ledger.

## RAG impact

Read-only aggregation over existing identifiers and workflow metadata only. No RAG ranking or answer-generation change; no live canary is part of this local plan.
