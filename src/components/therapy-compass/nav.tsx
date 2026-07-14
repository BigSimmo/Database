"use client";

import { useTcBindings } from "./bindings";
import { s } from "./style-utils";

/**
 * Therapy Compass's own tool navigation. It sits inside the app's universal
 * chrome (global header + rail + footer) as a secondary rail so every one of
 * the tool's screens stays reachable. The brand block that lived in the
 * design's bespoke top bar is folded in here since the universal header now
 * owns the top of the page.
 */
export function TherapyCompassNav() {
  const b = useTcBindings();
  return (
    <aside
      className="tc-scroll tc-no-print"
      style={s(
        `width:236px;flex:none;position:sticky;top:0;height:calc(100dvh - 4rem);padding:22px 16px;border-right:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;gap:6px;overflow:auto;`,
      )}
    >
      {/* Brand (relocated from the design's top bar) */}
      <div
        style={s(
          `display:flex;align-items:center;gap:12px;padding:0 8px 14px;margin-bottom:4px;border-bottom:1px solid var(--border);`,
        )}
      >
        <span
          style={s(
            `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
          )}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5.2" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span style={s(`display:flex;flex-direction:column;line-height:1.15;`)}>
          <span style={s(`font-size:15px;font-weight:650;color:var(--text-heading);letter-spacing:-0.01em;`)}>
            Therapy Compass
          </span>
          <span style={s(`font-size:11.5px;color:var(--text-soft);`)}>Source-grounded decision support</span>
        </span>
      </div>

      <div style={s(`font-size:11px;font-weight:650;letter-spacing:0.08em;color:var(--text-soft);padding:0 12px 6px;`)}>
        PRIMARY
      </div>
      <button type="button" className="tc-btn" onClick={b.goHome} style={b.navHome}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
        Home
      </button>
      <button type="button" className="tc-btn" onClick={b.goSearch} style={b.navSearch}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        Search
      </button>
      <button type="button" className="tc-btn" onClick={b.goRecommend} style={b.navRecommend}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6.3 6.3 4.5 4.5M19.5 19.5l-1.8-1.8M6.3 17.7l-1.8 1.8M19.5 4.5l-1.8 1.8" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
        Recommend
      </button>
      <button type="button" className="tc-btn" onClick={b.goCompare} style={b.navCompare}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 3v18" />
          <path d="m5 7-3 5.5h6L5 7Z" />
          <path d="m19 7-3 5.5h6L19 7Z" />
          <path d="M4 21h16" />
          <path d="M8 7h8" />
        </svg>
        Compare
      </button>

      <div
        style={s(`font-size:11px;font-weight:650;letter-spacing:0.08em;color:var(--text-soft);padding:16px 12px 6px;`)}
      >
        TOOLS
      </div>
      <button type="button" className="tc-btn" onClick={b.goPathways} style={b.navPathways}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M6 8.5v7" />
        </svg>
        Pathways
      </button>
      <button type="button" className="tc-btn" onClick={b.goBrief} style={b.navBrief}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        Brief Intervention
      </button>
      <button type="button" className="tc-btn" onClick={b.goSheets} style={b.navSheets}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M6 3h8l4 4v14H6Z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </svg>
        Patient Sheets
      </button>

      <div
        style={s(`font-size:11px;font-weight:650;letter-spacing:0.08em;color:var(--text-soft);padding:16px 12px 6px;`)}
      >
        GOVERNANCE
      </div>
      <button type="button" className="tc-btn" onClick={b.goReview} style={b.navReview}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
          <path d="m9.2 12 1.9 1.9 3.7-3.8" />
        </svg>
        Review Queue
      </button>

      <div style={s(`margin-top:auto;padding-top:18px;border-top:1px solid var(--border);`)}>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `display:flex;align-items:center;gap:12px;width:100%;padding:9px 12px;border:none;border-radius:10px;background:transparent;font-family:inherit;font-size:14px;text-align:left;color:var(--text-muted);font-weight:500;cursor:pointer;`,
          )}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
            <path d="M4 5.5V20.5" />
          </svg>
          Guide
        </button>
      </div>
    </aside>
  );
}
