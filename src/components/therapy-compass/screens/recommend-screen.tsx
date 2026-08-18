"use client";

import type { ReactNode } from "react";
import { ArrowRight, Check, Copy, Search, Shield, Sparkles } from "lucide-react";

import { pageContainer } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";

import { useTcBindings } from "../bindings";
import { therapyBtn } from "../controls";
import { RECOMMEND_CONSTRAINTS, summarise } from "../data/select";
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
    <section data-screen-label="Recommend" className={pageContainer}>
      <h1 className="mt-0 mx-0 mb-1.5 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">
        Recommend Tool
      </h1>
      <p className="mt-0 mx-0 mb-[22px] text-sm text-[color:var(--text-muted)]">
        Refine a clinical question with setting, time and caution constraints.
      </p>

      <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-[22px] px-6 mb-[22px]">
        <label htmlFor="tc-rec-q" className="block text-xs font-semibold text-[color:var(--text-heading)] mb-[9px]">
          What do you need help choosing?
        </label>
        <textarea
          id="tc-rec-q"
          value={b.recQuery}
          onChange={(e) => b.setRecQuery(e.target.value)}
          className="w-full min-h-[74px] py-[13px] px-[15px] border border-[color:var(--border-strong)] rounded-lg bg-[color:var(--surface)] text-[color:var(--text)] text-base-minus leading-normal resize-y"
        />
        <div className="text-2xs font-bold tracking-eyebrow text-[color:var(--text-muted)] mt-5 mx-0 mb-2.5">
          QUICK CONSTRAINTS
        </div>
        <div className="flex flex-wrap gap-[9px]">
          {RECOMMEND_CONSTRAINTS.map((c) => {
            const on = b.recConstraints.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                className={`${therapyBtn} inline-flex min-h-tap items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2 text-sm-minus font-semibold text-[color:var(--text-muted)] aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:bg-[color:var(--clinical-accent-soft)] aria-pressed:font-semibold aria-pressed:text-[color:var(--clinical-accent-hover)]`}
                onClick={() => b.toggleConstraint(c.key)}
                aria-pressed={on}
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
        <div className="flex items-center justify-between mt-[18px] gap-3 flex-wrap">
          <Button
            variant="secondary"
            icon={copied === "shortlist" ? Check : Copy}
            onClick={copyShortlist}
            disabled={!ranked.length}
          >
            {copied === "shortlist" ? "Copied" : "Copy shortlist"}
          </Button>
          <Button variant="primary" icon={Search} onClick={b.goSearch}>
            Refine in search
          </Button>
        </div>
      </div>

      {b.loading || !top ? (
        <LoadingState label="Ranking clinical matches…" />
      ) : (
        <>
          {/* top match */}
          <div className="bg-[color:var(--surface)] border border-[color:var(--border)] border-l-[3px] border-l-[color:var(--clinical-accent)] rounded-xl shadow-[var(--shadow-soft)] py-[22px] px-6 mb-[26px]">
            <div className="flex items-start gap-3.5 mb-[18px]">
              <span className="inline-flex items-center justify-center w-[40px] h-[40px] rounded-lg bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] flex-none">
                <Sparkles aria-hidden="true" size={20} strokeWidth={1.7} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-[5px]">
                  <span className="text-base font-semibold text-[color:var(--text-heading)]">{top.name}</span>
                  <span className="text-2xs font-semibold text-[color:var(--success-text)] bg-[color:var(--success-bg)] border border-[color:var(--success-border)] py-0.5 px-[9px] rounded-sm">
                    Strong match
                  </span>
                </div>
                <p className="m-0 text-sm-minus leading-normal text-[color:var(--text-muted)]">
                  {summarise(top.clinicalSummary, 2) || top.bestUsedFor}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-[color:var(--border)] border border-[color:var(--border)] rounded-lg overflow-hidden">
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
                <div className="flex gap-2 mt-2.5">
                  <button
                    type="button"
                    className={`${therapyBtn} flex-1 h-[38px] border-0 rounded-md bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] text-sm-minus font-semibold cursor-pointer`}
                    onClick={() => b.open(top.slug)}
                  >
                    Open record
                  </button>
                  <button
                    type="button"
                    className={`${therapyBtn} flex-1 h-[38px] border border-[color:var(--clinical-accent-border)] rounded-md bg-[color:var(--surface)] text-[color:var(--clinical-accent-hover)] text-sm-minus font-semibold cursor-pointer`}
                    onClick={() => {
                      if (!top.patientSheetAvailable) return;
                      b.openSheet(top.slug);
                    }}
                    aria-disabled={top.patientSheetAvailable ? undefined : true}
                    title={top.patientSheetAvailable ? undefined : "This record has no patient sheet"}
                  >
                    {top.patientSheetAvailable ? "Sheet" : "Sheet unavailable"}
                  </button>
                </div>
              </MatchCell>
            </div>
          </div>

          <div className="text-base-minus font-semibold text-[color:var(--text-heading)] mb-3.5">
            Ranked clinical matches
          </div>
          <div className="flex flex-col gap-3">
            {rest.map(({ therapy: t }, i) => (
              <div
                key={t.slug}
                className="grid grid-cols-1 sm:grid-cols-[auto_minmax(220px,_1.3fr)_1.1fr_1.1fr_auto] gap-5 items-center bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow-[var(--e1)] py-4 px-5"
              >
                <span className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-full bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] text-sm-minus font-bold">
                  {i + 2}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-1.5">{t.name}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(t.tags.length ? t.tags : [t.category]).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-2xs font-semibold py-0.5 px-2 rounded-sm bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ColMini eyebrow="TREATS" text={summarise(top === t ? "" : t.bestUsedFor, 1) || t.bestUsedFor || "—"} />
                <ColMini eyebrow="FIRST STEP" text={t.timeRequired || t.setting || "—"} />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`${therapyBtn} h-[34px] py-0 px-3 border-0 rounded-md bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] text-xs font-semibold cursor-pointer`}
                    onClick={() => b.open(t.slug)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className={`${therapyBtn} h-[34px] py-0 px-3 border border-[color:var(--border-strong)] rounded-md bg-[color:var(--surface)] text-[color:var(--text)] text-xs font-semibold cursor-pointer`}
                    onClick={() => {
                      if (!t.patientSheetAvailable) return;
                      b.openSheet(t.slug);
                    }}
                    aria-disabled={t.patientSheetAvailable ? undefined : true}
                    title={t.patientSheetAvailable ? undefined : "This record has no patient sheet"}
                  >
                    {t.patientSheetAvailable ? "Sheet" : "Sheet unavailable"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-[18px] text-xs text-[color:var(--text-muted)]">
            <Shield aria-hidden="true" size={15} className="text-[color:var(--decoration-soft)]" />
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
  return (
    <div
      className={`bg-[color:var(--surface)] p-3.5 [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-normal [&_p]:text-[color:var(--text-muted)]${tone === "accent" ? " bg-[color:var(--clinical-accent-soft)]" : ""}`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold tracking-eyebrow">
        <ArrowRight aria-hidden="true" size={13} strokeWidth={1.9} />
        {eyebrow}
      </div>
      <p>{text}</p>
      {children}
    </div>
  );
}

function ColMini({ eyebrow, text }: { eyebrow: string; text: string }) {
  return (
    <div className="min-w-0">
      <div className="text-3xs font-bold tracking-label text-[color:var(--text-muted)] mb-1">{eyebrow}</div>
      <p className="m-0 text-xs leading-normal text-[color:var(--text-muted)] overflow-hidden line-clamp-2">{text}</p>
    </div>
  );
}
