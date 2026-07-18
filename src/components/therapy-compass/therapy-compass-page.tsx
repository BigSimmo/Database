"use client";

import { ShieldCheck } from "lucide-react";

import { ModeHomeVerificationFooter } from "@/components/mode-home-template";

import { TcProvider, useTcBindings } from "./bindings";
import { TherapyCompassNav } from "./nav";
import { BriefScreen } from "./screens/brief-screen";
import { CompareScreen } from "./screens/compare-screen";
import { DetailScreen } from "./screens/detail-screen";
import { HomeScreen } from "./screens/home-screen";
import { OtherScreen } from "./screens/other-screen";
import { PathwaysScreen } from "./screens/pathways-screen";
import { RecommendScreen } from "./screens/recommend-screen";
import { SearchScreen } from "./screens/search-screen";
import { SheetsScreen } from "./screens/sheets-screen";
import { TherapyCompassStyles } from "./styles";
import { s } from "./style-utils";

// Universal clinical verification footer — the same component every mode home
// renders — placed at the bottom of the tool content, inside the app's chrome.
function TherapyCompassFooter() {
  return (
    <div
      className="tc-no-print"
      style={s(`max-width:1240px;margin:30px auto 0;padding-top:20px;border-top:1px solid var(--border);`)}
    >
      <ModeHomeVerificationFooter
        icon={ShieldCheck}
        label="Decision support"
        body="Source-grounded — review status before clinical use"
      />
    </div>
  );
}

function TherapyCompassShell() {
  const b = useTcBindings();
  return (
    <div
      className="tc-root"
      style={s(`min-height:calc(100dvh - 4rem);background:var(--surface-chrome);color:var(--text);`)}
    >
      <TherapyCompassNav />
      <main className="tc-main" style={s(`min-width:0;padding:32px 40px 40px;`)}>
        {b.error ? (
          <section
            role="alert"
            aria-live="assertive"
            aria-busy={b.loading}
            style={s(
              `max-width:42rem;margin:40px auto;padding:24px;border:1px solid var(--danger);border-radius:16px;background:var(--danger-soft);`,
            )}
          >
            <h1 style={s(`margin:0 0 8px;color:var(--text-heading);font-size:20px;`)}>
              Therapy Compass could not load
            </h1>
            <p style={s(`margin:0 0 16px;color:var(--text-muted);line-height:1.5;`)}>
              The therapy catalogue is unavailable. No results are being shown as a substitute.
            </p>
            <button
              type="button"
              className="tc-btn"
              onClick={b.retryData}
              disabled={b.loading}
              aria-disabled={b.loading}
              style={s(
                `padding:10px 14px;border:0;border-radius:8px;background:var(--clinical-accent);color:var(--clinical-accent-contrast);font-weight:650;opacity:${b.loading ? "0.7" : "1"};`,
              )}
            >
              {b.loading ? "Retrying…" : "Retry"}
            </button>
          </section>
        ) : (
          <>
            {b.isHome && <HomeScreen />}
            {b.isSearch && <SearchScreen />}
            {b.isDetail && <DetailScreen />}
            {b.isCompare && <CompareScreen />}
            {b.isRecommend && <RecommendScreen />}
            {b.isPathways && <PathwaysScreen />}
            {b.isBrief && <BriefScreen />}
            {b.isSheets && <SheetsScreen />}
            {b.isOther && <OtherScreen />}
          </>
        )}
        <TherapyCompassFooter />
      </main>
    </div>
  );
}

/**
 * Therapy Compass — a source-grounded therapy decision-support mockup with eight
 * screens (Home, Search, Detail, Compare, Recommend, Pathways, Brief
 * Intervention and Patient Sheet) plus a Review-Queue placeholder. It renders
 * inside the app's universal chrome (global header + sidebar via the mockups
 * layout) and closes with the universal clinical verification footer; the
 * design's own left rail is dropped, with its destinations kept reachable via a
 * horizontal in-content nav under the global header.
 */
export function TherapyCompassPage({
  initialQuery = "",
  autoRunSearch = false,
}: {
  initialQuery?: string;
  autoRunSearch?: boolean;
}) {
  // Remount the provider when a fresh run-enabled deep link arrives so its seed
  // re-runs — the App Router preserves client state across same-route navigations,
  // so without this a new /therapy-compass?q=…&run=1 would keep the prior search.
  const seedKey = autoRunSearch && initialQuery.trim() ? `q:${initialQuery.trim()}` : "home";
  return (
    <TcProvider key={seedKey} initialQuery={initialQuery} autoRunSearch={autoRunSearch}>
      <TherapyCompassStyles />
      <TherapyCompassShell />
    </TcProvider>
  );
}
