"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  CircleUserRound,
  Globe2,
  Keyboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  PanelTop,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { type SidebarIdentity } from "@/components/clinical-dashboard/ClinicalSidebar";
import { useAccountData } from "@/components/account-data-provider";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import {
  ANSWER_STYLE_OPTIONS,
  DENSITY_OPTIONS,
  JURISDICTION_OPTIONS,
  LANDING_OPTIONS,
  MOTION_OPTIONS,
  POPULATION_OPTIONS,
  useAppPreferences,
} from "@/components/clinical-dashboard/use-app-preferences";
import { useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { clearRecentQueries, countRecentQueries } from "@/lib/recent-query-storage";
import { cn, floatingControl, InlineNotice, primaryControl, toggleThumbSurface } from "@/components/ui-primitives";
import { ProviderBrandMark, type SsoProvider } from "@/components/clinical-dashboard/provider-brand-icons";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { type OAuthProvider, useAuthSession } from "@/lib/supabase/client";
import type { ThemePreference } from "@/lib/theme";

type SettingsSectionId =
  | "account"
  | "clinical-defaults"
  | "app-preferences"
  | "personalisation"
  | "notifications"
  | "privacy"
  | "keyboard"
  | "help"
  | "development";

const SETTINGS_SECTIONS: ReadonlyArray<{ id: SettingsSectionId; navLabel: string; icon: LucideIcon }> = [
  { id: "account", navLabel: "Account", icon: CircleUserRound },
  { id: "clinical-defaults", navLabel: "Clinical defaults", icon: Stethoscope },
  { id: "app-preferences", navLabel: "App preferences", icon: SlidersHorizontal },
  { id: "personalisation", navLabel: "Personalisation", icon: Sparkles },
  { id: "notifications", navLabel: "Notifications", icon: Bell },
  { id: "privacy", navLabel: "Privacy", icon: ShieldCheck },
  { id: "keyboard", navLabel: "Shortcuts", icon: Keyboard },
  { id: "help", navLabel: "Help & About", icon: CircleHelp },
  { id: "development", navLabel: "Developer", icon: FlaskConical },
];

const APPEARANCE_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// The section rail is `hidden lg:flex`. Match the repo's desktop seam literally
// (`1024px` in globals.css / JS media queries), not Tailwind's `64rem` token —
// rem-based seams drift from that CSS when the root font size is not 16px.
const settingsRailMediaQuery = "(min-width: 1024px)";

// Scroll offsets are fractional on hidpi displays, so "the same position" needs
// a pixel or two of slack. The spy marker uses the same tolerance so a settle
// that lands within it still answers as the clicked section.
const scrollSettleTolerance = 2;

// Sticky title bar clearance for focus-scroll into section content. Matches the
// desktop header's pt-6 + title leading-8 + pb-3 budget with a little slack so
// keyboard focus does not land under the opaque bar.
const settingsSectionScrollMarginClass =
  "scroll-mt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] lg:scroll-mt-24";

/**
 * A section chosen from the rail, held while the scroll travels to it and until
 * the reader scrolls somewhere else themselves.
 */
type PinnedSection = { id: SettingsSectionId; offset: number; distance: number; settled: boolean };

function sectionDomId(id: SettingsSectionId) {
  return `settings-section-${id}`;
}

function readDataCounts(): { recent: number; saved: number } {
  if (typeof window === "undefined") return { recent: 0, saved: 0 };
  const recent = countRecentQueries();
  return { recent, saved: 0 };
}

function settingsRowTestId(label: string) {
  return `settings-row-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

export function SettingsDialog({
  open,
  onClose,
  identity,
  onSignOut,
  onOpenGuide,
  onPrefetchGuide,
  initialFocus = "close",
}: {
  open: boolean;
  onClose: () => void;
  identity: SidebarIdentity;
  onSignOut: () => void;
  onOpenGuide: () => void;
  onPrefetchGuide?: () => void;
  initialFocus?: "close" | "guide";
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const guideButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The title bar is sticky inside the scroll region on every breakpoint, so its
  // height is the amount of the scroll port a section would otherwise land
  // underneath — both the scroll-spy root and the click-to-scroll offset have to
  // subtract it.
  const headerRef = useRef<HTMLElement | null>(null);
  // Section chosen from the rail, held until the reader scrolls for themselves.
  const pinnedSectionRef = useRef<PinnedSection | null>(null);
  // Memoised so phone scroll does not reconstruct a MediaQueryList on every event.
  const settingsRailMqlRef = useRef<MediaQueryList | null>(null);
  const scrollSpyFrameRef = useRef<number | null>(null);
  const settingsEmailInputRef = useRef<HTMLInputElement | null>(null);

  const { theme, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { preferences, setPreference, resetPreferences } = useAppPreferences();
  // Hide-on-scroll for the mobile glass header (phone-gated inside the hook), so
  // the top goes fully edge-to-edge while scrolling — the same behaviour as the
  // app's search bar. Desktop keeps its title bar pinned and never hides it.
  const { hidden: headerHidden, reportScroll } = useScrollHideReporter();

  const auth = useAuthSession();
  const accountData = useAccountData();
  const savedCount = Object.values(accountData.favourites).reduce((total, items) => total + items.length, 0);
  const [settingsEmail, setSettingsEmail] = useState("");
  const [emailEntryOpen, setEmailEntryOpen] = useState(false);
  // Guest account card uses a create / sign-in toggle. Both paths use the same
  // magic-link OTP; the mode only drives which control is pressed and focused.
  const [accountEntryMode, setAccountEntryMode] = useState<"create" | "sign-in">("create");
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<SsoProvider | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("account");
  const [dataCounts, setDataCounts] = useState<{ recent: number; saved: number }>(() => readDataCounts());
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  const settingsAuthBusy = auth.status === "loading";
  const settingsActionBusy = settingsAuthBusy || pendingProvider !== null;
  const signedOutAccount = !identity.signedIn;

  // Reset the surface each time it opens without a setState-in-effect: this is
  // React's supported "adjust state during render" pattern for reacting to a
  // prop change (the dialog stays mounted while the Sheet hides it), and it also
  // re-reads the live browser state that feeds the privacy counters.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setActiveSection("account");
      setPrivacyNotice(null);
      setDataCounts(readDataCounts());
      setEmailEntryOpen(false);
      setAccountEntryMode("create");
      setSettingsEmail("");
      setAccountNotice(null);
      setPendingProvider(null);
    }
  }

  const jurisdictionLabel = useMemo(
    () =>
      JURISDICTION_OPTIONS.find((option) => option.value === preferences.jurisdiction)?.label ??
      preferences.jurisdiction,
    [preferences.jurisdiction],
  );
  const refreshDataCounts = useCallback(() => {
    setDataCounts(readDataCounts());
  }, []);

  /**
   * Desktop scroll-spy: the rail highlights the last section whose heading has
   * passed under the sticky title bar.
   *
   * Read from geometry on scroll rather than from an IntersectionObserver. An
   * observer callback receives only the entries whose intersection *changed* in
   * that batch, so picking "the topmost visible entry" from it picks the topmost
   * of a partial set — which is how selecting the last rail item could leave the
   * rail highlighting the one above it.
   */
  const syncActiveSection = useCallback((container: HTMLDivElement) => {
    const railMql = settingsRailMqlRef.current;
    if (
      railMql ? !railMql.matches : typeof window !== "undefined" && !window.matchMedia(settingsRailMediaQuery).matches
    ) {
      return;
    }
    const sectionEls = container.querySelectorAll<HTMLElement>("[data-settings-section]");
    if (sectionEls.length === 0) return;
    const maxOffset = container.scrollHeight - container.clientHeight;
    // The final rendered section is shorter than the scroll port, so its heading
    // can never reach the marker line. The end of the runway belongs to it —
    // take the id from the DOM, not from SETTINGS_SECTIONS, so a conditional
    // section cannot desync the two sources of truth.
    if (maxOffset > 0 && maxOffset - container.scrollTop <= scrollSettleTolerance) {
      const lastId = sectionEls[sectionEls.length - 1]?.getAttribute("data-settings-section");
      if (lastId) setActiveSection(lastId as SettingsSectionId);
      return;
    }
    const marker =
      container.getBoundingClientRect().top + (headerRef.current?.offsetHeight ?? 0) + scrollSettleTolerance;
    let next =
      (sectionEls[0]?.getAttribute("data-settings-section") as SettingsSectionId | null) ?? SETTINGS_SECTIONS[0].id;
    for (const element of sectionEls) {
      if (element.getBoundingClientRect().top > marker) break;
      next = element.getAttribute("data-settings-section") as SettingsSectionId;
    }
    setActiveSection(next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    settingsRailMqlRef.current = window.matchMedia(settingsRailMediaQuery);
  }, []);

  useEffect(() => {
    if (!open) return;
    // The Sheet unmounts its children while closed, so the scroll port comes
    // back at offset 0 — but this component stays mounted, so a pin left over
    // from the last visit would survive and hold the spy inert on the fresh
    // surface. Cleared here rather than in the open-reset block above, which
    // runs during render where a ref must not be written.
    pinnedSectionRef.current = null;
    const container = scrollRef.current;
    if (container) syncActiveSection(container);
  }, [open, syncActiveSection]);

  // Geometry changes (viewport resize, panel height tracking 88dvh, email form
  // expanding a section) used to re-fire via IntersectionObserver. Re-run the
  // spy on resize / content size without releasing an in-flight rail pin.
  useEffect(() => {
    if (!open || typeof ResizeObserver === "undefined") return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let frame = 0;

    const reevaluate = () => {
      const container = scrollRef.current;
      if (!container) return;
      const pin = pinnedSectionRef.current;
      if (pin) {
        // Content/viewport growth can make the click target unreachable; keep
        // the pin, but clamp its offset so arrival remains possible. Reset
        // distance from the live scrollTop too: leaving the pre-clamp gap
        // would make the next scroll frame look like a takeover (distance
        // suddenly larger than pin.distance) and drop the hold mid-animation.
        const maxOffset = Math.max(0, container.scrollHeight - container.clientHeight);
        if (pin.offset > maxOffset) {
          pin.offset = maxOffset;
          pin.distance = Math.abs(container.scrollTop - pin.offset);
          pin.settled = pin.distance <= scrollSettleTolerance;
        }
        return;
      }
      syncActiveSection(container);
    };

    const detachWindow = () => {
      window.removeEventListener("resize", reevaluate);
      settingsRailMqlRef.current?.removeEventListener("change", reevaluate);
    };

    const attach = () => {
      const container = scrollRef.current;
      if (!container || cancelled) return false;
      observer = new ResizeObserver(reevaluate);
      observer.observe(container);
      for (const child of container.children) {
        if (child instanceof Element) observer.observe(child);
      }
      window.addEventListener("resize", reevaluate);
      settingsRailMqlRef.current?.addEventListener("change", reevaluate);
      return true;
    };

    if (!attach()) {
      // Sheet children mount with `open`; one frame is enough for the ref.
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        attach();
      });
    }

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      detachWindow();
    };
  }, [open, syncActiveSection]);

  // Scroll the settings scroll port itself rather than calling
  // `target.scrollIntoView()`. `scrollIntoView` walks every scrollable ancestor,
  // and an ancestor with `overflow: hidden` is still programmatically
  // scrollable — so it used to drag the whole two-column panel up, taking the
  // section rail and the close control out of the dialog with it.
  const scrollToSection = useCallback(
    (id: SettingsSectionId) => {
      setActiveSection(id);
      pinnedSectionRef.current = null;
      const container = scrollRef.current;
      const target = container?.querySelector<HTMLElement>(`[data-settings-section="${id}"]`);
      if (!container || !target) return;
      const prefersReducedMotion =
        preferences.motion === "reduced" ||
        (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const headerOffset = headerRef.current?.offsetHeight ?? 0;
      const top =
        container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - headerOffset;
      // Clamp to what the port can actually reach. The last sections are shorter
      // than the port, so their ideal offset lies past the end of the runway —
      // an unclamped target is one the scroll can never arrive at, and the pin
      // below would wait for that arrival forever.
      const maxOffset = Math.max(0, container.scrollHeight - container.clientHeight);
      const offset = Math.min(Math.max(0, top), maxOffset);
      const distance = Math.abs(container.scrollTop - offset);
      pinnedSectionRef.current = { id, offset, distance, settled: distance <= scrollSettleTolerance };
      // Avoid `behavior: "instant"` / `"auto"`: `"auto"` defers to the container's
      // `scroll-smooth`, and engines that do not recognise `"instant"` can fall
      // back to that CSS smooth path — the exact reduced-motion failure. Write
      // `scrollTop` under an inline `scroll-behavior: auto` instead.
      if (prefersReducedMotion) {
        const previousBehavior = container.style.scrollBehavior;
        container.style.scrollBehavior = "auto";
        container.scrollTop = offset;
        container.style.scrollBehavior = previousBehavior;
      } else {
        container.scrollTo({ top: offset, behavior: "smooth" });
      }
    },
    [preferences.motion],
  );

  /**
   * Decide whether a scroll belongs to the reader or to a rail click still in
   * flight, and return whether the spy may act on it.
   *
   * Driven by scroll position, never by which input event arrived. Releasing on
   * `wheel`/`touchmove`/`keydown` alone missed the one interaction this dialog
   * just regained — dragging the native scrollbar emits `scroll` and nothing
   * else — which left the rail highlighting the clicked section while the reader
   * was somewhere else entirely.
   */
  const admitScrollToSpy = useCallback((container: HTMLDivElement) => {
    const pin = pinnedSectionRef.current;
    if (!pin) return true;
    const distance = Math.abs(container.scrollTop - pin.offset);
    if (distance <= scrollSettleTolerance) {
      // Arrived. Hold the highlight here: a section shorter than the port cannot
      // reach the marker line, so geometry would answer a click on "Shortcuts"
      // with whichever neighbour sits at the top of the runway's end.
      pin.settled = true;
      pin.distance = distance;
      return false;
    }
    // Use `<=`, not `<`: a coalesced rAF can run after the pin is armed but
    // before smooth-scroll has moved `scrollTop`. Strict `<` treats that
    // no-progress frame as a reader takeover and drops the pin immediately,
    // so a rapid second rail click (or any scroll listener still in flight)
    // loses the hold before the animation starts.
    if (!pin.settled && distance <= pin.distance) {
      // Still closing the gap (or not yet moved), so this is the click's own
      // scroll animation.
      pin.distance = distance;
      return false;
    }
    // Either the reader scrolled after it settled, or they took the scroll over
    // mid-flight and the gap stopped shrinking. The choice is theirs now.
    pinnedSectionRef.current = null;
    return true;
  }, []);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      reportScroll({ offset: el.scrollTop, maxOffset: el.scrollHeight - el.clientHeight, source: el });
      // Coalesce spy geometry reads to one frame, matching useHideOnScroll.
      if (scrollSpyFrameRef.current != null) return;
      scrollSpyFrameRef.current = window.requestAnimationFrame(() => {
        scrollSpyFrameRef.current = null;
        // Sheet returns null while closed and unmounts this port, but the dialog
        // component stays mounted. A frame armed before close must not sync from
        // the detached node and overwrite the reopen reset (`activeSection` →
        // account) after the fresh port is already at offset 0.
        if (scrollRef.current !== el || !el.isConnected) return;
        if (admitScrollToSpy(el)) syncActiveSection(el);
      });
    },
    [admitScrollToSpy, reportScroll, syncActiveSection],
  );

  // Cancel a coalesced spy frame on close (and on unmount). The empty-deps
  // cleanup alone left the frame live across `open` flips.
  useEffect(() => {
    if (!open) {
      if (scrollSpyFrameRef.current != null) {
        window.cancelAnimationFrame(scrollSpyFrameRef.current);
        scrollSpyFrameRef.current = null;
      }
      return;
    }
    return () => {
      if (scrollSpyFrameRef.current != null) {
        window.cancelAnimationFrame(scrollSpyFrameRef.current);
        scrollSpyFrameRef.current = null;
      }
    };
  }, [open]);

  async function submitSettingsEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsEmail.trim() || settingsActionBusy) return;
    setAccountNotice(null);
    setPendingProvider(null);
    await auth.signInWithEmail(settingsEmail.trim());
  }

  function openSettingsEmailEntry(mode: "create" | "sign-in" = "create") {
    setAccountEntryMode(mode);
    setEmailEntryOpen(true);
    setAccountNotice(null);
  }

  async function chooseSettingsProvider(provider: SsoProvider) {
    if (settingsActionBusy) return;
    setAccountNotice(null);
    setPendingProvider(provider);
    const providerId: OAuthProvider = provider === "Apple" ? "apple" : provider === "Google" ? "google" : "azure";
    try {
      await auth.signInWithOAuth(providerId);
    } finally {
      setPendingProvider(null);
    }
  }

  function handleClearRecent() {
    clearRecentQueries();
    refreshDataCounts();
    setPrivacyNotice("Recent searches cleared.");
  }

  async function handleClearSaved() {
    const cleared = await accountData.clearFavourites();
    setPrivacyNotice(cleared ? "Saved items cleared." : "Sign in to clear account favourites.");
  }

  function handleResetPreferences() {
    resetPreferences();
    setThemePreference("system");
    setPrivacyNotice("Preferences reset to defaults.");
  }

  useEffect(() => {
    if (!emailEntryOpen) return;
    const focusFrame = window.requestAnimationFrame(() => {
      settingsEmailInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
    // Re-focus when the create / sign-in toggle changes so Sign in still does
    // visible work if the email form is already open.
  }, [emailEntryOpen, accountEntryMode]);

  const closeButton = (
    <button
      ref={closeButtonRef}
      type="button"
      onClick={onClose}
      aria-label="Close settings"
      className="order-first grid size-tap shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/70 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:order-last lg:h-10 lg:w-10 lg:border-transparent lg:bg-transparent lg:shadow-none"
    >
      <ArrowLeft aria-hidden="true" className="size-icon-lg lg:hidden" />
      <X aria-hidden="true" className="hidden size-icon-lg lg:block" />
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel="Close settings"
      labelledBy="account-settings-title"
      initialFocusRef={initialFocus === "guide" ? guideButtonRef : closeButtonRef}
      mobilePlacement="fullscreen"
      contentClassName="w-full max-w-none border-[color:var(--border-lux)] bg-[color:var(--background)] font-sans shadow-none max-lg:!pb-0 lg:max-w-[940px] lg:bg-[color:var(--surface-lux)] lg:shadow-[var(--shadow-lux)]"
      bodyClassName="p-0"
    >
      {/* The desktop height must be definite, not `h-auto` + `max-h-`. With an
          auto height the single grid row sizes to max-content (the full ~2800px
          of settings), overflows the capped container, and is clipped by
          `overflow-hidden` — so the scroll column below never overflows its own
          box and `overflow-y-auto` never engages. That left desktop settings
          unscrollable, with the section rail stretched off the bottom of the
          panel. A definite height bounds the row, which bounds the column. */}
      <div className="relative grid h-full max-h-full min-h-0 overflow-hidden lg:h-[min(88dvh,840px)] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[color:var(--border-lux)] bg-[color:var(--surface)]/72 px-4 pb-5 pt-6 lg:flex lg:flex-col">
          <nav aria-label="Settings sections" className="grid gap-1">
            {SETTINGS_SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeSection;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    active
                      ? "bg-[color:var(--surface-lux)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] ring-1 ring-[color:var(--clinical-accent)]/12"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-lux)]/80 hover:text-[color:var(--text-heading)]",
                  )}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.navLabel}</span>
                </button>
              );
            })}
          </nav>
          <p className="mt-auto flex items-center gap-2 px-1 pt-6 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--decoration-soft)]" />
            Stored on this device. No PHI.
          </p>
        </aside>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-testid="settings-scroll-port"
          className="relative min-h-0 w-full overflow-y-auto scroll-smooth bg-[color:var(--background)] polished-scroll lg:bg-transparent lg:px-7"
        >
          {/* Edge-to-edge glass header: full-bleed scrim covers the notch/status-bar
              band, and it slides away on scroll-down (mobile only) so the top runs
              edge-to-edge. On lg it stays pinned as a solid in-panel title bar. */}
          <header
            ref={headerRef}
            className={cn(
              // No permanent `will-change-transform`: it keeps a compositor layer
              // alive at rest for a header that only transforms during scroll-hide.
              // `transition-transform` already hints the browser for the animation.
              //
              // Desktop keeps the sticky position too. The close control lives in
              // this bar, so a static bar scrolls the only pointer-driven way out
              // of settings off the top as soon as the reader reaches a later
              // section. Sticky needs an opaque panel-surface fill so content
              // passes behind it rather than through it. `.edge-glass-header` is
              // in `@layer components`, so plain utilities already win — do not
              // use `!`, which would also beat the unlayered a11y fallbacks
              // (forced-colors Canvas / reduced-transparency `--surface`).
              // Scroll-hide stays phone-only via `lg:translate-y-0`.
              "edge-glass-header sticky top-0 z-30 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] transition-transform duration-[var(--duration-deliberate)] motion-reduce:transition-none lg:translate-y-0 lg:pb-3 lg:pt-6 lg:bg-[color:var(--surface-lux)] lg:px-0",
              headerHidden ? "-translate-y-full" : "translate-y-0",
            )}
          >
            <div className="edge-glass-header-backdrop lg:hidden" aria-hidden="true" />
            <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-between gap-3 lg:max-w-none">
              {closeButton}
              <div className="order-last min-w-0 flex-1 lg:order-first">
                <h2
                  id="account-settings-title"
                  aria-label="Account & app"
                  className="truncate text-xl font-semibold leading-tight tracking-display text-[color:var(--text-heading)] lg:text-2xl lg:leading-8"
                >
                  <span className="lg:hidden">Settings</span>
                  <span className="hidden lg:inline">Account &amp; app</span>
                </h2>
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-2 lg:max-w-none lg:px-0 lg:pb-8 lg:pt-2">
            {/* Account */}
            <SettingsSection id="account" title="Account">
              <section
                data-testid="settings-account-card"
                className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3.5 shadow-[var(--shadow-inset)] lg:bg-[color:var(--surface)] lg:p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold leading-none ring-1",
                      signedOutAccount
                        ? "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] ring-[color:var(--border)]"
                        : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] ring-[color:var(--clinical-accent)]/10",
                    )}
                  >
                    {signedOutAccount ? <UserRound aria-hidden="true" className="h-5 w-5" /> : identity.initials}
                    {identity.signedIn ? (
                      <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold leading-6 text-[color:var(--text-heading)]">
                      {identity.displayName}
                    </p>
                    <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                      {signedOutAccount
                        ? "Sign in or create an account"
                        : `Consultant psychiatrist · ${jurisdictionLabel}`}
                    </p>
                  </div>
                  {signedOutAccount ? (
                    <div className="hidden w-[220px] shrink-0 grid-cols-1 gap-2 lg:grid">
                      <AccountEntryModeButton
                        mode="create"
                        active={accountEntryMode === "create"}
                        onSelect={openSettingsEmailEntry}
                        className="min-h-10 whitespace-nowrap px-3 text-sm leading-none"
                      />
                      <AccountEntryModeButton
                        mode="sign-in"
                        active={accountEntryMode === "sign-in"}
                        onSelect={openSettingsEmailEntry}
                        className="min-h-10 whitespace-nowrap px-3 text-sm leading-none"
                      />
                    </div>
                  ) : (
                    <div className="hidden shrink-0 items-center gap-2 lg:flex">
                      <SettingsChip label="Private" />
                      <SettingsChip label="No PHI" />
                    </div>
                  )}
                </div>

                {signedOutAccount ? (
                  <div className="mt-4 grid gap-3">
                    <div className="grid grid-cols-2 gap-2 lg:hidden">
                      <AccountEntryModeButton
                        mode="create"
                        active={accountEntryMode === "create"}
                        onSelect={openSettingsEmailEntry}
                        className="min-h-10 whitespace-nowrap px-2.5 text-sm leading-none"
                      />
                      <AccountEntryModeButton
                        mode="sign-in"
                        active={accountEntryMode === "sign-in"}
                        onSelect={openSettingsEmailEntry}
                        className="min-h-10 whitespace-nowrap px-2.5 text-sm leading-none"
                      />
                    </div>

                    {emailEntryOpen ? (
                      <form
                        onSubmit={submitSettingsEmail}
                        className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]"
                      >
                        <TextField
                          ref={settingsEmailInputRef}
                          label="Email address"
                          icon={Mail}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          enterKeyHint="go"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          required
                          value={settingsEmail}
                          onChange={(event) => setSettingsEmail(event.target.value)}
                          placeholder="you@clinic.example"
                        />
                        <button
                          type="submit"
                          disabled={settingsActionBusy || !settingsEmail.trim() || !auth.isConfigured}
                          className={cn(primaryControl, "w-full")}
                        >
                          {settingsAuthBusy ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail aria-hidden="true" className="h-4 w-4" />
                          )}
                          Continue with email
                        </button>
                      </form>
                    ) : null}

                    <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-muted)]">
                      <span className="h-px flex-1 bg-[color:var(--border)]" />
                      <span>or continue with</span>
                      <span className="h-px flex-1 bg-[color:var(--border)]" />
                    </div>

                    <div className="grid gap-2">
                      {(["Apple", "Google", "Microsoft"] as const).map((provider) => (
                        <SettingsProviderRow
                          key={provider}
                          provider={provider}
                          busy={settingsActionBusy}
                          pending={pendingProvider === provider}
                          onClick={() => void chooseSettingsProvider(provider)}
                        />
                      ))}
                      <SettingsProviderRow
                        provider="email"
                        busy={settingsActionBusy}
                        pending={false}
                        onClick={() => openSettingsEmailEntry(accountEntryMode)}
                      />
                    </div>

                    <p className="flex items-start gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                      <LockKeyhole
                        aria-hidden="true"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--decoration-soft)]"
                      />
                      Accounts sync favourites and preferences across signed-in devices. Do not enter PHI.
                    </p>

                    {auth.notice ? (
                      // The auth context sets `notice` on a successful email submit
                      // ("check your email…"); surface it as a success status so the
                      // happy path is confirmed instead of the form sitting silent.
                      <InlineNotice tone="success">{auth.notice}</InlineNotice>
                    ) : null}
                    {accountNotice || auth.error || !auth.isConfigured ? (
                      // Show auth.error whenever present — not only after an email
                      // attempt — so an OAuth sign-in failure is announced instead of
                      // leaving the provider button looking dead.
                      <InlineNotice tone={auth.error ? "danger" : "neutral"}>
                        {accountNotice ??
                          auth.error ??
                          "Supabase browser authentication is not configured for account sign-in."}
                      </InlineNotice>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSignOut();
                      onClose();
                    }}
                    className={cn(
                      floatingControl,
                      "mt-3 min-h-10 w-full justify-center gap-2 rounded-lg text-sm lg:w-auto lg:px-4",
                    )}
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Sign out
                  </button>
                )}
              </section>
            </SettingsSection>

            {/* Clinical defaults */}
            <SettingsSection
              id="clinical-defaults"
              title="Clinical defaults"
              note="Saved on this device; not yet used in answers."
              noteId="settings-clinical-defaults-note"
            >
              <SettingsGroup>
                <SettingsField
                  icon={Globe2}
                  label="Jurisdiction"
                  htmlFor="settings-jurisdiction"
                  labelId="settings-jurisdiction-label"
                >
                  <SettingsSelect
                    id="settings-jurisdiction"
                    label="Jurisdiction"
                    labelledBy="settings-jurisdiction-label"
                    describedBy="settings-clinical-defaults-note"
                    value={preferences.jurisdiction}
                    onChange={(value) => setPreference("jurisdiction", value)}
                    options={JURISDICTION_OPTIONS}
                  />
                </SettingsField>
                <SettingsField
                  icon={CircleUserRound}
                  label="Default population"
                  htmlFor="settings-population"
                  labelId="settings-population-label"
                >
                  <SettingsSelect
                    id="settings-population"
                    label="Default population"
                    labelledBy="settings-population-label"
                    describedBy="settings-clinical-defaults-note"
                    value={preferences.population}
                    onChange={(value) => setPreference("population", value)}
                    options={POPULATION_OPTIONS}
                  />
                </SettingsField>
                <SettingsField
                  icon={SlidersHorizontal}
                  label="Answer style"
                  description={
                    ANSWER_STYLE_OPTIONS.find((option) => option.value === preferences.answerStyle)?.description
                  }
                  labelId="settings-answer-style-label"
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-answer-style-label"
                    ariaDescribedBy="settings-clinical-defaults-note"
                    layout="equal"
                    value={preferences.answerStyle}
                    onChange={(value) => setPreference("answerStyle", value)}
                    options={ANSWER_STYLE_OPTIONS}
                  />
                </SettingsField>
              </SettingsGroup>
            </SettingsSection>

            {/* App preferences */}
            <SettingsSection id="app-preferences" title="App preferences">
              <SettingsGroup>
                <SettingsField
                  icon={Palette}
                  label="Appearance"
                  description={
                    themePreference === "system"
                      ? `Matches your device (currently ${theme}).`
                      : `Always using ${themePreference} mode.`
                  }
                  labelId="settings-appearance-label"
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-appearance-label"
                    layout="equal"
                    value={themePreference}
                    onChange={setThemePreference}
                    options={APPEARANCE_OPTIONS}
                  />
                </SettingsField>
                <SettingsField icon={SettingsIcon} label="Interface density" labelId="settings-density-label" stacked>
                  <SegmentedControl
                    ariaLabelledBy="settings-density-label"
                    layout="equal"
                    value={preferences.density}
                    onChange={(value) => setPreference("density", value)}
                    options={DENSITY_OPTIONS}
                  />
                </SettingsField>
                <SettingsField icon={PanelTop} label="Default landing view" labelId="settings-landing-label" stacked>
                  <SegmentedControl
                    ariaLabelledBy="settings-landing-label"
                    layout="equal"
                    value={preferences.landing}
                    onChange={(value) => setPreference("landing", value)}
                    options={LANDING_OPTIONS}
                  />
                </SettingsField>
                <SettingsField
                  icon={Sparkles}
                  label="Motion"
                  labelId="settings-motion-label"
                  description="System follows your device's Reduce Motion setting. Full keeps loading animations running even when your device asks to reduce motion."
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-motion-label"
                    layout="equal"
                    value={preferences.motion}
                    onChange={(value) => setPreference("motion", value)}
                    options={MOTION_OPTIONS}
                  />
                </SettingsField>
              </SettingsGroup>
            </SettingsSection>

            {/* Personalisation */}
            <SettingsSection id="personalisation" title="Personalisation">
              <SettingsGroup>
                <SettingsToggleField
                  icon={PanelTop}
                  label="Recent searches on home"
                  checked={preferences.showRecentOnHome}
                  onChange={(checked) => setPreference("showRecentOnHome", checked)}
                />
                <SettingsToggleField
                  icon={Sparkles}
                  notYetActive
                  label="Saved protocols on home"
                  checked={preferences.showProtocolsOnHome}
                  onChange={(checked) => setPreference("showProtocolsOnHome", checked)}
                />
                <SettingsToggleField
                  icon={BookOpen}
                  label="Compact citations"
                  checked={preferences.compactCitations}
                  onChange={(checked) => setPreference("compactCitations", checked)}
                />
              </SettingsGroup>
            </SettingsSection>

            {/* Notifications */}
            <SettingsSection
              id="notifications"
              title="Notifications"
              note="Saved on this device; notifications are not available yet."
              noteId="settings-notifications-note"
            >
              <SettingsGroup>
                <SettingsToggleField
                  icon={Stethoscope}
                  label="Guideline updates"
                  checked={preferences.notifyGuidelineUpdates}
                  onChange={(checked) => setPreference("notifyGuidelineUpdates", checked)}
                  describedBy="settings-notifications-note"
                />
                <SettingsToggleField
                  icon={Sparkles}
                  label="Product news"
                  checked={preferences.notifyProductNews}
                  onChange={(checked) => setPreference("notifyProductNews", checked)}
                  describedBy="settings-notifications-note"
                />
                <SettingsToggleField
                  icon={Bell}
                  label="Saved item changes"
                  checked={preferences.notifySavedChanges}
                  onChange={(checked) => setPreference("notifySavedChanges", checked)}
                  describedBy="settings-notifications-note"
                />
              </SettingsGroup>
            </SettingsSection>

            {/* Privacy */}
            <SettingsSection id="privacy" title="Privacy & security">
              <SettingsGroup>
                <SettingsActionRow
                  icon={Trash2}
                  label="Clear recent searches"
                  meta={dataCounts.recent > 0 ? `${dataCounts.recent} saved` : "None"}
                  actionLabel="Clear recent searches"
                  onClick={handleClearRecent}
                  disabled={dataCounts.recent === 0}
                />
                <SettingsActionRow
                  icon={Trash2}
                  label="Clear saved items"
                  meta={savedCount > 0 ? `${savedCount} saved` : "None"}
                  actionLabel="Clear saved items"
                  onClick={handleClearSaved}
                  disabled={savedCount === 0}
                />
                <SettingsActionRow
                  icon={RotateCcw}
                  label="Reset preferences"
                  meta="Defaults"
                  actionLabel="Reset preferences to defaults"
                  onClick={handleResetPreferences}
                />
              </SettingsGroup>
              <p
                role={privacyNotice ? "status" : undefined}
                className="mt-2 flex items-center gap-2 px-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
              >
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
                {privacyNotice ?? "Recent searches stay in this browser. Do not enter PHI."}
              </p>
            </SettingsSection>

            {/* Keyboard shortcuts */}
            <SettingsSection id="keyboard" title="Keyboard shortcuts">
              <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:shadow-[var(--shadow-inset)]">
                <ShortcutRow label="Focus search" keys={["/"]} />
                <ShortcutRow label="Close dialog" keys={["Esc"]} />
              </div>
            </SettingsSection>

            {/* Help & About */}
            <SettingsSection id="help" title="Help & About">
              <div className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:shadow-[var(--shadow-inset)]">
                <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                  Clinical Knowledge Base
                </p>
                <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  Source-linked clinical reference. Verify primary guidance before acting.
                </p>
                <button
                  ref={guideButtonRef}
                  type="button"
                  data-settings-guide-trigger
                  onClick={() => {
                    onClose();
                    onOpenGuide();
                  }}
                  onPointerEnter={onPrefetchGuide}
                  onFocus={onPrefetchGuide}
                  className={cn(floatingControl, "mt-3 min-h-10 w-full gap-2 text-sm")}
                  data-testid="settings-row-guide-help"
                >
                  <BookOpen aria-hidden="true" className="h-4 w-4" />
                  Guide & help
                </button>
              </div>
            </SettingsSection>

            <SettingsSection
              id="development"
              title="Developer"
              note="In-progress surfaces. Signing in with a developer account is required to open them. Not clinical content."
            >
              <div className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--e2),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:shadow-[var(--shadow-inset)]">
                <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">Developer hub</p>
                <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  Index of the surfaces being built, including the Caring Contact prototype. Synthetic data only — no
                  patient record, message or schedule on them is real.
                </p>
                <Link
                  href="/mockups/development"
                  onClick={onClose}
                  className={cn(floatingControl, "mt-3 min-h-10 w-full gap-2 text-sm")}
                  data-testid="settings-row-development-page"
                >
                  <FlaskConical aria-hidden="true" className="h-4 w-4" />
                  Developer
                  <span className="ml-auto text-xs font-semibold text-[color:var(--text-muted)]">Temporary</span>
                </Link>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsSection({
  id,
  title,
  note,
  noteId,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  note?: string;
  noteId?: string;
  children: ReactNode;
}) {
  const headingId = `${sectionDomId(id)}-heading`;
  return (
    <section
      id={sectionDomId(id)}
      data-settings-section={id}
      aria-labelledby={headingId}
      className={cn(settingsSectionScrollMarginClass, "pt-4 first:pt-0 lg:pt-6")}
    >
      <h3
        id={headingId}
        className={cn("px-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)]", !note && "mb-2")}
      >
        {title}
      </h3>
      {note ? (
        <p id={noteId} className="mb-2 mt-0.5 px-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
          {note}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)] lg:bg-[color:var(--surface)]">
      {children}
    </div>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
      <Icon aria-hidden="true" className="h-4 w-4" />
    </span>
  );
}

/**
 * Honesty marker for preference controls that persist a choice but are not yet
 * consumed anywhere in the app (audit 2026-07-19 P2: inert settings presented as
 * live). Remove the marker from a control only when something actually reads its
 * preference and changes behavior. The badge carries an id so the control it
 * describes can reference it via `aria-describedby` — the marker must be
 * announced to assistive tech, not just rendered visually.
 */
function notYetActiveId(anchor: string) {
  return `${anchor}-not-yet-active`;
}

function NotYetActiveBadge({ id }: { id?: string }) {
  return (
    <span
      id={id}
      className="mt-1 inline-flex w-fit items-center gap-1 text-2xs font-medium leading-4 text-[color:var(--text-muted)]"
    >
      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-[color:var(--decoration-soft)]" />
      Not active yet
    </span>
  );
}

function SettingsField({
  icon,
  label,
  description,
  valueText,
  htmlFor,
  labelId,
  stacked = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  valueText?: string;
  htmlFor?: string;
  labelId?: string;
  stacked?: boolean;
  children?: ReactNode;
}) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div
      data-testid={settingsRowTestId(label)}
      className={cn(
        "flex border-b border-[color:var(--border)]/70 px-3.5 last:border-b-0",
        stacked ? "flex-col gap-2.5 py-3" : "flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge icon={icon} />
        <div className="min-w-0">
          <LabelTag
            {...(htmlFor ? { htmlFor } : {})}
            id={labelId}
            className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]"
          >
            {label}
          </LabelTag>
          {description ? (
            <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className={cn(stacked ? "w-full" : "w-full lg:w-auto lg:shrink-0")}>{children}</div>
      ) : valueText ? (
        <span className="shrink-0 pl-12 text-sm-minus font-medium leading-5 text-[color:var(--text-muted)] lg:pl-0 lg:text-right">
          {valueText}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The visible row text stays a real `<label htmlFor>` so clicking it focuses the
 * select, and `aria-labelledby` points back at that same label so it also owns
 * the accessible name. The DS `Select` keeps its own `sr-only` label — a field
 * without one is not a field — but `aria-labelledby` takes precedence, so the
 * name is the row's words once rather than two `<label for>` elements
 * concatenated into one.
 *
 * The earlier fold dropped `htmlFor` to avoid that concatenation and lost
 * click-to-focus with it. Correct name and clickable label are not a trade: this
 * is the shape that gives both.
 */
function SettingsSelect<T extends string>({
  id,
  label,
  labelledBy,
  value,
  onChange,
  options,
  describedBy,
}: {
  id: string;
  label: string;
  labelledBy?: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  describedBy?: string;
}) {
  return (
    <Select
      id={id}
      label={label}
      hideLabel
      value={value}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value as T)}
      options={options.map((option) => ({ value: option.value, label: option.label }))}
      fieldClassName="w-full lg:w-56"
      className="font-semibold text-[color:var(--text-heading)]"
    />
  );
}

function SettingsToggleField({
  icon,
  label,
  description,
  checked,
  onChange,
  notYetActive = false,
  describedBy,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  notYetActive?: boolean;
  describedBy?: string;
}) {
  return (
    <div
      data-testid={settingsRowTestId(label)}
      className="flex items-center justify-between gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-3.5 last:border-b-0"
    >
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge icon={icon} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{label}</p>
          {description ? (
            <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{description}</p>
          ) : null}
          {notYetActive ? <NotYetActiveBadge id={notYetActiveId(settingsRowTestId(label))} /> : null}
        </div>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        ariaLabel={label}
        describedBy={describedBy ?? (notYetActive ? notYetActiveId(settingsRowTestId(label)) : undefined)}
      />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  ariaLabel,
  describedBy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className="relative -my-3 inline-grid size-tap shrink-0 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-tap items-center rounded-full border transition motion-reduce:transition-none",
          checked
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)]"
            : "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)]",
        )}
      >
        <span
          className={cn(
            toggleThumbSurface,
            "grid h-[18px] w-[18px] place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--clinical-accent)] shadow-[var(--e1)] transition-transform motion-reduce:transition-none",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        >
          {checked ? <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      </span>
    </button>
  );
}

function SettingsActionRow({
  icon: Icon,
  label,
  meta,
  actionLabel,
  onClick,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={actionLabel}
      data-testid={settingsRowTestId(label)}
      className={cn(
        settingsSectionScrollMarginClass,
        "flex w-full items-center gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-55 lg:hover:bg-[color:var(--surface-lux)]/55",
      )}
    >
      <IconBadge icon={Icon} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
        {label}
      </span>
      {meta ? (
        <span className="shrink-0 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{meta}</span>
      ) : null}
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" />
    </button>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-2.5 last:border-b-0">
      <span className="min-w-0 truncate text-sm font-medium leading-5 text-[color:var(--text-heading)]">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-1.5 text-2xs font-semibold leading-none text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
          >
            {key}
          </kbd>
        ))}
      </span>
    </div>
  );
}

function AccountEntryModeButton({
  mode,
  active,
  onSelect,
  className,
}: {
  mode: "create" | "sign-in";
  active: boolean;
  onSelect: (mode: "create" | "sign-in") => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      aria-pressed={active}
      className={cn(active ? primaryControl : floatingControl, className)}
    >
      {mode === "create" ? "Create account" : "Sign in"}
    </button>
  );
}

function SettingsChip({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full border border-[color:var(--clinical-accent)]/18 bg-[color:var(--clinical-accent-soft)] px-2.5 text-2xs font-semibold leading-none text-[color:var(--clinical-accent)] lg:min-h-7 lg:px-3 lg:text-xs">
      {label}
    </span>
  );
}

function SettingsProviderRow({
  provider,
  onClick,
  busy,
  pending,
}: {
  provider: SsoProvider | "email";
  onClick: () => void;
  busy: boolean;
  pending: boolean;
}) {
  const label = provider === "email" ? "Use email instead" : `Continue with ${provider}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-65 disabled:hover:border-[color:var(--border)] disabled:hover:bg-[color:var(--surface-raised)]"
    >
      {pending ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        </span>
      ) : provider === "email" ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          <Mail aria-hidden="true" className="h-4 w-4" />
        </span>
      ) : (
        <ProviderBrandMark provider={provider} />
      )}
      <span className="min-w-0 flex-1 truncate">{pending ? "Connecting…" : label}</span>
      {pending ? null : (
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" />
      )}
    </button>
  );
}
