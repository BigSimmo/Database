"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, type LucideIcon } from "lucide-react";

import {
  cn,
  eyebrowText,
  floatingControl,
  iconTile,
  semanticChipTone,
  sourceCard,
  subtleStatusPill,
  textMuted,
  type SemanticChipTone,
} from "@/components/ui-primitives";
import { logCrossModeLinkOpen } from "@/components/clinical-dashboard/source-actions";
import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import {
  buildCrossModeLinksForThread,
  type CrossModeDifferentialCatalog,
  type CrossModeLink,
  type CrossModeLinkBadge,
} from "@/lib/cross-mode-links";
import { useRegistryRecords } from "@/lib/use-registry-records";

function badgeChipTone(tone: CrossModeLinkBadge["tone"]): SemanticChipTone | null {
  if (!tone) return null;
  return tone === "clinical" ? "info" : tone;
}

type CrossModeLinkCardProps = {
  link: CrossModeLink;
  Icon: LucideIcon;
  query: string;
  onModeSearch: (mode: AppModeId, query: string) => void;
};

function CrossModeLinkBadges({ badges }: { badges: CrossModeLinkBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-2xs font-semibold",
            semanticChipTone(badgeChipTone(badge.tone)),
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function CrossModeLinkActions({
  link,
  query,
  onModeSearch,
}: {
  link: CrossModeLink;
  query: string;
  onModeSearch: (mode: AppModeId, query: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Link
        href={link.detailHref}
        onClick={() => logCrossModeLinkOpen(query, link)}
        className="inline-flex min-h-11 items-center text-xs font-semibold text-[color:var(--clinical-accent)] underline-offset-2 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        Open reference
      </Link>
      <span className="text-[color:var(--text-soft)]" aria-hidden>
        ·
      </span>
      <button
        type="button"
        onClick={() => {
          logCrossModeLinkOpen(query, link);
          onModeSearch(link.modeId, link.modeSearchQuery);
        }}
        aria-label={`Search ${link.title} in ${link.modeLabel}`}
        className={cn(floatingControl, "inline-flex min-h-11 items-center gap-1.5 px-2.5 text-xs")}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Search in {link.modeLabel}
      </button>
    </div>
  );
}

function CrossModeLinkCard({ link, Icon, query, onModeSearch }: CrossModeLinkCardProps) {
  return (
    <article
      role="listitem"
      className={cn(
        sourceCard,
        "flex shrink-0 flex-col gap-2 p-3",
        "w-full md:w-[16.5rem] md:min-w-[15rem] md:max-w-[18rem]",
      )}
    >
      <div className="flex items-start gap-2.5 md:gap-3">
        <span className={iconTile}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={link.detailHref}
              onClick={() => logCrossModeLinkOpen(query, link)}
              className="inline-flex min-h-11 items-center text-sm font-semibold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] md:min-h-9"
            >
              <span className="line-clamp-2 md:line-clamp-1">{link.title}</span>
            </Link>
            <span className={cn(subtleStatusPill, "shrink-0")}>{link.modeLabel}</span>
          </div>
          {link.subtitle ? (
            <p className={cn("text-xs leading-5 line-clamp-2 md:line-clamp-1", textMuted)}>{link.subtitle}</p>
          ) : null}
          <CrossModeLinkBadges badges={link.badges} />
        </div>
      </div>
      <CrossModeLinkActions link={link} query={query} onModeSearch={onModeSearch} />
    </article>
  );
}

// Self-contained cross-mode links surface: owns the catalog fetching (same
// owner-scoped APIs the modes use; fixtures in demo mode), entity matching,
// and the strip. Mount it under any search-results surface and pass the
// query thread (oldest first) — it renders nothing until an entity matches.
export function CrossModeLinksSection({
  queries,
  enabled = true,
  onModeSearch,
}: {
  queries: Array<string | null | undefined>;
  enabled?: boolean;
  // Defaults to navigating to the target mode with the search pre-run.
  onModeSearch?: (mode: AppModeId, query: string) => void;
}) {
  const router = useRouter();
  const services = useRegistryRecords("service", { enabled });
  const forms = useRegistryRecords("form", { enabled });
  // fields=index keeps this to the ~30 KB identity slice of the catalog.
  const medications = useMedicationCatalog(undefined, { enabled, fields: "index" });
  const [differentials, setDifferentials] = useState<CrossModeDifferentialCatalog | null>(null);
  useEffect(() => {
    // Dynamic import keeps the 1.2 MB differentials snapshot out of the
    // dashboard bundle; the catalog is loaded once per session.
    if (!enabled || differentials) return;
    let cancelled = false;
    import("@/lib/cross-mode-differentials").then((module) => {
      if (!cancelled) setDifferentials(module.crossModeDifferentialCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, differentials]);

  // Memo on the thread's contents, not the (per-render) array identity.
  const queriesKey = queries.filter((value): value is string => Boolean(value?.trim())).join("\u0000");
  const links = useMemo(() => {
    if (!enabled || !queriesKey) return [];
    return buildCrossModeLinksForThread(queriesKey.split("\u0000"), {
      medications: medications.data?.records ?? [],
      services: services.records,
      forms: forms.records,
      differentials: differentials ?? undefined,
    });
  }, [enabled, queriesKey, medications.data, services.records, forms.records, differentials]);

  if (links.length === 0) return null;

  const telemetryQuery = queriesKey.split("\u0000").at(-1) ?? "";
  const handleModeSearch =
    onModeSearch ??
    ((mode: AppModeId, query: string) => {
      router.push(appModeHomeHref(mode, { query, focus: true, run: true }));
    });

  return <CrossModeLinksStrip links={links} onModeSearch={handleModeSearch} query={telemetryQuery} />;
}

export function CrossModeLinksStrip({
  links,
  onModeSearch,
  query = "",
}: {
  links: CrossModeLink[];
  onModeSearch: (mode: AppModeId, query: string) => void;
  // The search text that produced the links; used only for click telemetry.
  query?: string;
}) {
  if (links.length === 0) return null;

  return (
    <section
      aria-label="Related pages in other modes"
      className="max-w-[68ch] border-t border-[color:var(--border)] pt-3"
      data-testid="cross-mode-links"
    >
      <p className={cn(eyebrowText, "mb-2.5")}>
        Also in your library
        {links.length > 1 ? (
          <span className="font-medium normal-case tracking-normal text-[color:var(--text-muted)]">
            {" "}
            · {links.length} matches
          </span>
        ) : null}
      </p>

      <div
        role="list"
        tabIndex={links.length > 1 ? 0 : undefined}
        aria-label={links.length > 1 ? "Related library matches; scroll horizontally for more" : undefined}
        className="cross-mode-links-rail polished-scroll grid gap-2 overflow-x-auto overscroll-x-contain pb-1 md:flex md:w-max md:max-w-full md:gap-2.5"
        data-testid="cross-mode-links-rail"
      >
        {links.map((link) => {
          const Icon = appModeIcons[link.modeId];
          return (
            <CrossModeLinkCard
              key={`${link.modeId}:${link.slug}`}
              link={link}
              Icon={Icon}
              query={query}
              onModeSearch={onModeSearch}
            />
          );
        })}
      </div>
    </section>
  );
}
