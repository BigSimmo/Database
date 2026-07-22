"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  BookOpen,
  BrainCircuit,
  ClipboardPen,
  FileText,
  Heart,
  MessageSquarePlus,
  MessageSquare,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Tags,
  Wrench,
} from "lucide-react";
import { appModeIcons } from "@/lib/app-mode-icons";
import { BrandMark } from "@/components/clinical-dashboard/brand";
import {
  cn,
  fieldControlWithIcon,
  fieldIcon,
  sidebarItem,
  statusDotReady,
  textMuted,
} from "@/components/ui-primitives";

function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}
import { Sheet } from "@/components/ui/sheet";
import { appModeDefinition, type AppModeId, isAppModeId, isAppModeVisible } from "@/lib/app-modes";
import { type ResolvedTheme } from "@/lib/theme";

export type SidebarIdentity = {
  displayName: string;
  initials: string;
  detail: string;
  signedIn: boolean;
};

export function deriveSidebarIdentity(email: string | null | undefined): SidebarIdentity {
  const normalized = email?.trim();
  if (!normalized) {
    return { displayName: "Guest", initials: "G", detail: "Not signed in", signedIn: false };
  }
  const handle = normalized.split("@")[0] || normalized;
  const parts = handle.split(/[._\-+]+/).filter(Boolean);
  const initials = (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : handle.slice(0, 2)).toUpperCase() || "U";
  const displayName =
    parts.length > 0 ? parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : normalized;
  return { displayName, initials, detail: normalized, signedIn: true };
}

function accountProfileLabel(identity: SidebarIdentity) {
  const action = identity.signedIn ? "Open account profile" : "Set up workspace";
  return `${identity.initials} ${identity.displayName} ${identity.detail}. ${action}`;
}

const sidebarToolItems = [
  { id: "answer", label: "Answer", icon: Sparkles, href: "/?mode=answer" },
  { id: "documents", label: "Documents", icon: FileText, href: "/?mode=documents" },
  { id: "services", label: "Services", icon: appModeIcons.services, href: "/services" },
  // badge = catalogue-maturity pill: the Forms registry is a small starter set.
  { id: "forms", label: "Forms", icon: ClipboardPen, href: "/forms", badge: "Early access" },
  { id: "differentials", label: "Differentials", icon: BrainCircuit, href: "/differentials" },
  { id: "dsm", label: "DSM-5 Diagnosis", icon: appModeIcons.dsm, href: "/dsm" },
  { id: "specifiers", label: "Specifiers", icon: Tags, href: "/specifiers" },
  { id: "formulation", label: "Formulation", icon: Network, href: "/formulation" },
  { id: "prescribing", label: "Medication", icon: Pill, href: "/?mode=prescribing" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/?mode=tools" },
  {
    id: "therapy-compass",
    label: appModeDefinition("therapy-compass").label,
    icon: appModeIcons["therapy-compass"],
    href: "/therapy-compass",
  },
  { id: "factsheets", label: "Factsheets", icon: appModeIcons.factsheets, href: "/factsheets" },
] as const;

const sidebarAccountLibraryItems = [
  { id: "favourites" as const, label: "Favourites", icon: Heart, href: "/favourites" },
] as const;

// Drop any tool whose id is a dev-only app mode from the production nav. Non-mode
// entries (answer, documents, prescribing, tools) are query-param destinations,
// not app modes, so they always stay. NODE_ENV is inlined into the client bundle,
// so this resolves at build time.
const visibleSidebarToolItems = sidebarToolItems.filter((item) => !isAppModeId(item.id) || isAppModeVisible(item.id));

function sidebarItemBadge(item: (typeof sidebarToolItems)[number]): string | undefined {
  return "badge" in item ? item.badge : undefined;
}

// Display-free base so callers can compose `grid` / `hidden lg:grid` without
// conflicting display utilities (cn does not de-duplicate classes).
const collapsedSidebarControl =
  "h-tap w-tap shrink-0 place-items-center rounded-xl border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
const collapsedSidebarButton = `grid ${collapsedSidebarControl}`;
const collapsedSidebarActiveButton =
  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]";

