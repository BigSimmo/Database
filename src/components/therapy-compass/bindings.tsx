"use client";

import { createContext, useContext, useMemo, useState, useDeferredValue, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

// Therapy Compass now owns a route family under this base. Screen state is derived
// from the pathname (not React state) so every destination is a real URL: Home is the
// base, the fixed workspaces are static children, and a therapy detail / brief / sheet
// is `${BASE}/<slug>[/brief|/sheet]`. Reserved segments never collide with therapy
// slugs (verified in scripts) so a first segment that is not reserved is a slug.
const BASE = "/therapy-compass";
const RESERVED_SEGMENTS = new Set(["search", "recommend", "compare", "pathways", "review"]);

function screenHref(screen: string): string {
  return screen === "home" ? BASE : `${BASE}/${screen}`;
}

/** Resolve the active screen + therapy slug from the current pathname. */
function resolveRoute(pathname: string): { screen: string; slug: string | null } {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length).replace(/^\/+/, "") : "";
  const segments = rest ? rest.split("/") : [];
  if (segments.length === 0) return { screen: "home", slug: null };
  const [first, second] = segments;
  if (RESERVED_SEGMENTS.has(first)) return { screen: first, slug: null };
  // A non-reserved first segment is a therapy slug; the optional second segment
  // selects the brief-intervention or patient-sheet sub-view.
  const screen = second === "brief" ? "brief" : second === "sheet" ? "sheets" : "detail";
  return { screen, slug: first };
}

type SheetSectionKey = "about" | "steps" | "practice" | "coping" | "contacts";

export type TcBindings = {
  // ---- data -----------------------------------------------------------
  loading: boolean;
  error: string | null;
  retryData: () => void;
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
  navHome: string;
  navSearch: string;
  navRecommend: string;
  navCompare: string;
  navPathways: string;
  navBrief: string;
  navSheets: string;
  navReview: string;

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
  tabPriorities: string;
  tabDifferences: string;
  tabAll: string;
  setTabPriorities: () => void;
  setTabDifferences: () => void;
  setTabAll: () => void;
  density: string;
  segComfortable: string;
  segDense: string;
  setComfortable: () => void;
  setDense: () => void;

  // ---- brief-intervention tabs ---------------------------------------
  briefTab: string;
  brief5: string;
  brief15: string;
  briefGround: string;
  set5: () => void;
  set15: () => void;
  setGround: () => void;

  // ---- patient-sheet tone --------------------------------------------
  sheetTone: string;
  tonePlain: string;
  toneWarm: string;
  toneClinical: string;
  setTonePlain: () => void;
  setToneWarm: () => void;
  setToneClinical: () => void;

  // ---- patient-sheet sections + clinician ----------------------------
  secAbout: boolean;
  secSteps: boolean;
  secPractice: boolean;
  secCoping: boolean;
  secContacts: boolean;
  chipAbout: string;
  chipSteps: string;
  chipPractice: string;
  chipCoping: string;
  chipContacts: string;
  toggleAbout: () => void;
  toggleSteps: () => void;
  togglePractice: () => void;
  toggleCoping: () => void;
  toggleContacts: () => void;
  sheetClinician: boolean;
  toggleClinician: () => void;
  clinicianTrack: string;
  clinicianKnob: string;
  printSheet: () => void;
};

const TcContext = createContext<TcBindings | null>(null);

function navStyle(active: boolean): string {
  return `tc-nav-control${active ? " tc-is-active" : ""}`;
}
function tabStyle(active: boolean): string {
  return `tc-tab-control${active ? " tc-is-active" : ""}`;
}
function segStyle(active: boolean): string {
  return `tc-segment-control${active ? " tc-is-active" : ""}`;
}
function chipStyle(active: boolean): string {
  return `tc-chip-control${active ? " tc-is-active" : ""}`;
}

