"use client";

import { ChevronDown, Layers } from "lucide-react";
import type { ReactNode } from "react";

import { cardAccentEdge } from "@/components/card-recipes";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { appModeDefinition, type AppModeId } from "@/lib/app-modes";
import { APP_MODE_ACCENT, APP_MODE_ICON } from "@/lib/category-identity";

/**
 * Design-scratch study: also-matches identity without the 3px top rail.
 *
 * Chosen direction: tinted code chip (option C). Desktop stays a 4-up grid;
 * phone stacks one mode card per line so titles and matches are not truncated
 * into a 2×2 or 4-up. Presentation only — not a production swap.
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
  chosen?: boolean;
}> = [
  {
    id: "quiet",
    letter: "A",
    name: "Quiet — tile and title only",
    idea: "Drop the rail. Colour lives in the icon tile and the mode title. The card is otherwise an ordinary surface.",
    cost: "Four uppercase titles in four hues still shout in a 4-up. Not chosen.",
  },
  {
    id: "spine",
    letter: "B",
    name: "Left spine",
    idea: "Move the 3px category edge from the top to the leading edge. Reads as an index mark, not a highlight bar.",
    cost: "Same paint as today, rotated. Not chosen.",
  },
  {
    id: "chip",
    letter: "C",
    name: "Tinted code chip",
    idea: "No rail. The short code (Meds / Services / Forms / DSM) carries the accent fill. Title stays heading colour so the card is not painted twice.",
    cost: "Distinction concentrates in the tile plus a small chip. Phone stacks one card per line.",
    chosen: true,
  },
];

function AlsoMatchesCard({
  modeId,
  treatment,
  density,
}: {
  modeId: (typeof CLUSTER)[number];
  treatment: CardTreatment;
  density: "desktop" | "phone";
}) {
  const mode = appModeDefinition(modeId);
  const accent = APP_MODE_ACCENT[modeId];
  const titleAccented = treatment !== "chip";
  const chipAccented = treatment === "chip";
  const phone = density === "phone";

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
          "inline-flex shrink-0 items-start pt-0.5 text-2xs font-semibold",
          phone ? "min-h-tap" : "sm:items-center sm:pt-0",
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
      <div
        className={cn(
          "flex items-center gap-2.5 px-2",
          phone ? "min-h-tap py-2" : "border-b border-[color:var(--border)] py-1.5",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            phone ? "h-8 w-8" : "h-7 w-7",
          )}
          aria-hidden
        >
          <Layers className="size-icon-sm" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn(eyebrowText, "truncate text-[color:var(--text-heading)]")}>
              Also matches
              <span className="sr-only"> in other modes</span>
            </span>
            {phone ? (
              <span
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--clinical-accent-soft)] px-1.5 text-2xs font-semibold tabular-nums text-[color:var(--clinical-accent)]"
                aria-hidden
              >
                4
              </span>
            ) : null}
          </span>
          {phone ? (
            <span className="text-2xs font-medium text-[color:var(--text-muted)]" aria-hidden>
              4 related modes
            </span>
          ) : null}
        </span>
        {phone ? (
          <span
            className="grid h-8 w-8 shrink-0 rotate-180 place-items-center rounded-md text-[color:var(--text-muted)]"
            aria-hidden
          >
            <ChevronDown className="size-icon-sm" aria-hidden="true" />
          </span>
        ) : (
          <span className={cn("text-2xs font-medium", textMuted)}>4 related modes</span>
        )}
      </div>
      <div className={cn("grid gap-2 px-1 pb-1", phone ? "grid-cols-1" : "grid-cols-2 pt-2 xl:grid-cols-4")}>
        {CLUSTER.map((modeId) => (
          <AlsoMatchesCard key={modeId} modeId={modeId} treatment={treatment} density={density} />
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
            Also matches — chosen direction
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Tinted chip. One card per line on the phone.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Option C: no top rail. Colour lives in the icon tile and the short code chip. Desktop stays a four-up grid.
            Phone stacks each mode on its own row so Medication, Services, Forms, and DSM are readable in full.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[80rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="chosen-title"
          className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
          data-testid="also-matches-chosen-chip"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-[color:var(--clinical-accent)]">C</span>
              <h2 id="chosen-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
                Tinted code chip
              </h2>
              <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                Chosen
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">
              Heading-colour titles. Accent fill on `Meds` / `Services` / `Forms` / `DSM`. Phone is a single column —
              not a four-up and not a 2×2.
            </p>
          </div>
          <div className="grid gap-6 p-4 sm:p-5">
            <Frame label="Desktop · 4-up" width="100%">
              <AlsoMatchesPanel treatment="chip" />
            </Frame>
            <Frame label="Phone · one per line" width="24.375rem">
              <AlsoMatchesPanel treatment="chip" density="phone" />
            </Frame>
          </div>
        </section>

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
              Live treatment, for comparison. Not the chosen direction.
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <Frame label="Desktop grid" width="100%">
              <AlsoMatchesPanel treatment="rail" />
            </Frame>
          </div>
        </section>

        {alternatives
          .filter((option) => !option.chosen)
          .map((option) => (
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
              <div className="p-4 sm:p-5">
                <Frame label="Desktop · 4-up" width="100%">
                  <AlsoMatchesPanel treatment={option.id} />
                </Frame>
              </div>
            </section>
          ))}
      </div>
    </main>
  );
}
