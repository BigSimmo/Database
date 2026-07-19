"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type AppPreferences,
  type LandingPreference,
} from "@/lib/account-preferences";
import { useAuthSession } from "@/lib/supabase/client";

export {
  ANSWER_STYLE_OPTIONS,
  DEFAULT_PREFERENCES,
  DENSITY_OPTIONS,
  JURISDICTION_OPTIONS,
  LANDING_OPTIONS,
  normalizePreferences,
  POPULATION_OPTIONS,
} from "@/lib/account-preferences";
export type {
  AnswerStylePreference,
  AppPreferences,
  DensityPreference,
  LandingPreference,
  MotionPreference,
  PopulationPreference,
} from "@/lib/account-preferences";

const emptyAuthorizationHeader: Record<string, string> = {};
const ignoreExpiredSession = () => undefined;

function useAuthSessionIfAvailable() {
  try {
    return useAuthSession();
  } catch (error) {
    if (error instanceof Error && error.message === "useAuthSession must be used within AuthProvider.") return null;
    throw error;
  }
}

/**
 * App-wide, non-clinical preferences persisted per browser. This mirrors the
 * external-store pattern in use-theme.ts / use-sidebar-collapsed.ts so a choice
 * made in the settings surface survives route changes across every shell and
 * stays in sync between open tabs. Nothing here is PHI; values are plain enums.
 */

const storageKey = "clinical-kb-preferences";
const changeEvent = "clinical-kb-preferences-change";

// In-memory fallback when localStorage is unavailable (private mode, quota).
let inMemoryFallback: AppPreferences | null = null;
// Cache the parsed snapshot so useSyncExternalStore gets a stable reference
// between reads (a fresh object each call would loop the store forever).
let cachedRaw: string | null = null;
let cachedValue: AppPreferences = DEFAULT_PREFERENCES;
let lastLocalPreferenceChangeAt = 0;

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
  lastLocalPreferenceChangeAt = Date.now();
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

/**
 * Maps the saved default-landing preference onto the dashboard mode a bare "/"
 * load should open in. "ask" is the built-in default (no override needed), so
 * it — and any unset/invalid value — returns null.
 */
export function landingModeForPreference(landing: LandingPreference): "documents" | "tools" | null {
  if (landing === "search") return "documents";
  if (landing === "browse") return "tools";
  return null;
}

/**
 * One-shot, non-hook read of the stored preferences for callers that apply a
 * preference outside React state (e.g. the landing-mode redirect on mount).
 * Live consumers should use `useAppPreferences` so they re-render on change.
 */
export function readAppPreferences(): AppPreferences {
  return getSnapshot();
}

export function useAppPreferences() {
  const auth = useAuthSessionIfAvailable();
  const authStatus = auth?.status ?? "signed_out";
  const authorizationHeader = auth?.authorizationHeader ?? emptyAuthorizationHeader;
  const authEpoch = auth?.authEpoch ?? 0;
  const markSessionExpired = auth?.markSessionExpired ?? ignoreExpiredSession;
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    const fetchStartedAt = Date.now();
    fetch("/api/account/preferences", {
      cache: "no-store",
      headers: authorizationHeader,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) markSessionExpired();
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (lastLocalPreferenceChangeAt > fetchStartedAt) return;
        if (payload.preferences) {
          persist(normalizePreferences(payload.preferences));
          return;
        }
        const bootstrapResponse = await fetch("/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authorizationHeader },
          body: JSON.stringify(getSnapshot()),
          signal: controller.signal,
        });
        if (bootstrapResponse.status === 401) markSessionExpired();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [authEpoch, authStatus, authorizationHeader, markSessionExpired]);

  useEffect(() => {
    applyPreferenceSideEffects(preferences);
  }, [preferences]);

  const persistAccountPreferences = useCallback(
    (next: AppPreferences) => {
      if (authStatus !== "authenticated") return;
      fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authorizationHeader },
        body: JSON.stringify(next),
      })
        .then((response) => {
          if (response.status === 401) markSessionExpired();
        })
        .catch(() => undefined);
    },
    [authStatus, authorizationHeader, markSessionExpired],
  );

  const setPreference = useCallback(
    <Key extends keyof AppPreferences>(key: Key, value: AppPreferences[Key]) => {
      const current = getSnapshot();
      if (current[key] === value) return;
      const next = { ...current, [key]: value };
      persist(next);
      persistAccountPreferences(next);
    },
    [persistAccountPreferences],
  );

  const resetPreferences = useCallback(() => {
    persist(DEFAULT_PREFERENCES);
    persistAccountPreferences(DEFAULT_PREFERENCES);
  }, [persistAccountPreferences]);

  return { preferences, setPreference, resetPreferences };
}
