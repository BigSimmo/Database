---
name: rag
description: Validate Database retrieval, classification, ranking, grounding, citations, and answer behavior offline before preparing any live evaluation approval gate. Use for RAG changes, golden regressions, search quality, or answer-quality work.
---

# RAG

1. Run `npm run workflow:rag-lab -- --write-evidence` for the affected paths.
2. Compare fixtures, manifests, tests, and prior local artifacts before changing behavior.
3. Reproduce regressions with the smallest deterministic offline case.
4. Run focused retrieval tests, `npm run check:rag:fixtures`, and `npm run eval:rag:offline` as selected.
5. Preserve source governance, owner scope, conservative fallback, and rollback behavior.
6. Ask before live retrieval, answer, Supabase, OpenAI, or provider-backed evaluation.
