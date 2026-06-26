# Project Alignment Cleanup

## Dependency decisions

- Updated direct runtime and development dependencies to their current compatible releases as part of the June 2026 alignment pass.
- Kept `eslint` on `^9.39.4` because `eslint-config-next@16.2.7` still depends on plugins that peer against ESLint 9. ESLint 10 is intentionally deferred until the Next lint stack supports it without peer overrides.
- Added transitive overrides for `postcss`, `tmp`, and `uuid` to remove audit findings from Next and ExcelJS dependency paths while preserving the existing spreadsheet import/export code.
- Verified ExcelJS still writes and reads an XLSX buffer with the `uuid` override in place.

## Dependency verification note

- `npm ci` and `npm audit --json` are the release gates for dependency install and security status.
- On Windows with npm 11, `npm ls --depth=0` can report bundled optional wasm/native packages as extraneous immediately after `npm ci`: `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, and `@tybys/wasm-util`.
- `npm explain` traces these packages to optional wasm/native dependency paths from `@tailwindcss/oxide-wasm32-wasi`, `@rolldown/binding-wasm32-wasi`, and `@unrs/resolver-binding-wasm32-wasi`; the lockfile contains those paths and `npm audit --json` reports zero vulnerabilities.
- Do not treat this specific `npm ls --depth=0` extraneous output as a hard release blocker unless audit fails, install fails, package versions drift from `package-lock.json`, or a future npm/package update stops reproducing the optional-dependency reporting issue.

## Runtime policy

- CI verifies the project on Node.js 24, so local development should also use Node.js 24.x.
- `.nvmrc`, `.node-version`, and `package.json` `engines` all declare the Node 24 runtime expectation.
- New cleanup or dependency work should be verified on Node 24 before release, even when local shells happen to use newer Node versions.

## Stale branch audit

- `temporary` and `codex/spark` contain the same four unique commits covering upload workflow notes, Supabase project checks, and database cleanup hardening.
- `codex/database-local` contains the design-system experiment history and a design-system baseline document.
- `codex/design-system-baseline-20260524` is the earlier design baseline snapshot from the same design-system line.

No stale branch was merged directly. Current `main` already contains the accepted upload workflow, Supabase project safety guidance, cleanup scripts, RAG hardening, and dashboard/document-viewer design work. The remaining branch diffs are either superseded by current tracked files or predate the accepted design implementation, so no code was ported.
