# Decision: The source acquisition ledger stays one file, ordered to avoid conflicts

- **Status:** decided 2026-09-17
- **Source:** `scripts/merge-source-acquisitions.ts`, find "The fix (owner-approved 2026-09-17): keep one file, but order records by"

The source acquisition ledger stays a single file, but its records are ordered by a hash of their id so that parallel additions land in different places instead of conflicting. The tooling exists; it does not yet reorder the live file.

If this summary and the source ever differ, the source wins.
