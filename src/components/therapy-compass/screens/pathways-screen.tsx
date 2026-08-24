"use client";

import { useMemo } from "react";
import { Check, ChevronRight, Copy, FileText, ListChecks, Scale, TriangleAlert, Waypoints } from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { cn, pageContainer } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";

import { useTcBindings } from "../bindings";
import { InteractiveRow } from "@/components/ui/interactive-row";
import type { Therapy } from "../data/types";
import { LoadingState } from "../ui";
import { useClipboard } from "../use-clipboard";

export function PathwaysScreen() {
  const b = useTcBindings();
  const bySlug = useMemo(() => new Map(b.therapies.map((t) => [t.slug, t])), [b.therapies]);
  const pathway = b.selectedPathway;
  // Header counts. Summed here rather than in the header markup so the chips
  // stay declarative and the totals survive a data shape that grows a step.
  const linkedStepCount = useMemo(() => b.pathways.reduce((total, p) => total + p.steps.length, 0), [b.pathways]);
  // Called before the early return below, because it is a hook.
  const { copied, copy } = useClipboard();

  if (b.loading || !pathway) return <LoadingState label="Loading pathways…" />;

  const firstLinkedSlug =
    pathway.steps
      .map((step) => (step.therapySlug ? bySlug.get(step.therapySlug) : undefined))
      .find((therapy) => therapy?.patientSheetAvailable)?.slug ?? null;
  // Every other copy affordance in this mode goes through `useClipboard` ->
  // `@/lib/copy-to-clipboard`. This one reached for `navigator.clipboard`
  // directly, so it had no fallback path, treated a rejected write as success,
  // and gave the reader no confirmation that anything had been copied.
  const copyPathway = () => {
    const lines = pathway.steps.map((st, i) => {
      const name = (st.therapySlug ? bySlug.get(st.therapySlug)?.name : null) ?? st.label ?? "Step";
      return `${i + 1}. ${name}${st.description ? ` — ${st.description}` : ""}`;
    });
    copy(`${pathway.name}\n\n${lines.join("\n")}`, "pathway");
  };

  return (
    <section data-screen-label="Pathways" className={pageContainer}>
      {/* The Review queue lived here as the page's one action. It is a curation
          surface — which records still need source review — not something a
          clinician reads a pathway to reach, so the header no longer carries it;
          `/therapy-compass/review` still serves it directly. What replaces it is
          scale, not another control: the two counts say how much of the
          catalogue this page covers, and the accent chip is the only colour a
          phone gets here, since `PageHeader` hides its icon tile below `sm`.

          The description loses "generated from imported therapy records"
          because that provenance is already stated twice further down the same
          screen — the note under the pathway list and the caution banner — and
          on a 390px viewport it was the line that wrapped into the drawer
          handle. */}
      <PageHeader
        className="mb-[22px]"
        icon={Waypoints}
        title="Clinical Pathways"
        description="Step-by-step workflows for common clinical problems."
        meta={
          <>
            <Chip appearance={{ kind: "information", tone: "accent" }} icon={Waypoints}>
              {b.pathways.length} pathways
            </Chip>
            <Chip appearance={{ kind: "information", tone: "inset" }} icon={ListChecks}>
              {linkedStepCount} linked steps
            </Chip>
          </>
        }
      />

      <div className={cn(cardSurface, "grid grid-cols-1 sm:grid-cols-[320px_minmax(0,_1fr)] gap-4 overflow-hidden")}>
        {/* pathway list */}
        <div className="therapy-pathway-list border-r border-[color:var(--border)] p-[18px]">
          <div className="text-base-minus font-semibold text-[color:var(--text-heading)] mb-3.5">Pathways</div>
          <div className="flex flex-col gap-2.5">
            {b.pathways.map((p) => {
              const active = p.slug === pathway.slug;
              return (
                <InteractiveRow key={p.slug} variant="card" active={active} onClick={() => b.selectPathway(p.slug)}>
                  <span className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                    <Waypoints aria-hidden="true" size={20} strokeWidth={1.6} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{p.name}</span>
                    <span className="block text-xs text-[color:var(--text-muted)] mt-0.5 mx-0 mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
                      {p.clinicalProblem ?? p.summary ?? "Therapy workflow"}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-2xs text-[color:var(--text-muted)]">{p.steps.length} linked steps</span>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-semibold ${p.reviewStatus === "reviewed" ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]" : "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]"}`}
                      >
                        {p.reviewStatus === "reviewed" ? "Reviewed" : p.incomplete ? "Incomplete" : "Needs review"}
                      </span>
                    </span>
                  </span>
                </InteractiveRow>
              );
            })}
          </div>
          <p className="mt-4 mx-0 mb-0 text-2xs text-[color:var(--text-muted)] italic">
            Pathways are generated from imported therapy records.
          </p>
        </div>

        {/* pathway detail */}
        <div className="py-[22px] px-6 min-w-0">
          <div className="flex items-start gap-3.5 mb-5">
            <span className="inline-flex items-center justify-center w-[46px] h-[46px] rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] flex-none">
              <Waypoints aria-hidden="true" size={24} strokeWidth={1.5} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 text-xl font-semibold text-[color:var(--text-heading)]">{pathway.name}</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${pathway.reviewStatus === "reviewed" ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]" : "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]"}`}
                >
                  <TriangleAlert aria-hidden="true" size={14} strokeWidth={1.8} />
                  {pathway.reviewStatus === "reviewed" ? "Reviewed" : "Needs review"}
                </span>
              </div>
              <p className="mt-1.5 mx-0 mb-2 text-sm-minus leading-normal text-[color:var(--text-muted)]">
                {pathway.summary ??
                  "A source-linked workflow for reviewing therapy options, delivery constraints and cautions before choosing a next step."}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]">
                <Waypoints
                  aria-hidden="true"
                  size={14}
                  strokeWidth={1.8}
                  className="text-[color:var(--decoration-soft)]"
                />
                {pathway.steps.length} linked therapy steps
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {pathway.steps.map((step, i) => {
              const therapy: Therapy | undefined = step.therapySlug ? bySlug.get(step.therapySlug) : undefined;
              const last = i === pathway.steps.length - 1;
              return (
                <div key={i} className="flex items-center gap-4">
                  <span
                    className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[color:var(--surface-inset)] text-xs font-semibold text-[color:var(--text-muted)]${last ? " bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]" : ""}`}
                  >
                    {i + 1}
                  </span>
                  <div
                    className={cn(
                      cardSurface,
                      "transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex-1 min-w-0 flex items-center gap-3.5 py-3.5 px-4",
                    )}
                  >
                    <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] flex-none">
                      <Scale aria-hidden="true" size={17} strokeWidth={1.6} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm-minus font-semibold text-[color:var(--text-heading)]">
                        {therapy?.name ?? step.label ?? "Therapy step"}
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)] mt-0.5 overflow-hidden line-clamp-2">
                        {step.description ?? therapy?.bestUsedFor ?? "Review fit, contraindications and source status."}
                      </div>
                    </div>
                    <span className="text-3xs font-bold tracking-eyebrow text-[color:var(--text-muted)] whitespace-nowrap">
                      {step.label ?? "STEP"}
                    </span>
                    {therapy ? (
                      <Button variant="secondary" size="sm" className="flex-none" onClick={() => b.open(therapy.slug)}>
                        Open record
                      </Button>
                    ) : (
                      <ChevronRight
                        aria-hidden="true"
                        size={16}
                        strokeWidth={1.8}
                        className="text-[color:var(--decoration-soft)] flex-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[18px] mt-5 py-[18px] px-[22px] bg-[color:var(--warning-bg)] border border-[color:var(--warning-border)] rounded-xl flex-wrap">
        <TriangleAlert
          aria-hidden="true"
          size={22}
          strokeWidth={1.8}
          className="text-[color:var(--warning-text)] flex-none"
        />
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm-minus font-semibold text-[color:var(--warning-text)]">
            Clinical caution — decision support generated from imported records.
          </div>
          <div className="text-xs text-[color:var(--warning-text)] mt-0.5">
            {pathway.cautions ??
              "Review source status, missing fields and patient-specific factors before clinical use."}
          </div>
        </div>
        <div className="max-sm:flex-wrap flex gap-[9px]">
          <Button variant="secondary" icon={copied === "pathway" ? Check : Copy} onClick={copyPathway}>
            {copied === "pathway" ? "Copied" : "Copy pathway"}
          </Button>
          <Button
            variant="primary"
            icon={FileText}
            onClick={() => firstLinkedSlug && b.openSheet(firstLinkedSlug)}
            disabled={!firstLinkedSlug}
          >
            {firstLinkedSlug ? "Patient sheet" : "Patient sheet unavailable"}
          </Button>
        </div>
      </div>
    </section>
  );
}
