"use client";

import { useMemo } from "react";
import { ChevronRight, Copy, FileText, ListChecks, Scale, TriangleAlert, Waypoints } from "lucide-react";

import { pageContainer } from "@/components/ui-primitives";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl, therapyBtn } from "../controls";
import type { Therapy } from "../data/types";
import { LoadingState } from "../ui";
import { useClipboard } from "../use-clipboard";

export function PathwaysScreen() {
  const b = useTcBindings();
  const bySlug = useMemo(() => new Map(b.therapies.map((t) => [t.slug, t])), [b.therapies]);
  const pathway = b.selectedPathway;
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
      <div className="flex items-start justify-between gap-5 mb-[22px] flex-wrap">
        <div>
          <h1 className="mt-0 mx-0 mb-1.5 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">
            Clinical Pathways
          </h1>
          <p className="m-0 text-sm text-[color:var(--text-muted)]">
            Problem-based workflows generated from imported therapy records.
          </p>
        </div>
        <div className="max-sm:flex-wrap flex gap-2.5">
          <button type="button" className={`${therapyBtn} ${outlineControl}`} onClick={b.goReview}>
            <ListChecks aria-hidden="true" size={16} />
            Review queue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[320px_minmax(0,_1fr)] gap-4 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] overflow-hidden">
        {/* pathway list */}
        <div className="therapy-pathway-list border-r border-[color:var(--border)] p-[18px]">
          <div className="text-base-minus font-semibold text-[color:var(--text-heading)] mb-3.5">Pathways</div>
          <div className="flex flex-col gap-2.5">
            {b.pathways.map((p) => {
              const active = p.slug === pathway.slug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  className={`${therapyBtn} transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex w-full items-center gap-3.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3.5 text-left aria-[current=true]:border-[color:var(--clinical-accent-border)] aria-[current=true]:border-l-[3px] aria-[current=true]:border-l-[color:var(--clinical-accent)] aria-[current=true]:bg-[color:var(--clinical-accent-soft)]`}
                  onClick={() => b.selectPathway(p.slug)}
                  aria-current={active ? "true" : undefined}
                >
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
                </button>
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
                  <div className="transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex-1 min-w-0 flex items-center gap-3.5 py-3.5 px-4 border border-[color:var(--border)] rounded-lg bg-[color:var(--surface)]">
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
                      <button
                        type="button"
                        className={`${therapyBtn} inline-flex items-center gap-[5px] h-[32px] py-0 px-3 border border-[color:var(--border-strong)] rounded-md bg-[color:var(--surface)] text-[color:var(--text)] text-xs font-semibold cursor-pointer flex-none`}
                        onClick={() => b.open(therapy.slug)}
                      >
                        Open record
                      </button>
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
          <button
            type="button"
            className={`${therapyBtn} flex items-center gap-[7px] h-[40px] py-0 px-3.5 border border-[color:var(--warning-border)] rounded-md bg-[color:var(--surface)] text-[color:var(--text)] text-sm-minus font-semibold cursor-pointer`}
            onClick={copyPathway}
          >
            <Copy aria-hidden="true" size={15} />
            {copied === "pathway" ? "Copied" : "Copy pathway"}
          </button>
          <button
            type="button"
            className={`${therapyBtn} ${commandControl}`}
            onClick={() => firstLinkedSlug && b.openSheet(firstLinkedSlug)}
            disabled={!firstLinkedSlug}
          >
            <FileText aria-hidden="true" size={15} />
            {firstLinkedSlug ? "Patient sheet" : "Patient sheet unavailable"}
          </button>
        </div>
      </div>
    </section>
  );
}
