"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  MOTION_OPTIONS,
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

/**
 * Whether the last write of these preferences reached the signed-in account.
 *
 * `local-only` is the honest resting state for a signed-out browser rather than
 * a failure: the choice is saved, just not anywhere else. Before this existed
 * both the bootstrap read and every write swallowed their errors, so a failed
 * sync was indistinguishable from a successful one and the settings surface had
 * nothing truthful to show.
 */
export type PreferenceSyncState = "local-only" | "syncing" | "synced" | "error";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : (error as { name?: string })?.name === "AbortError";
}

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
/**
 * Module mirror of bootstrap readiness for non-React one-shot callers of
 * `mayRecordRecentSearches()`. Updated only from an effect inside
 * `useAppPreferences` (never during render). Prefer the hook return value
 * `canRecordRecentSearches` in React trees.
 */
let accountPreferencesReadyForRecording = false;

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
  // "system" is the absence of the attribute, so the CSS falls through to plain
  // prefers-reduced-motion. "reduced"/"full" are explicit overrides in either
  // direction and both need to reach the stylesheet.
  if (preferences.motion === "system") {
    root.removeAttribute("data-motion");
  } else {
    root.setAttribute("data-motion", preferences.motion);
  }
}

/**
 * Maps the saved default-landing preference onto the mode home a bare "/" load
 * should open. "ask" is the built-in default (no override needed), so it — and
 * any unset/invalid value — returns null. Callers must navigate to the mode's
 * real home (`/documents`, `/tools`): bare `/?mode=documents` is the shared home
 * with Documents preselected, not the Documents Start-here surface.
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

/**
 * Whether it is safe to write a recent query right now. Returns false while an
 * authenticated account preference bootstrap has not settled, and false when
 * the resolved preference opts out. Callers that only need this gate should
 * still mount `useAppPreferences` somewhere in the tree so the bootstrap runs.
 */
export function mayRecordRecentSearches(): boolean {
  if (!accountPreferencesReadyForRecording) return false;
  return getSnapshot().saveRecentSearches;
}

