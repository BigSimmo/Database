"use client";

import { Layers } from "lucide-react";
import type { ReactNode } from "react";

import { cardAccentEdge } from "@/components/card-recipes";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { cn, textMuted } from "@/components/ui-primitives";
import { appModeDefinition, type AppModeId } from "@/lib/app-modes";
import { APP_MODE_ACCENT, APP_MODE_ICON } from "@/lib/category-identity";

/**
 * Design-scratch study: also-matches cards without the 3px top category rail.
 *
 * Live cards use `cardAccentEdge` (top highlight). These three alternatives keep
 * the same four-mode cluster, glyphs, and `--cat-*` tokens, and move identity
 * off the top edge. Presentation only — not a production swap.
 */

type CardTreatment = "rail" | "quiet" | "spine" | "chip";

const CLUSTER = ["prescribing", "services", "forms", "dsm"] as const satisfies readonly AppModeId[];

const SAMPLE_ITEMS: Record<(typeof CLUSTER)[number], readonly [string, string]> = {
  prescribing: ["Acamprosate", "Naltrexone"],
  services: ["13YARN", "Headspace"],
  forms: ["Mental Health Act Form 6", "Community treatment order"],
  dsm: ["Alcohol use disorder", "Stimulant use disorder"],
};

const alternatives: Array<{
  id: Exclude<CardTreatment, "rail">;
  letter: string;
  name: string;
  idea: string;
  cost: string;
}> = [
  {
    id: "quiet",
    letter: "A",
    name: "Quiet — tile and title only",
    idea: "Drop the rail. Colour lives in the icon tile and the mode title. The card is otherwise an ordinary surface.",
    cost: "Softest of the set. In a four-up grid the tiles still separate the modes; the cards themselves look more alike at a glance.",
  },
  {
    id: "spine",
    letter: "B",
    name: "Left spine",
    idea: "Move the 3px category edge from the top to the leading edge. Reads as an index mark, not a highlight bar.",
    cost: "Same amount of paint as today, just rotated. Still an extra edge on a card that already has a 1px border.",
  },
  {
    id: "chip",
    letter: "C",
    name: "Tinted code chip",
    idea: "No rail. The short code (Meds / Services / Forms / DSM) carries the accent fill. Title stays heading colour so the card is not painted twice.",
    cost: "Distinction concentrates in a small chip. Forced-colors still has the tile and the code text; the fill may flatten.",
  },
];

function AlsoMatchesCard({ modeId, treatment }: { modeId: (typeof CLUSTER)[number]; treatment: CardTreatment }) {
  const mode = appModeDefinition(modeId);
  const accent = APP_MODE_ACCENT[modeId];
  const titleAccented = treatment !== "chip";
  const chipAccented = treatment === "chip";

  return (
    <div
      data-category-accent={accent}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3",
        treatment === "rail" && cardAccentEdge,
        treatment === "spine" && "border-l-[3px] border-l-[color:var(--cat-accent)]",
      )}
    >
      <CategoryIconTile icon={APP_MODE_ICON[modeId]} accent={accent} size="sm" />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "block truncate text-2xs font-semibold uppercase tracking-label",
              titleAccented ? "text-[color:var(--cat-accent)]" : "text-[color:var(--text-heading)]",
            )}
          >
            {mode.label}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-2xs font-semibold",
              chipAccented
                ? "border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] text-[color:var(--cat-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
            )}
          >
            {mode.search.statusLabel}
          </span>
        </span>
        {SAMPLE_ITEMS[modeId].map((title) => (
          <span key={title} className="block truncate text-xs font-medium leading-snug text-[color:var(--text)]">
            {title}
          </span>
        ))}
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-start pt-0.5 text-2xs font-semibold sm:items-center sm:pt-0",
          textMuted,
        )}
      >
        View all
      </span>
    </div>
  );
}

function AlsoMatchesPanel({
  treatment,
  density = "desktop",
}: {
  treatment: CardTreatment;
  density?: "desktop" | "phone";
}) {
  const phone = density === "phone";
  return (
    <section
      className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-1.5 shadow-[var(--shadow-inset)]"
      aria-label="Matches in other modes"
    >
      <div className="mb-1.5 flex items-center gap-2 px-2 py-1">
        <span
          className={cn(
            "h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            phone ? "grid" : "hidden",
          )}
          aria-hidden
        >
          <Layers className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-heading)]">
          Also matches in other modes
        </span>
        {phone ? null : <span className={cn("text-2xs font-medium", textMuted)}>Across Clinical KB</span>}
      </div>
      <div className={cn("grid gap-2 px-1 pb-1", phone ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4")}>
        {CLUSTER.map((modeId) => (
          <AlsoMatchesCard key={modeId} modeId={modeId} treatment={treatment} />
        ))}
      </div>
    </section>
  );
}

function Frame({ label, width, children }: { label: string; width: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{label}</p>
      <div
        className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 sm:p-4"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}

export function AlsoMatchesAccentMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[80rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Also matches — card identity
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Three ways to drop the top highlight
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Today each peer-mode card wears a 3px `--cat-accent` rail along the top. That reads as a highlight. These
            alternatives keep category colour (tile, title, or chip) and leave nav unpainted. Accents still come from
            `--type-*` / `--tone-*` — not danger, warning, or success.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[80rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="today-title"
          className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
          data-testid="also-matches-variant-rail"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:px-5">
            <h2 id="today-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
              Today — 3px top rail
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">
              Live treatment. The rail is the loudest identity mark on the card; tile and title repeat the same hue.
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <Frame label="Desktop grid" width="100%">
              <AlsoMatchesPanel treatment="rail" />
            </Frame>
          </div>
        </section>

        {alternatives.map((option) => (
          <section
            key={option.id}
            aria-labelledby={`${option.id}-title`}
            className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
            data-testid={`also-matches-variant-${option.id}`}
          >
            <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-[color:var(--clinical-accent)]">{option.letter}</span>
                <h2 id={`${option.id}-title`} className="text-base font-extrabold text-[color:var(--text-heading)]">
                  {option.name}
                </h2>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">{option.idea}</p>
              <p className="mt-1 max-w-3xl text-2xs leading-4 text-[color:var(--text-soft)]">
                <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {option.cost}
              </p>
            </div>
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,20rem)]">
              <Frame label="Desktop · 4-up" width="100%">
                <AlsoMatchesPanel treatment={option.id} />
              </Frame>
              <Frame label="Phone · 2-up" width="24.375rem">
                <AlsoMatchesPanel treatment={option.id} density="phone" />
              </Frame>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
