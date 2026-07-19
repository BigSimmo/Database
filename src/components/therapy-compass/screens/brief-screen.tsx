"use client";

import { useMemo, useState } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
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
    <section data-screen-label="Brief" className="tc-screens-brief-screen-001">
      <div className="tc-screens-brief-screen-002">
        <div>
          <h1 className="tc-screens-brief-screen-003">Brief Intervention</h1>
          <p className="tc-screens-brief-screen-004">
            Fast scripts and steps drawn from each record&rsquo;s delivery fields.
          </p>
        </div>
        <div className="tc-mobile-wrap tc-screens-brief-screen-005">
          <button
            type="button"
            className={`tc-btn ${commandControl}`}
            onClick={() => b.openSheet(t.slug)}
            disabled={!t.patientSheetAvailable}
            title={t.patientSheetAvailable ? undefined : "This intervention has no patient handout"}
          >
            <FileTextIcon size={16} />
            {t.patientSheetAvailable ? "Create handout" : "Handout unavailable"}
          </button>
        </div>
      </div>

      <div className="tc-screens-brief-screen-006" role="group" aria-label="Brief intervention duration">
        <button type="button" className={`tc-btn ${b.brief5}`} onClick={b.set5} aria-pressed={b.briefTab === "5min"}>
          5 minutes
        </button>
        <button type="button" className={`tc-btn ${b.brief15}`} onClick={b.set15} aria-pressed={b.briefTab === "15min"}>
          15 minutes
        </button>
        <button
          type="button"
          className={`tc-btn ${b.briefGround}`}
          onClick={b.setGround}
          aria-pressed={b.briefTab === "ground"}
        >
          Grounding now
        </button>
      </div>

      <div className="tc-stack-sm tc-screens-brief-screen-007">
        {/* records list */}
        <div className="tc-screens-brief-screen-008">
          <label className="tc-screens-brief-screen-009">
            <SearchIcon size={16} strokeWidth={1.8} className="tc-screens-brief-screen-010" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter records…"
              aria-label="Filter brief-intervention records"
              className="tc-screens-brief-screen-011"
            />
          </label>
          <div className="tc-scroll tc-screens-brief-screen-012">
            {briefTherapies.map((x) => {
              const active = x.slug === t.slug;
              return (
                <button
                  key={x.slug}
                  type="button"
                  className={`tc-btn tc-row tc-brief-option${active ? " tc-is-active" : ""}`}
                  onClick={() => b.select(x.slug)}
                  aria-pressed={active}
                >
                  <span className="tc-screens-brief-screen-013">
                    <span className="tc-screens-brief-screen-014">{x.name}</span>
                    <span className="tc-screens-brief-screen-015">{x.bestUsedFor ?? x.category}</span>
                  </span>
                  <AlertIcon
                    size={15}
                    strokeWidth={1.8}
                    className={x.reviewStatus === "reviewed" ? "tc-text-success" : "tc-text-warning"}
                  />
                </button>
              );
            })}
          </div>
          <div className="tc-screens-brief-screen-016">Showing {briefTherapies.length} records</div>
        </div>

        {/* brief detail */}
        <div className="tc-screens-brief-screen-017">
          <div className="tc-screens-brief-screen-018">
            <div className="tc-screens-brief-screen-019">
              <div className="tc-screens-brief-screen-020">
                <h2 className="tc-screens-brief-screen-021">{t.name}</h2>
                <span className="tc-screens-brief-screen-022">{durationLabel} mode</span>
                <span className="tc-screens-brief-screen-023">
                  {t.reviewStatus === "reviewed" ? "Reviewed" : "Clinician review required"}
                </span>
              </div>
              <button
                type="button"
                className={`tc-btn ${outlineControl} tc-control-compact`}
                onClick={() => b.open(t.slug)}
              >
                Open full record
                <ExternalLinkIcon size={14} strokeWidth={1.7} />
              </button>
            </div>
            <div className="tc-mobile-grid-2 tc-screens-brief-screen-024">
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

          <div className="tc-mobile-stack tc-screens-brief-screen-025">
            <div className="tc-screens-brief-screen-026">
              <div className="tc-screens-brief-screen-027">{durationLabel} delivery</div>
              {steps.length ? (
                <div className="tc-screens-brief-screen-028">
                  {steps.map((step, i) => (
                    <div key={i} className="tc-screens-brief-screen-029">
                      <span className={`tc-brief-step-index${i === steps.length - 1 ? " tc-is-last" : ""}`}>
                        {i + 1}
                      </span>
                      <div className="tc-screens-brief-screen-030">
                        <div className="tc-screens-brief-screen-031">{step}</div>
                        <button
                          type="button"
                          className={`tc-btn tc-step-copy${copied === `step-${i}` ? " tc-is-active" : ""}`}
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
                <p className="tc-screens-brief-screen-032">
                  No structured {durationLabel.toLowerCase()} steps in this record yet.{" "}
                  {t.briefVersion
                    ? "Use the source brief version and the clinician script below."
                    : "Open the full record for delivery guidance."}
                </p>
              )}

              {t.clinicianScripts.length ? (
                <div className="tc-screens-brief-screen-033">
                  <div className="tc-screens-brief-screen-034">CLINICIAN SCRIPT</div>
                  {t.clinicianScripts.slice(0, 2).map((c, i) => (
                    <div key={i} className="tc-screens-brief-screen-035">
                      {c.scriptType ? <div className="tc-screens-brief-screen-036">{c.scriptType}</div> : null}
                      <p className="tc-screens-brief-screen-037">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="tc-screens-brief-screen-038">
              <div className="tc-screens-brief-screen-039">Before use</div>
              <div className="tc-screens-brief-screen-040">
                {CHECKLIST.map((item) => (
                  <span key={item} className="tc-screens-brief-screen-041">
                    <span className="tc-screens-brief-screen-042" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="tc-screens-brief-screen-043">
                <AlertIcon size={17} strokeWidth={1.8} className="tc-screens-brief-screen-044" />
                <span className="tc-screens-brief-screen-045">
                  Clinical review is required before saving or sharing.
                </span>
              </div>
            </div>
          </div>

          <div className="tc-screens-brief-screen-046">
            <button
              type="button"
              className={`tc-btn ${outlineControl}`}
              onClick={() => copy(interventionText, "intervention")}
            >
              {copied === "intervention" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              {copied === "intervention" ? "Copied" : "Copy intervention"}
            </button>
            <button
              type="button"
              className={`tc-btn ${commandControl} ml-auto`}
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
    <div className={`tc-brief-meta${tone === "warning" ? " tc-is-warning" : ""}`}>
      <div className="tc-brief-meta-heading">{eyebrow}</div>
      <p>{text}</p>
    </div>
  );
}
