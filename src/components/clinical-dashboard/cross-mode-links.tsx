"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, type LucideIcon } from "lucide-react";

import { cn, eyebrowText, semanticChipTone, sourceCard, type SemanticChipTone } from "@/components/ui-primitives";
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

function CrossModeLinkCard({ link, Icon, query, onModeSearch }: CrossModeLinkCardProps) {
  const extraBadge = link.badges[0] ?? null;

  return (
    <article
      role="listitem"
      className={cn(sourceCard, "flex min-h-12 min-w-0 items-center gap-2.5 px-2.5 py-1.5", "md:max-w-full")}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <Link
        href={link.detailHref}
        onClick={() => logCrossModeLinkOpen(query, link)}
        className="inline-flex min-h-11 min-w-0 items-center text-sm font-semibold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <span className="truncate">{link.title}</span>
      </Link>
      <span className="inline-flex min-h-6 shrink-0 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 text-2xs font-semibold text-[color:var(--text-muted)]">
        {link.modeLabel}
      </span>
      {extraBadge ? (
        // Decorative on narrow screens — hidden below sm so the title keeps room.
        <span
          className={cn(
            "hidden shrink-0 items-center rounded-full border px-1.5 py-0.5 text-2xs font-semibold sm:inline-flex",
            semanticChipTone(badgeChipTone(extraBadge.tone)),
          )}
        >
          {extraBadge.label}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          logCrossModeLinkOpen(query, link);
          onModeSearch(link.modeId, link.modeSearchQuery);
        }}
        aria-label={`Search ${link.title} in ${link.modeLabel}`}
        title={`Search in ${link.modeLabel}`}
        className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
      </button>
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
      className="max-w-[68ch] border-t border-[color:var(--border)] pt-2.5"
      data-testid="cross-mode-links"
    >
      <p className={cn(eyebrowText, "mb-2")}>
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
        className="grid min-w-0 gap-1.5 md:flex md:max-w-full md:flex-wrap md:gap-2"
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
