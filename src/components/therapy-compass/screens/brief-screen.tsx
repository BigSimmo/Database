"use client";

import { useMemo, useState } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import { parseSteps, summarise } from "../data/select";
import { AlertIcon, CheckIcon, CopyIcon, ExternalLinkIcon, FileTextIcon, SearchIcon } from "../icons";
import { s } from "../style-utils";
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
    <section data-screen-label="Brief" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <h1
            style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}
          >
            Brief Intervention
          </h1>
          <p style={s(`margin:0;font-size:14.5px;color:var(--text-muted);`)}>
            Fast scripts and steps drawn from each record&rsquo;s delivery fields.
          </p>
        </div>
        <div style={s(`display:flex;gap:10px;`)}>
          <button
            type="button"
            className="tc-btn"
            onClick={() => b.openSheet(t.slug)}
            style={s(commandControl + "height:44px;")}
          >
            <FileTextIcon size={16} />
            Create handout
          </button>
        </div>
      </div>

      <div style={s(`display:flex;gap:24px;border-bottom:1px solid var(--border);margin-bottom:20px;flex-wrap:wrap;`)}>
        <button type="button" className="tc-btn" onClick={b.set5} style={b.brief5}>
          5 minutes
        </button>
        <button type="button" className="tc-btn" onClick={b.set15} style={b.brief15}>
          15 minutes
        </button>
        <button type="button" className="tc-btn" onClick={b.setGround} style={b.briefGround}>
          Grounding now
        </button>
      </div>

      <div style={s(`display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px;align-items:start;`)}>
        {/* records list */}
        <div
          style={s(
            `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:16px;`,
          )}
        >
          <label style={s(`position:relative;display:flex;align-items:center;margin-bottom:12px;`)}>
            <SearchIcon size={16} strokeWidth={1.8} style={s(`position:absolute;left:12px;color:var(--text-soft);`)} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter records…"
              aria-label="Filter brief-intervention records"
              style={s(
                `width:100%;height:40px;padding:0 12px 0 36px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-size:13px;font-family:inherit;outline:none;`,
              )}
            />
          </label>
          <div
            style={s(`display:flex;flex-direction:column;gap:8px;max-height:520px;overflow:auto;`)}
            className="tc-scroll"
          >
            {briefTherapies.map((x) => {
              const active = x.slug === t.slug;
              return (
                <button
                  key={x.slug}
                  type="button"
                  className="tc-btn tc-row"
                  onClick={() => b.select(x.slug)}
                  style={s(
                    `display:flex;gap:12px;align-items:center;padding:12px 13px;border:1px solid ${active ? "var(--clinical-accent-border)" : "var(--border)"};${active ? "border-left:3px solid var(--clinical-accent);" : ""}border-radius:11px;background:${active ? "var(--clinical-accent-soft)" : "var(--surface)"};text-align:left;cursor:pointer;font-family:inherit;`,
                  )}
                >
                  <span style={s(`flex:1;min-width:0;`)}>
                    <span style={s(`display:block;font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                      {x.name}
                    </span>
                    <span
                      style={s(
                        `display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
                      )}
                    >
                      {x.bestUsedFor ?? x.category}
                    </span>
                  </span>
                  <AlertIcon
                    size={15}
                    strokeWidth={1.8}
                    style={s(
                      `color:${x.reviewStatus === "reviewed" ? "var(--success-text)" : "var(--warning-text)"};flex:none;`,
                    )}
                  />
                </button>
              );
            })}
          </div>
          <div style={s(`text-align:center;font-size:11.5px;color:var(--text-soft);margin-top:14px;`)}>
            Showing {briefTherapies.length} records
          </div>
        </div>

        {/* brief detail */}
        <div style={s(`display:flex;flex-direction:column;gap:16px;min-width:0;`)}>
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;`,
            )}
          >
            <div
              style={s(
                `display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:12px;flex-wrap:wrap;`)}>
                <h2 style={s(`margin:0;font-size:19px;font-weight:680;color:var(--text-heading);`)}>{t.name}</h2>
                <span
                  style={s(
                    `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);border:1px solid var(--clinical-accent-border);`,
                  )}
                >
                  {durationLabel} mode
                </span>
                <span
                  style={s(
                    `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--warning-bg);color:var(--warning-text);border:1px solid var(--warning-border);`,
                  )}
                >
                  {t.reviewStatus === "reviewed" ? "Reviewed" : "Clinician review required"}
                </span>
              </div>
              <button
                type="button"
                className="tc-btn"
                onClick={() => b.open(t.slug)}
                style={s(outlineControl + "height:36px;padding:0 13px;font-size:12.5px;")}
              >
                Open full record
                <ExternalLinkIcon size={14} strokeWidth={1.7} />
              </button>
            </div>
            <div
              style={s(
                `display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
              )}
            >
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

          <div style={s(`display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start;`)}>
            <div
              style={s(
                `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:20px 22px;min-width:0;`,
              )}
            >
              <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:16px;`)}>
                {durationLabel} delivery
              </div>
              {steps.length ? (
                <div style={s(`display:flex;flex-direction:column;gap:14px;`)}>
                  {steps.map((step, i) => (
                    <div key={i} style={s(`display:flex;gap:14px;`)}>
                      <span
                        style={s(
                          `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${i === steps.length - 1 ? "var(--clinical-accent)" : "var(--clinical-accent-soft)"};color:${i === steps.length - 1 ? "#fff" : "var(--clinical-accent)"};font-size:12px;font-weight:700;flex:none;`,
                        )}
                      >
                        {i + 1}
                      </span>
                      <div
                        style={s(
                          `flex:1;min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;`,
                        )}
                      >
                        <div style={s(`font-size:13.5px;line-height:1.55;color:var(--text-muted);`)}>{step}</div>
                        <button
                          type="button"
                          className="tc-btn"
                          onClick={() => copy(step, `step-${i}`)}
                          title="Copy step"
                          style={s(
                            `display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border:1px solid ${copied === `step-${i}` ? "var(--clinical-accent-border)" : "var(--border)"};border-radius:8px;background:var(--surface);color:${copied === `step-${i}` ? "var(--clinical-accent)" : "var(--text-soft)"};flex:none;cursor:pointer;`,
                          )}
                        >
                          {copied === `step-${i}` ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={s(`margin:0;font-size:13.5px;color:var(--text-muted);`)}>
                  No structured {durationLabel.toLowerCase()} steps in this record yet.{" "}
                  {t.briefVersion
                    ? "Use the source brief version and the clinician script below."
                    : "Open the full record for delivery guidance."}
                </p>
              )}

              {t.clinicianScripts.length ? (
                <div style={s(`margin-top:20px;padding-top:16px;border-top:1px solid var(--border);`)}>
                  <div
                    style={s(
                      `font-size:12px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:10px;`,
                    )}
                  >
                    CLINICIAN SCRIPT
                  </div>
                  {t.clinicianScripts.slice(0, 2).map((c, i) => (
                    <div key={i} style={s(`margin-bottom:12px;`)}>
                      {c.scriptType ? (
                        <div style={s(`font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:3px;`)}>
                          {c.scriptType}
                        </div>
                      ) : null}
                      <p style={s(`margin:0;font-size:13px;line-height:1.6;color:var(--text-muted);`)}>{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              style={s(
                `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:20px 22px;`,
              )}
            >
              <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
                Before use
              </div>
              <div style={s(`display:flex;flex-direction:column;gap:13px;margin-bottom:16px;`)}>
                {CHECKLIST.map((item) => (
                  <span
                    key={item}
                    style={s(`display:flex;align-items:center;gap:11px;font-size:13px;color:var(--text);`)}
                  >
                    <span
                      style={s(
                        `width:19px;height:19px;border:1.5px solid var(--border-strong);border-radius:5px;flex:none;`,
                      )}
                    />
                    {item}
                  </span>
                ))}
              </div>
              <div
                style={s(
                  `display:flex;align-items:flex-start;gap:9px;padding:13px 14px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:11px;`,
                )}
              >
                <AlertIcon
                  size={17}
                  strokeWidth={1.8}
                  style={s(`color:var(--warning-text);flex:none;margin-top:1px;`)}
                />
                <span style={s(`font-size:12.5px;font-weight:600;line-height:1.45;color:var(--warning-text);`)}>
                  Clinical review is required before saving or sharing.
                </span>
              </div>
            </div>
          </div>

          <div style={s(`display:flex;gap:10px;flex-wrap:wrap;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={() => copy(interventionText, "intervention")}
              style={s(outlineControl + "height:46px;")}
            >
              {copied === "intervention" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              {copied === "intervention" ? "Copied" : "Copy intervention"}
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={() => b.openSheet(t.slug)}
              style={s(commandControl + "height:46px;margin-left:auto;")}
            >
              <FileTextIcon size={16} />
              Open patient sheet
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaCell({ eyebrow, text, tone }: { eyebrow: string; text: string; tone?: "warning" }) {
  const warn = tone === "warning";
  return (
    <div style={s(`padding:14px 15px;background:${warn ? "var(--warning-bg)" : "var(--surface)"};`)}>
      <div
        style={s(
          `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:${warn ? "var(--warning-text)" : "var(--text-soft)"};margin-bottom:7px;`,
        )}
      >
        {eyebrow}
      </div>
      <p
        style={s(
          `margin:0;font-size:12.5px;line-height:1.45;color:${warn ? "var(--warning-text)" : "var(--text-muted)"};`,
        )}
      >
        {text}
      </p>
    </div>
  );
}
