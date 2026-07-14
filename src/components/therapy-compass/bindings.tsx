"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { s } from "./style-utils";

// The eight first-class Therapy Compass screens. Anything else (e.g. the
// Review Queue) falls through to the shared "Other" placeholder, mirroring the
// design's `isOther` branch.
const KNOWN_SCREENS = ["search", "detail", "compare", "recommend", "pathways", "brief", "home", "sheets"] as const;

type SheetSectionKey = "about" | "steps" | "practice" | "coping" | "contacts";

/**
 * Every value the ported screen JSX references as `b.<name>`. The names and
 * semantics are a 1:1 mirror of the design export's `renderVals()` so the
 * converted markup binds without edits — screen navigation, comparison tabs,
 * density, brief tabs, patient-sheet tone/sections and the clinician toggle.
 */
export type TcBindings = {
  // navigation
  goHome: () => void;
  goSearch: () => void;
  goRecommend: () => void;
  goCompare: () => void;
  goPathways: () => void;
  goBrief: () => void;
  goSheets: () => void;
  goDetail: () => void;
  goReview: () => void;
  // active-screen flags
  isSearch: boolean;
  isDetail: boolean;
  isCompare: boolean;
  isRecommend: boolean;
  isPathways: boolean;
  isBrief: boolean;
  isHome: boolean;
  isSheets: boolean;
  isOther: boolean;
  otherLabel: string;
  // sidebar nav styling
  navHome: CSSProperties;
  navSearch: CSSProperties;
  navRecommend: CSSProperties;
  navCompare: CSSProperties;
  navPathways: CSSProperties;
  navBrief: CSSProperties;
  navSheets: CSSProperties;
  navReview: CSSProperties;
  // comparison tabs + density
  cmpTab: string;
  tabPriorities: CSSProperties;
  tabDifferences: CSSProperties;
  tabAll: CSSProperties;
  setTabPriorities: () => void;
  setTabDifferences: () => void;
  setTabAll: () => void;
  density: string;
  segComfortable: CSSProperties;
  segDense: CSSProperties;
  setComfortable: () => void;
  setDense: () => void;
  // brief-intervention tabs
  briefTab: string;
  brief5: CSSProperties;
  brief15: CSSProperties;
  briefGround: CSSProperties;
  set5: () => void;
  set15: () => void;
  setGround: () => void;
  // patient-sheet tone
  tonePlain: CSSProperties;
  toneWarm: CSSProperties;
  toneClinical: CSSProperties;
  setTonePlain: () => void;
  setToneWarm: () => void;
  setToneClinical: () => void;
  // patient-sheet section toggles
  secAbout: boolean;
  secSteps: boolean;
  secPractice: boolean;
  secCoping: boolean;
  secContacts: boolean;
  chipAbout: CSSProperties;
  chipSteps: CSSProperties;
  chipPractice: CSSProperties;
  chipCoping: CSSProperties;
  chipContacts: CSSProperties;
  toggleAbout: () => void;
  toggleSteps: () => void;
  togglePractice: () => void;
  toggleCoping: () => void;
  toggleContacts: () => void;
  // clinician footer toggle
  sheetClinician: boolean;
  toggleClinician: () => void;
  clinicianTrack: CSSProperties;
  clinicianKnob: CSSProperties;
  // patient-sheet print
  printSheet: () => void;
  // raw screen id (for callers that need it)
  screen: string;
};

const TcContext = createContext<TcBindings | null>(null);

function navStyle(active: boolean): CSSProperties {
  // Horizontal pill for the in-content tool nav (the mockup's own left rail was
  // dropped in favour of the app's universal sidebar). Button resets keep the
  // <button> chrome-free; the active pill fills with the accent-soft token.
  const base =
    "display:inline-flex;align-items:center;gap:8px;flex:none;padding:8px 13px;border:1px solid transparent;border-radius:10px;background:transparent;font-family:inherit;font-size:13.5px;white-space:nowrap;cursor:pointer;text-decoration:none;transition:background .12s ease,color .12s ease,border-color .12s ease;";
  // Both states set the `border` shorthand (never a mix of `border` +
  // `borderColor`), so React does not warn about shorthand/longhand conflicts
  // when the active pill changes.
  return s(
    active
      ? base +
          "background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);border:1px solid var(--clinical-accent-border);font-weight:650;"
      : base + "color:var(--text-muted);font-weight:500;",
  );
}

function tabStyle(active: boolean): CSSProperties {
  const base =
    "padding:10px 4px;border:none;background:transparent;font-size:14px;cursor:pointer;font-family:inherit;transition:color .12s ease;";
  return s(
    active
      ? base + "color:var(--clinical-accent-hover);font-weight:650;border-bottom:2px solid var(--clinical-accent);"
      : base + "color:var(--text-muted);font-weight:500;border-bottom:2px solid transparent;",
  );
}

function segStyle(active: boolean): CSSProperties {
  const base =
    "padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .12s ease;";
  return s(
    active
      ? base + "background:var(--surface);color:var(--clinical-accent-hover);box-shadow:var(--shadow-tight);"
      : base + "background:transparent;color:var(--text-muted);",
  );
}

