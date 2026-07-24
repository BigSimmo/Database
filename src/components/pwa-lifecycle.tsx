"use client";

import { RefreshCw, Share, SquarePlus, Wifi, WifiOff, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

const SERVICE_WORKER_URL = "/sw.js";
const INSTALL_DISMISSAL_KEY = "clinical-kb-pwa-install-dismissed-at";
const IOS_INSTALL_DISMISSAL_KEY = "clinical-kb-pwa-ios-install-dismissed-at";
const INSTALL_DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const PWA_CACHE_PREFIX = "clinical-kb-pwa-";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function subscribeConnectivity(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getConnectivitySnapshot() {
  return navigator.onLine;
}

const useConnectivityStore = createBrowserStore(subscribeConnectivity, getConnectivitySnapshot, true);

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function wasInstallRecentlyDismissed(key: string = INSTALL_DISMISSAL_KEY) {
  try {
    const dismissedAt = Number(window.localStorage.getItem(key));
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
    if (Date.now() - dismissedAt < INSTALL_DISMISSAL_MS) return true;
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private/restricted contexts. Installation
    // remains a progressive enhancement, so a storage failure is non-fatal.
  }
  return false;
}

function rememberInstallDismissal(key: string = INSTALL_DISMISSAL_KEY) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // See wasInstallRecentlyDismissed: the prompt can still be dismissed for
    // this render even when persistence is unavailable.
  }
}

function isIosBrowser() {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ reports a macOS user agent but exposes multi-touch.
  return platform === "MacIntel" && (maxTouchPoints ?? 0) > 1;
}

async function teardownLocalPwa() {
  try {
    // Exact-match the owned worker URL: a suffix check would also catch an
    // unrelated same-origin worker registered at a nested path like
    // /other-app/sw.js.
    const ownedWorkerUrl = new URL(SERVICE_WORKER_URL, window.location.origin).href;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) =>
          [registration.active, registration.waiting, registration.installing].some(
            (worker) => worker?.scriptURL === ownedWorkerUrl,
          ),
        )
        .map((registration) => registration.unregister()),
    );
    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.allSettled(
        cacheNames.filter((name) => name.startsWith(PWA_CACHE_PREFIX)).map((name) => window.caches.delete(name)),
      );
    }
  } catch {
    // Teardown is a local-dev convenience; on failure the documented manual
    // DevTools path in docs/pwa.md still applies.
  }
}

const cardClassName =
  "pwa-notice-card pointer-events-auto relative rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-white/35 backdrop-blur-md dark:ring-white/10";
const primaryButtonClassName =
  "inline-flex min-h-tap items-center justify-center rounded-lg bg-[color:var(--clinical-accent)] px-3.5 py-2 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition-colors hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
const secondaryButtonClassName =
  "inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--border-lux)] px-3.5 py-2 text-sm font-semibold text-[color:var(--text)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
const dismissIconButtonClassName =
  "absolute right-1 top-1 inline-flex h-tap w-tap items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

// Leading icon tile: categorical identity per notice type, on the semantic
// soft/border/ink triads so dark mode and forced-colors resolve via tokens.
function NoticeIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: "accent" | "info" | "warning" | "success" }) {
  const toneClassName =
    tone === "accent"
      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
      : tone === "info"
        ? "border-[color:var(--border)] bg-[color:var(--info-soft)] text-[color:var(--info)]"
        : tone === "warning"
          ? "border-[color:var(--border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
          : "border-[color:var(--border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border shadow-[var(--shadow-inset)] ${toneClassName}`}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

// Phone install notices read as a native install sheet: grip bar (visual
// echo of src/components/ui/sheet.tsx; static — notices are transient cards,
// not draggable dialogs) and the real app icon as the identity mark.
function InstallSheetGrip() {
  return (
    <div className="flex justify-center pb-2 pt-0.5 sm:hidden" aria-hidden="true">
      <span className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
    </div>
  );
}

function InstallAppIdentity({ title, titleId, tagline }: { title: string; titleId: string; tagline: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin
          brand asset; next/image adds a client chunk for zero benefit here. */}
      <img
        src="/icons/icon-192"
        alt=""
        aria-hidden="true"
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-xl border border-[color:var(--border-lux)] shadow-[var(--shadow-tight)]"
      />
      <div className="min-w-0">
        <p id={titleId} className="text-base font-bold leading-tight text-[color:var(--text-heading)]">
          {title}
        </p>
        <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{tagline}</p>
      </div>
    </div>
  );
}

function InstallStepChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-semibold text-[color:var(--clinical-accent)]">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Owns installability, service-worker updates, and cross-route connectivity UI.
 * The worker is production-first; `?pwa-dev=1` enables a cache-safe localhost
 * path for focused browser tests without persisting normal HMR assets, and
 * `?pwa-dev=0` (local hosts only) unregisters that worker and deletes the
 * owned caches again.
 */
export function PwaLifecycle() {
  const isOnline = useConnectivityStore();
  const [connectionRestored, setConnectionRestored] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [offlineNoticeDismissed, setOfflineNoticeDismissed] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [activatedUpdateReady, setActivatedUpdateReady] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastUpdateCheckRef = useRef(0);
  const updateDismissedRef = useRef(false);
  const refreshRequestedRef = useRef(false);
  const reloadingRef = useRef(false);
  const hasSeenControllerRef = useRef(false);

  useEffect(() => {
    let restoredTimer: number | undefined;

    const handleOffline = () => {
      if (restoredTimer) window.clearTimeout(restoredTimer);
      setConnectionRestored(false);
    };
    const handleOnline = () => {
      if (restoredTimer) window.clearTimeout(restoredTimer);
      setConnectionRestored(true);
      // Dismissal is per offline episode: the next connectivity drop should
      // re-surface the notice.
      setOfflineNoticeDismissed(false);
      restoredTimer = window.setTimeout(() => setConnectionRestored(false), 4_000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      if (restoredTimer) window.clearTimeout(restoredTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncDisplayMode = () => {
      document.documentElement.dataset.pwaDisplayMode = isStandaloneDisplay() ? "standalone" : "browser";
    };
    syncDisplayMode();
    displayMode.addEventListener("change", syncDisplayMode);
    return () => displayMode.removeEventListener("change", syncDisplayMode);
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      const deferredPrompt = event as BeforeInstallPromptEvent;
      deferredPrompt.preventDefault();
      if (!isStandaloneDisplay() && !wasInstallRecentlyDismissed()) setInstallPrompt(deferredPrompt);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      document.documentElement.dataset.pwaDisplayMode = "standalone";
      try {
        window.localStorage.removeItem(INSTALL_DISMISSAL_KEY);
      } catch {
        // Installation succeeded; storage cleanup is best-effort only.
      }
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    // iOS/iPadOS never fires beforeinstallprompt, so surface a one-time manual
    // Add to Home Screen hint instead — never in standalone mode, and never
    // again within the dismissal window. Deferred a tick so the client-only
    // eligibility check cannot diverge from the server-rendered markup.
    const timer = window.setTimeout(() => {
      if (!isIosBrowser() || isStandaloneDisplay()) return;
      if (wasInstallRecentlyDismissed(IOS_INSTALL_DISMISSAL_KEY)) return;
      setShowIosHint(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissIosHint = () => {
    rememberInstallDismissal(IOS_INSTALL_DISMISSAL_KEY);
    setShowIosHint(false);
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator) || window.isSecureContext === false) return;

    const pwaDevFlag = new URLSearchParams(window.location.search).get("pwa-dev");
    if (pwaDevFlag === "0" && LOCAL_HOSTNAMES.has(window.location.hostname)) {
      // Explicit local opt-out: unregister the worker a previous `?pwa-dev=1`
      // session installed and delete the owned caches. Non-local hosts ignore
      // the flag entirely.
      void teardownLocalPwa();
      return;
    }
    if (process.env.NODE_ENV !== "production" && pwaDevFlag !== "1") return;

    let cancelled = false;
    let cancelScheduledRegistration: () => void = () => {};
    const registrationCleanups = new Set<() => void>();
    hasSeenControllerRef.current = Boolean(navigator.serviceWorker.controller);

    const exposeWaitingWorker = (worker: ServiceWorker | null) => {
      if (!cancelled && worker && !updateDismissedRef.current) setWaitingWorker(worker);
    };

    const watchInstallingWorker = (registration: ServiceWorkerRegistration) => {
      const worker = registration.installing;
      if (!worker) return;
      const handleStateChange = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          exposeWaitingWorker(registration.waiting ?? worker);
        }
      };
      worker.addEventListener("statechange", handleStateChange);
      registrationCleanups.add(() => worker.removeEventListener("statechange", handleStateChange));
    };

    const checkForUpdates = () => {
      const registration = registrationRef.current;
      if (!registration || document.visibilityState !== "visible" || !navigator.onLine) return;
      if (Date.now() - lastUpdateCheckRef.current < UPDATE_CHECK_INTERVAL_MS) return;
      lastUpdateCheckRef.current = Date.now();
      void registration.update().catch(() => undefined);
    };

    const handleControllerChange = () => {
      if (reloadingRef.current) return;
      const wasPreviouslyControlled = hasSeenControllerRef.current;
      hasSeenControllerRef.current = true;
      if (refreshRequestedRef.current) {
        reloadingRef.current = true;
        window.location.reload();
        return;
      }
      setWaitingWorker(null);
      if (!cancelled && wasPreviouslyControlled && !updateDismissedRef.current) setActivatedUpdateReady(true);
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
          scope: "/",
          updateViaCache: "none",
        });
        if (cancelled) return;
        registrationRef.current = registration;
        exposeWaitingWorker(registration.waiting);
        watchInstallingWorker(registration);
        const handleUpdateFound = () => watchInstallingWorker(registration);
        registration.addEventListener("updatefound", handleUpdateFound);
        registrationCleanups.add(() => registration.removeEventListener("updatefound", handleUpdateFound));
        lastUpdateCheckRef.current = Date.now();
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.warn("Clinical KB PWA registration failed", error);
      }
    };

    const scheduleRegistration = () => {
      const idleWindow = window as unknown as {
        cancelIdleCallback?: Window["cancelIdleCallback"];
        requestIdleCallback?: Window["requestIdleCallback"];
      };
      const requestIdle = idleWindow.requestIdleCallback?.bind(window);
      const cancelIdle = idleWindow.cancelIdleCallback?.bind(window);

      if (requestIdle && cancelIdle) {
        const idleId = requestIdle(() => void register(), { timeout: 2_000 });
        cancelScheduledRegistration = () => cancelIdle(idleId);
      } else {
        const timeoutId = window.setTimeout(() => void register(), 0);
        cancelScheduledRegistration = () => window.clearTimeout(timeoutId);
      }
    };

    const handleLoad = () => scheduleRegistration();
    if (document.readyState === "complete") scheduleRegistration();
    else window.addEventListener("load", handleLoad, { once: true });

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdates);
    window.addEventListener("online", checkForUpdates);

    return () => {
      cancelled = true;
      cancelScheduledRegistration();
      for (const cleanup of registrationCleanups) cleanup();
      registrationCleanups.clear();
      window.removeEventListener("load", handleLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdates);
      window.removeEventListener("online", checkForUpdates);
      registrationRef.current = null;
    };
  }, []);

  const dismissInstall = () => {
    rememberInstallDismissal();
    setInstallPrompt(null);
  };

  const requestInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "dismissed") rememberInstallDismissal();
      setInstallPrompt(null);
    } catch {
      // The browser owns this prompt and may withdraw it between eligibility and
      // the click. Leave the web app usable and hide the stale affordance.
      setInstallPrompt(null);
    }
  };

  const applyUpdate = () => {
    refreshRequestedRef.current = true;
    if (activatedUpdateReady) {
      reloadingRef.current = true;
      window.location.reload();
    } else if (waitingWorker) waitingWorker.postMessage({ type: "SKIP_WAITING" });
    else {
      reloadingRef.current = true;
      window.location.reload();
    }
  };

  const dismissUpdate = () => {
    updateDismissedRef.current = true;
    setWaitingWorker(null);
    setActivatedUpdateReady(false);
  };

  const showOffline = !isOnline && !offlineNoticeDismissed;
  const showUpdate = isOnline && (Boolean(waitingWorker) || activatedUpdateReady);
  const showInstall = isOnline && !showUpdate && Boolean(installPrompt);
  const showIosInstallHint = isOnline && !showUpdate && !showInstall && showIosHint;
  if (!showOffline && !connectionRestored && !showInstall && !showUpdate && !showIosInstallHint) return null;

  return (
    <div className="pwa-notice-stack">
      {showOffline ? (
        <section className={cardClassName} role="region" aria-labelledby="pwa-offline-title" aria-live="polite">
          <button
            type="button"
            className={dismissIconButtonClassName}
            aria-label="Dismiss offline notice"
            onClick={() => setOfflineNoticeDismissed(true)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-start gap-3 pr-12">
            <NoticeIcon icon={WifiOff} tone="warning" />
            <div className="min-w-0">
              <p id="pwa-offline-title" className="text-sm font-bold text-[color:var(--text-heading)]">
                You appear to be offline
              </p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                Clinical search, answers, private documents, uploads, and account data require a connection.
              </p>
              <button
                type="button"
                className={`${secondaryButtonClassName} mt-3`}
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {connectionRestored ? (
        <section className={cardClassName} role="status">
          <div className="flex items-center gap-3">
            <NoticeIcon icon={Wifi} tone="success" />
            <p className="text-sm font-bold text-[color:var(--text-heading)]">Connection restored</p>
          </div>
        </section>
      ) : null}

      {showUpdate ? (
        <section className={cardClassName} role="region" aria-labelledby="pwa-update-title" aria-live="polite">
          <button
            type="button"
            className={dismissIconButtonClassName}
            aria-label="Dismiss update notice"
            onClick={dismissUpdate}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-start gap-3 pr-12">
            <NoticeIcon icon={RefreshCw} tone="info" />
            <div className="min-w-0">
              <p id="pwa-update-title" className="text-sm font-bold text-[color:var(--text-heading)]">
                An update is ready
              </p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                Refresh when convenient to use the latest Clinical KB version.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={primaryButtonClassName} onClick={applyUpdate}>
                  Refresh now
                </button>
                <button type="button" className={secondaryButtonClassName} onClick={dismissUpdate}>
                  Later
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {showIosInstallHint ? (
        <section
          className={`${cardClassName} pwa-install-sheet`}
          role="region"
          aria-labelledby="pwa-ios-install-title"
          aria-live="polite"
        >
          <button
            type="button"
            className={dismissIconButtonClassName}
            aria-label="Dismiss install hint"
            onClick={dismissIosHint}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <InstallSheetGrip />
          <div className="pr-12 sm:pr-10">
            <InstallAppIdentity
              title="Install Clinical KB"
              titleId="pwa-ios-install-title"
              tagline="Clinical guidelines on your home screen."
            />
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
              In Safari, tap Share, then Add to Home Screen. Private clinical features still require a connection.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2" aria-hidden="true">
              <InstallStepChip icon={Share} label="1. Tap Share" />
              <InstallStepChip icon={SquarePlus} label="2. Add to Home Screen" />
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <button type="button" className={secondaryButtonClassName} onClick={dismissIosHint}>
                Not now
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {showInstall ? (
        <section
          className={`${cardClassName} pwa-install-sheet`}
          role="region"
          aria-labelledby="pwa-install-title"
          aria-live="polite"
        >
          <button
            type="button"
            className={dismissIconButtonClassName}
            aria-label="Dismiss install prompt"
            onClick={dismissInstall}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <InstallSheetGrip />
          <div className="pr-12 sm:pr-10">
            <InstallAppIdentity
              title="Install Clinical KB"
              titleId="pwa-install-title"
              tagline="Clinical guidelines on your home screen."
            />
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
              Open it from your device like an app. Private clinical features still require a connection.
            </p>
            <p className="mt-1.5 text-xs font-semibold tracking-[0.01em] text-[color:var(--text-soft)]">
              Free · No app store · Takes a few seconds
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <button
                type="button"
                className={`${primaryButtonClassName} max-sm:flex-1`}
                onClick={() => void requestInstall()}
              >
                Install app
              </button>
              <button type="button" className={secondaryButtonClassName} onClick={dismissInstall}>
                Not now
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
