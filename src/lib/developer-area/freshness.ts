export type FreshnessMode = "snapshot" | "live";

/**
 * Deliberately free of any one snapshot's shape. Phase 1 kept this type inside
 * `ledger-snapshot.ts`, which made a second snapshot import ledger code to
 * describe its own age.
 */
export type Freshness = {
  contentAt: string | null;
  viewedAt: string;
  ageHours: number | null;
  mode?: FreshnessMode;
};

/**
 * Formats a duration in milliseconds into clean relative prose:
 * - < 1 minute: "just now"
 * - < 60 minutes: "< 1 hour ago"
 * - >= 60 minutes: "N hour(s) ago"
 */
export function formatRelativeAge(diffMs: number): string {
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return "< 1 hour ago";
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/**
 * `ageHours` is null for a missing OR unparseable content date. A NaN age would
 * reach `FreshnessStamp` and render "NaN hours old" — a confident-looking stamp
 * carrying no information, which is the failure that component exists to
 * prevent.
 */
export function resolveFreshnessFrom(contentAt: string | null, now: Date, mode: FreshnessMode = "snapshot"): Freshness {
  const viewedAt = now.toISOString();
  if (contentAt === null) return { contentAt, viewedAt, ageHours: null, mode };
  const parsed = new Date(contentAt);
  if (Number.isNaN(parsed.getTime())) return { contentAt, viewedAt, ageHours: null, mode };
  return {
    contentAt,
    viewedAt,
    ageHours: Math.round((now.getTime() - parsed.getTime()) / 3_600_000),
    mode,
  };
}

export function resolveLiveFreshness(contentAt: string | null = null, now: Date = new Date()): Freshness {
  return resolveFreshnessFrom(contentAt, now, "live");
}
