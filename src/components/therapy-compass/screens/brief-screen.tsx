"use client";

import { useMemo, useState } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl, therapyBtn } from "../controls";
import { parseSteps, summarise } from "../data/select";
import { AlertIcon, CheckIcon, CopyIcon, ExternalLinkIcon, FileTextIcon, SearchIcon } from "../icons";
import { LoadingState } from "../ui";
import { useClipboard } from "../use-clipboard";

const CHECKLIST = [
  "Confirm the primary problem",
  "Check risk and acuity",
  "Review contraindications",
  "Confirm patient-facing language",
];

export function BriefScreen() {
  const b = useTcBindings();
  const t = b.selectedTherapy;
  const [filter, setFilter] = useState("");
  const { copied, copy } = useClipboard();

  const briefTherapies = useMemo(
    () =>
      b.therapies
        .filter((x) => x.briefInterventionAvailable)
        .filter((x) => !filter.trim() || x.name.toLowerCase().includes(filter.toLowerCase()))
        .slice(0, 40),
    [b.therapies, filter],
  );

  if (b.loading || !t) return <LoadingState label="Loading brief interventions…" />;

  const durationLabel = b.briefTab === "15min" ? "15-minute" : b.briefTab === "ground" ? "Grounding" : "5-minute";
  const durationText =
    b.briefTab === "15min"
      ? t.fifteenMinuteVersion || t.fullSessionVersion || t.briefVersion
      : b.briefTab === "ground"
        ? t.clinicianScripts.find((c) => /ground|relax|distress/i.test(`${c.scriptType} ${c.title}`))?.body ||
          t.briefVersion
        : t.briefVersion;
  const steps = parseSteps(durationText, 6);
  const interventionText = [
    `${t.name} — ${durationLabel} intervention`,
    "",
    ...steps.map((st, i) => `${i + 1}. ${st}`),
    ...(t.clinicianScripts.length
      ? [
          "",
          "Clinician script:",
          ...t.clinicianScripts
            .slice(0, 2)
            .map((c) => (c.scriptType ? `${c.scriptType}: ${c.body ?? ""}` : (c.body ?? ""))),
        ]
      : []),
  ].join("\n");

  return (
    <section data-screen-label="Brief" className="max-w-[1240px] my-0 mx-auto">
      <div className="flex items-start justify-between gap-5 mb-5 flex-wrap">
        <div>
          <h1 className="mt-0 mx-0 mb-1.5 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">Brief Intervention</h1>
          <p className="m-0 text-sm text-[color:var(--text-muted)]">
            Fast scripts and steps drawn from each record&rsquo;s delivery fields.
          </p>
        </div>
        <div className="max-sm:flex-wrap flex gap-2.5">
          <button
            type="button"
            className={`${therapyBtn} ${commandControl}`}
            onClick={() => b.openSheet(t.slug)}
            disabled={!t.patientSheetAvailable}
            title={t.patientSheetAvailable ? undefined : "This intervention has no patient handout"}
          >
            <FileTextIcon size={16} />
            {t.patientSheetAvailable ? "Create handout" : "Handout unavailable"}
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-[color:var(--border)] mb-5 flex-wrap" role="group" aria-label="Brief intervention duration">
        <button type="button" className={`${therapyBtn} ${b.brief5}`} onClick={b.set5} aria-pressed={b.briefTab === "5min"}>
          5 minutes
        </button>
        <button type="button" className={`${therapyBtn} ${b.brief15}`} onClick={b.set15} aria-pressed={b.briefTab === "15min"}>
          15 minutes
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${b.briefGround}`}
          onClick={b.setGround}
          aria-pressed={b.briefTab === "ground"}
        >
          Grounding now
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[300px_minmax(0,_1fr)] gap-4 items-start">
        {/* records list */}
        <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] p-4">
          <label className="relative flex items-center mb-3">
            <SearchIcon size={16} strokeWidth={1.8} className="absolute left-[12px] text-[color:var(--text-soft)]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter records…"
              aria-label="Filter brief-intervention records"
              className="w-full h-[40px] pt-0 pr-3 pb-0 pl-9 border border-[color:var(--border)] rounded-md bg-[color:var(--surface)] text-[color:var(--text)] text-sm-minus"
            />
          </label>
          <div className="flex flex-col gap-2 max-h-[520px] overflow-auto">
            {briefTherapies.map((x) => {
              const active = x.slug === t.slug;
              return (
                <button
                  key={x.slug}
                  type="button"
                  className={`${therapyBtn} transition-colors duration-100 hover:bg-[color:var(--surface-subtle)] flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-left aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:border-l-[3px] aria-pressed:border-l-[color:var(--clinical-accent)] aria-pressed:bg-[color:var(--clinical-accent-soft)]`}
                  onClick={() => b.select(x.slug)}
                  aria-pressed={active}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm-minus font-semibold text-[color:var(--text-heading)]">{x.name}</span>
                    <span className="block text-2xs text-[color:var(--text-muted)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{x.bestUsedFor ?? x.category}</span>
                  </span>
                  <AlertIcon
                    size={15}
                    strokeWidth={1.8}
                    className={x.reviewStatus === "reviewed" ? "flex-none text-[color:var(--success-text)]" : "flex-none text-[color:var(--warning-text)]"}
                  />
                </button>
              );
            })}
          </div>
          <div className="text-center text-2xs text-[color:var(--text-soft)] mt-3.5">Showing {briefTherapies.length} records</div>
        </div>

        {/* brief detail */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-[22px] px-6">
            <div className="flex items-center justify-between gap-3 mb-[18px] flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="m-0 text-lg font-semibold text-[color:var(--text-heading)]">{t.name}</h2>
                <span className="text-2xs font-semibold py-[3px] px-2.5 rounded-sm bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)] border border-[color:var(--clinical-accent-border)]">{durationLabel} mode</span>
                <span className="text-2xs font-semibold py-[3px] px-2.5 rounded-sm bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] border border-[color:var(--warning-border)]">
                  {t.reviewStatus === "reviewed" ? "Reviewed" : "Clinician review required"}
                </span>
              </div>
              <button
                type="button"
                className={`${therapyBtn} ${outlineControl} px-[13px] text-xs`}
                onClick={() => b.open(t.slug)}
              >
                Open full record
                <ExternalLinkIcon size={14} strokeWidth={1.7} />
              </button>
            </div>
            <div className="grid grid-cols-2 grid-cols-[1fr_1fr_1fr_1fr] gap-[1px] bg-[color:var(--border)] border border-[color:var(--border)] rounded-lg overflow-hidden">
              <MetaCell eyebrow="GOAL" text={t.bestUsedFor || t.indications || "—"} />
              <MetaCell eyebrow="FIRST STEP" text={steps[0] || summarise(durationText, 1) || "—"} />
              <MetaCell
                eyebrow="CAUTIONS"
                tone="warning"
                text={summarise(t.contraindicationsOrCautions, 1) || "Review cautions before use."}
              />
              <MetaCell eyebrow="SOURCE" text={t.reviewStatus === "reviewed" ? "Reviewed record" : "Review required"} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr] gap-4 items-start">
            <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-5 px-[22px] min-w-0">
              <div className="text-base-minus font-semibold text-[color:var(--text-heading)] mb-4">{durationLabel} delivery</div>
              {steps.length ? (
                <div className="flex flex-col gap-3.5">
                  {steps.map((step, i) => (
                    <div key={i} className="flex gap-3.5">
                      <span className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[color:var(--surface-inset)] text-xs font-semibold text-[color:var(--text-muted)]${i === steps.length - 1 ? " bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]" : ""}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                        <div className="text-sm-minus leading-normal text-[color:var(--text-muted)]">{step}</div>
                        <button
                          type="button"
                          className={`${therapyBtn} inline-flex min-h-tap items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-[color:var(--text-soft)] aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:text-[color:var(--clinical-accent)]${copied === `step-${i}` ? " " : ""}`}
                          onClick={() => copy(step, `step-${i}`)}
                          title="Copy step"
                        >
                          {copied === `step-${i}` ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-sm-minus text-[color:var(--text-muted)]">
                  No structured {durationLabel.toLowerCase()} steps in this record yet.{" "}
                  {t.briefVersion
                    ? "Use the source brief version and the clinician script below."
                    : "Open the full record for delivery guidance."}
                </p>
              )}

              {t.clinicianScripts.length ? (
                <div className="mt-5 pt-4 border-t border-[color:var(--border)]">
                  <div className="text-xs font-bold tracking-eyebrow text-[color:var(--text-soft)] mb-2.5">CLINICIAN SCRIPT</div>
                  {t.clinicianScripts.slice(0, 2).map((c, i) => (
                    <div key={i} className="mb-3">
                      {c.scriptType ? <div className="text-xs font-semibold text-[color:var(--text-heading)] mb-[3px]">{c.scriptType}</div> : null}
                      <p className="m-0 text-sm-minus leading-normal text-[color:var(--text-muted)]">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-5 px-[22px]">
              <div className="text-base-minus font-semibold text-[color:var(--text-heading)] mb-3.5">Before use</div>
              <div className="flex flex-col gap-[13px] mb-4">
                {CHECKLIST.map((item) => (
                  <span key={item} className="flex items-center gap-[11px] text-sm-minus text-[color:var(--text)]">
                    <span className="w-[19px] h-[19px] border-[1.5px] border-[color:var(--border-strong)] rounded-xs flex-none" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex items-start gap-[9px] py-[13px] px-3.5 bg-[color:var(--warning-bg)] border border-[color:var(--warning-border)] rounded-lg">
                <AlertIcon size={17} strokeWidth={1.8} className="text-[color:var(--warning-text)] flex-none mt-[1px]" />
                <span className="text-xs font-semibold leading-normal text-[color:var(--warning-text)]">
                  Clinical review is required before saving or sharing.
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <button
              type="button"
              className={`${therapyBtn} ${outlineControl}`}
              onClick={() => copy(interventionText, "intervention")}
            >
              {copied === "intervention" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              {copied === "intervention" ? "Copied" : "Copy intervention"}
            </button>
            <button
              type="button"
              className={`${therapyBtn} ${commandControl} ml-auto`}
              onClick={() => b.openSheet(t.slug)}
              disabled={!t.patientSheetAvailable}
              title={t.patientSheetAvailable ? undefined : "This intervention has no patient sheet"}
            >
              <FileTextIcon size={16} />
              {t.patientSheetAvailable ? "Open patient sheet" : "Patient sheet unavailable"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaCell({ eyebrow, text, tone }: { eyebrow: string; text: string; tone?: "warning" }) {
  return (
    <div className={`rounded-lg bg-[color:var(--surface-inset)] p-3${tone === "warning" ? " bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]" : ""}`}>
      <div className="text-2xs font-bold tracking-eyebrow">{eyebrow}</div>
      <p>{text}</p>
    </div>
  );
}
