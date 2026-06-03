# Project Alignment Cleanup

## Dependency decisions

- Updated direct runtime and development dependencies to their current compatible releases as part of the June 2026 alignment pass.
- Kept `eslint` on `^9.39.4` because `eslint-config-next@16.2.7` still depends on plugins that peer against ESLint 9. ESLint 10 is intentionally deferred until the Next lint stack supports it without peer overrides.
- Added transitive overrides for `postcss`, `tmp`, and `uuid` to remove audit findings from Next and ExcelJS dependency paths while preserving the existing spreadsheet import/export code.
- Verified ExcelJS still writes and reads an XLSX buffer with the `uuid` override in place.

## Stale branch audit

- `temporary` and `codex/spark` contain the same four unique commits covering upload workflow notes, Supabase project checks, and database cleanup hardening.
- `codex/database-local` contains the design-system experiment history and a design-system baseline document.
- `codex/design-system-baseline-20260524` is the earlier design baseline snapshot from the same design-system line.

No stale branch was merged directly. Current `main` already contains the accepted upload workflow, Supabase project safety guidance, cleanup scripts, RAG hardening, and dashboard/document-viewer design work. The remaining branch diffs are either superseded by current tracked files or predate the accepted design implementation, so no code was ported.
