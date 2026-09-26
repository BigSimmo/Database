# Decision: The live search functions' memory settings are kept as they are

- **Status:** decided 2026-08-18
- **Source:** `docs/database-remediation-coordination.md`, find "Owner decisions (2026-08-18):"

The working-memory settings already live on the ten search functions (128 MB on four, 64 MB on six) were written into the migrations unchanged, and that change was exempted from the eval canary.

If this summary and the source ever differ, the source wins.
