"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { useUniversalSearch } from "@/components/clinical-dashboard/use-universal-search";
import { cn } from "@/components/ui-primitives";
import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { appModeIcons } from "@/lib/app-mode-icons";
import { universalSearchModeForDomain, universalSearchPreferredDomains } from "@/lib/universal-search-mode-context";

export function UniversalSearchAlsoMatches({
  modeId,
  query,
  className,
}: {
  modeId: AppModeId;
  query: string;
  className?: string;
}) {
  const trimmedQuery = query.trim();
  const universal = useUniversalSearch({
    query: trimmedQuery,
    enabled: trimmedQuery.length >= 2,
    contextMode: modeId,
    excludeDomains: universalSearchPreferredDomains(modeId),
    limitPerDomain: 2,
  });
  const panelId = useId();
  // Collapsed by default on phones so this cross-mode panel does not push the
  // primary results down; desktop always shows the grid (see the sm: rules below),
  // so the toggle state only governs the narrow-viewport disclosure.
  const [expanded, setExpanded] = useState(false);
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
      const modeGroup = byMode.get(targetModeId) ?? { modeId: targetModeId, items: [] };
      for (const item of group.items) {
        if (modeGroup.items.length >= 2) break;
        if (!modeGroup.items.some((existing) => existing.href === item.href)) modeGroup.items.push(item);
      }
      byMode.set(targetModeId, modeGroup);
    }

    return [...byMode.values()].filter((group) => group.items.length > 0).slice(0, 4);
  })();

  if (universal.query !== trimmedQuery || groups.length === 0) return null;

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
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors",
          "hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          // On desktop the panel is always open, so the header is inert copy rather than a control.
          "sm:mb-2 sm:cursor-default sm:py-0 sm:hover:bg-transparent",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-extrabold text-[color:var(--text-heading)]">Also matches in other modes</span>
          <span className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[color:var(--clinical-accent-soft)] px-1 text-2xs font-bold text-[color:var(--clinical-accent)] sm:hidden">
            {groups.length}
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
        className={cn(
          "gap-1 sm:grid sm:grid-cols-2 xl:grid-cols-4",
          expanded ? "mt-2 grid sm:mt-0" : "hidden",
        )}
      >
        {groups.map((group) => {
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
