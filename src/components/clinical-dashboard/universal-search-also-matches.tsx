"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useFavouritesAccess } from "@/components/clinical-dashboard/use-favourites-access";
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
  // Answer mounts this panel only after generation completes, so its request is
  // not competing with typeahead or answer work. Keep that result panel eager
  // and invisible until real matches arrive; a speculative phone disclosure
  // would add dead space to short answers that have no cross-mode matches.
  const searchActive = isWide || modeId === "answer" || expanded;
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

  if (!viewportReady || trimmedQuery.length < 2) return null;
  if (modeId === "answer" && currentGroups.length === 0) return null;
  if (isWide && !searchPending && currentGroups.length === 0) return null;

  return (
    <section
      className={cn(
        "basis-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5",
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
          "flex w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors",
          "hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          // On desktop the panel is always open, so the header is inert copy rather than a control.
          "sm:pointer-events-none sm:mb-2 sm:cursor-default sm:py-0 sm:hover:bg-transparent",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-extrabold text-[color:var(--text-heading)]">Also matches in other modes</span>
          <span className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[color:var(--clinical-accent-soft)] px-1 text-2xs font-bold text-[color:var(--clinical-accent)] sm:hidden">
            {currentGroups.length || "…"}
          </span>
        </span>
        <span className="hidden text-2xs font-bold text-[color:var(--text-soft)] sm:inline">Across Clinical KB</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition-transform sm:hidden",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn("gap-1 sm:grid sm:grid-cols-2 xl:grid-cols-4", expanded ? "mt-2 grid sm:mt-0" : "hidden")}
      >
        {searchPending || currentGroups.length === 0 ? (
          <p className={cn("rounded-md px-2 py-3 text-xs font-semibold", textMuted)} aria-live="polite">
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
              className="flex min-w-0 items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <TargetIcon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block truncate text-2xs font-bold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                  {targetMode.label}
                </span>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block truncate text-xs font-extrabold text-[color:var(--text)] hover:underline"
                  >
                    {item.title}
                  </Link>
                ))}
              </span>
              <Link
                href={appModeHomeHref(targetModeId, { query: trimmedQuery, run: true })}
                className="shrink-0 text-2xs font-bold text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)]"
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
