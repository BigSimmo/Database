export const THERAPY_COMPASS_BASE = "/therapy-compass";
export const THERAPY_MAX_COMPARE = 4;

export const THERAPY_KNOWN_SCREENS = [
  "search",
  "detail",
  "compare",
  "recommend",
  "pathways",
  "brief",
  "home",
  "sheets",
] as const;

export type TherapyScreen = (typeof THERAPY_KNOWN_SCREENS)[number];
export type TherapyCompareTab = "priorities" | "differences" | "all";
export type TherapyDensity = "comfortable" | "dense";
export type TherapyBriefDuration = "5min" | "15min" | "ground";
export type TherapySheetTone = "plain" | "warm" | "clinical";
export type TherapySheetSection = "about" | "steps" | "practice" | "coping" | "contacts";

export const THERAPY_RESERVED_ROUTE_SEGMENTS = ["search", "recommend", "compare", "pathways", "review"] as const;
const RESERVED_SEGMENTS = new Set<string>(THERAPY_RESERVED_ROUTE_SEGMENTS);
const ALL_SHEET_SECTIONS: TherapySheetSection[] = ["about", "steps", "practice", "coping", "contacts"];

export const THERAPY_WORKSPACE_PARAM_KEYS = [
  "ids",
  "topic",
  "brief",
  "sheet",
  "reviewed",
  "constraint",
  "pathway",
  "comparison",
  "density",
  "duration",
  "tone",
  "section",
  "clinician",
] as const;

const THERAPY_SENSITIVE_PARAM_KEYS = ["prompt", "recQuery", "recommendation", "patient", "notes"] as const;

export type TherapyWorkspaceState = {
  compareSlugs: string[];
  topics: string[];
  briefOnly: boolean;
  sheetOnly: boolean;
  reviewedOnly: boolean;
  constraints: string[];
  pathwaySlug: string | null;
  comparison: TherapyCompareTab;
  density: TherapyDensity;
  duration: TherapyBriefDuration;
  tone: TherapySheetTone;
  sections: TherapySheetSection[];
  clinician: boolean;
};

export const DEFAULT_THERAPY_WORKSPACE_STATE: TherapyWorkspaceState = {
  compareSlugs: [],
  topics: [],
  briefOnly: false,
  sheetOnly: false,
  reviewedOnly: false,
  constraints: ["outpatient"],
  pathwaySlug: null,
  comparison: "differences",
  density: "comfortable",
  duration: "5min",
  tone: "plain",
  sections: ALL_SHEET_SECTIONS,
  clinician: true,
};

function uniqueNonEmpty(values: Iterable<string>, limit = Number.POSITIVE_INFINITY): string[] {
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
    if (unique.length >= limit) break;
  }
  return unique;
}

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolve the active Therapy screen and record slug from a canonical pathname. */
export function resolveTherapyRoute(pathname: string): { screen: string; slug: string | null } {
  const rest = pathname.startsWith(THERAPY_COMPASS_BASE)
    ? pathname.slice(THERAPY_COMPASS_BASE.length).replace(/^\/+/, "")
    : "";
  const segments = rest ? rest.split("/") : [];
  if (segments.length === 0) return { screen: "home", slug: null };
  const [first, second] = segments;
  if (RESERVED_SEGMENTS.has(first)) return { screen: first, slug: null };
  const screen = second === "brief" ? "brief" : second === "sheet" ? "sheets" : "detail";
  return { screen, slug: safeDecodePathSegment(first) };
}

/**
 * Therapy routes that render the shared phone bottom dock, and therefore have a
 * slot the compare tray can dock into.
 *
 * `/therapy-compass/recommend` is absent because it hides the shell composer
 * (it owns an in-flow clinical-situation composer instead), and the record
 * routes are absent because `isInformationPage` hides the composer there. The
 * reserve inflates when a route CLAIMS the addon slot, not when the tray
 * renders, so claiming a route with no dock opens a blank band at the bottom of
 * the page — this list is what stops that.
 */
export const THERAPY_PHONE_DOCK_ROUTES = [
  THERAPY_COMPASS_BASE,
  `${THERAPY_COMPASS_BASE}/search`,
  `${THERAPY_COMPASS_BASE}/compare`,
  `${THERAPY_COMPASS_BASE}/pathways`,
  `${THERAPY_COMPASS_BASE}/review`,
] as const;

export function isTherapyPhoneDockRoute(pathname: string): boolean {
  return (THERAPY_PHONE_DOCK_ROUTES as readonly string[]).includes(pathname);
}

/**
 * How many therapies the URL currently selects for comparison.
 *
 * The shell needs this — and only this — to decide whether the compare tray has
 * anything to dock, without pulling the whole workspace parser onto every
 * render of every route.
 */
export function readTherapyCompareSlugCount(params: Pick<URLSearchParams, "get">): number {
  return uniqueNonEmpty((params.get("ids") ?? "").split(","), THERAPY_MAX_COMPARE).length;
}

