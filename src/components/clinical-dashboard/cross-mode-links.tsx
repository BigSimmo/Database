"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Search, type LucideIcon } from "lucide-react";

import { cn, eyebrowText, semanticChipTone, sourceCard, type SemanticChipTone } from "@/components/ui-primitives";
import { logCrossModeLinkOpen } from "@/components/clinical-dashboard/source-actions";
import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { APP_MODE_ACCENT } from "@/lib/category-identity";
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

type CrossModeLinksVariant = "card" | "compact" | "responsive-compact" | "line";

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
      data-category-accent={APP_MODE_ACCENT[link.modeId]}
      className={cn(sourceCard, "flex min-h-12 min-w-0 items-center gap-2.5 px-2.5 py-1.5", "md:max-w-full")}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] text-[color:var(--cat-accent)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <Link
        href={link.detailHref}
        onClick={() => logCrossModeLinkOpen(query, link)}
        className="inline-flex min-h-tap min-w-0 items-center text-sm font-semibold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--cat-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
          onModeSearch(link.modeId, link.modeSearchQuery);
        }}
        aria-label={`Search ${link.title} in ${link.modeLabel}`}
        title={`Search in ${link.modeLabel}`}
        className="ml-auto grid h-tap w-tap shrink-0 place-items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--cat-border)] hover:bg-[color:var(--cat-soft)] hover:text-[color:var(--cat-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    </article>
  );
}