export function ClinicalSidebarContent({
  recentQueries,
  identity,
  activeMode,
  showAccountLibrary = false,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
  onOpenAccount,
  theme,
  onToggleTheme,
  onPrefetchApplications,
  showHeader = true,
  onCollapsedChange,
  onNavigate,
}: {
  recentQueries: string[];
  identity: SidebarIdentity;
  activeMode: AppModeId;
  /** Account-scoped nav (Favourites). Shown for signed-in users and demo mode. */
  showAccountLibrary?: boolean;
  onNewChat: () => void;
  onPickRecent: (query: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPrefetchApplications?: () => void;
  showHeader?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void;
}) {
  const [chatFilter, setChatFilter] = useState("");
  const normalizedChatFilter = chatFilter.trim().toLowerCase();
  const matchingRecentQueries = normalizedChatFilter
    ? recentQueries.filter((recent) => recent.toLowerCase().includes(normalizedChatFilter))
    : recentQueries;
  const visibleRecentQueries = matchingRecentQueries.slice(0, 5);
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const nextThemeLabel = theme === "dark" ? "Light mode" : "Dark mode";
  const themeToggleLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const themeUiReady = useClientMounted();
  const accountLabel = accountProfileLabel(identity);

  return (
    <div className="clinical-sidebar-content flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {showHeader ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <p className="truncate text-base font-semibold tracking-tight text-[color:var(--text-heading)]">
              Clinical Guide
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCollapsedChange?.(true)}
            className="grid h-tap w-tap shrink-0 place-items-center rounded-lg border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          onNewChat();
          onNavigate?.();
        }}
        className="inline-flex min-h-tap w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-semibold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)]"
      >
        <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
        New chat
      </button>

      {/* Scroll region: search, recent chats, and tools scroll together on
          short viewports while the header, New chat, and account footer stay
          pinned. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
        <label className="relative block shrink-0">
          <Search aria-hidden="true" className={fieldIcon} />
          <input
            type="search"
            placeholder="Search chats"
            value={chatFilter}
            onChange={(event) => setChatFilter(event.target.value)}
            aria-label="Search recent chats"
            className={cn(fieldControlWithIcon, "font-medium")}
          />
        </label>

        <section className="min-w-0 shrink-0">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Recent chats</p>
          </div>
          <div className="grid gap-1">
            {visibleRecentQueries.length ? (
              visibleRecentQueries.map((recent, index) => (
                <button
                  key={`${recent}:${index}`}
                  type="button"
                  onClick={() => {
                    onPickRecent(recent);
                    onNavigate?.();
                  }}
                  title={recent}
                  className={cn(
                    sidebarItem,
                    index === 0 &&
                      "border-l-2 border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-chrome)] text-[color:var(--text)] hover:bg-[color:var(--surface-chrome)]",
                  )}
                >
                  <MessageSquare
                    aria-hidden="true"
                    className={cn("h-4 w-4 shrink-0", index === 0 && "text-[color:var(--clinical-accent)]")}
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{recent}</span>
                </button>
              ))
            ) : (
              <p
                className={cn(
                  "rounded-lg border border-dashed border-[color:var(--border)] px-3 py-2 text-sm",
                  textMuted,
                )}
              >
                {normalizedChatFilter ? "No recent chats match your search." : "Recent chats will appear here."}
              </p>
            )}
          </div>
        </section>

        <section className="min-w-0 shrink-0">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Tools</p>
          </div>
          <nav aria-label="Tools" className="grid gap-0.5">
            {visibleSidebarToolItems.map((item) => {
              const Icon = item.icon;
              const active = activeMode === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={item.id === "tools" ? true : undefined}
                  onFocus={item.id === "tools" ? onPrefetchApplications : undefined}
                  onPointerEnter={item.id === "tools" ? onPrefetchApplications : undefined}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    sidebarItem,
                    "border-l-2 border-transparent",
                    active &&
                      "border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-chrome)] text-[color:var(--text)] hover:bg-[color:var(--surface-chrome)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  {sidebarItemBadge(item) ? (
                    <span className="shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-0.5 text-2xs font-semibold text-[color:var(--text-soft)]">
                      {sidebarItemBadge(item)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </section>

        {showAccountLibrary ? (
          <section className="min-w-0 shrink-0">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Your library
              </p>
            </div>
            <nav aria-label="Your library" className="grid gap-0.5">
              {sidebarAccountLibraryItems.map((item) => {
                const Icon = item.icon;
                const active = activeMode === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      sidebarItem,
                      "border-l-2 border-transparent",
                      active &&
                        "border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-chrome)] text-[color:var(--text)] hover:bg-[color:var(--surface-chrome)]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </section>
        ) : null}
      </div>

      <div className="mt-auto grid shrink-0 gap-1 border-t border-[color:var(--border)] pt-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            window.requestAnimationFrame(onOpenGuide);
          }}
          className={sidebarItem}
        >
          <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>Guide & help</span>
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className={sidebarItem}
          aria-label={themeUiReady ? themeToggleLabel : "Toggle theme"}
        >
          {themeUiReady ? (
            <ThemeIcon className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>{themeUiReady ? nextThemeLabel : "Theme"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            window.requestAnimationFrame(onOpenSettings);
          }}
          className={sidebarItem}
        >
          <SettingsIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            window.requestAnimationFrame(onOpenAccount);
          }}
          data-testid="sidebar-account-settings"
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          aria-label={accountLabel}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-bold text-[color:var(--clinical-accent)]">
            {identity.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[color:var(--text)]">
              {identity.displayName}
            </span>
            <span className={cn("flex items-center gap-1.5 text-xs", textMuted)}>
              {identity.signedIn ? <span className={statusDotReady} aria-hidden="true" /> : null}
              <span className="truncate">{identity.detail}</span>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function ClinicalCollapsedRail({
  hiddenOnDesktop,
  collapseLocked,
  identity,
  activeMode,
  showAccountLibrary = false,
  onCollapsedChange,
  onNewChat,
  onOpenGuide,
  onOpenSettings,
  onOpenAccount,
  theme,
  onToggleTheme,
  onPrefetchApplications,
}: {
  /** Tablet-only rail: hide from lg up when the expanded sidebar takes over. */
  hiddenOnDesktop: boolean;
  collapseLocked: boolean;
  identity: SidebarIdentity;
  activeMode: AppModeId;
  showAccountLibrary?: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onNewChat: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPrefetchApplications: () => void;
}) {
  const CollapsedThemeIcon = theme === "dark" ? Sun : Moon;
  const nextThemeLabel = theme === "dark" ? "Light mode" : "Dark mode";
  const themeToggleLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const themeUiReady = useClientMounted();
  const accountLabel = accountProfileLabel(identity);

  return (
    <aside
      aria-label="Clinical Guide collapsed sidebar"
      className={cn(
        "hidden min-h-0 w-[5.25rem] shrink-0 flex-col items-center border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] py-4 shadow-[var(--shadow-soft)] md:flex",
        hiddenOnDesktop && "lg:hidden",
      )}
    >
      <div className="grid w-full shrink-0 justify-items-center gap-2 px-3">
        {collapseLocked ? (
          <Link
            href="/differentials"
            className={cn(collapsedSidebarButton, activeMode === "differentials" && collapsedSidebarActiveButton)}
            aria-label="Differentials home"
            title="Differentials"
          >
            <BrandMark className="h-7 w-7" />
          </Link>
        ) : (
          <>
            {/* Tablet: the expanded panel does not exist below lg, so show a
                static brand mark instead of a dead expand control. */}
            <span className={cn("hidden md:grid lg:hidden", collapsedSidebarControl)} aria-hidden="true">
              <BrandMark className="h-7 w-7" />
            </span>
            <button
              type="button"
              onClick={() => onCollapsedChange(false)}
              className={cn("hidden lg:grid", collapsedSidebarControl, "group")}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <BrandMark className="h-7 w-7 group-hover:hidden group-focus-visible:hidden" />
              <PanelLeftOpen
                aria-hidden="true"
                className="hidden size-icon-lg group-hover:block group-focus-visible:block"
              />
            </button>
          </>
        )}
        <span className="h-px w-8 bg-[color:var(--border)]" aria-hidden="true" />
      </div>

      <div className="mt-3 grid min-h-0 w-full flex-1 content-start justify-items-center gap-1.5 overflow-y-auto px-3 pb-1">
        <button
          type="button"
          onClick={onNewChat}
          className={collapsedSidebarButton}
          aria-label="New chat"
          title="New chat"
        >
          <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
        </button>
        {visibleSidebarToolItems.map((item) => {
          const Icon = item.icon;
          const active = activeMode === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={item.id === "tools" ? true : undefined}
              onFocus={item.id === "tools" ? onPrefetchApplications : undefined}
              onPointerEnter={item.id === "tools" ? onPrefetchApplications : undefined}
              className={cn(collapsedSidebarButton, active && collapsedSidebarActiveButton)}
              aria-label={sidebarItemBadge(item) ? `${item.label} (${sidebarItemBadge(item)})` : item.label}
              title={sidebarItemBadge(item) ? `${item.label} (${sidebarItemBadge(item)})` : item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
            </Link>
          );
        })}
        {showAccountLibrary
          ? sidebarAccountLibraryItems.map((item) => {
              const Icon = item.icon;
              const active = activeMode === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(collapsedSidebarButton, active && collapsedSidebarActiveButton)}
                  aria-label={item.label}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })
          : null}
        <span className="h-px w-8 bg-[color:var(--border)]" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenGuide}
          className={collapsedSidebarButton}
          aria-label="Guide and help"
          title="Guide"
        >
          <BookOpen aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className={collapsedSidebarButton}
          aria-label={themeUiReady ? themeToggleLabel : "Toggle theme"}
          title={themeUiReady ? nextThemeLabel : "Toggle theme"}
        >
          {themeUiReady ? <CollapsedThemeIcon className="h-4 w-4" /> : <Moon className="h-4 w-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className={collapsedSidebarButton}
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenAccount}
        data-testid="collapsed-account-settings"
        className="mt-3 grid h-tap w-tap shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent-border)]/60 bg-[color:var(--clinical-accent-soft)] text-xs font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        title={identity.signedIn ? identity.detail : "Set up workspace"}
        aria-label={accountLabel}
      >
        {identity.initials}
      </button>
    </aside>
  );
}

