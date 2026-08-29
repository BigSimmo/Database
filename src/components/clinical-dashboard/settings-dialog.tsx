"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CloudOff,
  FlaskConical,
  CircleUserRound,
  Globe2,
  History,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  PanelTop,
  RefreshCw,
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
  type PreferenceSyncState,
} from "@/components/clinical-dashboard/use-app-preferences";
import { useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { clearRecentQueries, countRecentQueries } from "@/lib/recent-query-storage";
import { cn, floatingControl, InlineNotice, primaryControl, toggleThumbSurface } from "@/components/ui-primitives";
import { ProviderBrandMark, type SsoProvider } from "@/components/clinical-dashboard/provider-brand-icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import {
  sectionDomId,
  settingsRowTestId,
  type SettingsSectionId,
} from "@/components/clinical-dashboard/settings-sections";
import { type OAuthProvider, useAuthSession } from "@/lib/supabase/client";
import type { AppPreferences } from "@/lib/account-preferences";
import type { ThemePreference } from "@/lib/theme";

const APPEARANCE_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * What a "just the app, keep my clinical setup" reset covers. Deliberately
 * excludes `jurisdiction`, `population` and `answerStyle`: those are the answers
 * to questions about this reader's practice, and re-answering them is exactly
 * the cost the scoped reset exists to avoid.
 */
const APP_PREFERENCE_RESET_KEYS: ReadonlyArray<keyof AppPreferences> = [
  "density",
  "motion",
  "landing",
  "showRecentOnHome",
  "showProtocolsOnHome",
  "compactCitations",
];

/** Every preference the full reset covers. Excludes the `saveRecentSearches`
 *  privacy opt-out, which the reset confirmation promises not to change. */
const FULL_RESET_KEYS: ReadonlyArray<keyof AppPreferences> = [
  ...APP_PREFERENCE_RESET_KEYS,
  "jurisdiction",
  "population",
  "answerStyle",
  "notifyGuidelineUpdates",
  "notifyProductNews",
  "notifySavedChanges",
];

// Sticky title-bar clearance for focus-scroll into section content. The compact
// header is one row plus its safe-area inset, so it no longer needs the 11rem
// reserve that the removed search field and chip rail required.
const settingsSectionScrollMarginClass = "scroll-mt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] md:scroll-mt-24";

function readRecentQueryCount(): number {
  if (typeof window === "undefined") return 0;
  return countRecentQueries();
}

/**
 * The platform and input-capability reads behind the shortcuts list, both as
 * external stores.
 *
 * `useSyncExternalStore` rather than an effect that calls `setState`: these are
 * browser facts, not React state, and reading them through the store keeps the
 * server render and the first client render agreeing without a settle frame.
 * The server snapshots are the conservative answers — non-Apple keys, and a
 * keyboard assumed present — so nothing flickers into view on a desktop.
 */
const neverChanges = () => () => undefined;

function isApplePlatformSnapshot() {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(`${platform} ${navigator.userAgent}`);
}

function useIsApplePlatform() {
  return useSyncExternalStore(neverChanges, isApplePlatformSnapshot, () => false);
}

/**
 * Phrased as "positively touch-only", not "has a fine pointer". An unsupported
 * or unrecognised media query answers `false`, so this shape fails toward
 * showing the shortcut list — hiding it from a desktop reader who does have a
 * keyboard is the worse mistake of the two, and it is the one a
 * capability-positive query makes.
 */
const touchOnlyQuery = "(pointer: coarse) and (hover: none)";

