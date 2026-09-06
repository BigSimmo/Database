"use client";

import { ChevronDown, ChevronRight, Filter, Layers, ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CategoryIconTile } from "@/components/category-icon-tile";
import { focusRing } from "@/components/card-recipes";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeDefinition, type AppModeId } from "@/lib/app-modes";
import { APP_MODE_ACCENT, APP_MODE_ICON } from "@/lib/category-identity";

/**
 * Design-scratch study: closing "Also matches" on tablet and desktop.
 *
 * Today the cross-mode tray is collapsed on phones only. From 640px up it is
 * always open, so a four-up grid of suggestions sits between the composer and
 * the answer to the question actually asked. This study asks what the CLOSED
 * state should be at those widths, given that it must still say how many modes
 * matched — otherwise the control is a blind door and nobody opens it.
 *
 * Not a production surface. Geometry mirrors
 * `clinical-dashboard/universal-search-also-matches.tsx` closely enough to
 * judge the disclosure, not closely enough to copy wholesale.
 */

type Density = "desktop" | "tablet" | "phone";

const CLUSTER = ["prescribing", "differentials", "therapy-compass"] as const satisfies readonly AppModeId[];

const SAMPLE_ITEMS: Record<(typeof CLUSTER)[number], readonly [string, string]> = {
  prescribing: ["Lithium carbonate (IR/SR)", "Tapentadol SR"],
  differentials: ["Lithium", "Lithium adverse effects"],
  "therapy-compass": ["Couples Therapy", "Developmental social-skills interventions"],
};

const MATCH_COUNT = CLUSTER.length;

function gridColumns(density: Density) {
  if (density === "phone") return "grid-cols-1";
  if (density === "tablet") return "grid-cols-2";
  return "grid-cols-3";
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function ModeCard({ modeId, density }: { modeId: (typeof CLUSTER)[number]; density: Density }) {
  const mode = appModeDefinition(modeId);
  const accent = APP_MODE_ACCENT[modeId];
  const phone = density === "phone";

  return (
    <div
      data-category-accent={accent}
      className="group/card flex min-w-0 flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)]"
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-t-xl px-2 text-left",
          phone ? "min-h-tap" : "min-h-compact-meta py-1",
        )}
      >
        <CategoryIconTile icon={APP_MODE_ICON[modeId]} accent={accent} size="sm" />
        <span className="min-w-0 flex-1 truncate text-2xs font-semibold uppercase tracking-label text-[color:var(--text-heading)]">
          {mode.label}
        </span>
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center rounded-md border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] px-1.5 py-px text-2xs font-semibold text-[color:var(--cat-accent)]"
        >
          {mode.search.statusLabel}
        </span>
        <ArrowRight className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
      </span>
      <ul className="flex min-w-0 flex-col border-t border-[color:var(--border)] px-1 py-1">
        {SAMPLE_ITEMS[modeId].map((title) => (
          <li key={title} className="min-w-0">
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 text-xs font-medium leading-snug text-[color:var(--text)]",
                phone ? "min-h-tap" : "py-1",
              )}
            >
              <span className="line-clamp-2 min-w-0 flex-1">{title}</span>
              <ChevronRight className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeGrid({ density, className }: { density: Density; className?: string }) {
  return (
    <div className={cn("grid gap-2", gridColumns(density), className)}>
      {CLUSTER.map((modeId) => (
        <ModeCard key={modeId} modeId={modeId} density={density} />
      ))}
    </div>
  );
}

/** The trigger's own content, shared by every direction so only the container differs. */
function TriggerFace({ open, density }: { open: boolean; density: Density }) {
  return (
    <>
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)]"
        aria-hidden
      >
        <Layers className="size-icon-md" aria-hidden />
      </span>
      <span className={cn(eyebrowText, "shrink-0 text-[color:var(--text-heading)]")}>Also matches</span>
      <span className="h-px min-w-3 flex-1 bg-[color:var(--border)]" aria-hidden />
      {/* Not aria-hidden. Production hides this because a visually hidden
          role="status" node announces the count properly; this study has no such
          node, so hiding it would leave the closed control with no count at all
          for a screen reader — the one thing the study says it must state. */}
      <span className="shrink-0 text-2xs font-medium tabular-nums text-[color:var(--text-muted)]">
        {MATCH_COUNT} related modes
      </span>
      <span
        className={cn(
          "-mr-1 grid shrink-0 place-items-center rounded-md text-[color:var(--text-muted)] transition-transform motion-reduce:transition-none",
          density === "phone" ? "h-8 w-8" : "h-7 w-7",
          open && "rotate-180",
        )}
        aria-hidden
      >
        <ChevronDown className="size-icon-md" aria-hidden />
      </span>
    </>
  );
}

