"use client";

import { useState, type ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, linkButton } from "../controls";
import type { Therapy } from "../data/types";
import { ChevronRightIcon, CompassIcon, FileTextIcon, PathwayIcon, ScaleIcon, SearchIcon, SparkleIcon } from "../icons";
import { s } from "../style-utils";

const SUGGESTIONS = [
  "Anxiety in outpatient care",
  "Low mood & motivation",
  "Trauma-focused",
  "5-minute grounding",
  "Relapse prevention",
];
const FEATURED_SLUGS = [
  "cognitive-behavioural-therapy-cbt",
  "behavioural-activation",
  "dialectical-behaviour-therapy-dbt",
  "eye-movement-desensitisation-and-reprocessing-emdr",
  "acceptance-and-commitment-therapy-act",
  "interpersonal-psychotherapy-ipt",
];

export function HomeScreen() {
  const b = useTcBindings();
  const [query, setLocalQuery] = useState("");

  const bySlug = new Map(b.therapies.map((t) => [t.slug, t]));
  const featured: Therapy[] = FEATURED_SLUGS.map((sl) => bySlug.get(sl)).filter((t): t is Therapy => Boolean(t));
  const featuredList = (featured.length ? featured : b.therapies).slice(0, 6);
  const pathways = b.pathways.slice(0, 3);

  const submit = () => b.submitQuery(query);

  return (
    <section data-screen-label="Home" style={s(`max-width:1100px;margin:0 auto;`)}>
      <div style={s(`text-align:center;padding:20px 0 8px;`)}>
        <span
          style={s(
            `display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:15px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:16px;`,
          )}
        >
          <CompassIcon size={28} strokeWidth={1.6} />
        </span>
        <h1
          style={s(`margin:0 0 8px;font-size:30px;font-weight:700;color:var(--text-heading);letter-spacing:-0.025em;`)}
        >
          What therapy are you looking for?
        </h1>
        <p style={s(`margin:0 auto 24px;font-size:15px;color:var(--text-muted);max-width:56ch;`)}>
          Search {b.therapies.length || "200+"} source-grounded therapy records by problem, symptom, skill or population
          — or jump into a clinical pathway.
        </p>
      </div>

      <div style={s(`display:flex;align-items:center;max-width:760px;margin:0 auto 14px;position:relative;`)}>
        <SearchIcon size={20} strokeWidth={1.8} style={s(`position:absolute;left:18px;color:var(--text-soft);`)} />
        <input
          value={query}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Search problem, symptom, therapy, skill, population…"
          aria-label="Search therapies"
          style={s(
            `width:100%;height:58px;padding:0 130px 0 50px;border:1px solid var(--border-strong);border-radius:15px;background:var(--surface);color:var(--text);font-size:16px;font-family:inherit;outline:none;box-shadow:var(--shadow-soft);`,
          )}
        />
        <button
          type="button"
          className="tc-btn"
          onClick={submit}
          style={s(`position:absolute;right:8px;${commandControl}height:44px;padding:0 20px;`)}
        >
          <SearchIcon size={16} strokeWidth={1.9} />
          Search
        </button>
      </div>

      <div style={s(`display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:760px;margin:0 auto 36px;`)}>
        {SUGGESTIONS.map((sugg) => (
          <button
            key={sugg}
            type="button"
            className="tc-btn"
            onClick={() => b.submitQuery(sugg)}
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;`,
            )}
          >
            {sugg}
          </button>
        ))}
      </div>

      {/* quick tools */}
      <div style={s(`display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px;`)}>
        <QuickTool
          icon={SparkleIcon}
          title="Recommend a therapy"
          body="Match a clinical question to indexed options."
          onClick={b.goRecommend}
        />
        <QuickTool
          icon={PathwayIcon}
          title="Open a pathway"
          body="Problem-based, step-by-step workflows."
          onClick={b.goPathways}
        />
        <QuickTool
          icon={FileTextIcon}
          title="Create a patient sheet"
          body="Design and print a plain-language handout."
          onClick={b.goSheets}
        />
      </div>

      {/* pathways */}
      <div style={s(`display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;`)}>
        <h2 style={s(`margin:0;font-size:17px;font-weight:680;color:var(--text-heading);`)}>Key clinical pathways</h2>
        <button type="button" onClick={b.goPathways} style={s(linkButton)}>
          View all pathways
        </button>
      </div>
      <div style={s(`display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px;`)}>
        {pathways.map((p) => (
          <button
            key={p.slug}
            type="button"
            className="tc-btn tc-row"
            onClick={() => {
              b.selectPathway(p.slug);
              b.goPathways();
            }}
            style={s(
              `text-align:left;padding:20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);cursor:pointer;font-family:inherit;`,
            )}
          >
            <span
              style={s(
                `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:14px;`,
              )}
            >
              <PathwayIcon size={21} strokeWidth={1.5} />
            </span>
            <span
              style={s(`display:block;font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:4px;`)}
            >
              {p.name}
            </span>
            <span
              style={s(`display:block;font-size:12.5px;color:var(--text-muted);line-height:1.45;margin-bottom:12px;`)}
            >
              {p.clinicalProblem ?? p.summary ?? "Source-linked therapy workflow."}
            </span>
            <span style={s(`font-size:11.5px;font-weight:600;color:var(--text-soft);`)}>
              {p.steps.length} linked therapy steps
            </span>
          </button>
        ))}
      </div>

      {/* therapies */}
      <div style={s(`display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;`)}>
        <h2 style={s(`margin:0;font-size:17px;font-weight:680;color:var(--text-heading);`)}>
          Frequently used therapies
        </h2>
        <button type="button" onClick={b.goSearch} style={s(linkButton)}>
          Browse library
        </button>
      </div>
      <div style={s(`display:grid;grid-template-columns:1fr 1fr;gap:12px;`)}>
        {featuredList.map((t) => (
          <button
            key={t.slug}
            type="button"
            className="tc-btn tc-row"
            onClick={() => b.open(t.slug)}
            style={s(
              `display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;background:var(--surface);text-align:left;cursor:pointer;font-family:inherit;`,
            )}
          >
            <span
              style={s(
                `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
              )}
            >
              <ScaleIcon size={20} strokeWidth={1.6} />
            </span>
            <span style={s(`flex:1;min-width:0;`)}>
              <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>{t.name}</span>
              <span
                style={s(
                  `display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
                )}
              >
                {t.bestUsedFor ?? t.category}
              </span>
            </span>
            <ChevronRightIcon size={16} strokeWidth={1.8} style={s(`color:var(--text-soft);flex:none;`)} />
          </button>
        ))}
      </div>
    </section>
  );
}

function QuickTool({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: (p: { size?: number; strokeWidth?: number }) => ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tc-btn tc-row"
      onClick={onClick}
      style={s(
        `display:flex;gap:14px;padding:18px 20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);text-align:left;cursor:pointer;font-family:inherit;`,
      )}
    >
      <span
        style={s(
          `display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
        )}
      >
        <Icon size={21} strokeWidth={1.6} />
      </span>
      <span>
        <span style={s(`display:block;font-size:14.5px;font-weight:650;color:var(--text-heading);`)}>{title}</span>
        <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px;line-height:1.4;`)}>
          {body}
        </span>
      </span>
    </button>
  );
}
