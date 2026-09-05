"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { CategoryIconTile } from "@/components/category-icon-tile";
import { useFavouritesAccess } from "@/components/clinical-dashboard/use-favourites-access";
import { shouldRunUniversalAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches-state";
import { useUniversalSearch } from "@/components/clinical-dashboard/use-universal-search";
import { focusRing } from "@/components/card-recipes";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { APP_MODE_ACCENT, APP_MODE_ICON } from "@/lib/category-identity";
import { isLocalNoAuthMode, resolveClientDemoMode } from "@/lib/client-env";
import { useAuthSession } from "@/lib/supabase/client";
import { universalSearchModeForDomain, universalSearchPreferredDomains } from "@/lib/universal-search-mode-context";

function isFavouritesHref(href: string) {
  return href === "/favourites" || href.startsWith("/favourites?");
}

function matchCountLabel(count: number) {
  return count === 1 ? "1 related mode" : `${count} related modes`;
}

/**
 * Loading placeholder that occupies the real card geometry.
 *
 * Replaces a single muted sentence, which collapsed the tray to one text line
 * and then snapped it open to a four-card grid the moment results landed. The
 * skeletons keep the tray the height it is about to be, so nothing below the
 * panel jumps. Purely decorative — announcement is owned by the visually
 * hidden `role="status"` node in the panel body (SPEC §9.2: a live region is
 * never visible content).
 */
function AlsoMatchesSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2 shadow-[var(--e1)]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 shrink-0 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <span className="h-3 w-20 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
      </div>
      <span className="h-3 w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
      <span className="h-3 w-3/5 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
    </div>
  );
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
    trimmedQuery,
  );
  // Collapsed by default on phones so this cross-mode panel does not push the
  // primary results down; from sm upward the grid is always shown (see the sm:
  // rules below), so the toggle state only governs the narrow-viewport disclosure.
  const [expanded, setExpanded] = useState(false);
  // Track the sm breakpoint (640px) so the header's disclosure semantics match
  // reality: from tablet width up the grid is always visible, so the button
  // reports expanded and drops out of the interaction/tab flow rather than
  // claiming to be a collapsed control the user can toggle to no effect.
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
  const searchActive = submissionActive && (isWide || modeId === "answer" || expanded);
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
  const matchCount = currentGroups.length;
  const emptyMessage = "No additional matches in other modes.";
  // What the announcer says must be what the panel is showing. Rendering one
  // fixed "searching / nothing found" string unconditionally would announce
  // "No additional matches" over a grid of four populated mode cards.
  const panelStatus = searchPending
    ? "Searching other modes"
    : matchCount > 0
      ? `${matchCountLabel(matchCount)} also match this search.`
      : emptyMessage;
  const headerMeta = searchPending
    ? "Searching…"
    : !searchActive
      ? "Tap to open"
      : matchCount > 0
        ? matchCountLabel(matchCount)
        : "No other matches";

  if (!submissionActive) return null;
  if (!viewportReady || trimmedQuery.length < 2) return null;
  if (modeId === "answer" && currentGroups.length === 0) return null;
  if (isWide && !searchPending && currentGroups.length === 0) return null;

  return (
    <section
      className={cn(
        // A recessed tray, not a third peer card. The results above sit on
        // `--surface-raised`; sinking this panel to `--surface-subtle` and
        // raising its mode cards back out of it puts the cross-mode suggestions
        // visibly one layer behind the answer to the question actually asked,
        // instead of competing with it at the same elevation.
        //
        // Border only, no `--shadow-inset`: card-recipes.ts records that pairing
        // a bevel with a border puts two edge treatments on one surface, which
        // is what made this panel read flat beside the cards above it.
        "basis-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1.5 sm:p-2",
        "motion-safe:animate-fade-up forced-colors:border",
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
          "flex min-h-tap w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors",
          "hover:bg-[color:var(--surface)]",
          focusRing,
          // From sm up the panel is always open, so the header is inert copy rather than a control.
          "sm:pointer-events-none sm:min-h-0 sm:cursor-default sm:gap-2.5 sm:px-1 sm:pb-2 sm:pt-0.5 sm:hover:bg-transparent",
        )}
      >
        {/* Quiet mark, not a second brand block. The glyph carries the accent and
            the tile is a hairline on the tray's own ground, so the eye lands on
            the label rather than on a saturated square competing with the mode
            tiles below it. */}
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)] forced-colors:border"
          aria-hidden
        >
          <Layers className="size-icon-md" aria-hidden />
        </span>
        <span className={cn(eyebrowText, "shrink-0 text-[color:var(--text-heading)]")}>
          Also matches
          <span className="sr-only"> in other modes</span>
        </span>
        {/* Label, rule, count — the editorial section-header device. The rule is
            what lets the count sit at the far edge at every width without a
            second line, and it replaces the phone's old stacked subtitle plus a
            tinted count badge that said the same number twice. */}
        <span className="h-px min-w-3 flex-1 bg-[color:var(--border)] forced-colors:bg-[CanvasText]" aria-hidden />
        {/* Visual cue only — the button's name stays the title, so a screen
            reader is not read a count that the sr-only status node already
            announces properly. */}
        <span className="shrink-0 text-2xs font-medium tabular-nums text-[color:var(--text-muted)]" aria-hidden>
          {headerMeta}
        </span>
        <span
          className={cn(
            "-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[color:var(--text-muted)] transition-transform motion-reduce:transition-none sm:hidden",
            expanded && "rotate-180",
          )}
          aria-hidden
        >
          <ChevronDown className="size-icon-md" aria-hidden="true" />
        </span>
      </button>
      <div
        id={panelId}
        className={cn(
          // 1 → 2 → 4 across phone, tablet and wide desktop. The tablet band
          // keeps two columns all the way to xl: four columns inside a
          // 1024px content well leaves each mode card too narrow for a
          // two-line clinical title, which is what forced the old single-line
          // truncation ("Mental Health Hospital in th…").
          "grid-cols-1 gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-4",
          expanded ? "mt-1.5 grid sm:mt-0" : "hidden",
        )}
      >
        {/* SPEC §9.2 — the live region is the announcer, never the visible content. */}
        <span className="sr-only" role="status">
          {panelStatus}
        </span>
        {searchPending ? (
          <>
            <AlsoMatchesSkeletonCard />
            <AlsoMatchesSkeletonCard className="max-sm:hidden" />
            <AlsoMatchesSkeletonCard className="hidden xl:flex" />
            <AlsoMatchesSkeletonCard className="hidden xl:flex" />
          </>
        ) : null}
        {!searchPending && currentGroups.length === 0 ? (
          <p className="rounded-lg px-2 py-2 text-xs font-medium text-[color:var(--text-muted)]">{emptyMessage}</p>
        ) : null}
        {currentGroups.map((group) => {
          const targetModeId = group.modeId;
          const targetMode = appModeDefinition(targetModeId);
          const accent = APP_MODE_ACCENT[targetModeId];
          return (
            <div
              key={targetModeId}
              data-category-accent={accent}
              // Two rows, not three. The identity row IS the "view all" control —
              // tapping a mode's name is the obvious way to ask for more of it, and
              // folding the two together removes a whole 48px row per card, which on
              // a phone is four rows of pure chrome across the panel.
              //
              // Vertical rather than the old `tile | titles | View all` row: that
              // squeezed the titles into the middle third and truncated them at every
              // width. Giving the titles the full card width is what makes a two-line
              // clinical name readable on a phone and in a 4-up.
              className="group/card flex min-w-0 flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)] transition-colors hover:border-[color:var(--cat-border)] forced-colors:border"
            >
              <Link
                href={appModeHomeHref(targetModeId, { query: trimmedQuery, run: true })}
                className={cn(
                  "flex min-h-tap min-w-0 items-center gap-2 rounded-t-xl px-2 text-left transition-colors hover:bg-[color:var(--cat-soft)] sm:min-h-compact-meta sm:py-1",
                  focusRing,
                )}
              >
                <CategoryIconTile icon={APP_MODE_ICON[targetModeId]} accent={accent} size="sm" />
                <span className="min-w-0 flex-1 truncate text-2xs font-semibold uppercase tracking-label text-[color:var(--text-heading)]">
                  <span className="sr-only">View all in </span>
                  {targetMode.label}
                </span>
                {/* Short code beside the full mode name it abbreviates — decorative
                    in the accessible name, which already says the name in full. */}
                <span
                  aria-hidden
                  className="inline-flex shrink-0 items-center rounded-md border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] px-1.5 py-px text-2xs font-semibold text-[color:var(--cat-accent)] forced-colors:border"
                >
                  {targetMode.search.statusLabel}
                </span>
                <ArrowRight
                  className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)] transition-colors group-hover/card:text-[color:var(--cat-accent)]"
                  aria-hidden
                />
              </Link>
              <ul className="flex min-w-0 flex-col border-t border-[color:var(--border)] px-1 py-1">
                {group.items.map((item) => (
                  <li key={item.href} className="min-w-0">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex min-h-tap min-w-0 items-center gap-1.5 rounded-lg px-1.5 text-xs font-medium leading-snug text-[color:var(--text)] transition-colors hover:bg-[color:var(--cat-soft)] hover:text-[color:var(--cat-accent)] sm:min-h-0 sm:py-1",
                        focusRing,
                      )}
                    >
                      <span className="line-clamp-2 min-w-0 flex-1">{item.title}</span>
                      <ChevronRight
                        className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)] transition-opacity sm:opacity-0 sm:group-hover/card:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