export function TcProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { screen, slug: routeSlug } = resolveRoute(pathname);
  const usesCatalogueIndex = screen === "home" || screen === "search" || screen === "pathways";
  const { data, loading, error, retry } = useTherapyData({
    catalogue: usesCatalogueIndex ? "index" : "full",
    includePathways: screen === "pathways",
    includeReference: false,
  });
  const therapies = useMemo(() => data?.therapies ?? [], [data]);
  const pathways = useMemo(() => data?.pathways ?? [], [data]);

  // The active screen and therapy are derived from the URL: each workspace route
  // renders the matching screen, and this keeps nav highlighting + the selected
  // therapy in sync with the address bar (back/forward, deep links, new tabs).
  // Non-navigational interaction state lives in the provider, which the layout
  // keeps mounted across the tool's routes so selections persist between screens.
  const qParam = (searchParams.get("q") ?? "").trim();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [search, setSearch] = useState<SearchOptions>(() =>
    qParam ? { ...EMPTY_SEARCH, query: qParam } : EMPTY_SEARCH,
  );
  const [recQuery, setRecQuery] = useState("What therapy for anxiety in outpatient care?");
  const [recConstraints, setRecConstraints] = useState<string[]>(["outpatient"]);
  const [selectedPathwaySlug, setSelectedPathwaySlug] = useState<string | null>(null);

  // Seed the search query from a `?q=` deep link (universal-search "view all" or a
  // recent-search pick) and re-sync whenever the deep link changes, using the
  // render-phase "adjust state when a value changes" pattern so live typing between
  // deep links is preserved without a setState-in-effect cascade. The sync is
  // unconditional (including an empty `q`) so navigating from `?q=act` back to a
  // query-less URL clears the stale query and the rendered state matches the URL.
  const [seededQuery, setSeededQuery] = useState(qParam);
  if (qParam !== seededQuery) {
    setSeededQuery(qParam);
    setSearch((prev) => ({ ...prev, query: qParam }));
  }

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
  // A slug in the URL always wins; otherwise fall back to any imperatively-set slug,
  // then the first therapy so the no-arg brief/sheet nav buttons have a target.
  const defaultTherapy =
    screen === "brief"
      ? therapies.find((therapy) => therapy.briefInterventionAvailable)
      : screen === "sheets"
        ? therapies.find((therapy) => therapy.patientSheetAvailable)
        : therapies[0];
  const effectiveSelectedSlug = routeSlug ?? selectedSlug ?? defaultTherapy?.slug ?? null;
  const selectedTherapy = effectiveSelectedSlug ? (bySlug.get(effectiveSelectedSlug) ?? null) : null;
  const effectivePathwaySlug = selectedPathwaySlug ?? pathways[0]?.slug ?? null;
  const selectedPathway = effectivePathwaySlug ? (pathways.find((p) => p.slug === effectivePathwaySlug) ?? null) : null;

  const deferredSearch = useDeferredValue(search);
  const searchResults = useMemo(() => searchTherapies(therapies, deferredSearch), [therapies, deferredSearch]);
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
    const go = (next: string) => router.push(screenHref(next));
    const toggleSection = (key: SheetSectionKey) => setSheetSections((prev) => ({ ...prev, [key]: !prev[key] }));
    const patchSearch = (patch: Partial<SearchOptions>) => setSearch((prev) => ({ ...prev, ...patch }));
    const openSlug = (slug: string, sub?: "brief" | "sheet") =>
      router.push(sub ? `${BASE}/${slug}/${sub}` : `${BASE}/${slug}`);
    // Unsupported artifact actions are a no-op. Call sites expose an honest disabled
    // state instead of silently sending the user to a different detail destination.
    const hasBrief = (slug: string | null | undefined) =>
      !!slug && (bySlug.get(slug)?.briefInterventionAvailable ?? false);
    const hasSheet = (slug: string | null | undefined) => !!slug && (bySlug.get(slug)?.patientSheetAvailable ?? false);
    const openBriefOr = (slug: string) => {
      if (hasBrief(slug)) openSlug(slug, "brief");
    };
    const openSheetOr = (slug: string) => {
      if (hasSheet(slug)) openSlug(slug, "sheet");
    };

    return {
      loading,
      error,
      retryData: retry,
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
      goBrief: () => {
        const target = hasBrief(effectiveSelectedSlug)
          ? effectiveSelectedSlug
          : therapies.find((therapy) => therapy.briefInterventionAvailable)?.slug;
        if (target) openBriefOr(target);
      },
      goSheets: () => {
        const target = hasSheet(effectiveSelectedSlug)
          ? effectiveSelectedSlug
          : therapies.find((therapy) => therapy.patientSheetAvailable)?.slug;
        if (target) openSheetOr(target);
      },
      goDetail: () => (effectiveSelectedSlug ? openSlug(effectiveSelectedSlug) : go("home")),
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
      open: (slug) => openSlug(slug),
      openBrief: (slug) => openBriefOr(slug),
      openSheet: (slug) => openSheetOr(slug),
      // On a routed brief/sheet/detail screen the URL slug wins over `selectedSlug`,
      // so a picker choice must navigate to the chosen therapy's matching subroute
      // instead of only setting state. Artifact pickers expose only supported records;
      // the guarded helpers remain no-ops for any stale or programmatic invalid choice.
      select: (slug) =>
        screen === "brief"
          ? openBriefOr(slug)
          : screen === "sheets"
            ? openSheetOr(slug)
            : screen === "detail"
              ? openSlug(slug)
              : setSelectedSlug(slug),

      search,
      searchResults,
      setQuery: (q) => patchSearch({ query: q }),
      submitQuery: (q) => {
        patchSearch({ query: q });
        const trimmed = q.trim();
        // Keep the query in the URL so the search screen is deep-linkable / shareable
        // and the run-enabled link keeps rendering the tool (not the dashboard).
        router.push(trimmed ? `${BASE}/search?q=${encodeURIComponent(trimmed)}&run=1` : `${BASE}/search`);
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
      clinicianTrack: `tc-clinician-track${sheetClinician ? " tc-is-active" : ""}`,
      clinicianKnob: `tc-clinician-knob${sheetClinician ? " tc-is-active" : ""}`,
      printSheet: () => {
        if (typeof window !== "undefined") window.print();
      },
    };
  }, [
    router,
    loading,
    error,
    retry,
    data,
    therapies,
    bySlug,
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
