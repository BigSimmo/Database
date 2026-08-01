"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { card, heroCard, outlineControl, therapyBtn } from "../controls";
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
    <section data-screen-label="Detail" className="max-w-[1240px] my-0 mx-auto">
      <button
        type="button"
        className={`${therapyBtn} flex items-center gap-2 mb-4 py-1.5 px-1 border-0 bg-transparent text-[color:var(--clinical-accent)] text-sm font-semibold cursor-pointer`}
        onClick={b.goSearch}
      >
        <ArrowLeftIcon size={18} />
        Back to results
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,_1fr)_344px] gap-[22px] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* HERO */}
          <div className={`${heroCard} p-6`}>
            <div className="flex gap-2.5 mb-3.5 flex-wrap">
              <StatusBadge status={t.reviewStatus} />
              {t.complexity ? (
                <span className="text-xs font-semibold py-[5px] px-[11px] rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] border border-[color:var(--border)]">
                  {complexityLabel(t.complexity)}
                </span>
              ) : null}
              {t.modality ? (
                <span className="text-xs font-semibold py-[5px] px-[11px] rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] border border-[color:var(--border)]">
                  {t.modality}
                </span>
              ) : null}
            </div>
            <h1 className="mt-0 mx-0 mb-1 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">
              {t.name}
            </h1>
            {t.aliases.length ? (
              <div className="text-sm-minus text-[color:var(--text-soft)] mb-3">
                Also known as {t.aliases.join(", ")}
              </div>
            ) : (
              <div className="text-sm-minus text-[color:var(--text-soft)] mb-3">{t.category}</div>
            )}
            {t.clinicalSummary ? (
              <p className="mt-0 mx-0 mb-4 text-base-minus leading-normal text-[color:var(--text-muted)] max-w-[64ch]">
                {t.clinicalSummary}
              </p>
            ) : null}
            <TagRow tags={t.tags.length ? t.tags : [t.category]} max={8} />
          </div>

          {/* QUICK TILES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
          <div className={`${card} px-6 py-1.5`}>
            {t.mechanism ? <BodyRow icon={CrosshairIcon} title="How it works" body={t.mechanism} /> : null}
            <BodyRow icon={PersonIcon} title="When to use" body={t.indications || t.bestUsedFor} />
            {steps.length ? (
              <BodyRow
                icon={FileTextIcon}
                title="How to deliver it"
                body={
                  <ol className="mt-1.5 mx-0 mb-0 pl-5">
                    {steps.map((step, i) => (
                      <li key={i} className="text-sm-minus leading-normal text-[color:var(--text-muted)] mb-1.5">
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
          <div className="flex flex-wrap gap-2.5">
            {t.patientSheetAvailable ? (
              <button
                type="button"
                className={`${therapyBtn} inline-flex items-center gap-[9px] h-[46px] py-0 px-5 border-0 rounded-lg bg-[color:var(--command)] text-[color:var(--command-contrast)] text-sm font-semibold shadow-[var(--shadow-tight)] cursor-pointer`}
                onClick={() => b.openSheet(t.slug)}
              >
                <FileTextIcon size={17} />
                Generate patient sheet
              </button>
            ) : null}
            <button
              type="button"
              className={`${therapyBtn} ${outlineControl}`}
              onClick={() => b.toggleCompare(t.slug)}
              aria-pressed={b.isInCompare(t.slug)}
            >
              <ScaleIcon size={17} />
              {b.isInCompare(t.slug) ? "In compare" : "Compare"}
            </button>
            {t.briefInterventionAvailable ? (
              <button
                type="button"
                className={`${therapyBtn} ${outlineControl} px-5`}
                onClick={() => b.openBrief(t.slug)}
              >
                <ClockIcon size={17} />
                Brief intervention
              </button>
            ) : null}
            <button type="button" className={`${therapyBtn} ${outlineControl} px-5`} onClick={b.goReview}>
              <ChecklistIcon size={17} />
              Review checklist
            </button>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="max-sm:static max-sm:top-auto flex flex-col gap-4 sticky top-[84px]">
          <div className={`${card} p-5`}>
            <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-3.5">At a glance</div>
            <div className="flex flex-col gap-[15px]">
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
            <div className={`${card} p-5`}>
              <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-2">Related therapies</div>
              <div className="flex flex-col">
                {b.relatedForSelected.map((r, i, arr) => (
                  <button
                    key={r.slug}
                    type="button"
                    className={`${therapyBtn} transition-colors duration-100 hover:bg-[color:var(--surface-subtle)] flex w-full items-center justify-between gap-2 border-0 bg-transparent px-0 py-[11px] text-left${i < arr.length - 1 ? " border-b border-[color:var(--border)]" : ""}`}
                    onClick={() => b.open(r.slug)}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm-minus font-semibold text-[color:var(--text-heading)]">
                        {r.name}
                      </span>
                      <span className="block text-xs text-[color:var(--text-soft)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                        {r.bestUsedFor ?? r.category}
                      </span>
                    </span>
                    <ChevronRightIcon size={15} strokeWidth={1.8} className="text-[color:var(--text-soft)] flex-none" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="bg-[color:var(--surface-subtle)] border border-[color:var(--border)] rounded-xl py-[18px] px-5">
            <div className="flex items-center gap-2 text-sm-minus font-semibold text-[color:var(--text-heading)] mb-2.5">
              <DatabaseIcon size={16} className="text-[color:var(--warning-text)]" />
              Source provenance
            </div>
            <div className="text-xs text-[color:var(--text-muted)] leading-normal">
              {t.sources.length ? (
                t.sources.slice(0, 3).map((src, i) => (
                  <div key={i}>
                    Source:{" "}
                    <strong className="text-[color:var(--text-heading)]">
                      {src.title ?? src.sourceType ?? "Uploaded source"}
                    </strong>
                  </div>
                ))
              ) : (
                <div>
                  Source:{" "}
                  <strong className="text-[color:var(--text-heading)]">
                    {t.sourceNotes ? "Referenced record" : "Single therapy record"}
                  </strong>
                </div>
              )}
              <div>
                Review:{" "}
                <span
                  className={
                    t.reviewStatus === "reviewed"
                      ? "font-semibold text-[color:var(--success-text)]"
                      : "font-semibold text-[color:var(--warning-text)]"
                  }
                >
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
    <div
      className={`rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface)] px-[17px] py-4 text-[color:var(--text-muted)] [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-normal [&_p]:text-inherit ${tone === "accent" ? "border-[color:var(--clinical-accent-border)]" : tone === "warning" ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]" : tone === "info" ? "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-text)]" : ""}`}
    >
      <div className="mb-2 flex items-center gap-[7px]">
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
    <div className="flex gap-3.5 py-5 px-0 border-b border-[color:var(--border)]">
      <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] flex-none">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-[5px]">{title}</div>
        {typeof body === "string" ? (
          <p className="m-0 text-sm-minus leading-normal text-[color:var(--text-muted)]">{body}</p>
        ) : (
          body
        )}
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
    <div className="flex gap-3.5 py-5 px-1 bg-[color:var(--warning-bg)] my-0 mx-[-18px] rounded-lg">
      <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-md bg-[color:var(--surface)] text-[color:var(--warning-text)] flex-none ml-3.5">
        <AlertIcon size={17} />
      </span>
      <div className="pr-3.5">
        <div className="text-sm font-semibold text-[color:var(--warning-text)] mb-[5px]">Safety &amp; cautions</div>
        <p className="m-0 text-sm-minus leading-normal text-[color:var(--warning-text)]">{text}</p>
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
    <div className="flex gap-3">
      <span className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] flex-none">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[color:var(--text-heading)] mb-0.5">{title}</div>
        <p className="m-0 text-xs leading-normal text-[color:var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}