export function ClinicalDesktopSidebar({
  collapsed,
  collapseLocked = false,
  recentQueries,
  identity,
  activeMode,
  showAccountLibrary = false,
  onCollapsedChange,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
  onOpenAccount,
  theme,
  onToggleTheme,
  onPrefetchApplications,
}: {
  collapsed: boolean;
  collapseLocked?: boolean;
  recentQueries: string[];
  identity: SidebarIdentity;
  activeMode: AppModeId;
  showAccountLibrary?: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onNewChat: () => void;
  onPickRecent: (query: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPrefetchApplications: () => void;
}) {
  return (
    <>
      {/* The icon rail covers tablets (md up); from lg the collapse toggle
          decides between rail and full panel. */}
      <ClinicalCollapsedRail
        hiddenOnDesktop={!collapsed}
        collapseLocked={collapseLocked}
        identity={identity}
        activeMode={activeMode}
        showAccountLibrary={showAccountLibrary}
        onCollapsedChange={onCollapsedChange}
        onNewChat={onNewChat}
        onOpenGuide={onOpenGuide}
        onOpenSettings={onOpenSettings}
        onOpenAccount={onOpenAccount}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onPrefetchApplications={onPrefetchApplications}
      />
      {!collapsed ? (
        <aside
          id="clinical-tools-sidebar"
          aria-label="Clinical Guide sidebar"
          className="hidden min-h-0 w-[20rem] max-w-[20rem] shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] lg:flex lg:flex-col"
        >
          <ClinicalSidebarContent
            recentQueries={recentQueries}
            identity={identity}
            activeMode={activeMode}
            showAccountLibrary={showAccountLibrary}
            onCollapsedChange={onCollapsedChange}
            onNewChat={onNewChat}
            onPickRecent={onPickRecent}
            onOpenGuide={onOpenGuide}
            onOpenSettings={onOpenSettings}
            onOpenAccount={onOpenAccount}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onPrefetchApplications={onPrefetchApplications}
          />
        </aside>
      ) : null}
    </>
  );
}

export function ClinicalMobileSidebar({
  open,
  recentQueries,
  identity,
  activeMode,
  showAccountLibrary = false,
  onOpenChange,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
  onOpenAccount,
  theme,
  onToggleTheme,
  onPrefetchApplications,
  hiddenFrom = "md",
}: {
  open: boolean;
  recentQueries: string[];
  identity: SidebarIdentity;
  activeMode: AppModeId;
  showAccountLibrary?: boolean;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onPickRecent: (query: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPrefetchApplications: () => void;
  /** Breakpoint the drawer disappears at; workflow routes keep it until lg. */
  hiddenFrom?: "md" | "lg";
}) {
  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Clinical Guide"
      description="Recent chats, daily tools, help, and settings."
      closeLabel="Close Clinical Guide menu"
      placement="left"
      contentClassName={hiddenFrom === "lg" ? "lg:hidden" : "md:hidden"}
      headerLeading={<BrandMark className="h-8 w-8" />}
    >
      <ClinicalSidebarContent
        showHeader={false}
        recentQueries={recentQueries}
        identity={identity}
        activeMode={activeMode}
        showAccountLibrary={showAccountLibrary}
        onNewChat={onNewChat}
        onPickRecent={onPickRecent}
        onOpenGuide={onOpenGuide}
        onOpenSettings={onOpenSettings}
        onOpenAccount={onOpenAccount}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onPrefetchApplications={onPrefetchApplications}
        onNavigate={() => onOpenChange(false)}
      />
    </Sheet>
  );
}
