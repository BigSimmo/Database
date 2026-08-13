# Immutable branch-review records

`npm run ledger:append` writes one validated `*.record.md` file here for every new review. The filename is derived from the complete row, so an equivalent retry converges and independent PRs create different files. `npm run ledger:lookup` and `npm run check:branch-review-ledger` read these records alongside the legacy live table and its archives.

For an active branch with a legacy row that predates this system, `npm run ledger:migrate-legacy` creates the matching immutable record and removes only its branch-added row from the table.

Do not hand-edit or rename record files.
