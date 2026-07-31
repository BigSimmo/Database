"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { card, heroCard, outlineControl } from "../controls";
import { complexityLabel, parseSteps, summarise } from "../data/select";
import type { Therapy } from "../data/types";
import {
  AlertIcon,
  ArrowLeftIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ClockIcon,
  CompassIcon,
  CrosshairIcon,
  DatabaseIcon,
  FileTextIcon,
  InfoIcon,
  PersonIcon,
  ScaleIcon,
  ShieldIcon,
} from "../icons";
import { Eyebrow, LoadingState, StatusBadge, TagRow } from "../ui";

export function DetailScreen() {
  const b = useTcBindings();
  const t = b.selectedTherapy;
  if (!t) return <LoadingState />;

  const steps = parseSteps(t.deliverySteps);

  return (
    <section data-screen-label="Detail" className="tc-screens-detail-screen-001">
      <button type="button" className="tc-btn tc-screens-detail-screen-002" onClick={b.goSearch}>
        <ArrowLeftIcon size={18} />
        Back to results
      </button>

      <div className="tc-stack-sm tc-screens-detail-screen-003">
        <div className="tc-screens-detail-screen-004">
          {/* HERO */}
          <div className={`${heroCard} tc-detail-hero`}>
            <div className="tc-screens-detail-screen-005">
              <StatusBadge status={t.reviewStatus} />
              {t.complexity ? (
                <span className="tc-screens-detail-screen-006">{complexityLabel(t.complexity)}</span>
              ) : null}
              {t.modality ? <span className="tc-screens-detail-screen-007">{t.modality}</span> : null}
            </div>
            <h1 className="tc-screens-detail-screen-008">{t.name}</h1>
            {t.aliases.length ? (
              <div className="tc-screens-detail-screen-009">Also known as {t.aliases.join(", ")}</div>
            ) : (
              <div className="tc-screens-detail-screen-010">{t.category}</div>
            )}
            {t.clinicalSummary ? <p className="tc-screens-detail-screen-011">{t.clinicalSummary}</p> : null}
            <TagRow tags={t.tags.length ? t.tags : [t.category]} max={8} />
          </div>

          {/* QUICK TILES */}
          <div className="tc-mobile-stack tc-screens-detail-screen-012">
            <Tile
              icon={ShieldIcon}
              eyebrow="USE WHEN"
              tone="accent"
              text={summarise(t.bestUsedFor || t.indications, 1) || "See clinical record."}
            />
            <Tile
              icon={AlertIcon}
              eyebrow="AVOID / MODIFY"
              tone="warning"
              text={summarise(t.contraindicationsOrCautions, 1) || "Confirm suitability against source before use."}
            />
            <Tile
              icon={ClockIcon}
              eyebrow="DELIVERY"
              tone="info"
              text={
                [t.timeRequired, t.sessionLength].filter(Boolean).join(" · ") ||
                (t.briefInterventionAvailable ? "Brief version available." : "See delivery notes.")
              }
            />
            <Tile
              icon={InfoIcon}
              eyebrow="EVIDENCE / SOURCE"
              tone="muted"
              text={t.evidenceLevel || (t.reviewStatus === "reviewed" ? "Reviewed record." : "Source review required.")}
            />
          </div>

          {/* BODY */}
          <div className={`${card} tc-detail-body`}>
            {t.mechanism ? <BodyRow icon={CrosshairIcon} title="How it works" body={t.mechanism} /> : null}
            <BodyRow icon={PersonIcon} title="When to use" body={t.indications || t.bestUsedFor} />
            {steps.length ? (
              <BodyRow
                icon={FileTextIcon}
                title="How to deliver it"
                body={
                  <ol className="tc-screens-detail-screen-013">
                    {steps.map((step, i) => (
                      <li key={i} className="tc-screens-detail-screen-014">
                        {step}
                      </li>
                    ))}
                  </ol>
                }
              />
            ) : (
              <BodyRow icon={FileTextIcon} title="How to deliver it" body={t.deliverySteps} />
            )}
            <SafetyRow therapy={t} />
          </div>

          {/* ACTIONS */}
          <div className="tc-screens-detail-screen-015">
            {t.patientSheetAvailable ? (
              <button type="button" className="tc-btn tc-screens-detail-screen-016" onClick={() => b.openSheet(t.slug)}>
                <FileTextIcon size={17} />
                Generate patient sheet
              </button>
            ) : null}
            <button
              type="button"
              className={`tc-btn ${outlineControl}${b.isInCompare(t.slug) ? " tc-is-selected" : ""}`}
              onClick={() => b.toggleCompare(t.slug)}
              aria-pressed={b.isInCompare(t.slug)}
            >
              <ScaleIcon size={17} />
              {b.isInCompare(t.slug) ? "In compare" : "Compare"}
            </button>
            {t.briefInterventionAvailable ? (
              <button
                type="button"
                className={`tc-btn ${outlineControl} tc-detail-action`}
                onClick={() => b.openBrief(t.slug)}
              >
                <ClockIcon size={17} />
                Brief intervention
              </button>
            ) : null}
            <button type="button" className={`tc-btn ${outlineControl} tc-detail-action`} onClick={b.goReview}>
              <ChecklistIcon size={17} />
              Review checklist
            </button>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="tc-mobile-static tc-screens-detail-screen-017">
          <div className={`${card} tc-detail-rail-card`}>
            <div className="tc-screens-detail-screen-018">At a glance</div>
            <div className="tc-screens-detail-screen-019">
              <GlanceRow icon={CompassIcon} title="Target symptoms" body={t.targetSymptoms || t.patientPopulation} />
              <GlanceRow
                icon={ClockIcon}
                title="Time & setting"
                body={[t.timeRequired, t.setting].filter(Boolean).join(" · ")}
              />
              <GlanceRow
                icon={ScaleIcon}
                title="Complexity / population"
                body={[t.complexity, t.patientPopulation].filter(Boolean).join(" — ")}
              />
            </div>
          </div>

          {b.relatedForSelected.length ? (
            <div className={`${card} tc-detail-rail-card`}>
              <div className="tc-screens-detail-screen-020">Related therapies</div>
              <div className="tc-screens-detail-screen-021">
                {b.relatedForSelected.map((r, i, arr) => (
                  <button
                    key={r.slug}
                    type="button"
                    className={`tc-btn tc-row tc-related-therapy${i < arr.length - 1 ? " tc-has-divider" : ""}`}
                    onClick={() => b.open(r.slug)}
                  >
                    <span className="tc-screens-detail-screen-022">
                      <span className="tc-screens-detail-screen-023">{r.name}</span>
                      <span className="tc-screens-detail-screen-024">{r.bestUsedFor ?? r.category}</span>
                    </span>
                    <ChevronRightIcon size={15} strokeWidth={1.8} className="tc-screens-detail-screen-025" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="tc-screens-detail-screen-026">
            <div className="tc-screens-detail-screen-027">
              <DatabaseIcon size={16} className="tc-screens-detail-screen-028" />
              Source provenance
            </div>
            <div className="tc-screens-detail-screen-029">
              {t.sources.length ? (
                t.sources.slice(0, 3).map((src, i) => (
                  <div key={i}>
                    Source:{" "}
                    <strong className="tc-screens-detail-screen-030">
                      {src.title ?? src.sourceType ?? "Uploaded source"}
                    </strong>
                  </div>
                ))
              ) : (
                <div>
                  Source:{" "}
                  <strong className="tc-screens-detail-screen-031">
                    {t.sourceNotes ? "Referenced record" : "Single therapy record"}
                  </strong>
                </div>
              )}
              <div>
                Review:{" "}
                <span className={t.reviewStatus === "reviewed" ? "tc-review-success" : "tc-review-warning"}>
                  {t.reviewStatus === "reviewed" ? "Reviewed" : "Not yet provided"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({
  icon: Icon,
  eyebrow,
  tone,
  text,
}: {
  icon: (p: { size?: number; strokeWidth?: number }) => ReactNode;
  eyebrow: string;
  tone: "accent" | "warning" | "info" | "muted";
  text: string;
}) {
  return (
    <div className={`tc-detail-tile tc-detail-tile-${tone}`}>
      <div className="tc-detail-tile-heading">
        <Icon size={15} strokeWidth={1.9} />
        <Eyebrow tone={tone === "muted" ? "neutral" : tone}>{eyebrow}</Eyebrow>
      </div>
      <p>{text}</p>
    </div>
  );
}

function BodyRow({
  icon: Icon,
  title,
  body,
}: {
  icon: (p: { size?: number }) => ReactNode;
  title: string;
  body: ReactNode;
}) {
  if (!body) return null;
  return (
    <div className="tc-screens-detail-screen-032">
      <span className="tc-screens-detail-screen-033">
        <Icon size={17} />
      </span>
      <div className="tc-screens-detail-screen-034">
        <div className="tc-screens-detail-screen-035">{title}</div>
        {typeof body === "string" ? <p className="tc-screens-detail-screen-036">{body}</p> : body}
      </div>
    </div>
  );
}

function SafetyRow({ therapy }: { therapy: Therapy }) {
  const contra = therapy.contraindicationsOrCautions?.trim() ?? "";
  const lim = therapy.limitations?.trim() ?? "";
  // `limitations` frequently repeats the tail of `contraindicationsOrCautions`;
  // only append it when it adds something new so the box doesn't echo itself.
  const text = lim && !contra.includes(lim) ? `${contra} ${lim}`.trim() : contra;
  if (!text) return null;
  return (
    <div className="tc-screens-detail-screen-037">
      <span className="tc-screens-detail-screen-038">
        <AlertIcon size={17} />
      </span>
      <div className="tc-screens-detail-screen-039">
        <div className="tc-screens-detail-screen-040">Safety &amp; cautions</div>
        <p className="tc-screens-detail-screen-041">{text}</p>
      </div>
    </div>
  );
}

function GlanceRow({
  icon: Icon,
  title,
  body,
}: {
  icon: (p: { size?: number; strokeWidth?: number }) => ReactNode;
  title: string;
  body: string | null;
}) {
  if (!body) return null;
  return (
    <div className="tc-screens-detail-screen-042">
      <span className="tc-screens-detail-screen-043">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <div className="tc-screens-detail-screen-044">
        <div className="tc-screens-detail-screen-045">{title}</div>
        <p className="tc-screens-detail-screen-046">{body}</p>
      </div>
    </div>
  );
}
