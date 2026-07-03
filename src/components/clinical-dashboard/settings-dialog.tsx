"use client";

import { useRef } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  CircleUserRound,
  Globe2,
  HelpCircle,
  Keyboard,
  LockKeyhole,
  LogOut,
  Palette,
  PanelTop,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import { type SidebarIdentity } from "@/components/clinical-dashboard/ClinicalSidebar";
import { cn } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";

export function SettingsDialog({
  open,
  onClose,
  identity,
  theme,
  onToggleTheme,
  onSignOut,
  onOpenGuide,
}: {
  open: boolean;
  onClose: () => void;
  identity: SidebarIdentity;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
  onOpenGuide: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentThemeLabel = theme === "dark" ? "Dark" : "Light";
  const settingSections = [
    {
      title: "Account",
      rows: [
        { icon: UserRound, label: "Profile", value: identity.displayName },
        { icon: Stethoscope, label: "Clinical role", value: "Consultant psychiatrist" },
      ],
    },
    {
      title: "Clinical defaults",
      rows: [
        { icon: Globe2, label: "Jurisdiction", value: "Western Australia", active: true },
        { icon: CircleUserRound, label: "Default population", value: "Adults" },
        { icon: SlidersHorizontal, label: "Answer style", value: "Conservative" },
      ],
    },
    {
      title: "App preferences",
      rows: [
        {
          icon: Palette,
          label: "Appearance",
          value: currentThemeLabel,
          onClick: onToggleTheme,
          actionLabel: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        },
        { icon: SettingsIcon, label: "Interface density", value: "Comfortable" },
      ],
    },
  ];
  const navItems = [
    { icon: SettingsIcon, label: "General" },
    { icon: Stethoscope, label: "Clinical defaults" },
    { icon: Sparkles, label: "Personalisation" },
    { icon: Bell, label: "Notifications" },
    { icon: LockKeyhole, label: "Security" },
    { icon: CircleUserRound, label: "Account", active: true },
    { icon: Keyboard, label: "Keyboard" },
    {
      icon: HelpCircle,
      label: "Help & About",
      onClick: () => {
        onClose();
        onOpenGuide();
      },
    },
  ];

  const closeButton = (
    <button
      ref={closeButtonRef}
      type="button"
      onClick={onClose}
      aria-label="Close settings"
      className="absolute right-2.5 top-[max(0.45rem,env(safe-area-inset-top))] z-10 grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:left-4 lg:right-auto lg:top-4 lg:h-10 lg:w-10"
    >
      <X className="h-4.5 w-4.5" />
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel="Close settings"
      labelledBy="account-settings-title"
      initialFocusRef={closeButtonRef}
      mobilePlacement="fullscreen"
      contentClassName="w-full max-w-none border-[color:var(--border-lux)] bg-[color:var(--background)] font-sans shadow-none lg:max-w-[900px] lg:bg-[color:var(--surface-lux)] lg:shadow-[var(--shadow-lux)]"
      bodyClassName="p-0"
    >
      <div className="relative grid h-dvh max-h-dvh min-h-0 overflow-hidden lg:h-auto lg:max-h-[min(86dvh,820px)] lg:grid-cols-[250px_minmax(0,1fr)]">
        {closeButton}
        <aside className="hidden border-r border-[color:var(--border-lux)] bg-[color:var(--surface)]/72 px-4 pb-5 pt-16 lg:flex lg:flex-col">
          <nav aria-label="Settings sections" className="grid gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    active
                      ? "bg-[color:var(--surface-lux)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] ring-1 ring-[color:var(--clinical-accent)]/10"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-lux)]/80 hover:text-[color:var(--text-heading)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="mx-auto min-h-0 w-full max-w-[460px] overflow-y-auto px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[max(2.45rem,calc(0.7rem+env(safe-area-inset-top)))] polished-scroll sm:px-5 lg:mx-0 lg:max-w-none lg:px-7 lg:pb-7 lg:pt-6">
          <div className="mb-2 flex items-center justify-between gap-4 lg:mb-5">
            <div className="min-w-0">
              <h2
                id="account-settings-title"
                className="truncate text-lg font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-xl lg:text-[1.45rem] lg:leading-8"
              >
                Account &amp; app
              </h2>
            </div>
            <span className="hidden min-h-7 shrink-0 items-center rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-xs font-semibold leading-none text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] lg:inline-flex">
              Clinician account
            </span>
          </div>

          <section className="rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-lux)_96%,transparent_4%)_0%,color-mix(in_srgb,var(--surface-lux)_88%,var(--background))_100%)] p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.06),var(--shadow-inset)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:p-3.5 lg:shadow-[var(--shadow-inset)]">
            <div className="flex items-center gap-3 lg:gap-3">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-sm font-bold leading-none text-[color:var(--clinical-accent)] ring-1 ring-[color:var(--clinical-accent)]/10 lg:h-11 lg:w-11">
                {identity.initials}
                {identity.signedIn ? (
                  <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-[11px] font-semibold leading-4 text-[color:var(--clinical-accent)] lg:hidden">
                  Clinical context
                </p>
                <p className="truncate text-[15px] font-semibold leading-5 text-[color:var(--text-heading)] lg:text-[15px]">
                  {identity.displayName}
                </p>
                <p className="text-[12px] font-medium leading-4 text-[color:var(--text-muted)] lg:truncate lg:text-[13px] lg:leading-5">
                  Consultant psychiatrist, Western Australia
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                <SettingsChip label="Private" />
                <SettingsChip label="No PHI" />
              </div>
            </div>
            <SettingsClinicalContextStrip />
          </section>

          <div className="hidden lg:mt-4 lg:grid lg:grid-cols-3 lg:gap-3">
            <SettingsSummaryTile icon={UserRound} label="Profile" value={identity.displayName} />
            <SettingsSummaryTile icon={Stethoscope} label="Clinical setup" value="WA, adults" emphasized />
            <SettingsSummaryTile icon={PanelTop} label="Default view" value="Ask" />
          </div>

          <section className="mt-3.5 grid gap-3 lg:mt-4 lg:rounded-xl lg:border lg:border-[color:var(--border-lux)] lg:bg-[color:var(--surface)] lg:px-5 lg:py-4 lg:shadow-[var(--shadow-inset)]">
            <div className="grid gap-3 lg:gap-4">
              {settingSections.map((section) => (
                <div key={section.title} className="min-w-0">
                  <h3 className="mb-1 px-1 text-[12px] font-semibold tracking-normal text-[color:var(--text-muted)] lg:mb-1.5 lg:text-[13px] lg:text-[color:var(--text-heading)]">
                    {section.title}
                  </h3>
                  <div className="overflow-hidden rounded-[1.1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[0_8px_22px_rgba(0,0,0,0.04),var(--shadow-inset)] dark:shadow-[0_12px_26px_rgba(0,0,0,0.24),var(--shadow-inset)] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
                    {section.rows.map((row) => (
                      <SettingsRow key={`${section.title}-${row.label}`} {...row} />
                    ))}
                    {section.title === "Account" && identity.signedIn ? (
                      <SettingsRow
                        icon={LogOut}
                        label="Sign out"
                        value=""
                        onClick={() => {
                          onSignOut();
                          onClose();
                        }}
                        actionLabel="Sign out"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <SettingsHelpFooter
              onClick={() => {
                onClose();
                onOpenGuide();
              }}
            />
          </section>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsChip({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full border border-[color:var(--clinical-accent)]/18 bg-[color:var(--clinical-accent-soft)] px-2.5 text-[11px] font-semibold leading-none text-[color:var(--clinical-accent)] lg:min-h-7 lg:px-3 lg:text-xs">
      {label}
    </span>
  );
}

function SettingsClinicalContextStrip() {
  return (
    <div className="mt-2.5 flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--clinical-accent)]/14 bg-[color:var(--clinical-accent-soft)]/60 px-3 text-[12px] font-semibold leading-none text-[color:var(--clinical-accent)] lg:hidden">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        Private<span className="hidden min-[360px]:inline"> workspace</span>{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> WA{" "}
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
  icon: typeof UserRound;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-2 shadow-[var(--shadow-inset)] lg:rounded-xl lg:p-3",
        emphasized
          ? "border-[color:var(--clinical-accent)]/26 bg-[color:var(--clinical-accent-soft)]/72"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface)]",
      )}
    >
      <div className="flex min-w-0 flex-col items-center justify-center gap-1 text-center lg:min-h-11 lg:flex-row lg:justify-start lg:gap-2.5 lg:text-left">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-[var(--shadow-inset)] lg:rounded-lg",
            emphasized
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--primary-contrast)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold leading-3 text-[color:var(--text-muted)] lg:text-xs lg:leading-4">
            {label}
          </span>
          <span className="block truncate text-xs font-semibold leading-4 text-[color:var(--text-heading)] lg:text-[13px]">
            {value}
          </span>
        </span>
      </div>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  active = false,
  onClick,
  actionLabel,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full transition sm:h-8 sm:w-8 lg:rounded-lg lg:border lg:shadow-[var(--shadow-inset)]",
          active
            ? "bg-[color:var(--clinical-accent)] text-[color:var(--primary-contrast)] shadow-[0_7px_16px_color-mix(in_srgb,var(--clinical-accent)_24%,transparent)] lg:border-[color:var(--clinical-accent)]"
            : "bg-transparent text-[color:var(--text-muted)] lg:border-[color:var(--border)] lg:bg-[color:var(--surface-lux)]",
        )}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <span className="min-w-0 flex-1 min-[360px]:flex min-[360px]:items-center min-[360px]:justify-between min-[360px]:gap-3">
        <span className="block truncate text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{label}</span>
        {value ? (
          <span className="mt-0.5 block max-w-full truncate text-[13px] font-medium leading-5 text-[color:var(--text-muted)] min-[360px]:mt-0 min-[360px]:max-w-[50%] min-[360px]:text-right sm:max-w-[58%] sm:text-sm sm:text-[color:var(--text)] lg:max-w-[52%] lg:text-[13px]">
            {value}
          </span>
        ) : null}
      </span>
      <ChevronDown className="-rotate-90 h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)] lg:h-4 lg:w-4" />
    </>
  );

  const className =
    "flex min-h-[50px] w-full items-center gap-2.5 border-b border-[color:var(--border)]/70 px-3 py-1.5 text-left last:border-b-0 transition hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:min-h-[54px] sm:gap-3 sm:px-3.5 sm:py-2 lg:min-h-10 lg:gap-3 lg:px-0 lg:py-0 lg:hover:bg-[color:var(--surface-lux)]/55";
  const testId = `settings-row-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel ?? label}
        className={className}
        data-testid={testId}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  );
}

function SettingsHelpFooter({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-1 pt-0.5 lg:hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-lux)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        data-testid="settings-row-guide-help"
      >
        <BookOpen className="h-4 w-4" />
        <span>Guide &amp; help</span>
        <ChevronDown className="-rotate-90 h-3.5 w-3.5 text-[color:var(--text-soft)]" />
      </button>
    </div>
  );
}
