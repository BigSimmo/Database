import { modeSummaryHairline, modeSummaryMutedText, modeSummarySurface } from "@/components/mode-kit/recipes";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { ActionStrip, type TeachingAction } from "@/components/teaching/teaching-actions";
import { LiveLabel } from "@/components/teaching/teaching-modules";
import { cn } from "@/components/ui-primitives";

/*
 * Today's hero on the kit's summary surface. One display figure (the start
 * time, regular weight, tabular) with the end after an en dash; on a day with no teaching
 * the date leads ("Tue 6 Oct · 08:00"). The design draws the figure at 40px;
 * the type scale has no 40px step, so it is `text-hero`.
 */
export type HeroModelProps = {
  eyebrowRight: string | null;
  figureDate?: string | null;
  figure: string | null;
  figureEnd: string | null;
  title: string;
  meta: string;
  status: string | null;
  live?: boolean;
  actions: readonly TeachingAction[];
};

// The kit's summary recipes: surface + ink, muted text, and the hairline.
const muted = modeSummaryMutedText;
const ink = "text-[color:var(--surface-summary-ink)]";

export function TeachingHero({
  eyebrowRight,
  figureDate = null,
  figure,
  figureEnd,
  title,
  meta,
  status,
  live = false,
  actions,
}: HeroModelProps) {
  return (
    <section
      aria-label="Next up"
      data-testid="teaching-hero"
      data-mode-identity="teaching"
      className={cn(modeSummarySurface, "grid gap-0.5 p-3")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-2xs leading-4 font-semibold tracking-label uppercase", muted)}>Next up</span>
        {eyebrowRight ? (
          <span className={cn("nums text-sm font-normal", muted)}>
            {live ? <LiveLabel freshKey="hero">{eyebrowRight}</LiveLabel> : eyebrowRight}
          </span>
        ) : null}
      </div>
      {figure ? (
        <p data-hero-figure className="flex flex-wrap items-baseline gap-x-2">
          {figureDate ? (
            <span data-hero-date className={cn("nums text-base-minus font-normal", ink)}>{`${figureDate} · `}</span>
          ) : null}
          <span className={cn("nums text-hero font-normal", ink)}>{figure}</span>
          {figureEnd ? <span className={cn("nums text-base-minus font-normal", muted)}>{figureEnd}</span> : null}
        </p>
      ) : null}
      <p className={cn("text-base-minus font-medium", ink)}>{title}</p>
      {meta ? <p className={cn("text-sm", muted)}>{meta}</p> : null}
      {status ? (
        <p className={cn("text-sm", muted)}>
          <ModeStateLabel tone="muted">{status}</ModeStateLabel>
        </p>
      ) : null}
      <ActionStrip
        actions={actions.slice(0, 2)}
        surface="summary"
        className={cn(modeSummaryHairline, "mt-1.5 pt-1.5")}
      />
    </section>
  );
}
