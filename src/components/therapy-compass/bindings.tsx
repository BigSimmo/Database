"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { s } from "./style-utils";
import { useTherapyData } from "./data/use-therapy-data";
import {
  EMPTY_SEARCH,
  RECOMMEND_CONSTRAINTS,
  rankRecommendations,
  relatedTherapies,
  searchTherapies,
  type Ranked,
  type SearchOptions,
} from "./data/select";
import type { Pathway, ReferenceData, Therapy } from "./data/types";

const KNOWN_SCREENS = ["search", "detail", "compare", "recommend", "pathways", "brief", "home", "sheets"] as const;
export const MAX_COMPARE = 4;

type SheetSectionKey = "about" | "steps" | "practice" | "coping" | "contacts";

export type TcBindings = {
  // ---- data -----------------------------------------------------------
  loading: boolean;
  error: string | null;
  therapies: Therapy[];
  unreviewedTherapies: Therapy[];
  reviewCount: number;
  pathways: Pathway[];
  reference: ReferenceData | null;

  // ---- screen navigation ---------------------------------------------
  screen: string;
  go: (screen: string) => void;
  goHome: () => void;
  goSearch: () => void;
  goRecommend: () => void;
  goCompare: () => void;
  goPathways: () => void;
  goBrief: () => void;
  goSheets: () => void;
  goDetail: () => void;
  goReview: () => void;
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
  navHome: CSSProperties;
  navSearch: CSSProperties;
  navRecommend: CSSProperties;
  navCompare: CSSProperties;
  navPathways: CSSProperties;
  navBrief: CSSProperties;
  navSheets: CSSProperties;
  navReview: CSSProperties;

  // ---- active therapy (detail / brief / sheet) ------------------------
  selectedSlug: string | null;
  selectedTherapy: Therapy | null;
  relatedForSelected: Therapy[];
  open: (slug: string) => void; // → detail
  openBrief: (slug: string) => void;
  openSheet: (slug: string) => void;
  select: (slug: string) => void; // set without navigating

  // ---- search ---------------------------------------------------------
  search: SearchOptions;
  searchResults: Therapy[];
  setQuery: (q: string) => void;
  submitQuery: (q: string) => void; // set query + go search
  toggleTag: (tag: string) => void;
  toggleBriefOnly: () => void;
  toggleSheetOnly: () => void;
  toggleReviewedOnly: () => void;
  clearSearch: () => void;

  // ---- compare --------------------------------------------------------
  compareSlugs: string[];
  compareTherapies: Therapy[];
  toggleCompare: (slug: string) => void; // add/remove + navigate
  addCompare: (slug: string) => void;
  removeCompare: (slug: string) => void;
  clearCompare: () => void;
  isInCompare: (slug: string) => boolean;

  // ---- recommend ------------------------------------------------------
  recQuery: string;
  setRecQuery: (q: string) => void;
  recConstraints: string[];
  toggleConstraint: (key: string) => void;
  recommendations: Ranked[];

  // ---- pathways -------------------------------------------------------
  selectedPathwaySlug: string | null;
  selectedPathway: Pathway | null;
  selectPathway: (slug: string) => void;

  // ---- comparison tabs + density -------------------------------------
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

  // ---- brief-intervention tabs ---------------------------------------
  briefTab: string;
  brief5: CSSProperties;
  brief15: CSSProperties;
  briefGround: CSSProperties;
  set5: () => void;
  set15: () => void;
  setGround: () => void;

  // ---- patient-sheet tone --------------------------------------------
  sheetTone: string;
  tonePlain: CSSProperties;
  toneWarm: CSSProperties;
  toneClinical: CSSProperties;
  setTonePlain: () => void;
  setToneWarm: () => void;
  setToneClinical: () => void;

  // ---- patient-sheet sections + clinician ----------------------------
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
  sheetClinician: boolean;
  toggleClinician: () => void;
  clinicianTrack: CSSProperties;
  clinicianKnob: CSSProperties;
  printSheet: () => void;
};

const TcContext = createContext<TcBindings | null>(null);

