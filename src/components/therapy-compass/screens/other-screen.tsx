"use client";

import { useMemo } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import { AlertIcon, ExternalLinkIcon, ShieldCheckIcon } from "../icons";
import { s } from "../style-utils";
import { LoadingState, Meter } from "../ui";

export function OtherScreen() {
  const b = useTcBindings();
  const isReview = b.screen === "review";

  const queue = useMemo(
    () =>
      [...b.unreviewedTherapies].sort((a, c) => (a.reviewCompleteness ?? 0) - (c.reviewCompleteness ?? 0)).slice(0, 24),
    [b.unreviewedTherapies],
  );

  if (!isReview) {
    return (
      <section style={s(`max-width:720px;margin:60px auto;text-align:center;`)}>
        <span
          style={s(
            `display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:20px;`,
          )}
        >
          <ShieldCheckIcon size={30} strokeWidth={1.6} />
        </span>
        <h1 style={s(`margin:0 0 8px;font-size:24px;font-weight:680;color:var(--text-heading);`)}>{b.otherLabel}</h1>
        <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
          This surface uses the same Therapy shell. Pick a tool from the top navigation to keep exploring the
          clinical workspace.
        </p>
        <div style={s(`display:flex;gap:10px;justify-content:center;flex-wrap:wrap;`)}>
          <button type="button" className="tc-btn" onClick={b.goHome} style={s(commandControl)}>
            Go to Home
          </button>
          <button type="button" className="tc-btn" onClick={b.goSearch} style={s(outlineControl)}>
            Search therapies
          </button>
        </div>
      </section>
    );
  }

  if (b.loading) return <LoadingState label="Loading review queue…" />;

  return (
    <section data-screen-label="Review Queue" style={s(`max-width:1180px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:6px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <h1
            style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}
          >
            Review Queue
          </h1>
          <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
            Records awaiting source and clinical review, lowest review-completeness first.
          </p>
        </div>
        <span
          style={s(
            `display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border:1px solid var(--warning-border);border-radius:11px;background:var(--warning-bg);color:var(--warning-text);font-size:13.5px;font-weight:600;`,
          )}
        >
          <AlertIcon size={16} strokeWidth={1.8} />
          {b.reviewCount} to review
        </span>
      </div>

      <div style={s(`display:flex;flex-direction:column;gap:12px;`)}>
        {queue.map((t) => (
          <div
            key={t.slug}
            style={s(
              `display:grid;grid-template-columns:minmax(200px,1.4fr) repeat(3,minmax(110px,1fr)) auto;gap:20px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-tight);padding:16px 20px;`,
            )}
          >
            <div style={s(`min-width:0;`)}>
              <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);`)}>{t.name}</div>
              <div
                style={s(
                  `font-size:12px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
                )}
              >
                {t.category}
              </div>
            </div>
            <Meter value={t.sourceCompleteness} label="Source" />
            <Meter value={t.indexCompleteness} label="Index" />
            <Meter value={t.reviewCompleteness} label="Review" />
            <button
              type="button"
              className="tc-btn"
              onClick={() => b.open(t.slug)}
              style={s(outlineControl + "height:38px;")}
            >
              <ExternalLinkIcon size={15} strokeWidth={1.7} />
              Open
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
