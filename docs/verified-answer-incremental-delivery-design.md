# Incremental delivery of verified answer content

Status: **design accepted for staged implementation; no runtime behaviour changed**<br>
Tracks: [`#100`](outstanding-issues.md), [`#021`](outstanding-issues.md)<br>
Origin: [`latency-audit-2026-07-28.md`](audit/latency-audit-2026-07-28.md#l0--structural-1)

## Decision

Improve time to first useful content without reviving token streaming. The answer stream may
progressively disclose only immutable, independently verified units:

1. a bounded evidence preview after retrieval, ranking, owner-scope enforcement, and client-payload
   trimming; then
2. answer sections after each complete section has passed the same citation, text, numeric, source,
   and claim-support checks required for the final answer.

The canonical `final` event remains mandatory and authoritative. Incremental units are an
append-only preview of content that is byte-identical to a subset of that final payload. A client
must discard previews if the stream errors, is cancelled, or the final payload does not reconcile.

This design explicitly rejects raw model-token delivery, provisional prose, in-place revision, and
any widening of `answerStreamEventNames`. Those shapes can expose a dose, threshold, or unsupported
claim before the existing post-generation safety gates can remove it.

## Current constraint

The provider call is buffered and returns one parsed structured object. Consequently, splitting the
existing fully generated object into frames would improve only post-processing paint time, not the
dominant generation wait. Meaningful per-section delivery requires a later provider-backed generation
experiment; retrieval-complete evidence can be delivered earlier without changing model behaviour.

## Stream contract

Keep the existing `progress`, `final`, and `error` event-name allowlist. Extend the public `progress`
DTO with an optional, discriminated `verifiedUnit` field. Existing clients ignore the field; new
clients render only recognized schema versions and unit kinds.

```ts
type VerifiedUnit =
  | {
      schemaVersion: 1;
      kind: "evidence_preview";
      sequence: 0;
      sources: ClientSourcePreview[];
      selectedContextCount: number;
    }
  | {
      schemaVersion: 1;
      kind: "answer_section";
      sequence: number;
      section: AnswerSection;
      citations: Citation[];
      supportLevel: Exclude<AnswerSectionSupportLevel, "unsupported">;
    };
```

Contract rules:

- `sequence` is strictly increasing and unique within one response. Retries start a new HTTP stream;
  units never carry across attempts.
- Evidence previews use the existing route-boundary source field policy and snippet limit. They never
  include full chunk context, table facts, document summaries, memory cards, images, service-role
  data, or another owner's document identifiers.
- A section is emitted only after all of its cited chunk IDs resolve to the already selected,
  owner-scoped evidence and its support level is not `unsupported`.
- The final response contains the same section body, citation identities, and source identities for
  every emitted unit. Reconciliation failure is a server fault, not permission to revise the preview.
- `complete` remains buffered until immediately before `final`. It never means that preview delivery
  alone succeeded.
- Cache hits may emit the same units from the already governed cached answer, but the final cache
  payload remains authoritative.

## Verification boundary

Create one pure server-only function for section finalization. It accepts a complete section plus the
selected evidence and returns either a governed immutable unit or a rejection. It must reuse, rather
than approximate, the current production gates:

1. citation sanitization and source membership;
2. answer and structured-text sanitization;
3. numeric verification and unbolding of unverified numbers;
4. quote-card sanitization where applicable;
5. claim-support assessment and labelled numeric-band coherence; and
6. the canonical answer render policy.

Do not implement a second, weaker “stream-safe” verifier. If the current gates cannot operate on an
independent section, that section stays buffered until the final answer. Cross-section comparisons,
conflicts, and conclusions that depend on later sections are not independently emit-able in v1.

## Delivery phases

### Phase 0 — offline contract proof

- Add schema validation for `verifiedUnit`, sequence monotonicity, bounded payload size, and rejection
  of `token` / `revising`.
- Add reconciliation tests proving every preview is an exact subset of `final` and is discarded on
  error, cancellation, retry, unknown schema version, or mismatch.
- Add owner-boundary fixtures proving private source fields and cross-owner identifiers cannot cross
  the route boundary.

This phase is provider-free and must land before either visible phase.

### Phase 1 — retrieval-complete evidence preview

- After answer evidence is ranked and the final context pack is selected, build a preview through the
  existing client-source trimming policy and emit it as `progress.verifiedUnit`.
- Render it in a clearly labelled “Selected evidence — answer still being verified” region. Do not
  render it as answer prose or mark the answer complete.
- Preserve the current final source list, source governance warnings, feedback token, telemetry, and
  persistence behaviour.

This is the smallest useful increment: it brings owner-scoped, source-backed content forward while
leaving generation, retrieval ordering, and ranking byte-identical.

### Phase 2 — verified answer sections

- Experiment with generation in complete independently verifiable section units. A unit must be fully
  parsed before verification; model token deltas remain private to the server.
- Prefer a bounded lead section followed by supporting sections. Do not create one provider request per
  display paragraph without evidence that cost, latency, cancellation, and rate-limit behaviour remain
  acceptable.
- Run independent section finalization, emit accepted sections, then assemble and globally verify the
  canonical final answer. If global verification would change an emitted unit, fail closed, terminate
  that stream, and let the existing client retry start a fresh request; never patch already displayed
  prose or label the partial response complete.

Phase 2 changes answer generation and cannot begin without the provider-backed gate below.

## Failure, retry, and rollout behaviour

- **Disconnect or Stop:** abort provider and retrieval work as today; the client removes all previews.
- **Retry:** clear prior previews before opening the new stream. A sequence number has meaning only
  inside one response.
- **Verifier rejection:** emit no unit. Continue toward the governed final or existing conservative
  source-only fallback.
- **Stream error after preview:** display the existing error state, not the preview as a completed
  answer. Evidence links may remain available only if the product explicitly labels them as incomplete.
- **Rolling deploy:** old clients safely ignore the optional field; new clients accept an absent field.
  No new SSE event name is introduced.
- **Feature flag:** gate rendering and emission separately. Deploy client parsing first, then server
  emission, then enable rendering for internal users. Rollback disables emission; no schema or stored
  data rollback is needed.

## Telemetry and acceptance

Record no clinical text in telemetry. Record timestamps and counts only:

- `retrieval_verified_unit_ms`, `first_verified_content_ms`, `first_verified_section_ms`;
- emitted/rejected unit counts and rejection-reason enums;
- final reconciliation success/failure;
- disconnect-before-final rate; and
- route, cache, fallback, and model class already recorded by the answer pipeline.

Acceptance requires:

- no change to retrieval results, ranking order, owner scope, final payload, source governance, or
  conservative fallback behaviour;
- zero preview/final reconciliation failures in deterministic tests;
- a lower median `first_verified_content_ms` than final-answer latency for Phase 1;
- for Phase 2, no regression in grounded-supported answers, citation failures, numeric verification,
  p95 final latency, provider cost, or disconnect-before-final rate; and
- accessibility proof that incremental additions do not repeatedly announce entire prior content or
  move focus.

## Required gates before runtime implementation

Local/offline:

1. focused stream-contract, parser, owner-scope, verification, and reconciliation tests;
2. `npm run eval:rag:offline`;
3. `npm run verify:cheap`;
4. `npm run check:production-readiness`;
5. `npm run ensure` followed by `npm run verify:ui` for the visible client phase; and
6. `npm run verify:pr-local` before handoff.

Provider-backed and therefore separately approval-gated:

1. `npm run eval:rag -- --limit 15` plus `npm run eval:quality -- --rag-only` for answer-generation
   and post-processing changes;
2. a baseline/post live canary pair with document/content recall pinned at `1.0`, zero per-case
   reciprocal-rank regressions, and no answer-quality regression; and
3. a staged observation window for final reconciliation, abort, latency, and cost metrics.

## Governance disposition

- **Clinical safety:** safer than token streaming because no provisional prose crosses the boundary;
  rejected units remain invisible and the existing source-only fallback remains intact.
- **Privacy and access:** no new data source or owner scope; the route emits only the bounded fields
  already permitted in final client payloads.
- **Source governance:** evidence remains linked to the same source identities and warnings; a preview
  is explicitly not a completed clinical answer.
- **SaMD:** this changes presentation timing, not intended purpose or recommendation logic. Reassess
  before Phase 2 because multiple generated units could change synthesis behaviour.
- **Rollback:** disable the server emission flag, then the client rendering flag. The canonical final
  contract and stored answer format remain unchanged.

## Explicit non-goals

- Reintroducing `token` or `revising` events.
- Streaming partial JSON or prose before a complete unit verifies.
- Changing retrieval, ranking, evidence selection, prompts, or final-answer quality thresholds in
  Phase 1.
- Persisting previews as completed answers or accepting feedback against preview-only content.
- Calling OpenAI, Supabase, hosted CI, or production services as part of this design-only change.