function subscribeTouchOnly(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mql = window.matchMedia(touchOnlyQuery);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * True when the device has touch and nothing else. A shortcuts list is worse
 * than nothing there: it advertises keys the reader has no way to press.
 */
function useIsTouchOnly() {
  return useSyncExternalStore(
    subscribeTouchOnly,
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(touchOnlyQuery).matches,
    () => false,
  );
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
  const settingsEmailInputRef = useRef<HTMLInputElement | null>(null);

  const { theme, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { preferences, setPreference, resetPreferences, syncState, retrySync } = useAppPreferences();
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
  const [recentQueryCount, setRecentQueryCount] = useState<number>(() => readRecentQueryCount());
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<"clear-saved" | "reset" | null>(null);
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
      setPrivacyNotice(null);
      setRecentQueryCount(readRecentQueryCount());
      setEmailEntryOpen(false);
      setAccountEntryMode("create");
      setSettingsEmail("");
      setAccountNotice(null);
      setPendingProvider(null);
      setPendingConfirm(null);
    }
  }

  const jurisdictionLabel = useMemo(
    () =>
      JURISDICTION_OPTIONS.find((option) => option.value === preferences.jurisdiction)?.label ??
      preferences.jurisdiction,
    [preferences.jurisdiction],
  );
  const refreshRecentQueryCount = useCallback(() => {
    setRecentQueryCount(readRecentQueryCount());
  }, []);
  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      reportScroll({ offset: el.scrollTop, maxOffset: el.scrollHeight - el.clientHeight, source: el });
    },
    [reportScroll],
  );

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
    refreshRecentQueryCount();
    setPrivacyNotice("Recent searches cleared.");
  }

  /**
   * Turning recording off also clears what is already stored. Leaving the old
   * questions behind would make the toggle a half-promise: the reader asked for
   * their searches not to be kept, and the ones already kept are the ones they
   * were thinking of.
   */
  function handleSaveRecentSearches(next: boolean) {
    setPreference("saveRecentSearches", next);
    if (next) {
      setPrivacyNotice("Recent searches will be remembered on this device.");
      return;
    }
    clearRecentQueries();
    refreshRecentQueryCount();
    setPrivacyNotice("Recent searches turned off and existing ones cleared.");
  }

  async function handleClearSaved() {
    setPendingConfirm(null);
    const cleared = await accountData.clearFavourites();
    setPrivacyNotice(cleared ? "Saved items cleared." : "Sign in to clear account favourites.");
  }

  function handleResetPreferences(scope: "section" | "all") {
    setPendingConfirm(null);
    if (scope === "all") {
      // `saveRecentSearches` is a privacy opt-out, not an appearance choice, and
      // the confirmation promises recent searches are untouched. Reset every
      // other key explicitly so the switch survives.
      resetPreferences(FULL_RESET_KEYS);
      setThemePreference("system");
      setPrivacyNotice("Every preference reset to defaults.");
      return;
    }
    // Appearance is owned by useTheme, not by the preference store, so an
    // "App preferences" reset has to reach both or the reader is left with the
    // theme they were trying to undo.
    resetPreferences(APP_PREFERENCE_RESET_KEYS);
    setThemePreference("system");
    setPrivacyNotice("App preferences reset. Clinical defaults kept.");
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
      className="order-first grid size-tap shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/70 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] md:order-last md:h-10 md:w-10 md:border-transparent md:bg-transparent md:shadow-none"
    >
      <ArrowLeft aria-hidden="true" className="size-icon-lg md:hidden" />
      <X aria-hidden="true" className="hidden size-icon-lg md:block" />
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
      contentClassName="w-full max-w-none border-[color:var(--border-lux)] bg-[color:var(--background)] font-sans shadow-none max-lg:!pb-0 lg:max-w-[720px] lg:bg-[color:var(--surface-lux)] lg:shadow-[var(--shadow-lux)]"
      bodyClassName="p-0"
    >
      {/* The desktop height stays definite so this single column owns its
          overflow and the close control remains in a sticky header. */}
      <div className="relative h-full max-h-full min-h-0 overflow-hidden lg:h-[min(88dvh,840px)]">
        <div
          onScroll={handleScroll}
          data-testid="settings-scroll-port"
          className="relative h-full min-h-0 w-full overflow-y-auto bg-[color:var(--background)] polished-scroll md:px-6 lg:bg-transparent lg:px-7"
        >
          {/* A compact title bar replaces the search field and both section
              rails. It stays reachable on desktop and yields on phone scroll. */}
          <header
            className={cn(
              "edge-glass-header sticky top-0 z-30 border-b border-[color:var(--border)]/70 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-transform duration-[var(--duration-deliberate)] motion-reduce:transition-none md:translate-y-0 md:bg-[color:var(--background)] md:px-0 md:pb-4 md:pt-5 lg:bg-[color:var(--surface-lux)]",
              headerHidden && "-translate-y-full",
            )}
          >
            <div className="edge-glass-header-backdrop md:hidden" aria-hidden="true" />
            <div className="relative mx-auto flex w-full max-w-[38rem] items-center justify-between gap-3">
              {closeButton}
              <div className="order-last min-w-0 flex-1 md:order-first">
                <h2
                  id="account-settings-title"
                  aria-label="Account & app"
                  className="truncate text-2xl font-semibold leading-8 tracking-display text-[color:var(--text-heading)]"
                >
                  Settings
                </h2>
                <p className="mt-0.5 truncate text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  Account and workspace preferences
                </p>
              </div>
            </div>
          </header>

          {/* A centred reading measure keeps the simplified surface deliberate
              on desktop while remaining edge-to-edge on small phones. */}
          <div className="mx-auto w-full max-w-[38rem] px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-3 md:px-0 md:pb-8 md:pt-4">
            {/* Account */}
            <SettingsSection id="account" title="Account">
              <section
                data-testid="settings-account-card"
                className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3.5 shadow-[var(--shadow-inset)] md:bg-[color:var(--surface)] md:p-4"
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
                    <div className="hidden w-[220px] shrink-0 grid-cols-1 gap-2 md:grid">
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
                    <div className="hidden shrink-0 items-center gap-2 md:flex">
                      <SettingsChip label="Private" />
                      <SettingsChip label="No PHI" />
                    </div>
                  )}
                </div>

                {signedOutAccount ? (
                  <div className="mt-4 grid gap-3">
                    <div className="grid grid-cols-2 gap-2 md:hidden">
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
                      "mt-3 min-h-10 w-full justify-center gap-2 rounded-lg text-sm md:w-auto md:px-4",
                    )}
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Sign out
                  </button>
                )}
              </section>
              <PreferenceSyncRow state={syncState} onRetry={retrySync} />
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
                {/* The label stays "Interface density" — it is the accessible
                    name pinned by the DOM and Playwright suites. What was
                    missing is that this is also the app's text-size control: it
                    scales the rem baseline (globals.css), so everything sizes
                    with it. The description says so, and the search index
                    carries "text size" and "font" so the words a reader
                    actually types reach this row. */}
                <SettingsField
                  icon={SettingsIcon}
                  label="Interface density"
                  description="Scales text and spacing across the app. Spacious is the largest."
                  labelId="settings-density-label"
                  stacked
                >
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
                <SettingsToggleField
                  icon={History}
                  label="Save recent searches"
                  description="Off stops this device recording your questions at all. Use it on a shared computer."
                  checked={preferences.saveRecentSearches}
                  onChange={handleSaveRecentSearches}
                />
                <SettingsActionRow
                  icon={Trash2}
                  label="Clear recent searches"
                  meta={recentQueryCount > 0 ? `${recentQueryCount} saved` : "None"}
                  actionLabel="Clear recent searches"
                  onClick={handleClearRecent}
                  disabled={recentQueryCount === 0}
                />
                <SettingsActionRow
                  icon={Trash2}
                  label="Clear saved items"
                  meta={savedCount > 0 ? `${savedCount} saved` : "None"}
                  actionLabel="Clear saved items"
                  onClick={() => setPendingConfirm("clear-saved")}
                  disabled={savedCount === 0}
                />
                <SettingsActionRow
                  icon={RotateCcw}
                  label="Reset preferences"
                  meta="Defaults"
                  actionLabel="Reset preferences to defaults"
                  onClick={() => setPendingConfirm("reset")}
                />
              </SettingsGroup>
              {/* Scoped reset sits beside the full one rather than inside its
                  confirmation: repairing the app's look is the common case, and
                  it should not have to travel through a dialog that talks about
                  discarding clinical defaults. */}
              <button
                type="button"
                onClick={() => handleResetPreferences("section")}
                data-testid="settings-row-reset-app-preferences-only"
                className={cn(floatingControl, "mt-2 min-h-tap w-full gap-2 text-sm md:w-auto md:px-4")}
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Reset app preferences only
              </button>
              {/* One live region that is always mounted, so the confirmation is
                  actually announced. Previously `role` appeared only once a
                  notice existed, which is too late for most screen readers. */}
              <p
                role="status"
                aria-live="polite"
                className="mt-2 flex items-center gap-2 px-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
              >
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
                {privacyNotice ?? "Recent searches stay in this browser. Do not enter PHI."}
              </p>
            </SettingsSection>

            {/* Keyboard shortcuts */}
            <SettingsSection id="keyboard" title="Keyboard shortcuts">
              <KeyboardShortcuts />
            </SettingsSection>

            {/* Help & About */}
            <SettingsSection id="help" title="Help & About">
              <SettingsCard rowId="settings-row-guide-help" padded>
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
              </SettingsCard>
            </SettingsSection>

            <SettingsSection
              id="development"
              title="Developer"
              note="In-progress surfaces. Signing in with a developer account is required to open them. Not clinical content."
            >
              <SettingsCard rowId="settings-row-development-page" padded>
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
              </SettingsCard>
            </SettingsSection>
          </div>
        </div>
      </div>

      {/* Both of these throw away work with no undo. `ConfirmDialog` stacks on
          top of the settings Sheet, which `Sheet` supports — only the topmost
          open sheet reacts to Escape and backdrop clicks. */}
      <ConfirmDialog
        open={pendingConfirm === "clear-saved"}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => void handleClearSaved()}
        title="Clear saved items?"
        description={
          identity.signedIn
            ? `This permanently deletes ${savedCount} saved item${savedCount === 1 ? "" : "s"} from every device you are signed in on. It cannot be undone.`
            : `This permanently deletes ${savedCount} saved item${savedCount === 1 ? "" : "s"} from this browser. It cannot be undone.`
        }
        confirmLabel={`Delete ${savedCount} saved item${savedCount === 1 ? "" : "s"}`}
      />
      <ConfirmDialog
        open={pendingConfirm === "reset"}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => handleResetPreferences("all")}
        title="Reset every preference?"
        description={
          <>
            This returns appearance, density, motion, landing view, personalisation, notifications
            <strong className="font-semibold text-[color:var(--text-heading)]">
              {" "}
              and your clinical defaults (jurisdiction, population, answer style){" "}
            </strong>
            to their original values. Saved items and recent searches are not affected.
          </>
        }
        confirmLabel="Reset everything"
      />
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
      className={cn(settingsSectionScrollMarginClass, "pt-5 first:pt-0 md:pt-7")}
    >
      <h3
        id={headingId}
        className={cn(
          "px-1 text-xs font-semibold leading-5 tracking-[0.03em] text-[color:var(--text-muted)]",
          !note && "mb-2",
        )}
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
    <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)] md:bg-[color:var(--surface)]">
      {children}
    </div>
  );
}

