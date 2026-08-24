import snapshotJson from "../../../data/repo-awareness-snapshot.json";

import { resolveFreshnessFrom, type Freshness } from "./freshness";
import {
  REPO_AWARENESS_SNAPSHOT_VERSION,
  type DocumentationSection,
  type QuarantinedTest,
  type RepoAwarenessSnapshot,
} from "./repo-awareness-types";

/**
 * No `import "server-only"`. This module belongs to the `data/*.json` reader
 * family (`differential-fixtures.ts` and friends), not the auth/env family —
 * the JSON it inlines is public repository metadata, and a client component
 * importing it would be wasteful rather than unsafe. The same call was made and
 * recorded for `ledger-snapshot.ts` in Phase 1 (ruling W1).
 */
export function assertRepoAwarenessVersion(snapshot: { version: string }): void {
  if (snapshot.version !== REPO_AWARENESS_SNAPSHOT_VERSION) {
    // Loud, not a render fallback: an unrecognised shape means a page would
    // silently under-report the repository, which is the `#338` failure.
    throw new Error(
      `Unrecognised repo awareness snapshot version ${snapshot.version}; ` +
        `expected ${REPO_AWARENESS_SNAPSHOT_VERSION}. Run: npm run snapshot:repo-awareness`,
    );
  }
}

export function loadRepoAwarenessSnapshot(): RepoAwarenessSnapshot {
  // `as unknown as` rather than a direct assertion: TypeScript infers `string`
  // for the JSON's `area` field, which does not overlap the `RouteArea` union,
  // so a single-step assertion is rejected. `assertRepoAwarenessVersion` below
  // is the runtime guard that makes the cast honest.
  const snapshot = snapshotJson as unknown as RepoAwarenessSnapshot;
  assertRepoAwarenessVersion(snapshot);
  return snapshot;
}

export function resolveRepoFreshness(snapshot: RepoAwarenessSnapshot, now: Date): Freshness {
  return resolveFreshnessFrom(snapshot.captured_revision?.committed_at ?? null, now);
}

/**
 * Expiry is computed here, never stored: a stored `expired` flag would change
 * the snapshot's bytes daily and fail the staleness gate on an unchanged
 * repository.
 *
 * The expiry date itself counts as still current — an entry expiring today has
 * a full day left — so the comparison is against the end of that day. An
 * unparseable date reports "not expired" rather than flashing a red badge on
 * data nobody can verify.
 */
export function isQuarantineExpired(entry: QuarantinedTest, now: Date): boolean {
  const endOfExpiryDay = new Date(`${entry.expires}T23:59:59.999Z`);
  if (Number.isNaN(endOfExpiryDay.getTime())) return false;
  return now.getTime() > endOfExpiryDay.getTime();
}

export type DocumentEntry = DocumentationSection["documents"][number];

/**
 * Section order comes from `documentation.sections`, which the generator
 * already sorted, so the page cannot introduce an order of its own. Every
 * document lands in exactly one group and none is dropped — a document with a
 * section the summary never listed would otherwise vanish from the page while
 * still being counted.
 */
export function documentsBySection(snapshot: RepoAwarenessSnapshot): { name: string; documents: DocumentEntry[] }[] {
  const grouped = new Map<string, DocumentEntry[]>();
  for (const section of snapshot.documentation.sections) grouped.set(section.name, []);
  for (const document of snapshot.documentation.documents) {
    const bucket = grouped.get(document.section);
    if (bucket) bucket.push(document);
    else grouped.set(document.section, [document]);
  }
  return [...grouped.entries()].map(([name, documents]) => ({ name, documents }));
}
