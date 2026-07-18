"use client";

import { useMemo, useState, type ReactNode } from "react";

import { MAX_COMPARE, useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import { needsReviewCount, parseSteps, searchTherapies, shortestDelivery, summarise } from "../data/select";
import type { Therapy } from "../data/types";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CrosshairIcon,
  InfoIcon,
  PlayIcon,
  PlusIcon,
  ScaleIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from "../icons";
import { s } from "../style-utils";
import { EmptyState } from "../ui";
import { useClipboard } from "../use-clipboard";

type Row = {
  key: string;
  label: string;
  icon: (p: { size?: number; strokeWidth?: number }) => ReactNode;
  tone?: "warning";
  priority?: boolean;
  get: (t: Therapy) => string;
};

const ROWS: Row[] = [
  {
    key: "avoid",
    label: "When not to use",
    icon: AlertIcon,
    tone: "warning",
    priority: true,
    get: (t) => summarise(t.contraindicationsOrCautions, 1) || "Check source before use.",
  },
  {
    key: "fit",
    label: "Best fit",
    icon: CrosshairIcon,
    priority: true,
    get: (t) => t.bestUsedFor || t.targetSymptoms || "—",
  },
  {
    key: "first",
    label: "What to do first",
    icon: PlayIcon,
    get: (t) => parseSteps(t.deliverySteps)[0] || summarise(t.mechanism, 1) || "—",
  },
  { key: "time", label: "Time required", icon: ClockIcon, get: (t) => t.timeRequired || t.sessionLength || "—" },
  { key: "setting", label: "Setting", icon: ShieldIcon, get: (t) => t.setting || t.patientPopulation || "—" },
  { key: "complexity", label: "Clinician skill / complexity", icon: ScaleIcon, get: (t) => t.complexity || "—" },
  {
    key: "evidence",
    label: "Evidence level",
    icon: ShieldIcon,
    tone: "warning",
    priority: true,
    get: (t) => t.evidenceLevel || (t.reviewStatus === "reviewed" ? "Reviewed" : "Source review required"),
  },
];

export function CompareScreen() {
  const b = useTcBindings();
  const items = b.compareTherapies;
  const { copied, copy } = useClipboard();

  const rows = useMemo(() => {
    if (b.cmpTab === "priorities") return ROWS.filter((r) => r.priority);
    if (b.cmpTab === "differences") {
      return ROWS.filter((r) => new Set(items.map((t) => r.get(t))).size > 1 || items.length < 2);
    }
    return ROWS;
  }, [b.cmpTab, items]);

  const copySet = () =>
    copy(
      [
        `Therapy comparison — ${items.map((t) => t.name).join(" vs ")}`,
        "",
        ...ROWS.map((r) => `${r.label}: ${items.map((t) => r.get(t)).join("  |  ")}`),
      ].join("\n"),
      "set",
    );

  const cols = `minmax(180px,1.1fr) ${items.map(() => "minmax(160px,1fr)").join(" ")}`;
  const dense = b.density === "dense";
  const cellPad = dense ? "11px 16px" : "15px 20px";

  return (
    <section data-screen-label="Compare" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:6px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <div style={s(`display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;`)}>
            <h1 style={s(`margin:0;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}>
              Therapy Comparison
            </h1>
            <span
              style={s(
                `font-size:13px;font-weight:600;color:var(--clinical-accent-hover);background:var(--clinical-accent-soft);padding:3px 10px;border-radius:8px;`,
              )}
            >
              {items.length} of 4 selected
            </span>
          </div>
          <p style={s(`margin:6px 0 0;font-size:14.5px;color:var(--text-muted);`)}>
            Compare fit, cautions, delivery and evidence without losing source context.
          </p>
        </div>
        <div style={s(`display:flex;align-items:center;gap:10px;flex-wrap:wrap;`)}>
          <div style={s(`display:flex;gap:2px;padding:3px;background:var(--surface-inset);border-radius:11px;`)}>
            <button type="button" className="tc-btn" onClick={b.setComfortable} style={b.segComfortable}>
              Comfortable
            </button>
            <button type="button" className="tc-btn" onClick={b.setDense} style={b.segDense}>
              Dense
            </button>
          </div>
          <button
            type="button"
            className="tc-btn"
            onClick={copySet}
            disabled={items.length < 2}
            style={s(outlineControl + `height:42px;${items.length < 2 ? "opacity:0.5;cursor:not-allowed;" : ""}`)}
          >
            {copied === "set" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied === "set" ? "Copied" : "Copy set"}
          </button>
          <button type="button" className="tc-btn" onClick={b.clearCompare} style={s(outlineControl + "height:42px;")}>
            Clear
          </button>
        </div>
      </div>

      <div style={s(`display:flex;gap:12px;margin:18px 0;flex-wrap:wrap;align-items:center;`)}>
        <AddPicker />
        {items.map((t) => (
          <span
            key={t.slug}
            style={s(
              `display:flex;align-items:center;gap:8px;height:46px;padding:0 8px 0 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow-tight);`,
            )}
          >
            <ScaleIcon size={15} style={s(`color:var(--text-soft);`)} />
            <span
              style={s(
                `font-size:13px;font-weight:600;color:var(--text-heading);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
              )}
            >
              {t.name}
            </span>
            <button
              type="button"
              className="tc-btn"
              onClick={() => b.removeCompare(t.slug)}
              title={`Remove ${t.name}`}
              style={s(
                `display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:none;background:transparent;color:var(--text-soft);cursor:pointer;border-radius:7px;`,
              )}
            >
              <XIcon size={15} strokeWidth={1.9} />
            </button>
          </span>
        ))}
      </div>

      {items.length < 2 ? (
        <EmptyState
          icon={ScaleIcon}
          title={items.length === 0 ? "Add therapies to compare" : "Add one more therapy"}
          body="Pick two to four therapies — from search results, a therapy record, or the add box above — to compare fit, cautions, delivery and evidence side by side."
          action={
            <button type="button" className="tc-btn" onClick={b.goSearch} style={s(commandControl)}>
              <SearchIcon size={16} strokeWidth={1.9} />
              Find therapies to compare
            </button>
          }
        />
      ) : (
        <>
          {/* decision summary */}
          <div
            className="tc-mobile-stack"
            style={s(
              `display:grid;grid-template-columns:1.1fr 1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;margin-bottom:20px;`,
            )}
          >
            <div style={s(`padding:20px 22px;`)}>
              <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);`)}>Decision summary</div>
            </div>
            <SummaryCell label="SHORTEST DELIVERY" value={shortestDelivery(items)?.name ?? "—"} accent />
            <SummaryCell
              label="SOURCE STATUS"
              value={`${needsReviewCount(items)} of ${items.length} need review`}
              warn
            />
          </div>

          {/* tabs */}
          <div
            className="tc-compare-tabs"
            style={s(`display:flex;gap:26px;border-bottom:1px solid var(--border);margin-bottom:2px;`)}
          >
            <button type="button" className="tc-btn" onClick={b.setTabPriorities} style={b.tabPriorities}>
              Priorities
            </button>
            <button type="button" className="tc-btn" onClick={b.setTabDifferences} style={b.tabDifferences}>
              Differences
            </button>
            <button type="button" className="tc-btn" onClick={b.setTabAll} style={b.tabAll}>
              All fields
            </button>
          </div>

          {/* table */}
          <div
            className="tc-scroll-sm"
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-top:none;border-radius:0 0 16px 16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
            )}
          >
            <div
              style={s(
                `display:grid;grid-template-columns:${cols};background:var(--surface-subtle);border-bottom:1px solid var(--border);`,
              )}
            >
              <div style={s(`padding:16px 20px;font-size:13px;font-weight:650;color:var(--text-soft);`)}>Field</div>
              {items.map((t) => (
                <div key={t.slug} style={s(`padding:14px 20px;border-left:1px solid var(--border);`)}>
                  <div style={s(`display:flex;align-items:center;gap:7px;`)}>
                    <ScaleIcon size={15} style={s(`color:var(--text-soft);`)} />
                    <span style={s(`font-size:13px;font-weight:650;color:var(--text-heading);`)}>{t.name}</span>
                  </div>
                  <div
                    style={s(
                      `font-size:11.5px;color:${t.reviewStatus === "reviewed" ? "var(--success-text)" : "var(--warning-text)"};font-weight:600;margin-top:3px;`,
                    )}
                  >
                    {t.reviewStatus === "reviewed" ? "Reviewed" : "Needs review"}
                  </div>
                </div>
              ))}
            </div>
            {rows.map((r, ri) => {
              const warn = r.tone === "warning";
              const stripe = ri % 2 === 1;
              const rowBg = warn ? "var(--warning-bg)" : stripe ? "var(--surface-subtle)" : "var(--surface)";
              const text = warn ? "var(--warning-text)" : "var(--text-muted)";
              return (
                <div
                  key={r.key}
                  style={s(
                    `display:grid;grid-template-columns:${cols};border-bottom:1px solid var(--border);background:${rowBg};`,
                  )}
                >
                  <div
                    style={s(
                      `padding:${cellPad};display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:${warn ? "var(--warning-text)" : "var(--text-heading)"};`,
                    )}
                  >
                    <r.icon size={16} strokeWidth={1.7} />
                    {r.label}
                  </div>
                  {items.map((t) => (
                    <div
                      key={t.slug}
                      style={s(
                        `padding:${cellPad};border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:${text};font-weight:${warn ? 600 : 400};`,
                      )}
                    >
                      {r.get(t)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div
            style={s(
              `display:flex;align-items:center;gap:8px;margin-top:16px;font-size:12.5px;color:var(--text-soft);`,
            )}
          >
            <InfoIcon size={15} strokeWidth={1.8} />
            Comparisons are source-grounded. Review status reflects the latest source checks.
          </div>
        </>
      )}
    </section>
  );
}

function SummaryCell({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const inset = accent
    ? "box-shadow:inset 3px 0 0 var(--clinical-accent);"
    : warn
      ? "box-shadow:inset 3px 0 0 var(--warning-text);"
      : "";
  return (
    <div style={s(`padding:20px 22px;border-left:1px solid var(--border);${inset}`)}>
      <div
        style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:6px;`)}
      >
        {label}
      </div>
      <div style={s(`font-size:14px;font-weight:600;color:${warn ? "var(--warning-text)" : "var(--text-heading)"};`)}>
        {value}
      </div>
    </div>
  );
}

