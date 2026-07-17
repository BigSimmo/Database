---
name: rag-change-lab
description: Validate Database retrieval, ranking, chunking, query classification, source selection, citations, answer synthesis, grounding, and RAG privacy changes with focused tests and provider-free golden evaluation before requesting live evaluation approval. Use for RAG implementation, refactoring, debugging, regression analysis, or merge-readiness work.
---

# RAG Change Lab

1. Generate the lab plan:
   `npm run workflow:rag-lab -- --write-evidence`
2. Read `docs/retrieval-quality-runbook.md` and only the change-relevant RAG architecture or threat-model sections.
3. Define the invariant before editing: retrieval recall/ranking, owner scope, grounding, citation correctness, unsupported-query behavior, latency, cache invalidation, or prompt-injection resistance.
4. Run the closest unit/property tests first, followed by `npm run eval:rag:offline`. Inspect cases and metrics rather than relying only on exit status.
5. Make minimal changes and compare against the accepted baseline. Treat recall, MRR, grounded support, citation failure, numeric grounding, source governance, and strategy mix as separate signals.
6. Run `verify:cheap` after focused proof. Use `verify:pr-local` for handoff.
7. Stop before `eval:retrieval:quality`, `eval:rag`, `eval:quality`, or any live corpus/provider operation. Present the exact command, expected cost/effect, required environment, baseline, and success threshold for explicit approval.
8. Report whether remaining uncertainty is code, corpus, owner configuration, live-provider variance, or environment.