/** Compact pill trigger used by directions B and C. */
function ChipTrigger({ open, onToggle, density }: { open: boolean; onToggle: () => void; density: Density }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-semibold transition-colors",
        density === "phone" ? "min-h-tap" : "min-h-8 py-1",
        open
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      <Layers className="size-icon-sm shrink-0" aria-hidden />
      <span>Also matches</span>
      <span className="sr-only">{MATCH_COUNT} related modes</span>
      <span
        aria-hidden
        className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-3xs font-extrabold tabular-nums",
          open
            ? "bg-[color:var(--clinical-accent)] text-[color:var(--surface-raised)]"
            : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
        )}
      >
        {MATCH_COUNT}
      </span>
      <ChevronDown
        className={cn("size-icon-sm shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")}
        aria-hidden
      />
    </button>
  );
}

/** The results band the tray sits above, so each closed state is judged in context. */
function ResultsBand({ density, metaSlot }: { density: Density; metaSlot?: ReactNode }) {
  const phone = density === "phone";
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className="h-4 w-0.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]" aria-hidden />
        <span className="text-xs font-extrabold text-[color:var(--text-heading)]">7 documents</span>
        <span className="text-xs font-medium text-[color:var(--text-muted)]">lithium</span>
        <span className="flex-1" aria-hidden />
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
          Relevance
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
          A–Z
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 py-1 text-2xs font-semibold text-[color:var(--text-muted)]">
          <Filter className="size-icon-sm" aria-hidden />
          Filter
        </span>
        {metaSlot}
      </div>
      <div className={cn("grid gap-2", phone ? "grid-cols-1" : "grid-cols-2")}>
        {["Lithium Clinical Guideline", "Lithium Carbonate (IR SR)"].map((title) => (
          <div
            key={title}
            className="flex min-w-0 items-start gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2 shadow-[var(--e1)]"
          >
            <span
              className="h-12 w-9 shrink-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-inset)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">{title}</span>
              <span className="block text-3xs font-semibold text-[color:var(--text-muted)]">
                High relevance · Page 3
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Direction A — in-tray disclosure                                    */
/* ------------------------------------------------------------------ */

function DirectionTray({ density, startOpen = false }: { density: Density; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="grid gap-3">
      <section
        aria-label="Matches in other modes"
        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1.5 sm:p-2"
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors hover:bg-[color:var(--surface)]",
            density === "phone" ? "min-h-tap" : "min-h-11",
            focusRing,
          )}
        >
          <TriggerFace open={open} density={density} />
        </button>
        {open ? <ModeGrid density={density} className="mt-1.5" /> : null}
      </section>
      <ResultsBand density={density} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Direction B — meta-row chip                                         */
/* ------------------------------------------------------------------ */

function DirectionChip({ density, startOpen = false }: { density: Density; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className="h-4 w-0.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]" aria-hidden />
        <span className="text-xs font-extrabold text-[color:var(--text-heading)]">7 documents</span>
        <span className="text-xs font-medium text-[color:var(--text-muted)]">lithium</span>
        <span className="flex-1" aria-hidden />
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
          Relevance
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
          A–Z
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 py-1 text-2xs font-semibold text-[color:var(--text-muted)]">
          <Filter className="size-icon-sm" aria-hidden />
          Filter
        </span>
        <ChipTrigger open={open} onToggle={() => setOpen((value) => !value)} density={density} />
      </div>
      {open ? (
        <section
          aria-label="Matches in other modes"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1.5 motion-safe:animate-fade-up sm:p-2"
        >
          <ModeGrid density={density} />
        </section>
      ) : null}
      <div className={cn("grid gap-2", density === "phone" ? "grid-cols-1" : "grid-cols-2")}>
        {["Lithium Clinical Guideline", "Lithium Carbonate (IR SR)"].map((title) => (
          <div
            key={title}
            className="flex min-w-0 items-start gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2 shadow-[var(--e1)]"
          >
            <span
              className="h-12 w-9 shrink-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-inset)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">{title}</span>
              <span className="block text-3xs font-semibold text-[color:var(--text-muted)]">
                High relevance · Page 3
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Direction C — anchored popover                                      */
/* ------------------------------------------------------------------ */

function DirectionPopover({ density }: { density: Density }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      {/* Reserve enough frame height for the floating panel to be seen in full.
          It still overlays the first row of results, which is the trade-off. */}
      <div className={cn("relative", open && "min-h-[23rem]")}>
        <ResultsBand
          density={density}
          metaSlot={<ChipTrigger open={open} onToggle={() => setOpen((value) => !value)} density={density} />}
        />
        {open ? (
          <div
            className={cn(
              "absolute left-0 right-0 top-[5.25rem] rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-[var(--e3,0_16px_40px_rgba(15,23,42,0.18))] motion-safe:animate-fade-up",
            )}
          >
            <span className="mb-1.5 flex items-center gap-2 px-1">
              <span className={cn(eyebrowText, "text-[color:var(--text-heading)]")}>Also matches</span>
              <span className="h-px flex-1 bg-[color:var(--border)]" aria-hidden />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-2 py-1 text-2xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
                  focusRing,
                )}
              >
                Close
              </button>
            </span>
            <ModeGrid density={density} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

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

function Study({
  letter,
  title,
  chosen,
  idea,
  cost,
  testId,
  children,
}: {
  letter: string;
  title: string;
  chosen?: boolean;
  idea: string;
  cost: string;
  testId: string;
  children: ReactNode;
}) {
  const headingId = `${testId}-title`;
  return (
    <section
      aria-labelledby={headingId}
      data-testid={testId}
      className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-[color:var(--clinical-accent)]">{letter}</span>
          <h2 id={headingId} className="text-base font-extrabold text-[color:var(--text-heading)]">
            {title}
          </h2>
          {chosen ? (
            <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
              Recommended
            </span>
          ) : null}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">{idea}</p>
        <p className="mt-1 max-w-3xl text-2xs leading-4 text-[color:var(--text-soft)]">
          <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {cost}
        </p>
      </div>
      <div className="grid gap-6 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function AlsoMatchesClosedMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[80rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Also matches — closed by default
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Closed on tablet and desktop. One click to open.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Today the cross-mode tray is collapsed on phones only. From 640px up it is always open, so a grid of
            suggestions sits between the composer and the results the search actually asked for. Every direction below
            is live — click the control to open and close it.
          </p>
          <p className="mt-3 max-w-3xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-2xs leading-5 text-[color:var(--text-muted)]">
            <span className="font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-heading)]">
              Constant across all three
            </span>{" "}
            — the cross-mode lookup still runs on submit, so the closed control states the real count and the whole
            surface stays hidden when nothing matched. A closed control that cannot say what is behind it is a blind
            door and gets ignored.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[80rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Study
          letter="B"
          title="Meta-row chip"
          chosen
          testId="also-matches-closed-chip"
          idea="No tray at all when closed. The disclosure becomes a pill on the row that already holds Filter, reading `Also matches · 3`. Opening unfolds the same tray directly beneath that row, above the result cards."
          cost="Quieter than a full-width band, so it relies on the count to earn the press. Adds a third control to a row that already carries Filter and the sort pair."
        >
          <Frame label="Desktop · closed, then click the chip" width="100%">
            <DirectionChip density="desktop" />
          </Frame>
          <Frame label="Desktop · shown open for comparison" width="100%">
            <DirectionChip density="desktop" startOpen />
          </Frame>
          <Frame label="Tablet · 768px" width="48rem">
            <DirectionChip density="tablet" />
          </Frame>
          <Frame label="Phone · 390px" width="24.375rem">
            <DirectionChip density="phone" />
          </Frame>
        </Study>

        <Study
          letter="A"
          title="In-tray disclosure"
          testId="also-matches-closed-tray"
          idea="Keep the tray, keep the header exactly as it looks today, and simply let it collapse at every width instead of only on phones. The smallest possible change to shipped code."
          cost="Closed, it is still a full-width band with a hairline rule running across it — roughly 44px of chrome that says almost nothing. On a wide desktop that empty rule is conspicuous."
        >
          <Frame label="Desktop · closed, then click the row" width="100%">
            <DirectionTray density="desktop" />
          </Frame>
          <Frame label="Tablet · 768px" width="48rem">
            <DirectionTray density="tablet" />
          </Frame>
          <Frame label="Phone · 390px, unchanged from today" width="24.375rem">
            <DirectionTray density="phone" />
          </Frame>
        </Study>

        <Study
          letter="C"
          title="Anchored popover"
          testId="also-matches-closed-popover"
          idea="Same chip trigger as B, but the panel floats over the results instead of pushing them down, so nothing below it moves when it opens or closes."
          cost="A new overlay pattern for a low-stakes suggestion surface. Needs focus trapping, Escape, outside-click dismissal and edge repositioning, and it covers the first row of results while open, which is the content the search was for."
        >
          <Frame label="Desktop · click the chip, results stay put" width="100%">
            <DirectionPopover density="desktop" />
          </Frame>
          <Frame label="Tablet · 768px" width="48rem">
            <DirectionPopover density="tablet" />
          </Frame>
        </Study>
      </div>
    </main>
  );
}
