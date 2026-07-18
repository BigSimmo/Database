"use client";

import { useTcBindings } from "./bindings";

/** Core Therapy destinations for non-home screens. */
export function TherapyCompassNav() {
  const b = useTcBindings();

  return (
    <div className="tc-topnav tc-no-print tc-nav-001">
      <nav className="tc-scroll tc-nav-007" aria-label="Therapy sections">
        <button
          type="button"
          className={`tc-btn ${b.navHome}`}
          onClick={b.goHome}
          aria-current={b.isHome ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
          Home
        </button>
        <button
          type="button"
          className={`tc-btn ${b.navSearch}`}
          onClick={b.goSearch}
          aria-current={b.isSearch ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Search
        </button>
        <button
          type="button"
          className={`tc-btn ${b.navRecommend}`}
          onClick={b.goRecommend}
          aria-current={b.isRecommend ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6.3 6.3 4.5 4.5M19.5 19.5l-1.8-1.8M6.3 17.7l-1.8 1.8M19.5 4.5l-1.8 1.8" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
          Recommend
        </button>
        <button
          type="button"
          className={`tc-btn ${b.navCompare}`}
          onClick={b.goCompare}
          aria-current={b.isCompare ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M12 3v18" />
            <path d="m5 7-3 5.5h6L5 7Z" />
            <path d="m19 7-3 5.5h6L19 7Z" />
            <path d="M4 21h16" />
            <path d="M8 7h8" />
          </svg>
          Compare
        </button>
        <span className="tc-nav-008" aria-hidden="true" />
        <button
          type="button"
          className={`tc-btn ${b.navPathways}`}
          onClick={b.goPathways}
          aria-current={b.isPathways ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <circle cx="6" cy="18" r="2.5" />
            <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M6 8.5v7" />
          </svg>
          Pathways
        </button>
        <button
          type="button"
          className={`tc-btn ${b.navBrief}`}
          onClick={b.goBrief}
          aria-current={b.isBrief ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Brief Intervention
        </button>
        <button
          type="button"
          className={`tc-btn ${b.navSheets}`}
          onClick={b.goSheets}
          aria-current={b.isSheets ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
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