export function therapyScreenHref(screen: string): string {
  return screen === "home" ? THERAPY_COMPASS_BASE : `${THERAPY_COMPASS_BASE}/${screen}`;
}

export function therapyRecordHref(slug: string, artifact?: "brief" | "sheet"): string {
  const encodedSlug = encodeURIComponent(slug);
  return artifact ? `${THERAPY_COMPASS_BASE}/${encodedSlug}/${artifact}` : `${THERAPY_COMPASS_BASE}/${encodedSlug}`;
}

/** Parse only non-sensitive, explicitly shareable workspace state. */
export function readTherapyWorkspaceState(params: Pick<URLSearchParams, "get" | "getAll">): TherapyWorkspaceState {
  const compareSlugs = uniqueNonEmpty((params.get("ids") ?? "").split(","), THERAPY_MAX_COMPARE);
  const topics = uniqueNonEmpty(params.getAll("topic"));
  const rawConstraints = uniqueNonEmpty(params.getAll("constraint"));
  const rawSections = uniqueNonEmpty(params.getAll("section"));
  const sections = rawSections.filter((value): value is TherapySheetSection =>
    ALL_SHEET_SECTIONS.includes(value as TherapySheetSection),
  );

  return {
    compareSlugs,
    topics,
    briefOnly: params.get("brief") === "1",
    sheetOnly: params.get("sheet") === "1",
    reviewedOnly: params.get("reviewed") === "1",
    constraints: rawConstraints.includes("none")
      ? []
      : rawConstraints.length > 0
        ? rawConstraints
        : DEFAULT_THERAPY_WORKSPACE_STATE.constraints,
    pathwaySlug: params.get("pathway")?.trim() || null,
    comparison: oneOf(params.get("comparison"), ["priorities", "differences", "all"], "differences"),
    density: oneOf(params.get("density"), ["comfortable", "dense"], "comfortable"),
    duration: oneOf(params.get("duration"), ["5min", "15min", "ground"], "5min"),
    tone: oneOf(params.get("tone"), ["plain", "warm", "clinical"], "plain"),
    sections: rawSections.includes("none") ? [] : sections.length > 0 ? sections : ALL_SHEET_SECTIONS,
    clinician: params.get("clinician") !== "0",
  };
}

function setRepeated(params: URLSearchParams, key: string, values: readonly string[]) {
  params.delete(key);
  for (const value of uniqueNonEmpty(values)) params.append(key, value);
}

/**
 * Canonicalise shareable state while preserving unrelated search/navigation
 * context such as `q`, `run`, and `from`. Free-text recommendation prompts are
 * intentionally unrepresentable here so they cannot leak into URLs or logs.
 */
export function therapyWorkspaceSearchParams(
  current: Pick<URLSearchParams, "toString">,
  state: TherapyWorkspaceState,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of THERAPY_WORKSPACE_PARAM_KEYS) params.delete(key);
  for (const key of THERAPY_SENSITIVE_PARAM_KEYS) params.delete(key);

  if (state.compareSlugs.length > 0)
    params.set("ids", uniqueNonEmpty(state.compareSlugs, THERAPY_MAX_COMPARE).join(","));
  setRepeated(params, "topic", state.topics);
  if (state.briefOnly) params.set("brief", "1");
  if (state.sheetOnly) params.set("sheet", "1");
  if (state.reviewedOnly) params.set("reviewed", "1");
  if (state.constraints.join("|") !== DEFAULT_THERAPY_WORKSPACE_STATE.constraints.join("|")) {
    if (state.constraints.length === 0) params.set("constraint", "none");
    else setRepeated(params, "constraint", state.constraints);
  }
  if (state.pathwaySlug) params.set("pathway", state.pathwaySlug);
  if (state.comparison !== DEFAULT_THERAPY_WORKSPACE_STATE.comparison) params.set("comparison", state.comparison);
  if (state.density !== DEFAULT_THERAPY_WORKSPACE_STATE.density) params.set("density", state.density);
  if (state.duration !== DEFAULT_THERAPY_WORKSPACE_STATE.duration) params.set("duration", state.duration);
  if (state.tone !== DEFAULT_THERAPY_WORKSPACE_STATE.tone) params.set("tone", state.tone);
  const canonicalSections = ALL_SHEET_SECTIONS.filter((section) => state.sections.includes(section));
  if (canonicalSections.join("|") !== ALL_SHEET_SECTIONS.join("|")) {
    if (canonicalSections.length === 0) params.set("section", "none");
    else setRepeated(params, "section", canonicalSections);
  }
  if (!state.clinician) params.set("clinician", "0");
  return params;
}

export function therapyHrefWithSearchParams(pathname: string, params: Pick<URLSearchParams, "toString">): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Entries safe to carry between Therapy workflows through the shared mode bar. */
export function therapyWorkspaceNavigationEntries(params: URLSearchParams): Array<readonly [string, string]> {
  const allowed = new Set<string>(["q", "run", ...THERAPY_WORKSPACE_PARAM_KEYS]);
  return Array.from(params.entries()).filter(([key, value]) => allowed.has(key) && Boolean(value));
}
