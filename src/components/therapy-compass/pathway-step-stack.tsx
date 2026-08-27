"use client";

import type { ReactNode } from "react";
import { ChevronRight, Scale, Waypoints } from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";

import type { Pathway, PathwayStep, Therapy } from "./data/types";

type PathwayStepStackProps = {
  steps: PathwayStep[];
  bySlug: Map<string, Therapy>;
  onOpenRecord: (slug: string) => void;
};

function StepCard({
  step,
  index,
  last,
  therapy,
  onOpenRecord,
  layout,
}: {
  step: PathwayStep;
  index: number;
  last: boolean;
  therapy: Therapy | undefined;
  onOpenRecord: (slug: string) => void;
  layout: "mobile" | "desktop";
}) {
  const title = therapy?.name ?? step.label ?? "Therapy step";
  const description = step.description ?? therapy?.bestUsedFor ?? "Review fit, contraindications and source status.";
  const roleLabel = step.label ?? "STEP";

  if (layout === "mobile") {
    return (
      <article className={cn(cardSurface, "relative flex flex-col gap-3 p-4")}>
        {!last ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-10px] left-[calc(1rem+14px)] top-[calc(1rem+1.75rem)] w-px bg-[color:var(--border)]"
          />
        ) : null}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex size-7 flex-none items-center justify-center rounded-full text-xs font-semibold",
              last
                ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
            )}
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm-minus font-semibold text-[color:var(--text-heading)]">{title}</h3>
              <span className="inline-flex items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-2 py-0.5 text-2xs font-bold tracking-eyebrow text-[color:var(--text-muted)]">
                {roleLabel}
              </span>
            </div>
            <p className="mt-1.5 mb-0 text-xs leading-normal text-[color:var(--text-muted)]">{description}</p>
          </div>
        </div>
        {therapy ? (
          <Button variant="secondary" size="sm" className="w-full min-h-tap" onClick={() => onOpenRecord(therapy.slug)}>
            Open record
          </Button>
        ) : (
          <ChevronRight
            aria-hidden="true"
            size={16}
            strokeWidth={1.8}
            className="self-end text-[color:var(--decoration-soft)]"
          />
        )}
      </article>
    );
  }

  return (
    <div className="relative flex items-stretch gap-4">
      <div className="flex w-[26px] flex-none flex-col items-center">
        <span
          className={cn(
            "inline-flex size-[26px] flex-none items-center justify-center rounded-full text-xs font-semibold",
            last
              ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
          )}
        >
          {index + 1}
        </span>
        {!last ? <span aria-hidden="true" className="mt-1 w-px flex-1 bg-[color:var(--border)]" /> : null}
      </div>
      <div
        className={cn(
          cardSurface,
          "flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)]",
        )}
      >
        <span className="inline-flex size-[34px] flex-none items-center justify-center rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]">
          <Scale aria-hidden="true" size={17} strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-[color:var(--text-muted)]">{description}</div>
        </div>
        <span className="whitespace-nowrap text-3xs font-bold tracking-eyebrow text-[color:var(--text-muted)]">
          {roleLabel}
        </span>
        {therapy ? (
          <Button variant="secondary" size="sm" className="flex-none" onClick={() => onOpenRecord(therapy.slug)}>
            Open record
          </Button>
        ) : (
          <ChevronRight
            aria-hidden="true"
            size={16}
            strokeWidth={1.8}
            className="flex-none text-[color:var(--decoration-soft)]"
          />
        )}
      </div>
    </div>
  );
}

export function PathwayStepStack({ steps, bySlug, onOpenRecord }: PathwayStepStackProps) {
  return (
    <>
      <div data-testid="therapy-pathway-steps" className="flex flex-col gap-2.5 sm:hidden" aria-label="Pathway steps">
        {steps.map((step, index) => {
          const therapy = step.therapySlug ? bySlug.get(step.therapySlug) : undefined;
          return (
            <StepCard
              key={`${step.therapySlug ?? step.label ?? "step"}-${index}`}
              step={step}
              index={index}
              last={index === steps.length - 1}
              therapy={therapy}
              onOpenRecord={onOpenRecord}
              layout="mobile"
            />
          );
        })}
      </div>
      <div
        data-testid="therapy-pathway-steps-desktop"
        className="hidden flex-col gap-2.5 sm:flex"
        aria-label="Pathway steps"
      >
        {steps.map((step, index) => {
          const therapy = step.therapySlug ? bySlug.get(step.therapySlug) : undefined;
          return (
            <StepCard
              key={`${step.therapySlug ?? step.label ?? "step"}-desktop-${index}`}
              step={step}
              index={index}
              last={index === steps.length - 1}
              therapy={therapy}
              onOpenRecord={onOpenRecord}
              layout="desktop"
            />
          );
        })}
      </div>
    </>
  );
}

export function PathwayDetailHeader({ pathway, reviewBadge }: { pathway: Pathway; reviewBadge?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3.5">
      <span className="inline-flex size-[46px] flex-none items-center justify-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Waypoints aria-hidden="true" size={24} strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-xl font-semibold text-[color:var(--text-heading)]">{pathway.name}</h2>
          {reviewBadge}
        </div>
        <p className="mt-1.5 mb-2 text-sm-minus leading-normal text-[color:var(--text-muted)]">
          {pathway.summary ??
            "A source-linked workflow for reviewing therapy options, delivery constraints and cautions before choosing a next step."}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]">
          <Waypoints aria-hidden="true" size={14} strokeWidth={1.8} className="text-[color:var(--decoration-soft)]" />
          {pathway.steps.length} linked therapy steps
        </div>
      </div>
    </div>
  );
}