/**
 * The single card shell for the non-list sections. Keyboard, Help and Developer
 * each hand-rolled their own border/shadow combination and had drifted apart —
 * Developer carried `--e2` where the others carried `--shadow-soft`, so the
 * three sat at visibly different elevations in the same scroll.
 */
function SettingsCard({ rowId, padded = false, children }: { rowId: string; padded?: boolean; children: ReactNode }) {
  return (
    <div
      data-testid={`${rowId}-card`}
      className={cn(
        "overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft),var(--shadow-inset)] md:bg-[color:var(--surface)] md:shadow-[var(--shadow-inset)]",
        padded && "p-4",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Whether the last preference write reached the account, said plainly. A signed
 * out browser is not a failure — "this device only" is the truth there, and the
 * row offers sign-in as the fix rather than an error.
 */
function PreferenceSyncRow({ state, onRetry }: { state: PreferenceSyncState; onRetry: () => void }) {
  const copy = {
    "local-only": {
      icon: CloudOff,
      title: "Saved on this device",
      detail: "Sign in to carry your settings to your other devices.",
      tone: "muted" as const,
    },
    syncing: {
      icon: RefreshCw,
      title: "Saving to your account…",
      detail: "Your latest change is on its way.",
      tone: "muted" as const,
    },
    synced: {
      icon: Check,
      title: "Synced to your account",
      detail: "Your settings follow you to every signed-in device.",
      tone: "success" as const,
    },
    error: {
      icon: CloudOff,
      title: "Couldn't save to your account",
      detail: "Your choice is kept on this device. Retry to sync it.",
      tone: "danger" as const,
    },
  }[state];
  const Icon = copy.icon;
  return (
    <div
      data-testid="settings-row-preference-sync"
      data-sync-state={state}
      className="mt-2 flex items-center gap-3 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3.5 py-3 shadow-[var(--shadow-inset)] md:bg-[color:var(--surface)]"
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]",
          copy.tone === "success"
            ? "text-[color:var(--success)]"
            : copy.tone === "danger"
              ? "text-[color:var(--danger)]"
              : "text-[color:var(--text-muted)]",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("h-4 w-4", state === "syncing" && "animate-spin motion-reduce:animate-none")}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{copy.title}</p>
        <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{copy.detail}</p>
      </div>
      {state === "error" ? (
        <button type="button" onClick={onRetry} className={cn(floatingControl, "min-h-tap shrink-0 gap-2 text-sm")}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * The shortcuts this app actually binds, rendered for the keyboard in front of
 * the reader. The old list named two of four and printed Mac glyphs to everyone;
 * on a touch device it advertised keys with nothing to press them on.
 *
 * Sources: `/` and `⌘K` in universal-search-command-surface.tsx, `⌘↵` in
 * master-search-header.tsx, Escape in ui/sheet.tsx.
 */
function KeyboardShortcuts() {
  const isApple = useIsApplePlatform();
  const touchOnly = useIsTouchOnly();
  const modifier = isApple ? "⌘" : "Ctrl";
  if (touchOnly) {
    return (
      <SettingsCard rowId="settings-keyboard-shortcuts" padded>
        <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
          Keyboard shortcuts appear here when you use this app with a hardware keyboard.
        </p>
      </SettingsCard>
    );
  }
  return (
    <SettingsCard rowId="settings-keyboard-shortcuts">
      <ShortcutRow label="Focus search" keys={["/"]} />
      <ShortcutRow label="Open the command palette" keys={[modifier, "K"]} />
      <ShortcutRow label="Ask the question you have typed" keys={[modifier, "Enter"]} />
      <ShortcutRow label="Close this dialog" keys={["Esc"]} />
    </SettingsCard>
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
  const rowId = settingsRowTestId(label);
  return (
    <div
      data-testid={rowId}
      className={cn(
        "flex border-b border-[color:var(--border)]/70 px-3.5 last:border-b-0",
        stacked ? "flex-col gap-2.5 py-3" : "flex-col gap-3 py-3.5 md:flex-row md:items-center md:justify-between",
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
        <div className={cn(stacked ? "w-full" : "w-full md:w-auto md:shrink-0")}>{children}</div>
      ) : valueText ? (
        <span className="shrink-0 pl-12 text-sm-minus font-medium leading-5 text-[color:var(--text-muted)] md:pl-0 md:text-right">
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
      fieldClassName="w-full md:w-56"
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
  const rowId = settingsRowTestId(label);
  return (
    <div
      data-testid={rowId}
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
  const rowId = settingsRowTestId(label);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={actionLabel}
      data-testid={rowId}
      className={cn(
        settingsSectionScrollMarginClass,
        "flex w-full items-center gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-55 md:hover:bg-[color:var(--surface-lux)]/55",
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
    <span className="inline-flex min-h-6 items-center rounded-full border border-[color:var(--clinical-accent)]/18 bg-[color:var(--clinical-accent-soft)] px-2.5 text-2xs font-semibold leading-none text-[color:var(--clinical-accent)] md:min-h-7 md:px-3 md:text-xs">
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
