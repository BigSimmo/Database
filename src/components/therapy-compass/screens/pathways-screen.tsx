"use client";

import { useMemo } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import type { Therapy } from "../data/types";
import { AlertIcon, ChecklistIcon, ChevronRightIcon, CopyIcon, FileTextIcon, PathwayIcon, ScaleIcon } from "../icons";
import { s } from "../style-utils";
import { LoadingState } from "../ui";

export function PathwaysScreen() {
  const b = useTcBindings();
  const bySlug = useMemo(() => new Map(b.therapies.map((t) => [t.slug, t])), [b.therapies]);
  const pathway = b.selectedPathway;

  if (b.loading || !pathway) return <LoadingState label="Loading pathways…" />;

  const reviewTone = pathway.reviewStatus === "reviewed" ? "success" : "warning";
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
    <section data-screen-label="Pathways" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <h1
            style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}
          >
            Clinical Pathways
          </h1>
          <p style={s(`margin:0;font-size:14.5px;color:var(--text-muted);`)}>
            Problem-based workflows generated from imported therapy records.
          </p>
        </div>
        <div style={s(`display:flex;gap:10px;`)}>
          <button type="button" className="tc-btn" onClick={b.goReview} style={s(outlineControl + "height:44px;")}>
            <ChecklistIcon size={16} />
            Review queue
          </button>
        </div>
      </div>

      <div
        style={s(
          `display:grid;grid-template-columns:320px minmax(0,1fr);gap:16px;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
        )}
      >
        {/* pathway list */}
        <div style={s(`border-right:1px solid var(--border);padding:18px;`)}>
          <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>Pathways</div>
          <div style={s(`display:flex;flex-direction:column;gap:10px;`)}>
            {b.pathways.map((p) => {
              const active = p.slug === pathway.slug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  className="tc-btn tc-row"
                  onClick={() => b.selectPathway(p.slug)}
                  style={s(
                    `display:flex;gap:12px;padding:14px;border:1px solid ${active ? "var(--clinical-accent-border)" : "var(--border)"};${active ? "border-left:3px solid var(--clinical-accent);" : ""}border-radius:12px;background:${active ? "var(--clinical-accent-soft)" : "var(--surface)"};text-align:left;cursor:pointer;font-family:inherit;`,
                  )}
                >
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:${active ? "#fff" : "var(--surface-inset)"};color:${active ? "var(--clinical-accent)" : "var(--text-muted)"};flex:none;`,
                    )}
                  >
                    <PathwayIcon size={20} strokeWidth={1.6} />
                  </span>
                  <span style={s(`flex:1;min-width:0;`)}>
                    <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
                      {p.name}
                    </span>
                    <span
                      style={s(
                        `display:block;font-size:12px;color:var(--text-muted);margin:2px 0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
                      )}
                    >
                      {p.clinicalProblem ?? p.summary ?? "Therapy workflow"}
                    </span>
                    <span style={s(`display:flex;align-items:center;justify-content:space-between;gap:8px;`)}>
                      <span style={s(`font-size:11.5px;color:var(--text-soft);`)}>{p.steps.length} linked steps</span>
                      <span
                        style={s(
                          `font-size:11px;font-weight:600;color:${p.reviewStatus === "reviewed" ? "var(--success-text)" : "var(--warning-text)"};background:${p.reviewStatus === "reviewed" ? "var(--success-bg)" : "var(--warning-bg)"};border:1px solid ${p.reviewStatus === "reviewed" ? "var(--success-border)" : "var(--warning-border)"};padding:2px 8px;border-radius:6px;`,
                        )}
                      >
                        {p.reviewStatus === "reviewed" ? "Reviewed" : p.incomplete ? "Incomplete" : "Needs review"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p style={s(`margin:16px 0 0;font-size:11.5px;color:var(--text-soft);font-style:italic;`)}>
            Pathways are generated from imported therapy records.
          </p>
        </div>

        {/* pathway detail */}
        <div style={s(`padding:22px 24px;min-width:0;`)}>
          <div style={s(`display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;`)}>
            <span
              style={s(
                `display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:12px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
              )}
            >
              <PathwayIcon size={24} strokeWidth={1.5} />
            </span>
            <div style={s(`flex:1;min-width:0;`)}>
              <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;`)}>
                <h2 style={s(`margin:0;font-size:20px;font-weight:680;color:var(--text-heading);`)}>{pathway.name}</h2>
                <span
                  style={s(
                    `display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--${reviewTone}-text);background:var(--${reviewTone}-bg);border:1px solid var(--${reviewTone}-border);padding:5px 11px;border-radius:9px;`,
                  )}
                >
                  <AlertIcon size={14} strokeWidth={1.8} />
                  {pathway.reviewStatus === "reviewed" ? "Reviewed" : "Needs review"}
                </span>
              </div>
              <p style={s(`margin:6px 0 8px;font-size:13.5px;line-height:1.5;color:var(--text-muted);`)}>
                {pathway.summary ??
                  "A source-linked workflow for reviewing therapy options, delivery constraints and cautions before choosing a next step."}
              </p>
              <div style={s(`display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-soft);`)}>
                <PathwayIcon size={14} strokeWidth={1.8} />
                {pathway.steps.length} linked therapy steps
              </div>
            </div>
          </div>

          <div style={s(`display:flex;flex-direction:column;gap:10px;`)}>
            {pathway.steps.map((step, i) => {
              const therapy: Therapy | undefined = step.therapySlug ? bySlug.get(step.therapySlug) : undefined;
              const last = i === pathway.steps.length - 1;
              return (
                <div key={i} style={s(`display:flex;align-items:center;gap:16px;`)}>
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--clinical-accent);background:${last ? "var(--clinical-accent)" : "var(--surface)"};color:${last ? "#fff" : "var(--clinical-accent)"};font-size:12px;font-weight:700;flex:none;`,
                    )}
                  >
                    {i + 1}
                  </span>
                  <div
                    className="tc-row"
                    style={s(
                      `flex:1;min-width:0;display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);`,
                    )}
                  >
                    <span
                      style={s(
                        `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                      )}
                    >
                      <ScaleIcon size={17} strokeWidth={1.6} />
                    </span>
                    <div style={s(`flex:1;min-width:0;`)}>
                      <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                        {therapy?.name ?? step.label ?? "Therapy step"}
                      </div>
                      <div
                        style={s(
                          `font-size:12.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;`,
                        )}
                      >
                        {step.description ?? therapy?.bestUsedFor ?? "Review fit, contraindications and source status."}
                      </div>
                    </div>
                    <span
                      style={s(
                        `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);white-space:nowrap;`,
                      )}
                    >
                      {step.label ?? "STEP"}
                    </span>
                    {therapy ? (
                      <button
                        type="button"
                        className="tc-btn"
                        onClick={() => b.open(therapy.slug)}
                        style={s(
                          `display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;flex:none;`,
                        )}
                      >
                        Open record
                      </button>
                    ) : (
                      <ChevronRightIcon size={16} strokeWidth={1.8} style={s(`color:var(--text-soft);flex:none;`)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={s(
          `display:flex;align-items:center;gap:18px;margin-top:20px;padding:18px 22px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:16px;flex-wrap:wrap;`,
        )}
      >
        <AlertIcon size={22} strokeWidth={1.8} style={s(`color:var(--warning-text);flex:none;`)} />
        <div style={s(`flex:1;min-width:200px;`)}>
          <div style={s(`font-size:13.5px;font-weight:650;color:var(--warning-text);`)}>
            Clinical caution — decision support generated from imported records.
          </div>
          <div style={s(`font-size:12.5px;color:var(--warning-text);margin-top:2px;`)}>
            {pathway.cautions ??
              "Review source status, missing fields and patient-specific factors before clinical use."}
          </div>
        </div>
        <div style={s(`display:flex;gap:9px;`)}>
          <button
            type="button"
            className="tc-btn"
            onClick={copyPathway}
            style={s(
              `display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border:1px solid var(--warning-border);border-radius:10px;background:#fff;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;`,
            )}
          >
            <CopyIcon size={15} />
            Copy pathway
          </button>
          <button
            type="button"
            className="tc-btn"
            onClick={() => firstLinkedSlug && b.openSheet(firstLinkedSlug)}
            disabled={!firstLinkedSlug}
            style={s(commandControl + `height:40px;${firstLinkedSlug ? "" : "opacity:0.5;cursor:not-allowed;"}`)}
          >
            <FileTextIcon size={15} />
            Patient sheet
          </button>
        </div>
      </div>
    </section>
  );
}
