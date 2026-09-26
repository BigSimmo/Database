# Decision: The registry records module counts as clinical-risk

- **Status:** decided 2026-09-19
- **Source:** `scripts/pr-policy.mjs`, find "Owner ruling 2026-09-19 (#86E34T)"

`registry-records.ts` is classed as clinical-risk like its two siblings, because all three decide whether a stored clinical record is shown as current, review-due or outdated.

If this summary and the source ever differ, the source wins.