function chipStyle(on: boolean): CSSProperties {
  const base =
    "padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .12s ease;";
  return s(
    on
      ? base +
          "border:1px solid var(--clinical-accent-border);background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);"
      : base + "border:1px solid var(--border);background:var(--surface);color:var(--text-muted);",
  );
}

export function TcProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<string>("home");
  const [cmpTab, setCmpTab] = useState("differences");
  const [density, setDensity] = useState("comfortable");
  const [briefTab, setBriefTab] = useState("5min");
  const [sheetTone, setSheetTone] = useState("plain");
  const [sheetSections, setSheetSections] = useState<Record<SheetSectionKey, boolean>>({
    about: true,
    steps: true,
    practice: true,
    coping: true,
    contacts: true,
  });
  const [sheetClinician, setSheetClinician] = useState(true);

  const value = useMemo<TcBindings>(() => {
    const go = (next: string) => () => setScreen(next);
    const toggleSection = (key: SheetSectionKey) => setSheetSections((prev) => ({ ...prev, [key]: !prev[key] }));
    const ss = sheetSections;
    return {
      goHome: go("home"),
      goSearch: go("search"),
      goRecommend: go("recommend"),
      goCompare: go("compare"),
      goPathways: go("pathways"),
      goBrief: go("brief"),
      goSheets: go("sheets"),
      goDetail: go("detail"),
      goReview: go("review"),
      isSearch: screen === "search",
      isDetail: screen === "detail",
      isCompare: screen === "compare",
      isRecommend: screen === "recommend",
      isPathways: screen === "pathways",
      isBrief: screen === "brief",
      isHome: screen === "home",
      isSheets: screen === "sheets",
      isOther: !KNOWN_SCREENS.includes(screen as (typeof KNOWN_SCREENS)[number]),
      otherLabel: screen.charAt(0).toUpperCase() + screen.slice(1),
      navHome: navStyle(screen === "home"),
      navSearch: navStyle(screen === "search"),
      navRecommend: navStyle(screen === "recommend"),
      navCompare: navStyle(screen === "compare"),
      navPathways: navStyle(screen === "pathways"),
      navBrief: navStyle(screen === "brief"),
      navSheets: navStyle(screen === "sheets"),
      navReview: navStyle(screen === "review"),
      cmpTab,
      tabPriorities: tabStyle(cmpTab === "priorities"),
      tabDifferences: tabStyle(cmpTab === "differences"),
      tabAll: tabStyle(cmpTab === "all"),
      setTabPriorities: () => setCmpTab("priorities"),
      setTabDifferences: () => setCmpTab("differences"),
      setTabAll: () => setCmpTab("all"),
      density,
      segComfortable: segStyle(density === "comfortable"),
      segDense: segStyle(density === "dense"),
      setComfortable: () => setDensity("comfortable"),
      setDense: () => setDensity("dense"),
      briefTab,
      brief5: tabStyle(briefTab === "5min"),
      brief15: tabStyle(briefTab === "15min"),
      briefGround: tabStyle(briefTab === "ground"),
      set5: () => setBriefTab("5min"),
      set15: () => setBriefTab("15min"),
      setGround: () => setBriefTab("ground"),
      tonePlain: segStyle(sheetTone === "plain"),
      toneWarm: segStyle(sheetTone === "warm"),
      toneClinical: segStyle(sheetTone === "clinical"),
      setTonePlain: () => setSheetTone("plain"),
      setToneWarm: () => setSheetTone("warm"),
      setToneClinical: () => setSheetTone("clinical"),
      secAbout: ss.about,
      secSteps: ss.steps,
      secPractice: ss.practice,
      secCoping: ss.coping,
      secContacts: ss.contacts,
      chipAbout: chipStyle(ss.about),
      chipSteps: chipStyle(ss.steps),
      chipPractice: chipStyle(ss.practice),
      chipCoping: chipStyle(ss.coping),
      chipContacts: chipStyle(ss.contacts),
      toggleAbout: () => toggleSection("about"),
      toggleSteps: () => toggleSection("steps"),
      togglePractice: () => toggleSection("practice"),
      toggleCoping: () => toggleSection("coping"),
      toggleContacts: () => toggleSection("contacts"),
      sheetClinician,
      toggleClinician: () => setSheetClinician((prev) => !prev),
      clinicianTrack: s(
        "position:relative;width:42px;height:24px;border-radius:12px;flex:none;cursor:pointer;transition:background .15s ease;background:" +
          (sheetClinician ? "var(--clinical-accent)" : "var(--border-strong)") +
          ";",
      ),
      clinicianKnob: s(
        "position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.2);left:" +
          (sheetClinician ? "21px" : "3px") +
          ";",
      ),
      printSheet: () => {
        if (typeof window !== "undefined") window.print();
      },
      screen,
    };
  }, [screen, cmpTab, density, briefTab, sheetTone, sheetSections, sheetClinician]);

  return <TcContext.Provider value={value}>{children}</TcContext.Provider>;
}

export function useTcBindings(): TcBindings {
  const ctx = useContext(TcContext);
  if (!ctx) throw new Error("useTcBindings must be used within <TcProvider>");
  return ctx;
}
