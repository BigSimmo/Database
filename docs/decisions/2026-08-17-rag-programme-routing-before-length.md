# Decision: The RAG programme fixes dosing routing before answer length

- **Status:** decided 2026-08-17
- **Source:** `docs/rag-improvement/HANDOVER.md`, find "Owner decisions 2026-08-17:"

In the RAG improvement programme, the strong-routing fix for dosing questions (R1) came before the answer-length work (S2), because longer answers would push more dosing questions into timeouts. The same decision chose Option B for document-summary rows.

If this summary and the source ever differ, the source wins.
