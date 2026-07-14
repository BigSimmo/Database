"use client";

import Link from "next/link";

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
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-extrabold text-[color:var(--text-heading)]">Also matches in other modes</p>
        <span className="text-2xs font-bold text-[color:var(--text-soft)]">Across Clinical KB</span>
      </div>
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
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
