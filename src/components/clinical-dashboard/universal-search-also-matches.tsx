"use client";

import Link from "next/link";
import { ChevronDown, Layers } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useFavouritesAccess } from "@/components/clinical-dashboard/use-favourites-access";
import { shouldRunUniversalAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches-state";
import { useUniversalSearch } from "@/components/clinical-dashboard/use-universal-search";
import { cn, textMuted } from "@/components/ui-primitives";
import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { appModeIcons } from "@/lib/app-mode-icons";
import { isLocalNoAuthMode, resolveClientDemoMode } from "@/lib/client-env";
import { useAuthSession } from "@/lib/supabase/client";
import { universalSearchModeForDomain, universalSearchPreferredDomains } from "@/lib/universal-search-mode-context";

function isFavouritesHref(href: string) {
  return href === "/favourites" || href.startsWith("/favourites?");
}

function matchCountLabel(count: number) {
  return count === 1 ? "1 related mode" : `${count} related modes`;
}

export function UniversalSearchAlsoMatches({
  modeId,
  query,
  className,
}: {
  modeId: AppModeId;
  query: string;
  className?: string;
}) {
  const auth = useAuthSession();
  const clientDemoMode = resolveClientDemoMode({
    explicitDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
    authUnavailableFallback: !auth.isConfigured,
    localNoAuthMode: isLocalNoAuthMode(),
  });
  const { favouritesAccessible } = useFavouritesAccess(auth.status === "authenticated", clientDemoMode);
  const trimmedQuery = query.trim();
  const panelId = useId();
  // Answer threads can be restored on an unsubmitted shared home. Keep their
  // prior cross-mode panel tied to a submitted URL rather than the mere
  // presence of a persisted answer object.
  const submissionActive = shouldRunUniversalAlsoMatches(
    modeId,
    typeof window === "undefined" ? null : window.location.search,
  );
  // Collapsed by default on phones so this cross-mode panel does not push the
  // primary results down; desktop always shows the grid (see the sm: rules below),
  // so the toggle state only governs the narrow-viewport disclosure.
  const [expanded, setExpanded] = useState(false);
  // Track the sm breakpoint (640px) so the header's disclosure semantics match
  // reality: on desktop the grid is always visible, so the button reports
  // expanded and drops out of the interaction/tab flow rather than claiming to
  // be a collapsed control the user can toggle to no effect.
  const [isWide, setIsWide] = useState(false);
  const [viewportReady, setViewportReady] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      setIsWide(query.matches);
      setViewportReady(true);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  // ClinicalDashboard mounts Answer-mode also-matches only after generation
  // completes (`answer && !loading`), so this fetch never races the answer
  // stream. Once mounted, keep the panel eager and invisible until real matches
  // arrive; a speculative phone disclosure would add dead space to short
  // answers that have no cross-mode matches.
  // Prescribing hides this panel entirely (see early return below). Keep the
  // fetch disabled too so wide viewports never fire `/api/search/universal`
  // for results that cannot render.
  const searchActive = modeId !== "prescribing" && submissionActive && (isWide || modeId === "answer" || expanded);
  const universal = useUniversalSearch({
    query: trimmedQuery,
    enabled: trimmedQuery.length >= 2 && searchActive,
    contextMode: modeId,
    excludeDomains: universalSearchPreferredDomains(modeId),
    limitPerDomain: 2,
  });
  const preferred = new Set(universal.preferredDomains ?? []);
  const groups = (() => {
    const groupByDomain = new Map(universal.groups.map((group) => [group.kind, group]));
    const orderedGroups = (universal.domainOrder ?? universal.groups.map((group) => group.kind))
      .map((domain) => groupByDomain.get(domain))
      .filter((group): group is NonNullable<typeof group> =>
        Boolean(group && !preferred.has(group.kind) && group.items.length > 0),
      );
    const byMode = new Map<
      AppModeId,
      { modeId: AppModeId; items: Array<(typeof universal.groups)[number]["items"][number]> }
    >();

    for (const group of orderedGroups) {
      const targetModeId = universalSearchModeForDomain(group.kind);
      if (targetModeId === modeId) continue;
      if (targetModeId === "favourites" && !favouritesAccessible) continue;
      const modeGroup = byMode.get(targetModeId) ?? { modeId: targetModeId, items: [] };
      for (const item of group.items) {
        if (!favouritesAccessible && isFavouritesHref(item.href)) continue;
        if (modeGroup.items.length >= 2) break;
        if (!modeGroup.items.some((existing) => existing.href === item.href)) modeGroup.items.push(item);
      }
      byMode.set(targetModeId, modeGroup);
    }

    return [...byMode.values()].filter((group) => group.items.length > 0).slice(0, 4);
  })();

  const currentGroups = universal.query === trimmedQuery ? groups : [];
  const searchPending = searchActive && (universal.loading || universal.query !== trimmedQuery);
  const panelStatus = searchPending ? "Searching other modes" : "No additional matches in other modes.";
  const matchCount = currentGroups.length;
  const phoneSubtitle = searchPending
    ? "Searching…"
    : !searchActive
      ? "Tap to browse related modes"
      : matchCount > 0
        ? matchCountLabel(matchCount)
        : "No additional matches";

  // Medication search is already a tightly scoped clinical result surface. Do
  // not add cross-mode suggestions above its prescribing results: they displace
  // the medication count, patient details, and primary matches on phones.
  if (modeId === "prescribing" || !submissionActive) return null;
  if (!viewportReady || trimmedQuery.length < 2) return null;
  if (modeId === "answer" && currentGroups.length === 0) return null;
  if (isWide && !searchPending && currentGroups.length === 0) return null;

  // Count badge: ellipsis while collapsed/pending/empty so a finished-empty
  // disclosure does not show a literal "0" next to "No additional matches".
  const phoneCountBadge = !searchActive || searchPending || matchCount === 0 ? "…" : String(matchCount);

  return (
    <section
      className={cn(
        // Raised card — matches the library rows above, instead of a flat bar
        // flush against the phone home-indicator / dock edge.
        "basis-full rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-1.5 shadow-[var(--shadow-inset)] motion-safe:animate-fade-up",
        // Content spacing below the last interactive section on phones — not a
        // chrome/dock reserve restore (those stay 0rem when scroll-hidden).
        "max-sm:mb-4",
        className,
      )}
      aria-label="Matches in other modes"
      data-testid="universal-also-matches"
    >
      <button
        type="button"
        onClick={() => {
          if (!isWide) setExpanded((value) => !value);
        }}
        aria-expanded={isWide ? true : expanded}
        aria-controls={panelId}
        tabIndex={isWide ? -1 : undefined}
        className={cn(
          "flex min-h-tap w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
          "hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          // On desktop the panel is always open, so the header is inert copy rather than a control.
          "sm:pointer-events-none sm:mb-1.5 sm:min-h-0 sm:cursor-default sm:gap-2 sm:px-2 sm:py-1 sm:hover:bg-transparent",
        )}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] sm:hidden"
          aria-hidden
        >
          <Layers className="h-4 w-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
              Also matches in other modes
            </span>
            <span
              className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--clinical-accent-soft)] px-1.5 text-2xs font-semibold tabular-nums text-[color:var(--clinical-accent)] sm:hidden"
              aria-hidden={phoneCountBadge === "…"}
            >
              {phoneCountBadge}
            </span>
          </span>
          {/* Visual cue only — keep the button name to the title (+ optional count). */}
          <span className="text-2xs font-medium text-[color:var(--text-muted)] sm:hidden" aria-hidden>
            {phoneSubtitle}
          </span>
        </span>
        <span className="hidden text-2xs font-medium text-[color:var(--text-muted)] sm:inline">Across Clinical KB</span>
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-md text-[color:var(--text-muted)] transition-transform sm:hidden",
            expanded && "rotate-180",
          )}
          aria-hidden
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
      <div
        id={panelId}
        className={cn(
          "gap-2 px-1 pb-1 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 xl:grid-cols-4",
          expanded ? "mt-1.5 grid sm:mt-0" : "hidden",
        )}
      >
        {searchPending || currentGroups.length === 0 ? (
          <p className={cn("rounded-lg px-2.5 py-3 text-xs font-medium", textMuted)} aria-live="polite">
            {panelStatus}
          </p>
        ) : null}
        {currentGroups.map((group) => {
          const targetModeId = group.modeId;
          const targetMode = appModeDefinition(targetModeId);
          const TargetIcon = appModeIcons[targetModeId];
          return (
            <div
              key={targetModeId}
              className="flex min-w-0 items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <TargetIcon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-2xs font-semibold uppercase tracking-label text-[color:var(--clinical-accent)]">
                  {targetMode.label}
                </span>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block truncate text-xs font-medium leading-snug text-[color:var(--text)] underline-offset-2 hover:text-[color:var(--clinical-accent)] hover:underline"
                  >
                    {item.title}
                  </Link>
                ))}
              </span>
              <Link
                href={appModeHomeHref(targetModeId, { query: trimmedQuery, run: true })}
                // Top-align the label with the mode title; min-h-tap still grows the
                // hit box downward so the 48px floor does not pull the text mid-card.
                className="inline-flex min-h-tap shrink-0 items-start pt-0.5 text-2xs font-semibold text-[color:var(--clinical-accent)] underline-offset-2 hover:underline sm:min-h-0 sm:items-center sm:pt-0"
              >
                View all
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
