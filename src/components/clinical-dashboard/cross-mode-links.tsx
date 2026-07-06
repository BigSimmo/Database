"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import {
  chatMicroAction,
  cn,
  eyebrowText,
  iconTile,
  semanticChipTone,
  sourceCard,
  subtleStatusPill,
  textMuted,
  type SemanticChipTone,
} from "@/components/ui-primitives";
import { appModeIcons } from "@/lib/app-mode-icons";
import type { AppModeId } from "@/lib/app-modes";
import type { CrossModeLink, CrossModeLinkBadge } from "@/lib/cross-mode-links";

function badgeChipTone(tone: CrossModeLinkBadge["tone"]): SemanticChipTone | null {
  if (!tone) return null;
  return tone === "clinical" ? "info" : tone;
}

export function CrossModeLinksStrip({
  links,
  onModeSearch,
}: {
  links: CrossModeLink[];
  onModeSearch: (mode: AppModeId, query: string) => void;
}) {
  if (links.length === 0) return null;

  return (
    <section
      aria-label="Related pages in other modes"
      className="mx-auto w-full max-w-4xl"
      data-testid="cross-mode-links"
    >
      <p className={cn(eyebrowText, "mb-2")}>Also in your library</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const Icon = appModeIcons[link.modeId];
          return (
            <article key={`${link.modeId}:${link.slug}`} className={cn(sourceCard, "flex items-center gap-3 p-3")}>
              <span className={iconTile}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={link.detailHref}
                  className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--clinical-accent)]"
                >
                  <span className="line-clamp-1">{link.title}</span>
                </Link>
                {link.subtitle ? (
                  <p className={cn("text-xs leading-5 line-clamp-1", textMuted)}>{link.subtitle}</p>
                ) : null}
                {link.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {link.badges.map((badge) => (
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
                )}
              </div>
              <span className={cn(subtleStatusPill, "shrink-0")}>{link.modeLabel}</span>
              <button
                type="button"
                onClick={() => onModeSearch(link.modeId, link.modeSearchQuery)}
                aria-label={`Search ${link.title} in ${link.modeLabel}`}
                className={cn(chatMicroAction, "shrink-0")}
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
              </button>
              <ChevronRight className={cn("h-4 w-4 shrink-0", textMuted)} aria-hidden />
            </article>
          );
        })}
      </div>
    </section>
  );
}
