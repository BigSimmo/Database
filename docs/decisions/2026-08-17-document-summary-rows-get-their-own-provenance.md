# Decision: Document-summary rows get their own provenance tag

- **Status:** decided 2026-08-17
- **Source:** `docs/clinical-hazard-analysis.md`, find "Owner decision 2026-08-17 — Option B:"

Document-summary rows keep their high confidence label, and the fixed similarity score they carry gets its own provenance value, `document_context`, instead of being counted as a synthetic score (Option B). Option A, which would have capped those summaries at medium confidence, was rejected.

If this summary and the source ever differ, the source wins.
