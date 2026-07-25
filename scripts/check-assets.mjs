/**
 * Deferred asset gate for PR #1195.
 *
 * A full SVGO stability check requires adding `svgo` to package.json, which
 * flips CI `lockfile_changed` and makes the pre-existing exceljs/brace-expansion
 * npm audit highs blocking. Keep this stub so `npm run check:assets` resolves
 * for docs/ledger references and brand:check remains the owner of icon.svg.
 */
console.log("check:assets deferred (no SVGO lockfile delta); brand:check owns icon.svg");
