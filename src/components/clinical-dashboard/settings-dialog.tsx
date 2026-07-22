"use client";

import { type FormEvent, type ReactNode, type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
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
  POPULATION_OPTIONS,
  useAppPreferences,
} from "@/components/clinical-dashboard/use-app-preferences";
import { useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { clearRecentQueries, countRecentQueries } from "@/lib/recent-query-storage";
import {
  cn,
  fieldControlWithIcon,
  fieldIcon,
  floatingControl,
  InlineNotice,
  primaryControl,
  toggleThumbSurface,
} from "@/components/ui-primitives";
import { ProviderBrandMark } from "@/components/clinical-dashboard/provider-brand-icons";
import { Sheet } from "@/components/ui/sheet";
import { useAuthSession } from "@/lib/supabase/client";
import type { ThemePreference } from "@/lib/theme";

type SettingsSectionId =
  | "account"
  | "clinical-defaults"
  | "app-preferences"
  | "personalisation"
  | "notifications"
  | "privacy"
  | "keyboard"
  | "help";

const SETTINGS_SECTIONS: ReadonlyArray<{ id: SettingsSectionId; navLabel: string; icon: LucideIcon }> = [
  { id: "account", navLabel: "Account", icon: CircleUserRound },
  { id: "clinical-defaults", navLabel: "Clinical defaults", icon: Stethoscope },
  { id: "app-preferences", navLabel: "App preferences", icon: SlidersHorizontal },
  { id: "personalisation", navLabel: "Personalisation", icon: Sparkles },
  { id: "notifications", navLabel: "Notifications", icon: Bell },
  { id: "privacy", navLabel: "Privacy", icon: ShieldCheck },
  { id: "keyboard", navLabel: "Shortcuts", icon: Keyboard },
  { id: "help", navLabel: "Help & About", icon: CircleHelp },
];

const APPEARANCE_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

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
  initialFocus = "close",
}: {
  open: boolean;
  onClose: () => void;
  identity: SidebarIdentity;
  onSignOut: () => void;
  onOpenGuide: () => void;
  initialFocus?: "close" | "guide";
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const guideButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const settingsEmailInputRef = useRef<HTMLInputElement | null>(null);

  const { theme, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { preferences, setPreference, resetPreferences } = useAppPreferences();
  // Hide-on-scroll for the mobile glass header (phone-gated inside the hook), so
  // the top goes fully edge-to-edge while scrolling — the same behaviour as the
  // app's search bar. Desktop keeps a static in-panel header.
  const { hidden: headerHidden, reportScroll } = useScrollHideReporter();

  const auth = useAuthSession();
  const accountData = useAccountData();
  const savedCount = Object.values(accountData.favourites).reduce((total, items) => total + items.length, 0);
  const [settingsEmail, setSettingsEmail] = useState("");
  const [emailEntryOpen, setEmailEntryOpen] = useState(false);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("account");
  const [dataCounts, setDataCounts] = useState<{ recent: number; saved: number }>(() => readDataCounts());
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  const settingsAuthBusy = auth.status === "loading";
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
    }
  }

  const jurisdictionLabel = useMemo(
    () =>
      JURISDICTION_OPTIONS.find((option) => option.value === preferences.jurisdiction)?.label ??
      preferences.jurisdiction,
    [preferences.jurisdiction],
  );
  const populationLabel = useMemo(
    () => POPULATION_OPTIONS.find((option) => option.value === preferences.population)?.label ?? preferences.population,
    [preferences.population],
  );
  const jurisdictionShort = useMemo(
    () => (preferences.jurisdiction === "national" ? "National" : preferences.jurisdiction.toUpperCase()),
    [preferences.jurisdiction],
  );

  const refreshDataCounts = useCallback(() => {
    setDataCounts(readDataCounts());
  }, []);

  // Desktop scroll-spy: highlight the section nearest the top of the scroll
  // region so the rail mirrors what the reader is looking at.
  useEffect(() => {
    if (!open || typeof IntersectionObserver === "undefined") return;
    const container = scrollRef.current;
    if (!container) return;
    const sectionEls = Array.from(container.querySelectorAll<HTMLElement>("[data-settings-section]"));
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const next = visible[0]?.target.getAttribute("data-settings-section");
        if (next) setActiveSection(next as SettingsSectionId);
      },
      { root: container, rootMargin: "0px 0px -62% 0px", threshold: [0, 0.35] },
    );
    sectionEls.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [open]);

  const scrollToSection = useCallback(
    (id: SettingsSectionId) => {
      setActiveSection(id);
      const container = scrollRef.current;
      const target = container?.querySelector<HTMLElement>(`[data-settings-section="${id}"]`);
      if (!target) return;
      const prefersReducedMotion =
        preferences.motion === "reduced" ||
        (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    },
    [preferences.motion],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      reportScroll({ offset: el.scrollTop, maxOffset: el.scrollHeight - el.clientHeight, source: el });
    },
    [reportScroll],
  );

  async function submitSettingsEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsEmail.trim()) return;
    setAccountNotice(null);
    await auth.signInWithEmail(settingsEmail.trim());
  }

  function openSettingsEmailEntry() {
    setEmailEntryOpen(true);
    setAccountNotice(null);
  }

  async function chooseSettingsProvider(provider: "Apple" | "Google" | "Microsoft") {
    setAccountNotice(null);
    if (provider === "Apple") {
      setAccountNotice("Apple sign-in is not configured. Continue with email, Google, or Microsoft.");
      return;
    }
    await auth.signInWithOAuth(provider === "Google" ? "google" : "azure");
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
  }, [emailEntryOpen]);

  const closeButton = (
    <button
      ref={closeButtonRef}
      type="button"
      onClick={onClose}
      aria-label="Close settings"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/70 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:h-10 lg:w-10 lg:border-transparent lg:bg-transparent lg:shadow-none"
    >
      <X aria-hidden="true" className="size-icon-lg" />
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
      <div className="relative grid h-full max-h-full min-h-0 overflow-hidden lg:h-auto lg:max-h-[min(88dvh,840px)] lg:grid-cols-[248px_minmax(0,1fr)]">
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
          <p className="mt-auto flex items-center gap-2 px-1 pt-6 text-2xs font-medium leading-4 text-[color:var(--text-soft)]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Preferences stay on this device. No PHI.
          </p>
        </aside>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative min-h-0 w-full overflow-y-auto scroll-smooth bg-[color:var(--background)] polished-scroll lg:bg-transparent lg:px-7"
        >
          {/* Edge-to-edge glass header: full-bleed scrim covers the notch/status-bar
              band, and it slides away on scroll-down (mobile only) so the top runs
              edge-to-edge. On lg it reverts to a static in-panel title bar. */}
          <header
            className={cn(
              // No permanent `will-change-transform`: it keeps a compositor layer
              // alive at rest for a header that only transforms during scroll-hide.
              // `transition-transform` already hints the browser for the animation.
              "edge-glass-header sticky top-0 z-30 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] transition-transform duration-300 motion-reduce:transition-none lg:static lg:z-auto lg:translate-y-0 lg:pb-0 lg:pt-6 lg:bg-transparent! lg:px-0!",
              headerHidden ? "-translate-y-full" : "translate-y-0",
            )}
          >
            <div className="edge-glass-header-backdrop lg:hidden" aria-hidden="true" />
            <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-between gap-3 lg:max-w-none">
              <div className="min-w-0">
                <h2
                  id="account-settings-title"
                  className="truncate text-lg font-semibold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-xl lg:text-2xl lg:leading-8"
                >
                  Account &amp; app
                </h2>
                <p className="mt-0.5 truncate text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  Tune your workspace, clinical defaults, and privacy.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden min-h-7 items-center rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-xs font-semibold leading-none text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] lg:inline-flex">
                  Clinician account
                </span>
                {closeButton}
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-2 lg:max-w-none lg:px-0 lg:pb-8 lg:pt-2">
            {/* Account */}
            <SettingsSection id="account" title="Account">
              <section className="rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3.5 shadow-[var(--shadow-soft),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:p-4 lg:shadow-[var(--shadow-inset)]">
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
                    <p className="truncate text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                      {signedOutAccount
                        ? "Sign in or create an account"
                        : `Consultant psychiatrist, ${jurisdictionLabel}`}
                    </p>
                  </div>
                  {signedOutAccount ? (
                    <div className="hidden w-[220px] shrink-0 grid-cols-1 gap-2 lg:grid">
                      <button
                        type="button"
                        onClick={openSettingsEmailEntry}
                        className={cn(primaryControl, "min-h-10 whitespace-nowrap px-3 text-sm leading-none")}
                      >
                        Create account
                      </button>
                      <button
                        type="button"
                        onClick={openSettingsEmailEntry}
                        className={cn(floatingControl, "min-h-10 whitespace-nowrap px-3 text-sm leading-none")}
                      >
                        Sign in
                      </button>
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
                      <button
                        type="button"
                        onClick={openSettingsEmailEntry}
                        className={cn(primaryControl, "min-h-10 whitespace-nowrap px-2.5 text-sm leading-none")}
                      >
                        Create account
                      </button>
                      <button
                        type="button"
                        onClick={openSettingsEmailEntry}
                        className={cn(floatingControl, "min-h-10 whitespace-nowrap px-2.5 text-sm leading-none")}
                      >
                        Sign in
                      </button>
                    </div>

                    {emailEntryOpen ? (
                      <form
                        onSubmit={submitSettingsEmail}
                        className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]"
                      >
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-[color:var(--text-muted)]">
                            Email address
                          </span>
                          <div className="relative">
                            <Mail aria-hidden="true" className={fieldIcon} />
                            <input
                              ref={settingsEmailInputRef}
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
                              className={fieldControlWithIcon}
                            />
                          </div>
                        </label>
                        <button
                          type="submit"
                          disabled={settingsAuthBusy || !settingsEmail.trim() || !auth.isConfigured}
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

                    <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-soft)]">
                      <span className="h-px flex-1 bg-[color:var(--border)]" />
                      <span>or continue with</span>
                      <span className="h-px flex-1 bg-[color:var(--border)]" />
                    </div>

                    <div className="grid gap-2">
                      <SettingsProviderRow provider="Apple" onClick={() => void chooseSettingsProvider("Apple")} />
                      <SettingsProviderRow provider="Google" onClick={() => void chooseSettingsProvider("Google")} />
                      <SettingsProviderRow
                        provider="Microsoft"
                        onClick={() => void chooseSettingsProvider("Microsoft")}
                      />
                      <SettingsProviderRow provider="email" onClick={openSettingsEmailEntry} />
                    </div>

                    <p className="flex items-start gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                      <LockKeyhole
                        aria-hidden="true"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]"
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
                  <SettingsClinicalContextStrip jurisdictionShort={jurisdictionShort} />
                )}
              </section>

              {!signedOutAccount ? (
                <div className="mt-3.5 hidden lg:grid lg:grid-cols-3 lg:gap-3">
                  <SettingsSummaryTile icon={UserRound} label="Profile" value={identity.displayName} />
                  <SettingsSummaryTile
                    icon={Stethoscope}
                    label="Clinical setup"
                    value={`${jurisdictionShort}, ${populationLabel.toLowerCase()}`}
                    emphasized
                  />
                  <SettingsSummaryTile
                    icon={PanelTop}
                    label="Default view"
                    value={LANDING_OPTIONS.find((option) => option.value === preferences.landing)?.label ?? "Ask"}
                  />
                </div>
              ) : null}

              <SettingsGroup>
                <SettingsField icon={UserRound} label="Profile" valueText={identity.displayName} />
                <SettingsField icon={Stethoscope} label="Clinical role" valueText="Consultant psychiatrist" />
                {identity.signedIn ? (
                  <SettingsActionRow
                    icon={LogOut}
                    label="Sign out"
                    actionLabel="Sign out"
                    onClick={() => {
                      onSignOut();
                      onClose();
                    }}
                  />
                ) : null}
              </SettingsGroup>
            </SettingsSection>

            {/* Clinical defaults */}
            <SettingsSection id="clinical-defaults" title="Clinical defaults">
              <SettingsGroup>
                <SettingsField
                  icon={Globe2}
                  label="Jurisdiction"
                  description="Prioritises guidance relevant to your region."
                  notYetActive
                  htmlFor="settings-jurisdiction"
                >
                  <SettingsSelect
                    id="settings-jurisdiction"
                    describedBy={notYetActiveId("settings-jurisdiction")}
                    value={preferences.jurisdiction}
                    onChange={(value) => setPreference("jurisdiction", value)}
                    options={JURISDICTION_OPTIONS}
                  />
                </SettingsField>
                <SettingsField
                  icon={CircleUserRound}
                  label="Default population"
                  description="Frames answers for your usual patient group."
                  notYetActive
                  htmlFor="settings-population"
                >
                  <SettingsSelect
                    id="settings-population"
                    describedBy={notYetActiveId("settings-population")}
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
                  notYetActive
                  labelId="settings-answer-style-label"
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-answer-style-label"
                    ariaDescribedBy={notYetActiveId("settings-answer-style-label")}
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
                  description={`Following ${themePreference === "system" ? `your device (${theme})` : themePreference}.`}
                  labelId="settings-appearance-label"
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-appearance-label"
                    value={themePreference}
                    onChange={setThemePreference}
                    options={APPEARANCE_OPTIONS}
                  />
                </SettingsField>
                <SettingsField
                  icon={SettingsIcon}
                  label="Interface density"
                  description="Adjusts spacing across the app."
                  labelId="settings-density-label"
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-density-label"
                    value={preferences.density}
                    onChange={(value) => setPreference("density", value)}
                    options={DENSITY_OPTIONS}
                  />
                </SettingsField>
                <SettingsField
                  icon={PanelTop}
                  label="Default landing view"
                  description="The mode shown when you open the app."
                  labelId="settings-landing-label"
                  stacked
                >
                  <SegmentedControl
                    ariaLabelledBy="settings-landing-label"
                    value={preferences.landing}
                    onChange={(value) => setPreference("landing", value)}
                    options={LANDING_OPTIONS}
                  />
                </SettingsField>
                <SettingsToggleField
                  icon={Sparkles}
                  label="Reduce motion"
                  description="Minimise animations and transitions."
                  checked={preferences.motion === "reduced"}
                  onChange={(checked) => setPreference("motion", checked ? "reduced" : "system")}
                />
              </SettingsGroup>
            </SettingsSection>

            {/* Personalisation */}
            <SettingsSection id="personalisation" title="Personalisation">
              <SettingsGroup>
                <SettingsToggleField
                  icon={PanelTop}
                  label="Recent searches on home"
                  description="Surface your latest questions when you land."
                  checked={preferences.showRecentOnHome}
                  onChange={(checked) => setPreference("showRecentOnHome", checked)}
                />
                <SettingsToggleField
                  icon={Sparkles}
                  notYetActive
                  label="Saved protocols on home"
                  description="Keep pinned protocols within easy reach."
                  checked={preferences.showProtocolsOnHome}
                  onChange={(checked) => setPreference("showProtocolsOnHome", checked)}
                />
                <SettingsToggleField
                  icon={BookOpen}
                  label="Compact citations"
                  description="Show tighter inline source references."
                  checked={preferences.compactCitations}
                  onChange={(checked) => setPreference("compactCitations", checked)}
                />
              </SettingsGroup>
            </SettingsSection>

            {/* Notifications */}
            <SettingsSection id="notifications" title="Notifications">
              <SettingsGroup>
                <SettingsToggleField
                  icon={Stethoscope}
                  notYetActive
                  label="Guideline updates"
                  description="When source guidance you rely on changes."
                  checked={preferences.notifyGuidelineUpdates}
                  onChange={(checked) => setPreference("notifyGuidelineUpdates", checked)}
                />
                <SettingsToggleField
                  icon={Sparkles}
                  notYetActive
                  label="Product news"
                  description="Occasional updates about new features."
                  checked={preferences.notifyProductNews}
                  onChange={(checked) => setPreference("notifyProductNews", checked)}
                />
                <SettingsToggleField
                  icon={Bell}
                  notYetActive
                  label="Saved item changes"
                  description="Alerts about items you have saved."
                  checked={preferences.notifySavedChanges}
                  onChange={(checked) => setPreference("notifySavedChanges", checked)}
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
                {privacyNotice ?? "Recent searches may be stored in this browser session. Do not enter PHI."}
              </p>
            </SettingsSection>

            {/* Keyboard shortcuts */}
            <SettingsSection id="keyboard" title="Keyboard shortcuts">
              <div className="overflow-hidden rounded-[1.1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:shadow-[var(--shadow-inset)]">
                <ShortcutRow label="Focus search" keys={["/"]} />
                <ShortcutRow label="Open command menu" keys={["Ctrl", "K"]} />
                <ShortcutRow label="New question" keys={["Ctrl", "Shift", "O"]} />
                <ShortcutRow label="Toggle appearance" keys={["Ctrl", "Shift", "L"]} />
                <ShortcutRow label="Close dialog" keys={["Esc"]} />
              </div>
            </SettingsSection>

            {/* Help & About */}
            <SettingsSection id="help" title="Help & About">
              <div className="rounded-[1.1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:shadow-[var(--shadow-inset)]">
                <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                  Clinical Knowledge Base
                </p>
                <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  A grounded clinical reference. Every answer cites the source it came from — always confirm against the
                  primary guideline before acting.
                </p>
                <button
                  ref={guideButtonRef}
                  type="button"
                  data-settings-guide-trigger
                  onClick={() => {
                    onClose();
                    onOpenGuide();
                  }}
                  className={cn(floatingControl, "mt-3 min-h-10 w-full gap-2 text-sm")}
                  data-testid="settings-row-guide-help"
                >
                  <BookOpen aria-hidden="true" className="h-4 w-4" />
                  Guide & help
                </button>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsSection({ id, title, children }: { id: SettingsSectionId; title: string; children: ReactNode }) {
  const headingId = `${sectionDomId(id)}-heading`;
  return (
    <section
      id={sectionDomId(id)}
      data-settings-section={id}
      aria-labelledby={headingId}
      className="scroll-mt-4 pt-4 first:pt-0 lg:pt-6"
    >
      <h3
        id={headingId}
        className="mb-2 px-1 text-sm font-semibold leading-5 tracking-normal text-[color:var(--text-heading)]"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:shadow-[var(--shadow-inset)]">
      {children}
    </div>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
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
      className="mt-1 inline-flex w-fit items-center gap-1 text-2xs font-medium leading-4 text-[color:var(--text-soft)]"
    >
      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-[color:var(--text-soft)]" />
      Saved for later — not active yet
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
  notYetActive = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  valueText?: string;
  htmlFor?: string;
  labelId?: string;
  stacked?: boolean;
  notYetActive?: boolean;
  children?: ReactNode;
}) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div
      data-testid={settingsRowTestId(label)}
      className={cn(
        "flex gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-3 last:border-b-0",
        stacked ? "flex-col" : "flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between",
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
          {notYetActive ? (
            <NotYetActiveBadge id={notYetActiveId(htmlFor ?? labelId ?? settingsRowTestId(label))} />
          ) : null}
        </div>
      </div>
      {children ? (
        <div className={cn(stacked ? "w-full pt-0.5" : "shrink-0")}>{children}</div>
      ) : valueText ? (
        <span className="shrink-0 pl-11 text-sm-minus font-medium leading-5 text-[color:var(--text-muted)] min-[420px]:pl-0 min-[420px]:text-right">
          {valueText}
        </span>
      ) : null}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabelledBy,
  ariaDescribedBy,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon }>;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      // Segments size to their content and wrap onto a second row on narrow
      // screens rather than truncating long labels ("Comprehensive"); each row's
      // items grow to fill the width so the control still reads as a unit.
      className="flex w-full flex-wrap gap-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1 shadow-[var(--shadow-inset)]"
    >
      {options.map((option) => {
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-8 flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)]",
              checked
                ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] forced-colors:outline forced-colors:outline-2 forced-colors:[outline-color:Highlight]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SettingsSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  describedBy,
}: {
  id: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  describedBy?: string;
}) {
  return (
    <div className="relative min-[420px]:w-56">
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] py-2 pl-3 pr-9 text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronRight
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[color:var(--text-soft)]"
      />
    </div>
  );
}

