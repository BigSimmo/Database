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
  ageMinutes?: number | null;
  mode?: FreshnessMode;
  status?: FreshnessMode;
};

/**
 * Formats a human-readable time distance string for sub-hour and hourly elapsed times.
 */
export function formatTimeDistance(ageHours: number | null, ageMinutes?: number | null): string {
  if (ageHours === null) return "unknown age";
  if (ageMinutes !== undefined && ageMinutes !== null && ageMinutes < 60) {
    if (ageMinutes < 1) return "just now";
    return ageMinutes === 1 ? "1 minute ago" : `${ageMinutes} minutes ago`;
  }
  return ageHours === 1 ? "1 hour ago" : `${ageHours} hours ago`;
}

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
export function resolveFreshnessFrom(
  contentAt: string | null,
  now: Date,
  modeOrOptions?: FreshnessMode | { status?: FreshnessMode; mode?: FreshnessMode },
): Freshness {
  const mode: FreshnessMode =
    typeof modeOrOptions === "string"
      ? modeOrOptions
      : (modeOrOptions?.mode ?? modeOrOptions?.status ?? "snapshot");
  const viewedAt = now.toISOString();
  if (contentAt === null) {
    return { contentAt, viewedAt, ageHours: null, ageMinutes: null, mode, status: mode };
  }
  const parsed = new Date(contentAt);
  if (Number.isNaN(parsed.getTime())) {
    return { contentAt, viewedAt, ageHours: null, ageMinutes: null, mode, status: mode };
  }
  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const ageMinutes = Math.floor(diffMs / 60_000);
  const ageHours = Math.round(diffMs / 3_600_000);
  return { contentAt, viewedAt, ageHours, ageMinutes, mode, status: mode };
}

export function resolveLiveFreshness(contentAt: string | null = null, now: Date = new Date()): Freshness {
  return resolveFreshnessFrom(contentAt, now, "live");
}
