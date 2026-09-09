import { Clock } from "lucide-react";

import type { Freshness } from "@/lib/developer-area/freshness";

/**
 * Returns `null` for a date the snapshot recorded but that cannot be parsed, so
 * the caller can say the revision is unknown rather than render the literal
 * "Invalid Date" beside a `NaN` age — a confident-looking stamp carrying no
 * information, which is precisely the failure this component exists to prevent.
 *
 * #L14: this is a Server Component, so without an explicit `timeZone` it
 * follows the container's clock (UTC on Railway) while a client-rendered
 * stamp on the same page (`IngestionPanel`'s `CheckedAt`) follows the
 * browser's — an unlabelled eight-hour gap for a Perth reader on the one page
 * that polls live. Pinned to `Australia/Perth` here so both agree regardless
 * of where either half renders. The zone name is appended literally rather
 * than via `timeZoneName`, because `Intl.DateTimeFormat` rejects
 * `timeZoneName` combined with `dateStyle`/`timeStyle` on this runtime;
 * Perth observes no daylight saving, so "AWST" is correct year-round and this
 * is not a seasonal shortcut.
 */
function formatDate(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const formatted = parsed.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
  return `${formatted} AWST`;
}

/**
 * Unconditional by design. There is no "fresh" short-circuit that could
 * suppress it — a page that can hide its own age is the `#338` defect.
 *
 * `label` names what the content date belongs to. It defaults to "Ledger" so
 * every Phase 1 call site is unchanged; a page rendering a different snapshot
 * must pass its own, or it will claim to be showing the task ledger.
 */
export function FreshnessStamp({
  freshness,
  label = "Ledger",
  status,
}: {
  freshness: Freshness;
  label?: string;
  status?: "snapshot" | "live";
}) {
  const isLive = status === "live" || freshness.status === "live" || freshness.mode === "live";
  const contentAt = freshness.contentAt === null ? null : formatDate(freshness.contentAt);
  const viewedAt = formatDate(freshness.viewedAt);

  return (
    <p
      data-testid="developer-hub-freshness"
      className="flex flex-wrap items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs text-[color:var(--text-muted)]"
    >
      <Clock aria-hidden="true" className="size-icon-sm" />
      {isLive ? (
        <span>
          {contentAt ? (
            <>
              {label} read live · last updated {contentAt}
              {viewedAt ? ` · viewed ${viewedAt}` : ""}
            </>
          ) : (
            <>
              {label} read live on demand{viewedAt ? ` · viewed ${viewedAt}` : ""}
            </>
          )}
        </span>
      ) : contentAt ? (
        <span>
          {/*
           * Both timestamps are labelled. An unlabelled second date beside
           * "Ledger content as of …" reads as a second ledger date rather than
           * the moment the page was rendered, and this is the one surface whose
           * whole job is stating age unambiguously.
           */}
          {label} content as of {contentAt}
          {viewedAt ? ` · viewed ${viewedAt}` : ""} · {freshness.ageHours} {freshness.ageHours === 1 ? "hour" : "hours"}{" "}
          old
        </span>
      ) : isLive ? (
        <span>
          {label} read live{viewedAt ? ` · viewed ${viewedAt}` : ""}
        </span>
      ) : (
        <span>
          {label} revision unknown{viewedAt ? ` · viewed ${viewedAt}` : ""}
        </span>
      )}
    </p>
  );
}
