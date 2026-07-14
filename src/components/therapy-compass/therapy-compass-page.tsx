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
    <div className="tc-root" style={s(`background:var(--surface-chrome);color:var(--text);`)}>
      <div style={s(`display:flex;align-items:flex-start;min-height:calc(100dvh - 4rem);`)}>
        <TherapyCompassNav />
        <main className="tc-main" style={s(`flex:1;min-width:0;padding:32px 40px 40px;`)}>
          {b.isHome && <HomeScreen />}
          {b.isSearch && <SearchScreen />}
          {b.isDetail && <DetailScreen />}
          {b.isCompare && <CompareScreen />}
          {b.isRecommend && <RecommendScreen />}
          {b.isPathways && <PathwaysScreen />}
          {b.isBrief && <BriefScreen />}
          {b.isSheets && <SheetsScreen />}
          {b.isOther && <OtherScreen />}
          <TherapyCompassFooter />
        </main>
      </div>
    </div>
  );
}

/**
 * Therapy Compass — a source-grounded therapy decision-support mockup with eight
 * screens (Home, Search, Detail, Compare, Recommend, Pathways, Brief
 * Intervention and Patient Sheet) plus a Review-Queue placeholder. It renders
 * inside the app's universal chrome (global header + rail via the mockups
 * layout) and closes with the universal clinical verification footer; its own
 * tool navigation sits between them as a secondary rail.
 */
export function TherapyCompassPage() {
  return (
    <TcProvider>
      <TherapyCompassStyles />
      <TherapyCompassShell />
    </TcProvider>
  );
}
