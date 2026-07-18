"use client";

import { useTcBindings } from "./bindings";
import { s } from "./style-utils";

/**
 * In-content tool navigation for Therapy Compass.
 *
 * The design shipped its own left sidebar, but inside this app that role is
 * already filled by the universal rail, so the bespoke rail is dropped. Its
 * core destinations are kept reachable through a horizontal, repo-idiomatic
 * pill nav that sits at the top of non-home content (sticky under the global
 * header) and scrolls horizontally on narrow viewports.
 */
export function TherapyCompassNav() {
  const b = useTcBindings();
  return (
    <div
      className="tc-topnav tc-no-print"
      style={s(
        `position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:18px;padding:14px 40px;background:var(--surface-glass);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);`,
      )}
    >
      {/* Screen nav — horizontal, scrollable */}
      <nav
        className="tc-scroll"
        aria-label="Therapy sections"
        style={s(`display:flex;align-items:center;gap:6px;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px;`)}
      >
        <button type="button" className="tc-btn" onClick={b.goHome} style={b.navHome}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
          Home
        </button>
        <button type="button" className="tc-btn" onClick={b.goSearch} style={b.navSearch}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Search
        </button>
        <button type="button" className="tc-btn" onClick={b.goRecommend} style={b.navRecommend}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6.3 6.3 4.5 4.5M19.5 19.5l-1.8-1.8M6.3 17.7l-1.8 1.8M19.5 4.5l-1.8 1.8" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
          Recommend
        </button>
        <button type="button" className="tc-btn" onClick={b.goCompare} style={b.navCompare}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3v18" />
            <path d="m5 7-3 5.5h6L5 7Z" />
            <path d="m19 7-3 5.5h6L19 7Z" />
            <path d="M4 21h16" />
            <path d="M8 7h8" />
          </svg>
          Compare
        </button>
        <span style={s(`width:1px;height:22px;flex:none;background:var(--border);margin:0 4px;`)} aria-hidden="true" />
        <button type="button" className="tc-btn" onClick={b.goPathways} style={b.navPathways}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <circle cx="6" cy="18" r="2.5" />
            <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M6 8.5v7" />
          </svg>
          Pathways
        </button>
        <button type="button" className="tc-btn" onClick={b.goBrief} style={b.navBrief}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Brief Intervention
        </button>
        <button type="button" className="tc-btn" onClick={b.goSheets} style={b.navSheets}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M6 3h8l4 4v14H6Z" />
            <path d="M14 3v4h4" />
            <path d="M9 12h6M9 16h6" />
          </svg>
          Patient Sheets
        </button>
      </nav>
    </div>
  );
}
