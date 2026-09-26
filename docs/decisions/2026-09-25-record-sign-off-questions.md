# Decision: Every clinical record sign-off asks the same three questions

- **Status:** decided 2026-09-25 (the source gives no date; this is when it was first recorded)
- **Source:** `scripts/lib/clinical-record-review-contract.mjs`, find "The three questions every sign-off asks, for every kind, one record at a time (owner-approved"

Each clinical record is signed off one at a time against three fixed questions: the wording matches its source, the clinical meaning is correct, and it is safe to show as reviewed. Any answer other than yes leaves the record unsigned.

If this summary and the source ever differ, the source wins.