function SettingsToggleField({
  icon,
  label,
  description,
  checked,
  onChange,
  notYetActive = false,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  notYetActive?: boolean;
}) {
  return (
    <div
      data-testid={settingsRowTestId(label)}
      className="flex items-center justify-between gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-3 last:border-b-0"
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
        describedBy={notYetActive ? notYetActiveId(settingsRowTestId(label)) : undefined}
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
      className={cn(
        "relative inline-flex h-6 w-tap shrink-0 items-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        checked
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)]"
          : "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)]",
      )}
    >
      <span
        className={cn(
          toggleThumbSurface,
          "grid h-[18px] w-[18px] place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-tight)] transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {checked ? <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} /> : null}
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
      className="flex w-full items-center gap-3 border-b border-[color:var(--border)]/70 px-3.5 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-55 lg:hover:bg-[color:var(--surface-lux)]/55"
    >
      <IconBadge icon={Icon} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
        {label}
      </span>
      {meta ? (
        <span className="shrink-0 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{meta}</span>
      ) : null}
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
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
}: {
  provider: "Apple" | "Google" | "Microsoft" | "email";
  onClick: () => void;
}) {
  const label = provider === "email" ? "Use email instead" : provider;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      {provider === "email" ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          <Mail aria-hidden="true" className="h-4 w-4" />
        </span>
      ) : (
        <ProviderBrandMark provider={provider} />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
    </button>
  );
}

function SettingsClinicalContextStrip({ jurisdictionShort }: { jurisdictionShort: string }) {
  return (
    <div className="mt-2.5 flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--clinical-accent)]/14 bg-[color:var(--clinical-accent-soft)]/60 px-3 text-xs font-semibold leading-none text-[color:var(--clinical-accent)] lg:hidden">
      <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        Private<span className="hidden min-[360px]:inline"> workspace</span>{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> {jurisdictionShort}{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> No PHI
      </span>
    </div>
  );
}

function SettingsSummaryTile({
  icon: Icon,
  label,
  value,
  emphasized = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-3 shadow-[var(--shadow-inset)]",
        emphasized
          ? "border-[color:var(--clinical-accent)]/26 bg-[color:var(--clinical-accent-soft)]/72"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface)]",
      )}
    >
      <div className="flex min-h-[44px] min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
            emphasized
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
          )}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold leading-4 text-[color:var(--text-muted)]">{label}</span>
          <span className="block truncate text-sm-minus font-semibold leading-4 text-[color:var(--text-heading)]">
            {value}
          </span>
        </span>
      </div>
    </div>
  );
}