function AddPicker() {
  const b = useTcBindings();
  const [q, setQ] = useState("");
  const atLimit = b.compareSlugs.length >= MAX_COMPARE;
  const matches = useMemo(() => {
    if (atLimit || !q.trim()) return [];
    return searchTherapies(b.therapies, { query: q, tags: [], briefOnly: false, sheetOnly: false, reviewedOnly: false })
      .filter((t) => !b.isInCompare(t.slug))
      .slice(0, 6);
  }, [q, b, atLimit]);

  return (
    <div style={s(`position:relative;flex:1;min-width:260px;`)}>
      <label style={s(`position:relative;display:flex;align-items:center;`)}>
        <SearchIcon size={17} strokeWidth={1.8} style={s(`position:absolute;left:14px;color:var(--text-soft);`)} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={atLimit}
          placeholder={
            atLimit ? "Maximum of 4 selected — remove one to add another" : "Add a therapy to the comparison…"
          }
          aria-label="Add a therapy to compare"
          style={s(
            `width:100%;height:46px;padding:0 14px 0 40px;border:1px dashed var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none;${atLimit ? "opacity:0.6;cursor:not-allowed;" : ""}`,
          )}
        />
      </label>
      {matches.length ? (
        <div
          style={s(
            `position:absolute;z-index:30;top:52px;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-hover);overflow:hidden;`,
          )}
        >
          {matches.map((t) => (
            <button
              key={t.slug}
              type="button"
              className="tc-btn tc-row"
              onClick={() => {
                b.addCompare(t.slug);
                setQ("");
              }}
              style={s(
                `display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border:none;border-bottom:1px solid var(--border);background:transparent;text-align:left;cursor:pointer;font-family:inherit;`,
              )}
            >
              <PlusIcon size={15} style={s(`color:var(--clinical-accent);flex:none;`)} />
              <span style={s(`font-size:13px;font-weight:600;color:var(--text-heading);`)}>{t.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
