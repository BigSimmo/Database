import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generate } from "./generate-outstanding-issues-snapshot.mjs";

const OUTPUT_PATH = "data/outstanding-issues-snapshot.json";
const FIX = "node scripts/generate-outstanding-issues-snapshot.mjs";

/**
 * Content keys only.
 *
 * `ledger_revision` is deliberately NOT compared. It is the sha of the commit
 * that last touched the ledger, so it changes as a *side effect* of committing
 * a ledger edit: generate the snapshot, commit ledger + snapshot together, and
 * that very commit becomes the newest change to the ledger — so a regeneration
 * immediately after the commit yields a different sha than the one stored. The
 * gate would then fail with nothing stale, on every single ledger change, and
 * `main` would go red after each squash merge that touches the ledger.
 *
 * `pending` (and `counts.pending`) is also deliberately NOT compared in check gates.
 * Feature branches add immutable request files to `docs/outstanding-issues-inbox/`
 * without modifying `data/outstanding-issues-snapshot.json`, isolating feature PRs
 * from snapshot merge conflicts. Pending inbox requests are reconciled and the
 * authoritative snapshot updated during serialized `issues:reconcile`.
 *
 * Excluding them fails safe: every canonical ledger content difference (open,
 * queue, counts.open, counts.p1..p3, counts.queued, counts.resolved) is still caught.
 *
 * Excluding `pending` from the VALUE comparison is not the same as permitting it
 * in the committed file, and `compareSnapshots` enforces the difference below.
 */
const COMPARED_CONTENT_KEYS = ["queue", "open"];

export function compareSnapshots(committed, regenerated) {
  const differences = [];
  if (committed?.version !== regenerated.version) {
    differences.push(`version: committed ${committed?.version} vs regenerated ${regenerated.version}`);
  }

  // Compare canonical ledger count keys only (`pending` is excluded to isolate feature PRs).
  // Compare the union of both key sets, so a committed snapshot carrying a key
  // the generator no longer emits is caught rather than silently ignored.
  const countKeys = new Set([...Object.keys(regenerated.counts ?? {}), ...Object.keys(committed?.counts ?? {})]);
  for (const key of countKeys) {
    if (key === "pending") continue;
    if (committed?.counts?.[key] !== regenerated.counts?.[key]) {
      differences.push(
        `counts.${key}: committed ${committed?.counts?.[key]} vs regenerated ${regenerated.counts?.[key]}`,
      );
    }
  }

  for (const key of COMPARED_CONTENT_KEYS) {
    if (JSON.stringify(committed?.[key]) !== JSON.stringify(regenerated[key])) {
      differences.push(`${key} differs from the ledger`);
    }
  }

  // `pending` is excluded from the value comparison above, but the committed
  // file must still be EMPTY of it. Excluding a field from comparison never
  // stopped it conflicting in git — the bytes still ship, and their value
  // depends on every other branch's queued requests, which is the whole of
  // `#Y090R5`. The generator defaults to an empty `pending` for exactly this
  // reason, but `prebuild` passes `--with-pending` so the built image can show
  // the true list, and `prebuild` also runs on any local `npm run build`. That
  // leaves a dirtied working tree a developer can commit by accident, which
  // re-arms the conflict. This is the backstop that makes the invariant
  // enforced rather than merely conventional.
  if (Array.isArray(committed?.pending) && committed.pending.length > 0) {
    differences.push(
      `pending: the committed snapshot carries ${committed.pending.length} inbox request(s); it must be empty. ` +
        "A local `npm run build` rewrites it via `prebuild --with-pending` — re-run the generator with no flag to clear it.",
    );
  }

  const topLevelKeys = new Set([...Object.keys(regenerated), ...Object.keys(committed ?? {})]);
  for (const key of topLevelKeys) {
    if (!(key in regenerated)) differences.push(`unexpected key in the committed snapshot: ${key}`);
    else if (!(key in (committed ?? {}))) differences.push(`missing key in the committed snapshot: ${key}`);
  }

  return differences;
}

function main() {
  const regenerated = generate();
  let committed = null;
  try {
    committed = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    console.error(`[snapshot] ${OUTPUT_PATH} is missing or unreadable. Run: ${FIX}`);
    process.exit(1);
  }
  const differences = compareSnapshots(committed, regenerated);
  if (differences.length > 0) {
    console.error("[snapshot] The committed snapshot is behind docs/outstanding-issues.md:");
    for (const difference of differences) console.error(`  - ${difference}`);
    console.error(`[snapshot] Fix with: ${FIX}`);
    process.exit(1);
  }
  console.log(
    `[snapshot] in step with ${OUTPUT_PATH} (${regenerated.counts.open} open, ${regenerated.counts.pending} pending)`,
  );
}

// Windows-safe main-module check — see generate-outstanding-issues-snapshot.mjs
// for why a manual `file://${argv[1]}` string reconstruction never matches
// `import.meta.url` on Windows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