export function useAppPreferences() {
  const auth = useAuthSessionIfAvailable();
  const authStatus = auth?.status ?? "signed_out";
  const authorizationHeader = auth?.authorizationHeader ?? emptyAuthorizationHeader;
  const authEpoch = auth?.authEpoch ?? 0;
  const markSessionExpired = auth?.markSessionExpired ?? ignoreExpiredSession;
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // `null` means "nothing observed for this session yet", which reads as
  // "syncing" below. Keeping it nullable is what lets the resting states be
  // derived rather than written from an effect: a signed-out browser is always
  // `local-only`, and a freshly signed-in one is always `syncing` until the
  // bootstrap request answers.
  const [observedSync, setObservedSync] = useState<PreferenceSyncState | null>(null);
  const [sessionKey, setSessionKey] = useState(`${authEpoch}:${authStatus}`);
  // Only the newest write may set the resting sync state. Two quick toggles
  // otherwise race, and a slow first response can overwrite a fast second one —
  // showing "couldn't sync" for a write that has already succeeded.
  const writeSequenceRef = useRef(0);
  // Serialize account PUTs so a delayed older whole-snapshot upsert cannot
  // overwrite a newer one that already reached the server. The pending ref
  // coalesces bursts: only the latest snapshot is sent when the chain drains.
  const writeChainRef = useRef(Promise.resolve());
  const pendingWriteRef = useRef<AppPreferences | null>(null);

  // Adjust during render rather than in an effect: a new session must not spend
  // a frame reporting the previous session's sync outcome, and an effect always
  // lands one render too late for that.
  const currentSessionKey = `${authEpoch}:${authStatus}`;
  if (sessionKey !== currentSessionKey) {
    setSessionKey(currentSessionKey);
    setObservedSync(null);
  }

  const syncState: PreferenceSyncState = authStatus !== "authenticated" ? "local-only" : (observedSync ?? "syncing");
  const accountBootstrapReady =
    authStatus !== "authenticated" || observedSync === "synced" || observedSync === "local-only";
  const canRecordRecentSearches = accountBootstrapReady && preferences.saveRecentSearches;

  useEffect(() => {
    accountPreferencesReadyForRecording = accountBootstrapReady;
  }, [accountBootstrapReady]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    const fetchStartedAt = Date.now();
    void (async () => {
      try {
        const response = await fetch("/api/account/preferences", {
          cache: "no-store",
          headers: authorizationHeader,
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401) {
            markSessionExpired();
            setObservedSync("local-only");
            return;
          }
          setObservedSync("error");
          return;
        }
        const payload = await response.json().catch(() => ({}));
        // A local change made while this read was in flight is newer than what
        // the server returned; keep it rather than clobbering it, and treat the
        // pending write it already queued as the authority on sync state.
        if (lastLocalPreferenceChangeAt > fetchStartedAt) return;
        if (payload.preferences) {
          persist(normalizePreferences(payload.preferences));
          setObservedSync("synced");
          return;
        }
        const bootstrapResponse = await fetch("/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authorizationHeader },
          body: JSON.stringify(getSnapshot()),
          signal: controller.signal,
        });
        if (bootstrapResponse.status === 401) {
          markSessionExpired();
          setObservedSync("local-only");
          return;
        }
        setObservedSync(bootstrapResponse.ok ? "synced" : "error");
      } catch (error) {
        // An abort is this effect being torn down, not a failure to report.
        if (isAbortError(error)) return;
        setObservedSync("error");
      }
    })();
    return () => controller.abort();
  }, [authEpoch, authStatus, authorizationHeader, markSessionExpired]);

  useEffect(() => {
    applyPreferenceSideEffects(preferences);
  }, [preferences]);

  const persistAccountPreferences = useCallback(
    (next: AppPreferences) => {
      if (authStatus !== "authenticated") {
        setObservedSync("local-only");
        return;
      }
      const sequence = ++writeSequenceRef.current;
      pendingWriteRef.current = next;
      const settle = (state: PreferenceSyncState) => {
        if (sequence === writeSequenceRef.current) setObservedSync(state);
      };
      setObservedSync("syncing");
      writeChainRef.current = writeChainRef.current
        .catch(() => undefined)
        .then(async () => {
          // A newer setPreference already replaced the pending snapshot; let
          // that later chain step send it instead of upserting this stale one.
          if (pendingWriteRef.current !== next) return;
          const snapshot = pendingWriteRef.current;
          pendingWriteRef.current = null;
          try {
            const response = await fetch("/api/account/preferences", {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...authorizationHeader },
              body: JSON.stringify(snapshot),
            });
            if (response.status === 401) {
              markSessionExpired();
              settle("local-only");
              return;
            }
            settle(response.ok ? "synced" : "error");
          } catch {
            settle("error");
          }
        });
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

  /**
   * Reset every preference, or only the named keys. A partial reset exists so
   * repairing one section (appearance, say) does not also discard the clinical
   * defaults, which the single all-or-nothing reset used to do silently.
   */
  const resetPreferences = useCallback(
    (keys?: ReadonlyArray<keyof AppPreferences>) => {
      const next = keys
        ? keys.reduce<AppPreferences>((draft, key) => ({ ...draft, [key]: DEFAULT_PREFERENCES[key] }), getSnapshot())
        : DEFAULT_PREFERENCES;
      persist(next);
      persistAccountPreferences(next);
    },
    [persistAccountPreferences],
  );

  const retrySync = useCallback(() => {
    persistAccountPreferences(getSnapshot());
  }, [persistAccountPreferences]);

  return {
    preferences,
    setPreference,
    resetPreferences,
    syncState,
    retrySync,
    canRecordRecentSearches,
  };
}
