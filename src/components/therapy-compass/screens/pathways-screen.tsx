"use client";

import { useMemo } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import type { Therapy } from "../data/types";
import { AlertIcon, ChecklistIcon, ChevronRightIcon, CopyIcon, FileTextIcon, PathwayIcon, ScaleIcon } from "../icons";
import { LoadingState } from "../ui";

export function PathwaysScreen() {
  const b = useTcBindings();
  const bySlug = useMemo(() => new Map(b.therapies.map((t) => [t.slug, t])), [b.therapies]);
  const pathway = b.selectedPathway;

  if (b.loading || !pathway) return <LoadingState label="Loading pathways…" />;

  const firstLinkedSlug = pathway.steps.find((st) => st.therapySlug)?.therapySlug ?? null;
  const copyPathway = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    const lines = pathway.steps.map((st, i) => {
      const name = (st.therapySlug ? bySlug.get(st.therapySlug)?.name : null) ?? st.label ?? "Step";
      return `${i + 1}. ${name}${st.description ? ` — ${st.description}` : ""}`;
    });
    void navigator.clipboard.writeText(`${pathway.name}\n\n${lines.join("\n")}`);
  };

  return (
    <section data-screen-label="Pathways" className="tc-screens-pathways-screen-001">
      <div className="tc-screens-pathways-screen-002">
        <div>
          <h1 className="tc-screens-pathways-screen-003">Clinical Pathways</h1>
          <p className="tc-screens-pathways-screen-004">
            Problem-based workflows generated from imported therapy records.
          </p>
        </div>
        <div className="tc-mobile-wrap tc-screens-pathways-screen-005">
          <button type="button" className={`tc-btn ${outlineControl}`} onClick={b.goReview}>
            <ChecklistIcon size={16} />
            Review queue
          </button>
        </div>
      </div>

      <div className="tc-stack-sm tc-screens-pathways-screen-006">
        {/* pathway list */}
        <div className="tc-pathway-list tc-screens-pathways-screen-007">
          <div className="tc-screens-pathways-screen-008">Pathways</div>
          <div className="tc-screens-pathways-screen-009">
            {b.pathways.map((p) => {
              const active = p.slug === pathway.slug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  className={`tc-btn tc-row tc-pathway-option${active ? " tc-is-active" : ""}`}
                  onClick={() => b.selectPathway(p.slug)}
                  aria-pressed={active}
                >
                  <span className="tc-pathway-option-icon">
                    <PathwayIcon size={20} strokeWidth={1.6} />
                  </span>
                  <span className="tc-screens-pathways-screen-010">
                    <span className="tc-screens-pathways-screen-011">{p.name}</span>
                    <span className="tc-screens-pathways-screen-012">
                      {p.clinicalProblem ?? p.summary ?? "Therapy workflow"}
                    </span>
                    <span className="tc-screens-pathways-screen-013">
                      <span className="tc-screens-pathways-screen-014">{p.steps.length} linked steps</span>
                      <span
                        className={`tc-pathway-status tc-tone-${p.reviewStatus === "reviewed" ? "success" : "warning"}`}
                      >
                        {p.reviewStatus === "reviewed" ? "Reviewed" : p.incomplete ? "Incomplete" : "Needs review"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="tc-screens-pathways-screen-015">Pathways are generated from imported therapy records.</p>
        </div>

        {/* pathway detail */}
        <div className="tc-screens-pathways-screen-016">
          <div className="tc-screens-pathways-screen-017">
            <span className="tc-screens-pathways-screen-018">
              <PathwayIcon size={24} strokeWidth={1.5} />
            </span>
            <div className="tc-screens-pathways-screen-019">
              <div className="tc-screens-pathways-screen-020">
                <h2 className="tc-screens-pathways-screen-021">{pathway.name}</h2>
                <span
                  className={`tc-status-badge tc-tone-${pathway.reviewStatus === "reviewed" ? "success" : "warning"}`}
                >
                  <AlertIcon size={14} strokeWidth={1.8} />
                  {pathway.reviewStatus === "reviewed" ? "Reviewed" : "Needs review"}
                </span>
              </div>
              <p className="tc-screens-pathways-screen-022">
                {pathway.summary ??
                  "A source-linked workflow for reviewing therapy options, delivery constraints and cautions before choosing a next step."}
              </p>
              <div className="tc-screens-pathways-screen-023">
                <PathwayIcon size={14} strokeWidth={1.8} />
                {pathway.steps.length} linked therapy steps
              </div>
            </div>
          </div>

          <div className="tc-screens-pathways-screen-024">
            {pathway.steps.map((step, i) => {
              const therapy: Therapy | undefined = step.therapySlug ? bySlug.get(step.therapySlug) : undefined;
              const last = i === pathway.steps.length - 1;
              return (
                <div key={i} className="tc-screens-pathways-screen-025">
                  <span className={`tc-pathway-step-index${last ? " tc-is-last" : ""}`}>{i + 1}</span>
                  <div className="tc-row tc-screens-pathways-screen-026">
                    <span className="tc-screens-pathways-screen-027">
                      <ScaleIcon size={17} strokeWidth={1.6} />
                    </span>
                    <div className="tc-screens-pathways-screen-028">
                      <div className="tc-screens-pathways-screen-029">
                        {therapy?.name ?? step.label ?? "Therapy step"}
                      </div>
                      <div className="tc-screens-pathways-screen-030">
                        {step.description ?? therapy?.bestUsedFor ?? "Review fit, contraindications and source status."}
                      </div>
                    </div>
                    <span className="tc-screens-pathways-screen-031">{step.label ?? "STEP"}</span>
                    {therapy ? (
                      <button
                        type="button"
                        className="tc-btn tc-screens-pathways-screen-032"
                        onClick={() => b.open(therapy.slug)}
                      >
                        Open record
                      </button>
                    ) : (
                      <ChevronRightIcon size={16} strokeWidth={1.8} className="tc-screens-pathways-screen-033" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="tc-screens-pathways-screen-034">
        <AlertIcon size={22} strokeWidth={1.8} className="tc-screens-pathways-screen-035" />
        <div className="tc-screens-pathways-screen-036">
          <div className="tc-screens-pathways-screen-037">
            Clinical caution — decision support generated from imported records.
          </div>
          <div className="tc-screens-pathways-screen-038">
            {pathway.cautions ??
              "Review source status, missing fields and patient-specific factors before clinical use."}
          </div>
        </div>
        <div className="tc-mobile-wrap tc-screens-pathways-screen-039">
          <button type="button" className="tc-btn tc-screens-pathways-screen-040" onClick={copyPathway}>
            <CopyIcon size={15} />
            Copy pathway
          </button>
          <button
            type="button"
            className={`tc-btn ${commandControl}`}
            onClick={() => firstLinkedSlug && b.openSheet(firstLinkedSlug)}
            disabled={!firstLinkedSlug}
          >
            <FileTextIcon size={15} />
            Patient sheet
          </button>
        </div>
      </div>
    </section>
  );
}
