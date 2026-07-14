"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import { RECOMMEND_CONSTRAINTS, summarise } from "../data/select";
import { ArrowRightIcon, CheckIcon, CopyIcon, SearchIcon, ShieldIcon, SparkleIcon } from "../icons";
import { s } from "../style-utils";
import { LoadingState } from "../ui";
import { useClipboard } from "../use-clipboard";

export function RecommendScreen() {
  const b = useTcBindings();
  const { copied, copy } = useClipboard();
  const ranked = b.recommendations;
  const top = ranked[0]?.therapy;
  const rest = ranked.slice(1, 6);

  const copyShortlist = () =>
    copy(
      [
        "Recommendation shortlist",
        b.recQuery.trim() ? `Question: ${b.recQuery.trim()}` : "",
        b.recConstraints.length
          ? `Constraints: ${RECOMMEND_CONSTRAINTS.filter((c) => b.recConstraints.includes(c.key))
              .map((c) => c.label)
              .join(", ")}`
          : "",
        "",
        ...ranked.map((r, i) => `${i + 1}. ${r.therapy.name}`),
      ]
        .filter(Boolean)
        .join("\n"),
      "shortlist",
    );

  return (
    <section data-screen-label="Recommend" style={s(`max-width:1180px;margin:0 auto;`)}>
      <h1 style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}>
        Recommend Tool
      </h1>
      <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
        Refine a clinical question with setting, time and caution constraints.
      </p>

      <div
        style={s(
          `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;margin-bottom:22px;`,
        )}
      >
        <label
          htmlFor="tc-rec-q"
          style={s(`display:block;font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:9px;`)}
        >
          What do you need help choosing?
        </label>
        <textarea
          id="tc-rec-q"
          value={b.recQuery}
          onChange={(e) => b.setRecQuery(e.target.value)}
          style={s(
            `width:100%;min-height:74px;padding:13px 15px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:15px;font-family:inherit;line-height:1.5;outline:none;resize:vertical;`,
          )}
        />
        <div
          style={s(`font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--text-soft);margin:20px 0 10px;`)}
        >
          QUICK CONSTRAINTS
        </div>
        <div style={s(`display:flex;flex-wrap:wrap;gap:9px;`)}>
          {RECOMMEND_CONSTRAINTS.map((c) => {
            const on = b.recConstraints.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                className="tc-btn"
                onClick={() => b.toggleConstraint(c.key)}
                style={s(
                  `display:flex;align-items:center;gap:7px;padding:8px 15px;border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit;transition:all .12s ease;` +
                    (on
                      ? "border:1px solid var(--clinical-accent-border);background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);font-weight:600;"
                      : "border:1px solid var(--border);background:var(--surface);color:var(--text-muted);font-weight:500;"),
                )}
              >
                {c.label}
                {on ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="m5 12 5 5 9-11" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
        <div
          style={s(
            `display:flex;align-items:center;justify-content:space-between;margin-top:18px;gap:12px;flex-wrap:wrap;`,
          )}
        >
          <button
            type="button"
            className="tc-btn"
            onClick={copyShortlist}
            disabled={!ranked.length}
            style={s(outlineControl + (ranked.length ? "" : "opacity:0.5;cursor:not-allowed;"))}
          >
            {copied === "shortlist" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied === "shortlist" ? "Copied" : "Copy shortlist"}
          </button>
          <button type="button" className="tc-btn" onClick={b.goSearch} style={s(commandControl)}>
            <SearchIcon size={16} strokeWidth={1.9} />
            Refine in search
          </button>
        </div>
      </div>

      {b.loading || !top ? (
        <LoadingState label="Ranking clinical matches…" />
      ) : (
        <>
          {/* top match */}
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--clinical-accent);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;margin-bottom:26px;`,
            )}
          >
            <div style={s(`display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
                )}
              >
                <SparkleIcon size={20} strokeWidth={1.7} />
              </span>
              <div style={s(`flex:1;min-width:0;`)}>
                <div style={s(`display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:5px;`)}>
                  <span style={s(`font-size:16px;font-weight:650;color:var(--text-heading);`)}>{top.name}</span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;color:var(--success-text);background:var(--success-bg);border:1px solid var(--success-border);padding:2px 9px;border-radius:7px;`,
                    )}
                  >
                    Strong match
                  </span>
                  {top.modality ? (
                    <span
                      style={s(
                        `font-size:11.5px;font-weight:600;color:var(--info-text);background:var(--info-bg);border:1px solid var(--info-border);padding:2px 9px;border-radius:7px;`,
                      )}
                    >
                      {top.modality}
                    </span>
                  ) : null}
                </div>
                <p style={s(`margin:0;font-size:13.5px;line-height:1.55;color:var(--text-muted);`)}>
                  {summarise(top.clinicalSummary, 2) || top.bestUsedFor}
                </p>
              </div>
            </div>
            <div
              style={s(
                `display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
              )}
            >
              <MatchCell eyebrow="WHAT IT TREATS" text={top.bestUsedFor || top.indications || "—"} />
              <MatchCell
                eyebrow="HOW IT HELPS"
                text={summarise(top.mechanism, 1) || summarise(top.clinicalSummary, 1) || "—"}
              />
              <MatchCell
                eyebrow="WHERE TO START"
                tone="accent"
                text={`Open the record for the full protocol, or generate a patient sheet.`}
              >
                <div style={s(`display:flex;gap:8px;margin-top:10px;`)}>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={() => b.open(top.slug)}
                    style={s(
                      `flex:1;height:38px;border:none;border-radius:9px;background:var(--clinical-accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;`,
                    )}
                  >
                    Open record
                  </button>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={() => b.openSheet(top.slug)}
                    style={s(
                      `flex:1;height:38px;border:1px solid var(--clinical-accent-border);border-radius:9px;background:var(--surface);color:var(--clinical-accent-hover);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;`,
                    )}
                  >
                    Sheet
                  </button>
                </div>
              </MatchCell>
            </div>
          </div>

          <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
            Ranked clinical matches
          </div>
          <div style={s(`display:flex;flex-direction:column;gap:12px;`)}>
            {rest.map(({ therapy: t }, i) => (
              <div
                key={t.slug}
                style={s(
                  `display:grid;grid-template-columns:auto minmax(220px,1.3fr) 1.1fr 1.1fr auto;gap:20px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-tight);padding:16px 20px;`,
                )}
              >
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--surface-inset);color:var(--text-muted);font-size:13px;font-weight:700;`,
                  )}
                >
                  {i + 2}
                </span>
                <div style={s(`min-width:0;`)}>
                  <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:6px;`)}>
                    {t.name}
                  </div>
                  <div style={s(`display:flex;gap:6px;flex-wrap:wrap;`)}>
                    {(t.tags.length ? t.tags : [t.category]).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        style={s(
                          `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--surface-inset);color:var(--text-muted);`,
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ColMini eyebrow="TREATS" text={summarise(top === t ? "" : t.bestUsedFor, 1) || t.bestUsedFor || "—"} />
                <ColMini eyebrow="FIRST STEP" text={t.timeRequired || t.setting || "—"} />
                <div style={s(`display:flex;gap:6px;`)}>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={() => b.open(t.slug)}
                    style={s(
                      `height:34px;padding:0 12px;border:none;border-radius:8px;background:var(--clinical-accent);color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;`,
                    )}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={() => b.openSheet(t.slug)}
                    style={s(
                      `height:34px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;`,
                    )}
                  >
                    Sheet
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={s(
              `display:flex;align-items:center;gap:8px;margin-top:18px;font-size:12.5px;color:var(--text-soft);`,
            )}
          >
            <ShieldIcon size={15} />
            Ranking is source-grounded and advisory. Confirm fit, cautions and review status before clinical use.
          </div>
        </>
      )}
    </section>
  );
}

function MatchCell({
  eyebrow,
  text,
  tone,
  children,
}: {
  eyebrow: string;
  text: string;
  tone?: "accent";
  children?: ReactNode;
}) {
  const bg = tone === "accent" ? "var(--clinical-accent-soft)" : "var(--surface)";
  const head = tone === "accent" ? "var(--clinical-accent-hover)" : "var(--clinical-accent)";
  const body = tone === "accent" ? "var(--clinical-accent-hover)" : "var(--text-muted)";
  return (
    <div style={s(`padding:16px 17px;background:${bg};`)}>
      <div
        style={s(
          `display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:${head};margin-bottom:9px;`,
        )}
      >
        <ArrowRightIcon size={13} strokeWidth={1.9} />
        {eyebrow}
      </div>
      <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:${body};`)}>{text}</p>
      {children}
    </div>
  );
}

function ColMini({ eyebrow, text }: { eyebrow: string; text: string }) {
  return (
    <div style={s(`min-width:0;`)}>
      <div style={s(`font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`)}>
        {eyebrow}
      </div>
      <p
        style={s(
          `margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;`,
        )}
      >
        {text}
      </p>
    </div>
  );
}
