# Decision: Safety findings show below the answer's prose

- **Status:** decided 2026-09-03
- **Source:** `src/components/clinical-dashboard/answer-result-surface.tsx`, find "The safety findings themselves are NOT here any more (owner decision,"

Safety findings render as a points rail below the answer's prose, where the answer ends and its evidence begins, rather than in the status chip row above it.

If this summary and the source ever differ, the source wins.
