"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import { RECOMMEND_CONSTRAINTS, summarise } from "../data/select";
import { ArrowRightIcon, CheckIcon, CopyIcon, SearchIcon, ShieldIcon, SparkleIcon } from "../icons";
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
    <section data-screen-label="Recommend" className="tc-screens-recommend-screen-001">
      <h1 className="tc-screens-recommend-screen-002">Recommend Tool</h1>
      <p className="tc-screens-recommend-screen-003">
        Refine a clinical question with setting, time and caution constraints.
      </p>

      <div className="tc-screens-recommend-screen-004">
        <label htmlFor="tc-rec-q" className="tc-screens-recommend-screen-005">
          What do you need help choosing?
        </label>
        <textarea
          id="tc-rec-q"
          value={b.recQuery}
          onChange={(e) => b.setRecQuery(e.target.value)}
          className="tc-screens-recommend-screen-006"
        />
        <div className="tc-screens-recommend-screen-007">QUICK CONSTRAINTS</div>
        <div className="tc-screens-recommend-screen-008">
          {RECOMMEND_CONSTRAINTS.map((c) => {
            const on = b.recConstraints.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                className={`tc-btn tc-recommend-constraint${on ? " tc-is-active" : ""}`}
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
        <div className="tc-screens-recommend-screen-009">
          <button
            type="button"
            className={`tc-btn ${outlineControl}`}
            onClick={copyShortlist}
            disabled={!ranked.length}
          >
            {copied === "shortlist" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied === "shortlist" ? "Copied" : "Copy shortlist"}
          </button>
          <button type="button" className={`tc-btn ${commandControl}`} onClick={b.goSearch}>
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
          <div className="tc-screens-recommend-screen-010">
            <div className="tc-screens-recommend-screen-011">
              <span className="tc-screens-recommend-screen-012">
                <SparkleIcon size={20} strokeWidth={1.7} />
              </span>
              <div className="tc-screens-recommend-screen-013">
                <div className="tc-screens-recommend-screen-014">
                  <span className="tc-screens-recommend-screen-015">{top.name}</span>
                  <span className="tc-screens-recommend-screen-016">Strong match</span>
                  {top.modality ? <span className="tc-screens-recommend-screen-017">{top.modality}</span> : null}
                </div>
                <p className="tc-screens-recommend-screen-018">
                  {summarise(top.clinicalSummary, 2) || top.bestUsedFor}
                </p>
              </div>
            </div>
            <div className="tc-mobile-stack tc-screens-recommend-screen-019">
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
                <div className="tc-screens-recommend-screen-020">
                  <button
                    type="button"
                    className="tc-btn tc-screens-recommend-screen-021"
                    onClick={() => b.open(top.slug)}
                  >
                    Open record
                  </button>
                  <button
                    type="button"
                    className="tc-btn tc-screens-recommend-screen-022"
                    onClick={() => b.openSheet(top.slug)}
                  >
                    Sheet
                  </button>
                </div>
              </MatchCell>
            </div>
          </div>

          <div className="tc-screens-recommend-screen-023">Ranked clinical matches</div>
          <div className="tc-screens-recommend-screen-024">
            {rest.map(({ therapy: t }, i) => (
              <div key={t.slug} className="tc-stack-sm tc-screens-recommend-screen-025">
                <span className="tc-screens-recommend-screen-026">{i + 2}</span>
                <div className="tc-screens-recommend-screen-027">
                  <div className="tc-screens-recommend-screen-028">{t.name}</div>
                  <div className="tc-screens-recommend-screen-029">
                    {(t.tags.length ? t.tags : [t.category]).slice(0, 2).map((tag) => (
                      <span key={tag} className="tc-screens-recommend-screen-030">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ColMini eyebrow="TREATS" text={summarise(top === t ? "" : t.bestUsedFor, 1) || t.bestUsedFor || "—"} />
                <ColMini eyebrow="FIRST STEP" text={t.timeRequired || t.setting || "—"} />
                <div className="tc-screens-recommend-screen-031">
                  <button
                    type="button"
                    className="tc-btn tc-screens-recommend-screen-032"
                    onClick={() => b.open(t.slug)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="tc-btn tc-screens-recommend-screen-033"
                    onClick={() => b.openSheet(t.slug)}
                  >
                    Sheet
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="tc-screens-recommend-screen-034">
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
  return (
    <div className={`tc-match-cell${tone === "accent" ? " tc-match-cell-accent" : ""}`}>
      <div className="tc-match-cell-heading">
        <ArrowRightIcon size={13} strokeWidth={1.9} />
        {eyebrow}
      </div>
      <p>{text}</p>
      {children}
    </div>
  );
}

function ColMini({ eyebrow, text }: { eyebrow: string; text: string }) {
  return (
    <div className="tc-screens-recommend-screen-035">
      <div className="tc-screens-recommend-screen-036">{eyebrow}</div>
      <p className="tc-screens-recommend-screen-037">{text}</p>
    </div>
  );
}
