import { Clock } from "lucide-react";

import type { Freshness } from "@/lib/developer-area/ledger-snapshot";

/**
 * Returns `null` for a date the snapshot recorded but that cannot be parsed, so
 * the caller can say the revision is unknown rather than render the literal
 * "Invalid Date" beside a `NaN` age — a confident-looking stamp carrying no
 * information, which is precisely the failure this component exists to prevent.
 */
function formatDate(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Unconditional by design. There is no "fresh" short-circuit that could
 * suppress it — a page that can hide its own age is the `#338` defect.
 */
export function FreshnessStamp({ freshness }: { freshness: Freshness }) {
  const contentAt = freshness.contentAt === null ? null : formatDate(freshness.contentAt);
  const viewedAt = formatDate(freshness.viewedAt);

  return (
    <p
      data-testid="developer-hub-freshness"
      className="flex flex-wrap items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs text-[color:var(--text-muted)]"
    >
      <Clock aria-hidden="true" className="size-icon-sm" />
      {contentAt ? (
        <span>
          Ledger content as of {contentAt}
          {viewedAt ? ` · ${viewedAt}` : ""} · {freshness.ageHours} hours old
        </span>
      ) : (
        <span>Ledger revision unknown{viewedAt ? ` · viewed ${viewedAt}` : ""}</span>
      )}
    </p>
  );
}