// Compact one-line variant of the card: a small rectangle with the entity
// name and mode label linking to the reference, plus a square trailing
// button that re-runs the search inside that mode. Used where vertical
// space matters (e.g. the documents search page).
function CrossModeLinkChip({ link, Icon, query, onModeSearch }: CrossModeLinkCardProps) {
  return (
    <article
      role="listitem"
      data-category-accent={APP_MODE_ACCENT[link.modeId]}
      className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--cat-border)] hover:shadow-[var(--e1)]"
    >
      <Link
        href={link.detailHref}
        onClick={() => logCrossModeLinkOpen(query, link)}
        className="inline-flex min-h-tap min-w-0 items-center gap-2 px-2.5 transition hover:text-[color:var(--cat-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)] md:min-h-compact-meta"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] text-[color:var(--cat-accent)]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="max-w-[13rem] truncate text-xs font-semibold text-[color:var(--text-heading)]">
          {link.title}
        </span>
        <span className="shrink-0 text-2xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]">
          {link.modeLabel}
        </span>
      </Link>
      <button
        type="button"
        // Matches the card variant: the search button re-runs the query in the
        // target mode, so it must not emit a cross_mode_link_open (a detail-page
        // open) — only the title link above does. Otherwise every "Search in …"
        // click would corrupt retrieval-quality/click telemetry.
        onClick={() => onModeSearch(link.modeId, link.modeSearchQuery)}
        aria-label={`Search ${link.title} in ${link.modeLabel}`}
        className="grid min-h-tap w-tap shrink-0 place-items-center border-l border-[color:var(--border)] text-[color:var(--text-muted)] transition hover:bg-[color:var(--cat-soft)] hover:text-[color:var(--cat-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)] md:min-h-compact-meta md:w-compact-meta"
      >
        <Search className="h-3.5 w-3.5" aria-hidden />
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
  variant = "card",
}: {
  queries: Array<string | null | undefined>;
  enabled?: boolean;
  // Defaults to navigating to the target mode with the search pre-run.
  onModeSearch?: (mode: AppModeId, query: string) => void;
  variant?: CrossModeLinksVariant;
}) {
  const router = useRouter();
  const services = useRegistryRecords("service", { enabled, view: "search" });
  const forms = useRegistryRecords("form", { enabled, view: "search" });
  // fields=index keeps this to the ~30 KB identity slice of the catalog.
  const medications = useMedicationCatalog(undefined, { enabled, fields: "index" });
  const [differentials, setDifferentials] = useState<CrossModeDifferentialCatalog | null>(null);
  useEffect(() => {
    // Dynamic import keeps the cross-mode catalog out of the dashboard bundle.
    // cross-mode-differentials.ts now loads a precomputed ~53 KB index (not the
    // full ~1.2 MB differentials snapshot); the catalog is loaded once per session.
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

  return <CrossModeLinksStrip links={links} onModeSearch={handleModeSearch} query={telemetryQuery} variant={variant} />;
}

/**
 * One line, opened on demand — the answer thread's variant (owner decision,
 * 2026-08-26, "direction B").
 *
 * Under an answer this block used to be a permanently expanded rail sitting
 * directly above a second, near-identical panel of mode matches. Two panels
 * asking the same question ("where else does this appear") read as one panel
 * repeated, and neither is the clinician's next step — the follow-up questions
 * above them are. So this collapses to a single row carrying a preview of what
 * is inside, and opens to exactly the rail it always was.
 *
 * The preview names come from the resolved links, so the line can never
 * advertise a match the expanded rail does not list.
 */
function CrossModeLinksLine({
  links,
  onModeSearch,
  query,
}: {
  links: CrossModeLink[];
  onModeSearch: (mode: AppModeId, query: string) => void;
  query: string;
}) {
  const [open, setOpen] = useState(false);
  // `useId`, not a constant: two of these can mount at once (the answer thread
  // and a historical turn), and a duplicate id is a DOM-integrity failure the
  // smoke audit fails on.
  const panelId = useId();
  const preview = links.slice(0, 3).map((link) => link.title);
  const rest = links.length - preview.length;
  return (
    <section aria-label="Related pages in other modes" data-testid="cross-mode-links" className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="cross-mode-links-line-trigger"
        className={cn(
          "flex min-h-12 w-full items-center gap-2 rounded-xl border border-[color:var(--border)] px-3 text-left transition hover:bg-[color:var(--surface-subtle)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        )}
      >
        <span className={cn(eyebrowText, "shrink-0")}>Also in your library</span>
        <span className="min-w-0 flex-1 truncate text-2xs text-[color:var(--text-muted)]">
          {preview.join(" · ")}
          {rest > 0 ? ` · +${rest}` : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-icon-xs shrink-0 text-[color:var(--text-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {/* Always mounted, hidden with `display: none` when closed. Rendering it
          only while open left `aria-controls` pointing at nothing for the whole
          time the line was collapsed — a broken ARIA reference, which is what
          the smoke suite's DOM-integrity audit caught. */}
      <div
        id={panelId}
        role="list"
        className={cn(
          "cross-mode-links-rail mt-1.5 grid min-w-0 gap-1.5 md:flex md:max-w-full md:flex-wrap md:gap-2",
          !open && "hidden",
        )}
        data-testid="cross-mode-links-rail"
      >
        {links.map((link) => (
          <CrossModeLinkCard
            key={`${link.modeId}:${link.slug}`}
            link={link}
            Icon={appModeIcons[link.modeId]}
            query={query}
            onModeSearch={onModeSearch}
          />
        ))}
      </div>
    </section>
  );
}

export function CrossModeLinksStrip({
  links,
  onModeSearch,
  query = "",
  variant = "card",
}: {
  links: CrossModeLink[];
  onModeSearch: (mode: AppModeId, query: string) => void;
  // The search text that produced the links; used only for click telemetry.
  query?: string;
  variant?: CrossModeLinksVariant;
}) {
  if (links.length === 0) return null;

  if (variant === "line") {
    return <CrossModeLinksLine links={links} onModeSearch={onModeSearch} query={query} />;
  }

  const compact = variant === "compact";
  const responsiveCompact = variant === "responsive-compact";
  const LinkItem = compact ? CrossModeLinkChip : CrossModeLinkCard;

  return (
    <section
      aria-label="Related pages in other modes"
      className={cn(
        "border-t border-[color:var(--border)] pt-2.5",
        compact ? "md:flex md:items-center md:gap-3" : "max-w-[68ch]",
      )}
      data-testid="cross-mode-links"
    >
      <p className={cn(eyebrowText, compact ? "mb-2 shrink-0 md:mb-0" : "mb-2")}>
        Also in your library
        {links.length > 1 ? (
          <span className="font-medium normal-case tracking-normal text-[color:var(--text-muted)]">
            {" "}
            · {links.length} matches
          </span>
        ) : null}
      </p>

      {responsiveCompact ? (
        // Both rails stay mounted so SSR and the first paint agree; `hidden` /
        // `md:hidden` use `display: none`, which removes the inactive rail from
        // the accessibility tree. Keep distinct test ids so phone vs wide
        // selectors do not double-count links.
        <>
          <div
            role="list"
            tabIndex={links.length > 1 ? 0 : undefined}
            aria-label={links.length > 1 ? "Related library matches; scroll horizontally for more" : undefined}
            className="cross-mode-links-rail polished-scroll flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 md:hidden"
            data-testid="cross-mode-links-rail"
          >
            {links.map((link) => (
              <CrossModeLinkChip
                key={`${link.modeId}:${link.slug}`}
                link={link}
                Icon={appModeIcons[link.modeId]}
                query={query}
                onModeSearch={onModeSearch}
              />
            ))}
          </div>
          <div
            role="list"
            className="cross-mode-links-rail hidden min-w-0 gap-1.5 md:flex md:max-w-full md:flex-wrap md:gap-2"
            data-testid="cross-mode-links-card-rail"
          >
            {links.map((link) => (
              <CrossModeLinkCard
                key={`${link.modeId}:${link.slug}`}
                link={link}
                Icon={appModeIcons[link.modeId]}
                query={query}
                onModeSearch={onModeSearch}
              />
            ))}
          </div>
        </>
      ) : (
        <div
          role="list"
          tabIndex={compact && links.length > 1 ? 0 : undefined}
          aria-label={compact && links.length > 1 ? "Related library matches; scroll horizontally for more" : undefined}
          className={cn(
            "cross-mode-links-rail",
            compact
              ? "polished-scroll flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 md:pb-0"
              : "grid min-w-0 gap-1.5 md:flex md:max-w-full md:flex-wrap md:gap-2",
          )}
          data-testid="cross-mode-links-rail"
        >
          {links.map((link) => (
            <LinkItem
              key={`${link.modeId}:${link.slug}`}
              link={link}
              Icon={appModeIcons[link.modeId]}
              query={query}
              onModeSearch={onModeSearch}
            />
          ))}
        </div>
      )}
    </section>
  );
}
