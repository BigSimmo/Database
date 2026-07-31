---
name: clinical
description: Assemble clinical safety, privacy, source-governance, rollback, and production-readiness evidence for Database changes. Use for answer generation, retrieval, ingestion, clinical content, source rendering, or other patient-safety-sensitive behavior.
---

# Clinical

1. Run `npm run workflow:clinical-proof -- --write-evidence` for the affected paths.
2. Trace the clinical claim path from source and retrieval through generation and rendering.
3. Check conservative failure behavior, ownership, privacy, citations, metadata, and rollback.
4. Add the smallest deterministic local safety proof and run relevant offline domain checks.
5. Complete the governance checklist required by `.github/pull_request_template.md` for handoff.
6. Keep live Supabase, OpenAI, production-readiness, and provider evaluations approval-gated.
