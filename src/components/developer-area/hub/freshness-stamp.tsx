import { Clock } from "lucide-react";

import type { Freshness } from "@/lib/developer-area/ledger-snapshot";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Unconditional by design. There is no "fresh" short-circuit that could
 * suppress it — a page that can hide its own age is the `#338` defect.
 */
export function FreshnessStamp({ freshness }: { freshness: Freshness }) {
  return (
    <p
      data-testid="developer-hub-freshness"
      className="flex flex-wrap items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs text-[color:var(--text-muted)]"
    >
      <Clock aria-hidden="true" className="size-icon-sm" />
      {freshness.contentAt ? (
        <span>
          Ledger content as of {formatDate(freshness.contentAt)} · {formatDate(freshness.viewedAt)} ·{" "}
          {freshness.ageHours} hours old
        </span>
      ) : (
        <span>Ledger revision unknown · viewed {formatDate(freshness.viewedAt)}</span>
      )}
    </p>
  );
}
