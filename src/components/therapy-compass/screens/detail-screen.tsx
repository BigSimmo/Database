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
  CrosshairIcon,
  DatabaseIcon,
  FileTextIcon,
  InfoIcon,
  PersonIcon,
  ScaleIcon,
  ShieldIcon,
  TargetIcon,
} from "../icons";
import { s } from "../style-utils";
import { Eyebrow, LoadingState, StatusBadge, TagRow } from "../ui";

export function DetailScreen() {
  const b = useTcBindings();
  const t = b.selectedTherapy;
  if (!t) return <LoadingState />;

  const steps = parseSteps(t.deliverySteps);

  return (
    <section data-screen-label="Detail" style={s(`max-width:1240px;margin:0 auto;`)}>
      <button
        type="button"
        className="tc-btn"
        onClick={b.goSearch}
        style={s(
          `display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:6px 4px;border:none;background:transparent;color:var(--clinical-accent);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;`,
        )}
      >
        <ArrowLeftIcon size={18} />
        Back to results
      </button>

      <div
        className="tc-stack-sm"
        style={s(`display:grid;grid-template-columns:minmax(0,1fr) 344px;gap:22px;align-items:start;`)}
      >
        <div style={s(`display:flex;flex-direction:column;gap:16px;min-width:0;`)}>
          {/* HERO */}
          <div style={s(heroCard + "padding:24px 26px;")}>
            <div style={s(`display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;`)}>
              <StatusBadge status={t.reviewStatus} />
              {t.complexity ? (
                <span
                  style={s(
                    `font-size:12px;font-weight:600;padding:5px 11px;border-radius:8px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                  )}
                >
                  {complexityLabel(t.complexity)}
                </span>
              ) : null}
              {t.modality ? (
                <span
                  style={s(
                    `font-size:12px;font-weight:600;padding:5px 11px;border-radius:8px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                  )}
                >
                  {t.modality}
                </span>
              ) : null}
            </div>
            <h1
              style={s(
                `margin:0 0 4px;font-size:26px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`,
              )}
            >
              {t.name}
            </h1>
            {t.aliases.length ? (
              <div style={s(`font-size:13px;color:var(--text-soft);margin-bottom:12px;`)}>
                Also known as {t.aliases.join(", ")}
              </div>
            ) : (
              <div style={s(`font-size:13px;color:var(--text-soft);margin-bottom:12px;`)}>{t.category}</div>
            )}
            {t.clinicalSummary ? (
              <p style={s(`margin:0 0 16px;font-size:15px;line-height:1.6;color:var(--text-muted);max-width:64ch;`)}>
                {t.clinicalSummary}
              </p>
            ) : null}
            <TagRow tags={t.tags.length ? t.tags : [t.category]} max={8} />
          </div>

          {/* QUICK TILES */}
          <div style={s(`display:grid;grid-template-columns:1fr 1fr;gap:14px;`)}>
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
          <div style={s(card + "padding:6px 24px;")}>
            {t.mechanism ? <BodyRow icon={CrosshairIcon} title="How it works" body={t.mechanism} /> : null}
            <BodyRow icon={PersonIcon} title="When to use" body={t.indications || t.bestUsedFor} />
            {steps.length ? (
              <BodyRow
                icon={FileTextIcon}
                title="How to deliver it"
                body={
                  <ol style={s(`margin:6px 0 0;padding-left:20px;`)}>
                    {steps.map((step, i) => (
                      <li
                        key={i}
                        style={s(`font-size:13.5px;line-height:1.55;color:var(--text-muted);margin-bottom:6px;`)}
                      >
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
          <div style={s(`display:flex;flex-wrap:wrap;gap:10px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={() => b.openSheet(t.slug)}
              style={s(
                `display:inline-flex;align-items:center;gap:9px;height:46px;padding:0 20px;border:none;border-radius:12px;background:var(--command);color:var(--command-contrast);font-size:14px;font-weight:600;box-shadow:var(--shadow-tight);cursor:pointer;font-family:inherit;`,
              )}
            >
              <FileTextIcon size={17} />
              Generate patient sheet
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={() => b.toggleCompare(t.slug)}
              style={s(outlineControl + "height:46px;padding:0 20px;")}
            >
              <ScaleIcon size={17} />
              {b.isInCompare(t.slug) ? "In compare" : "Compare"}
            </button>
            {t.briefInterventionAvailable ? (
              <button
                type="button"
                className="tc-btn"
                onClick={() => b.openBrief(t.slug)}
                style={s(outlineControl + "height:46px;padding:0 20px;")}
              >
                <ClockIcon size={17} />
                Brief intervention
              </button>
            ) : null}
            <button
              type="button"
              className="tc-btn"
              onClick={b.goReview}
              style={s(outlineControl + "height:46px;padding:0 20px;")}
            >
              <ChecklistIcon size={17} />
              Review checklist
            </button>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div style={s(`display:flex;flex-direction:column;gap:16px;position:sticky;top:84px;`)}>
          <div style={s(card + "padding:20px;")}>
            <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
              At a glance
            </div>
            <div style={s(`display:flex;flex-direction:column;gap:15px;`)}>
              <GlanceRow icon={TargetIcon} title="Target symptoms" body={t.targetSymptoms || t.patientPopulation} />
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
            <div style={s(card + "padding:20px;")}>
              <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:8px;`)}>
                Related therapies
              </div>
              <div style={s(`display:flex;flex-direction:column;`)}>
                {b.relatedForSelected.map((r, i, arr) => (
                  <button
                    key={r.slug}
                    type="button"
                    className="tc-btn tc-row"
                    onClick={() => b.open(r.slug)}
                    style={s(
                      `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 0;border:none;${i < arr.length - 1 ? "border-bottom:1px solid var(--border);" : ""}background:transparent;text-align:left;cursor:pointer;font-family:inherit;`,
                    )}
                  >
                    <span style={s(`min-width:0;`)}>
                      <span style={s(`display:block;font-size:13px;font-weight:600;color:var(--text-heading);`)}>
                        {r.name}
                      </span>
                      <span
                        style={s(
                          `display:block;font-size:12px;color:var(--text-soft);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
                        )}
                      >
                        {r.bestUsedFor ?? r.category}
                      </span>
                    </span>
                    <ChevronRightIcon size={15} strokeWidth={1.8} style={s(`color:var(--text-soft);flex:none;`)} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div
            style={s(
              `background:var(--surface-subtle);border:1px solid var(--border);border-radius:16px;padding:18px 20px;`,
            )}
          >
            <div
              style={s(
                `display:flex;align-items:center;gap:8px;font-size:13px;font-weight:650;color:var(--text-heading);margin-bottom:10px;`,
              )}
            >
              <DatabaseIcon size={16} style={s(`color:var(--warning-text);`)} />
              Source provenance
            </div>
            <div style={s(`font-size:12.5px;color:var(--text-muted);line-height:1.7;`)}>
              {t.sources.length ? (
                t.sources.slice(0, 3).map((src, i) => (
                  <div key={i}>
                    Source:{" "}
                    <strong style={s(`color:var(--text-heading);`)}>
                      {src.title ?? src.sourceType ?? "Uploaded source"}
                    </strong>
                  </div>
                ))
              ) : (
                <div>
                  Source:{" "}
                  <strong style={s(`color:var(--text-heading);`)}>
                    {t.sourceNotes ? "Referenced record" : "Single therapy record"}
                  </strong>
                </div>
              )}
              <div>
                Review:{" "}
                <span
                  style={s(
                    `color:${t.reviewStatus === "reviewed" ? "var(--success-text)" : "var(--warning-text)"};font-weight:600;`,
                  )}
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
  const bg = tone === "warning" ? "var(--warning-bg)" : tone === "info" ? "var(--info-bg)" : "var(--surface)";
  const border =
    tone === "accent"
      ? "var(--clinical-accent-border)"
      : tone === "warning"
        ? "var(--warning-border)"
        : tone === "info"
          ? "var(--info-border)"
          : "var(--border)";
  const head =
    tone === "accent"
      ? "var(--clinical-accent)"
      : tone === "warning"
        ? "var(--warning-text)"
        : tone === "info"
          ? "var(--info-text)"
          : "var(--text-soft)";
  const body = tone === "warning" ? "var(--warning-text)" : tone === "info" ? "var(--info-text)" : "var(--text-muted)";
  return (
    <div style={s(`background:${bg};border:1px solid ${border};border-radius:14px;padding:16px 17px;`)}>
      <div style={s(`display:flex;align-items:center;gap:7px;margin-bottom:8px;color:${head};`)}>
        <Icon size={15} strokeWidth={1.9} />
        <Eyebrow color={head}>{eyebrow}</Eyebrow>
      </div>
      <p style={s(`margin:0;font-size:13px;line-height:1.5;color:${body};`)}>{text}</p>
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
    <div style={s(`display:flex;gap:14px;padding:20px 0;border-bottom:1px solid var(--border);`)}>
      <span
        style={s(
          `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
        )}
      >
        <Icon size={17} />
      </span>
      <div style={s(`min-width:0;`)}>
        <div style={s(`font-size:14.5px;font-weight:650;color:var(--text-heading);margin-bottom:5px;`)}>{title}</div>
        {typeof body === "string" ? (
          <p style={s(`margin:0;font-size:13.5px;line-height:1.6;color:var(--text-muted);`)}>{body}</p>
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
    <div
      style={s(
        `display:flex;gap:14px;padding:20px 4px;background:var(--warning-bg);margin:0 -18px;border-radius:12px;`,
      )}
    >
      <span
        style={s(
          `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface);color:var(--warning-text);flex:none;margin-left:14px;`,
        )}
      >
        <AlertIcon size={17} />
      </span>
      <div style={s(`padding-right:14px;`)}>
        <div style={s(`font-size:14.5px;font-weight:650;color:var(--warning-text);margin-bottom:5px;`)}>
          Safety &amp; cautions
        </div>
        <p style={s(`margin:0;font-size:13.5px;line-height:1.6;color:var(--warning-text);`)}>{text}</p>
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
    <div style={s(`display:flex;gap:12px;`)}>
      <span
        style={s(
          `display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
        )}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <div style={s(`min-width:0;`)}>
        <div style={s(`font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:2px;`)}>{title}</div>
        <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>{body}</p>
      </div>
    </div>
  );
}
