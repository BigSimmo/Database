---
name: clinical-change-proof
description: Build evidence for Database changes affecting clinical output, ingestion, retrieval, ranking, answers, citations, source rendering, privacy, owner scoping, document access, Supabase, or production behavior. Use for implementation, review, readiness, or handoff work that must satisfy clinical governance and conservative failure requirements.
---

# Clinical Change Proof

1. Generate the scoped evidence plan:
   `npm run workflow:clinical-proof -- --write-evidence`
2. Read only the relevant sections of `.github/pull_request_template.md`, `docs/clinical-governance.md`, and the domain runbook selected by the change.
3. Trace the full behavior boundary: input, authorization/owner scope, retrieval or write path, output contract, source evidence, logs, and failure fallback.
4. Prove locally that:
   - private or service-role data remains server-only and fail-closed;
   - source-backed claims and conservative unknown/outdated behavior are preserved;
   - demo data remains distinct from clinical sources;
   - rollback or feature-disable behavior is documented;
   - affected behavior has focused regression coverage.
5. Run the local checks in the plan, narrowest first. The offline RAG contract is mandatory when retrieval or answer behavior is involved.
6. Present every live Supabase, OpenAI, hosted CI, or production-readiness command as a separate approval request. Never bundle approval implicitly into a local gate.
7. Complete the Clinical Governance Preflight and report evidence, gaps, rollback, and any SaMD implication.