function navStyle(active: boolean): CSSProperties {
  const base =
    "display:inline-flex;align-items:center;gap:8px;flex:none;padding:8px 13px;border:1px solid transparent;border-radius:10px;background:transparent;font-family:inherit;font-size:13.5px;white-space:nowrap;cursor:pointer;text-decoration:none;transition:background .12s ease,color .12s ease,border-color .12s ease;";
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

export function TcProvider({
  children,
  initialQuery = "",
  autoRunSearch = false,
}: {
  children: ReactNode;
  initialQuery?: string;
  autoRunSearch?: boolean;
}) {
  const { data, loading, error } = useTherapyData();
  const therapies = useMemo(() => data?.therapies ?? [], [data]);
  const pathways = useMemo(() => data?.pathways ?? [], [data]);

  // Honor a run-enabled deep link (/therapy-compass?q=…&run=1): open on Search
  // with the query seeded, so a query submitted from the universal composer or a
  // recent-search pick runs in-tool instead of landing on Home. A fresh deep link
  // while already mounted re-seeds via the provider key in TherapyCompassPage,
  // which remounts this provider when the run-query changes.
  const seededQuery = autoRunSearch ? initialQuery.trim() : "";
  const [screen, setScreen] = useState<string>(seededQuery ? "search" : "home");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [search, setSearch] = useState<SearchOptions>(
    seededQuery ? { ...EMPTY_SEARCH, query: seededQuery } : EMPTY_SEARCH,
  );
  const [recQuery, setRecQuery] = useState("What therapy for anxiety in outpatient care?");
  const [recConstraints, setRecConstraints] = useState<string[]>(["outpatient"]);
  const [selectedPathwaySlug, setSelectedPathwaySlug] = useState<string | null>(null);

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

  const bySlug = useMemo(() => new Map(therapies.map((t) => [t.slug, t])), [therapies]);
  const unreviewedTherapies = useMemo(() => therapies.filter((t) => t.reviewStatus !== "reviewed"), [therapies]);

  // Default selections once data arrives so detail/brief/sheet/pathways are never empty.
  const effectiveSelectedSlug = selectedSlug ?? therapies[0]?.slug ?? null;
  const selectedTherapy = effectiveSelectedSlug ? (bySlug.get(effectiveSelectedSlug) ?? null) : null;
  const effectivePathwaySlug = selectedPathwaySlug ?? pathways[0]?.slug ?? null;
  const selectedPathway = effectivePathwaySlug ? (pathways.find((p) => p.slug === effectivePathwaySlug) ?? null) : null;

  const searchResults = useMemo(() => searchTherapies(therapies, search), [therapies, search]);
  const compareTherapies = useMemo(
    () => compareSlugs.map((sl) => bySlug.get(sl)).filter((t): t is Therapy => Boolean(t)),
    [compareSlugs, bySlug],
  );
  const recommendations = useMemo(
    () => rankRecommendations(therapies, recQuery, recConstraints),
    [therapies, recQuery, recConstraints],
  );
  const relatedForSelected = useMemo(
    () => (selectedTherapy ? relatedTherapies(therapies, selectedTherapy) : []),
    [therapies, selectedTherapy],
  );

  const value = useMemo<TcBindings>(() => {
    const go = (next: string) => setScreen(next);
    const toggleSection = (key: SheetSectionKey) => setSheetSections((prev) => ({ ...prev, [key]: !prev[key] }));
    const patchSearch = (patch: Partial<SearchOptions>) => setSearch((prev) => ({ ...prev, ...patch }));

    return {
      loading,
      error,
      therapies,
      unreviewedTherapies,
      reviewCount: unreviewedTherapies.length,
      pathways,
      reference: data?.reference ?? null,

      screen,
      go,
      goHome: () => go("home"),
      goSearch: () => go("search"),
      goRecommend: () => go("recommend"),
      goCompare: () => go("compare"),
      goPathways: () => go("pathways"),
      goBrief: () => go("brief"),
      goSheets: () => go("sheets"),
      goDetail: () => go("detail"),
      goReview: () => go("review"),
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

      selectedSlug: effectiveSelectedSlug,
      selectedTherapy,
      relatedForSelected,
      open: (slug) => {
        setSelectedSlug(slug);
        go("detail");
      },
      openBrief: (slug) => {
        setSelectedSlug(slug);
        go("brief");
      },
      openSheet: (slug) => {
        setSelectedSlug(slug);
        go("sheets");
      },
      select: (slug) => setSelectedSlug(slug),

      search,
      searchResults,
      setQuery: (q) => patchSearch({ query: q }),
      submitQuery: (q) => {
        patchSearch({ query: q });
        go("search");
      },
      toggleTag: (tag) =>
        setSearch((prev) => ({
          ...prev,
          tags: prev.tags.includes(tag) ? prev.tags.filter((x) => x !== tag) : [...prev.tags, tag],
        })),
      toggleBriefOnly: () => setSearch((prev) => ({ ...prev, briefOnly: !prev.briefOnly })),
      toggleSheetOnly: () => setSearch((prev) => ({ ...prev, sheetOnly: !prev.sheetOnly })),
      toggleReviewedOnly: () => setSearch((prev) => ({ ...prev, reviewedOnly: !prev.reviewedOnly })),
      clearSearch: () => setSearch(EMPTY_SEARCH),

      compareSlugs,
      compareTherapies,
      toggleCompare: (slug) => {
        setCompareSlugs((prev) =>
          prev.includes(slug) ? prev.filter((x) => x !== slug) : prev.length >= MAX_COMPARE ? prev : [...prev, slug],
        );
        go("compare");
      },
      addCompare: (slug) =>
        setCompareSlugs((prev) => (prev.includes(slug) || prev.length >= MAX_COMPARE ? prev : [...prev, slug])),
      removeCompare: (slug) => setCompareSlugs((prev) => prev.filter((x) => x !== slug)),
      clearCompare: () => setCompareSlugs([]),
      isInCompare: (slug) => compareSlugs.includes(slug),

      recQuery,
      setRecQuery,
      recConstraints,
      toggleConstraint: (key) =>
        setRecConstraints((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key])),
      recommendations,

      selectedPathwaySlug: effectivePathwaySlug,
      selectedPathway,
      selectPathway: (slug) => setSelectedPathwaySlug(slug),

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

      sheetTone,
      tonePlain: segStyle(sheetTone === "plain"),
      toneWarm: segStyle(sheetTone === "warm"),
      toneClinical: segStyle(sheetTone === "clinical"),
      setTonePlain: () => setSheetTone("plain"),
      setToneWarm: () => setSheetTone("warm"),
      setToneClinical: () => setSheetTone("clinical"),

      secAbout: sheetSections.about,
      secSteps: sheetSections.steps,
      secPractice: sheetSections.practice,
      secCoping: sheetSections.coping,
      secContacts: sheetSections.contacts,
      chipAbout: chipStyle(sheetSections.about),
      chipSteps: chipStyle(sheetSections.steps),
      chipPractice: chipStyle(sheetSections.practice),
      chipCoping: chipStyle(sheetSections.coping),
      chipContacts: chipStyle(sheetSections.contacts),
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
    };
  }, [
    loading,
    error,
    data,
    therapies,
    unreviewedTherapies,
    pathways,
    screen,
    effectiveSelectedSlug,
    selectedTherapy,
    relatedForSelected,
    search,
    searchResults,
    compareSlugs,
    compareTherapies,
    recQuery,
    recConstraints,
    recommendations,
    effectivePathwaySlug,
    selectedPathway,
    cmpTab,
    density,
    briefTab,
    sheetTone,
    sheetSections,
    sheetClinician,
  ]);

  return <TcContext.Provider value={value}>{children}</TcContext.Provider>;
}

export function useTcBindings(): TcBindings {
  const ctx = useContext(TcContext);
  if (!ctx) throw new Error("useTcBindings must be used within <TcProvider>");
  return ctx;
}

export { RECOMMEND_CONSTRAINTS };
