"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * App-wide, non-clinical preferences persisted per browser. This mirrors the
 * external-store pattern in use-theme.ts / use-sidebar-collapsed.ts so a choice
 * made in the settings surface survives route changes across every shell and
 * stays in sync between open tabs. Nothing here is PHI; values are plain enums.
 */

export type DensityPreference = "comfortable" | "compact" | "spacious";
export type MotionPreference = "system" | "reduced";
export type PopulationPreference = "adults" | "older-adults" | "adolescents" | "all";
export type AnswerStylePreference = "conservative" | "balanced" | "comprehensive";
export type LandingPreference = "ask" | "search" | "browse";

export type AppPreferences = {
  density: DensityPreference;
  motion: MotionPreference;
  jurisdiction: string;
  population: PopulationPreference;
  answerStyle: AnswerStylePreference;
  landing: LandingPreference;
  showRecentOnHome: boolean;
  showProtocolsOnHome: boolean;
  compactCitations: boolean;
  notifyGuidelineUpdates: boolean;
  notifyProductNews: boolean;
  notifySavedChanges: boolean;
};

export const JURISDICTION_OPTIONS = [
  { value: "wa", label: "Western Australia" },
  { value: "nsw", label: "New South Wales" },
  { value: "vic", label: "Victoria" },
  { value: "qld", label: "Queensland" },
  { value: "sa", label: "South Australia" },
  { value: "tas", label: "Tasmania" },
  { value: "act", label: "Australian Capital Territory" },
  { value: "nt", label: "Northern Territory" },
  { value: "national", label: "National (Australia)" },
] as const;

export const POPULATION_OPTIONS: ReadonlyArray<{ value: PopulationPreference; label: string }> = [
  { value: "adults", label: "Adults" },
  { value: "older-adults", label: "Older adults" },
  { value: "adolescents", label: "Adolescents" },
  { value: "all", label: "All ages" },
];

export const ANSWER_STYLE_OPTIONS: ReadonlyArray<{
  value: AnswerStylePreference;
  label: string;
  description: string;
}> = [
  { value: "conservative", label: "Conservative", description: "Guideline-first, cautious phrasing" },
  { value: "balanced", label: "Balanced", description: "Guidelines with practical context" },
  { value: "comprehensive", label: "Comprehensive", description: "Fuller detail and alternatives" },
];

export const DENSITY_OPTIONS: ReadonlyArray<{ value: DensityPreference; label: string }> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
  { value: "spacious", label: "Spacious" },
];

export const LANDING_OPTIONS: ReadonlyArray<{ value: LandingPreference; label: string }> = [
  { value: "ask", label: "Ask" },
  { value: "search", label: "Search" },
  { value: "browse", label: "Browse" },
];

export const DEFAULT_PREFERENCES: AppPreferences = {
  density: "comfortable",
  motion: "system",
  jurisdiction: "wa",
  population: "adults",
  answerStyle: "conservative",
  landing: "ask",
  showRecentOnHome: true,
  showProtocolsOnHome: true,
  compactCitations: false,
  notifyGuidelineUpdates: true,
  notifyProductNews: false,
  notifySavedChanges: true,
};

const storageKey = "clinical-kb-preferences";
const changeEvent = "clinical-kb-preferences-change";

// In-memory fallback when localStorage is unavailable (private mode, quota).
let inMemoryFallback: AppPreferences | null = null;
// Cache the parsed snapshot so useSyncExternalStore gets a stable reference
// between reads (a fresh object each call would loop the store forever).
let cachedRaw: string | null = null;
let cachedValue: AppPreferences = DEFAULT_PREFERENCES;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceEnum<T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  return typeof value === "string" && (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizePreferences(input: unknown): AppPreferences {
  if (!isPlainObject(input)) return DEFAULT_PREFERENCES;
  const jurisdiction =
    typeof input.jurisdiction === "string" && JURISDICTION_OPTIONS.some((option) => option.value === input.jurisdiction)
      ? input.jurisdiction
      : DEFAULT_PREFERENCES.jurisdiction;
  return {
    density: coerceEnum(input.density, ["comfortable", "compact", "spacious"], DEFAULT_PREFERENCES.density),
    motion: coerceEnum(input.motion, ["system", "reduced"], DEFAULT_PREFERENCES.motion),
    jurisdiction,
    population: coerceEnum(
      input.population,
      ["adults", "older-adults", "adolescents", "all"],
      DEFAULT_PREFERENCES.population,
    ),
    answerStyle: coerceEnum(
      input.answerStyle,
      ["conservative", "balanced", "comprehensive"],
      DEFAULT_PREFERENCES.answerStyle,
    ),
    landing: coerceEnum(input.landing, ["ask", "search", "browse"], DEFAULT_PREFERENCES.landing),
    showRecentOnHome: coerceBoolean(input.showRecentOnHome, DEFAULT_PREFERENCES.showRecentOnHome),
    showProtocolsOnHome: coerceBoolean(input.showProtocolsOnHome, DEFAULT_PREFERENCES.showProtocolsOnHome),
    compactCitations: coerceBoolean(input.compactCitations, DEFAULT_PREFERENCES.compactCitations),
    notifyGuidelineUpdates: coerceBoolean(input.notifyGuidelineUpdates, DEFAULT_PREFERENCES.notifyGuidelineUpdates),
    notifyProductNews: coerceBoolean(input.notifyProductNews, DEFAULT_PREFERENCES.notifyProductNews),
    notifySavedChanges: coerceBoolean(input.notifySavedChanges, DEFAULT_PREFERENCES.notifySavedChanges),
  };
}

function readStored(): AppPreferences {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = DEFAULT_PREFERENCES;
    return cachedValue;
  }
  try {
    cachedValue = normalizePreferences(JSON.parse(raw));
  } catch {
    cachedValue = DEFAULT_PREFERENCES;
  }
  return cachedValue;
}

function getSnapshot(): AppPreferences {
  if (inMemoryFallback) return inMemoryFallback;
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  return readStored();
}

function getServerSnapshot(): AppPreferences {
  return DEFAULT_PREFERENCES;
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function persist(next: AppPreferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    inMemoryFallback = null;
  } catch {
    inMemoryFallback = next;
  }
  window.dispatchEvent(new Event(changeEvent));
}

/** Reflects density/motion onto <html> so the choice takes real visual effect. */
export function applyPreferenceSideEffects(preferences: AppPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (preferences.density === "comfortable") {
    root.removeAttribute("data-density");
  } else {
    root.setAttribute("data-density", preferences.density);
  }
  if (preferences.motion === "reduced") {
    root.setAttribute("data-motion", "reduced");
  } else {
    root.removeAttribute("data-motion");
  }
}

export function useAppPreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyPreferenceSideEffects(preferences);
  }, [preferences]);

  const setPreference = useCallback(<Key extends keyof AppPreferences>(key: Key, value: AppPreferences[Key]) => {
    const current = getSnapshot();
    if (current[key] === value) return;
    persist({ ...current, [key]: value });
  }, []);

  const resetPreferences = useCallback(() => {
    persist(DEFAULT_PREFERENCES);
  }, []);

  return { preferences, setPreference, resetPreferences };
}
