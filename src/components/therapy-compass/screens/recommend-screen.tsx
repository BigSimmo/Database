"use client";

import { Check, Copy, Search, Shield, Sparkles } from "lucide-react";

import { cardPadding, cardSurface } from "@/components/card-recipes";
import { PageHeader } from "@/components/ui/page-header";
import { cn, eyebrowText, pageContainer } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";

import { useTcBindings } from "../bindings";
import { interactiveRowBase } from "@/components/ui/interactive-row";
import { controlPressed } from "../controls";
import { RECOMMEND_CONSTRAINT_GROUPS, RECOMMEND_CONSTRAINTS } from "../data/select";
import { ResultCard } from "../therapy-card";
import { EmptyState, LoadingState } from "../ui";
import { useClipboard } from "../use-clipboard";

export function RecommendScreen() {
  const b = useTcBindings();
  const { copied, copy } = useClipboard();
  const ranked = b.recommendations;
  const top = ranked[0];
  const rest = ranked.slice(1);

  const copyShortlist = () =>
    copy(
      [
        "Recommendation shortlist",
        b.recQuery.trim() ? `Situation: ${b.recQuery.trim()}` : "",
        RECOMMEND_CONSTRAINTS.filter((c) => b.isConstraintActive(c.key)).length
          ? `Constraints: ${RECOMMEND_CONSTRAINTS.filter((c) => b.isConstraintActive(c.key))
              .map((c) => c.label)
              .join(", ")}`
          : "",
        "",
        ...ranked.map((r, i) => `${i + 1}. ${r.therapy.name}`),
      ]
        .filter(Boolean)
        .join("\n"),
      "shortlist",
    );

  return (
    <section data-screen-label="Recommend" className={pageContainer}>
      <PageHeader
        className="mb-6"
        eyebrow="Therapy Compass"
        icon={Sparkles}
        title="Recommend a therapy"
        description="Describe the clinical situation. Catalogue matches rank by presentation, setting, time and cautions — advisory, not a protocol. Confirm fit and review status before use."
      />

      <form
        data-therapy-recommend-composer
        className={cn(cardSurface, cardPadding.standard, "mb-8 sm:p-5")}
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="tc-rec-q" className="block text-xs font-semibold text-[color:var(--text-heading)]">
          Clinical situation
        </label>
        <textarea
          id="tc-rec-q"
          value={b.recQuery}
          onChange={(event) => b.setRecQuery(event.target.value)}
          placeholder="e.g. 28-year-old with panic attacks in outpatient clinic, 15 minutes available, no trauma work yet"
          className="mt-2 w-full min-h-20 resize-y rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3.5 py-3 text-base-minus leading-normal text-[color:var(--text)]"
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {RECOMMEND_CONSTRAINT_GROUPS.map((group) => {
            const chips = RECOMMEND_CONSTRAINTS.filter((constraint) => constraint.group === group.id);
            return (
              <fieldset key={group.id} className="min-w-0">
                <legend className={cn(eyebrowText, "mb-2 px-0")}>{group.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {chips.map((constraint) => {
                    const active = b.isConstraintActive(constraint.key);
                    const inferred = b.isConstraintInferred(constraint.key);
                    return (
                      <button
                        key={constraint.key}
                        type="button"
                        className={cn(
                          interactiveRowBase,
                          controlPressed,
                          "inline-flex w-auto min-h-tap items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2 text-sm-minus font-semibold text-[color:var(--text-muted)]",
                          "aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:bg-[color:var(--clinical-accent-soft)] aria-pressed:font-semibold aria-pressed:text-[color:var(--clinical-accent-hover)]",
                        )}
                        onClick={() => b.toggleConstraint(constraint.key)}
                        aria-pressed={active}
                        title={inferred ? `${constraint.label} — inferred from the situation` : undefined}
                      >
                        {constraint.label}
                        {active ? <Check aria-hidden="true" size={14} /> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        {RECOMMEND_CONSTRAINTS.some((constraint) => b.isConstraintInferred(constraint.key)) ? (
          <p className="mt-3 text-xs text-[color:var(--text-muted)]">
            From the situation: accent chips were inferred from the typed presentation. Toggle any chip to override.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[color:var(--text-muted)]" aria-live="polite">
            {b.loading
              ? "Ranking clinical matches…"
              : `${ranked.length} ranked ${ranked.length === 1 ? "match" : "matches"}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={copied === "shortlist" ? Check : Copy}
              onClick={copyShortlist}
              disabled={!ranked.length}
            >
              {copied === "shortlist" ? "Copied" : "Copy shortlist"}
            </Button>
            <Button variant="secondary" icon={Search} onClick={b.goSearch}>
              Refine in catalogue
            </Button>
          </div>
        </div>
      </form>

      {b.loading && !top ? (
        <LoadingState label="Ranking clinical matches…" />
      ) : !top ? (
        <EmptyState
          icon={Sparkles}
          title="No ranked matches"
          body="Add a presentation, setting or caution, or widen the constraints. Ranking stays inside the therapy catalogue."
        />
      ) : (
        <>
          <div className="mb-3.5 text-base-minus font-semibold text-[color:var(--text-heading)]">
            Ranked clinical matches
          </div>
          <div className="flex flex-col gap-3">
            <ResultCard
              therapy={top.therapy}
              rank={1}
              featured
              query={b.recQuery}
              whyMatched={top.reasons.join(" · ") || undefined}
            />
            {rest.map(({ therapy, reasons }, index) => (
              <ResultCard
                key={therapy.slug}
                therapy={therapy}
                rank={index + 2}
                query={b.recQuery}
                whyMatched={reasons.join(" · ") || undefined}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
            <Shield aria-hidden="true" size={15} className="text-[color:var(--decoration-soft)]" />
            Ranking is source-grounded and advisory. Confirm fit, cautions and review status before clinical use.
          </div>
        </>
      )}
    </section>
  );
}
