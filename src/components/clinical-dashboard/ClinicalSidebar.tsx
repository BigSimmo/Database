"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ClipboardList,
  FileText,
  Heart,
  MessageSquarePlus,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Wrench,
} from "lucide-react";
import { BrandMark } from "@/components/clinical-dashboard/brand";
import { cn, sidebarItem, sidebarToolTile, statusDotReady, textMuted } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { type AppModeId } from "@/lib/app-modes";
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

const sidebarToolItems = [
  { id: "answer", label: "Answer", icon: Sparkles, href: "/?mode=answer" },
  { id: "documents", label: "Documents", icon: FileText, href: "/?mode=documents" },
  { id: "services", label: "Services", icon: ClipboardList, href: "/services" },
  { id: "forms", label: "Forms", icon: FileText, href: "/forms" },
  { id: "favourites", label: "Faves", icon: Heart, href: "/favourites" },
  { id: "differentials", label: "Diffs", icon: BrainCircuit, href: "/differentials" },
  { id: "prescribing", label: "Meds", icon: Pill, href: "/?mode=prescribing" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/?mode=tools" },
] as const;

const collapsedSidebarButton =
  "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
const collapsedSidebarActiveButton =
  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]";

export function ClinicalSidebarContent({
  recentQueries,
  identity,
  activeMode,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
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
  onNewChat: () => void;
  onPickRecent: (query: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
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

  return (
    <div className="clinical-sidebar-content flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <p className="truncate text-base font-semibold tracking-tight text-[color:var(--text-heading)]">
              Clinical Guide
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCollapsedChange?.(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          onNewChat();
          onNavigate?.();
        }}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-semibold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)]"
      >
        <MessageSquarePlus className="h-4 w-4" />
        New chat
      </button>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
        <input
          type="search"
          placeholder="Search chats"
          value={chatFilter}
          onChange={(event) => setChatFilter(event.target.value)}
          aria-label="Search recent chats"
          className="clinical-sidebar-search-input h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-9 pr-3 text-sm font-medium text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
        />
      </label>

      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Recent chats
          </p>
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

      <section>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Tools</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sidebarToolItems.map((item) => {
            const Icon = item.icon;
            const active = activeMode === item.id;
            return (
              <Link
                key={item.label}
                href={item.href}
                prefetch={item.href === "/?mode=tools" ? true : undefined}
                onFocus={item.href === "/?mode=tools" ? onPrefetchApplications : undefined}
                onPointerEnter={item.href === "/?mode=tools" ? onPrefetchApplications : undefined}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  sidebarToolTile,
                  "clinical-sidebar-tool-tile",
                  active &&
                    "border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-chrome)] text-[color:var(--text)] shadow-[var(--shadow-tight)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <Link
          href="/?mode=tools"
          prefetch
          onFocus={onPrefetchApplications}
          onPointerEnter={onPrefetchApplications}
          onClick={onNavigate}
          className="mt-2 inline-flex min-h-10 w-full items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
        >
          View tools
          <ChevronDown className="-rotate-90 h-4 w-4" />
        </Link>
      </section>

      <div className="mt-auto grid gap-1 border-t border-[color:var(--border)] pt-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            window.requestAnimationFrame(onOpenGuide);
          }}
          className={sidebarItem}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          <span>Guide & help</span>
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className={sidebarItem}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <ThemeIcon className="h-4 w-4 shrink-0" />
          <span>{nextThemeLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            window.requestAnimationFrame(onOpenSettings);
          }}
          className={sidebarItem}
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            window.requestAnimationFrame(onOpenSettings);
          }}
          data-testid="sidebar-account-settings"
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          aria-label={identity.signedIn ? `Open account profile for ${identity.detail}` : "Open account profile"}
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

export function ClinicalDesktopSidebar({
  collapsed,
  recentQueries,
  identity,
  activeMode,
  onCollapsedChange,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
  theme,
  onToggleTheme,
  onPrefetchApplications,
}: {
  collapsed: boolean;
  recentQueries: string[];
  identity: SidebarIdentity;
  activeMode: AppModeId;
  onCollapsedChange: (collapsed: boolean) => void;
  onNewChat: () => void;
  onPickRecent: (query: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPrefetchApplications: () => void;
}) {
  const CollapsedThemeIcon = theme === "dark" ? Sun : Moon;

  if (collapsed) {
    return (
      <aside
        aria-label="Clinical Guide collapsed sidebar"
        className="hidden min-h-0 border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] py-4 shadow-[var(--shadow-soft)] lg:flex lg:w-[5.25rem] lg:flex-col lg:items-center"
      >
        <div className="grid w-full justify-items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className={cn(collapsedSidebarButton, "group")}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <BrandMark className="h-7 w-7 group-hover:hidden group-focus-visible:hidden" />
            <PanelLeftOpen className="hidden h-4.5 w-4.5 group-hover:block group-focus-visible:block" />
          </button>
          <span className="h-px w-8 bg-[color:var(--border)]" aria-hidden="true" />
        </div>

        <div className="mt-3 grid w-full justify-items-center gap-2 px-3">
          <button
            type="button"
            onClick={onNewChat}
            className={collapsedSidebarButton}
            aria-label="New chat"
            title="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className={cn(collapsedSidebarButton, activeMode === "answer" && collapsedSidebarActiveButton)}
            aria-label="Search chats"
            title="Search chats"
            aria-current={activeMode === "answer" ? "page" : undefined}
          >
            <Search className="h-4 w-4" />
          </button>
          <Link
            href="/services"
            className={cn(collapsedSidebarButton, activeMode === "services" && collapsedSidebarActiveButton)}
            aria-label="Services"
            title="Services"
            aria-current={activeMode === "services" ? "page" : undefined}
          >
            <ClipboardList className="h-4 w-4" />
          </Link>
          <Link
            href="/forms"
            className={cn(collapsedSidebarButton, activeMode === "forms" && collapsedSidebarActiveButton)}
            aria-label="Forms"
            title="Forms"
            aria-current={activeMode === "forms" ? "page" : undefined}
          >
            <FileText className="h-4 w-4" />
          </Link>
          <Link
            href="/favourites"
            className={cn(collapsedSidebarButton, activeMode === "favourites" && collapsedSidebarActiveButton)}
            aria-label="Favourites"
            title="Favourites"
            aria-current={activeMode === "favourites" ? "page" : undefined}
          >
            <Heart className="h-4 w-4" />
          </Link>
          <Link
            href="/differentials"
            className={cn(collapsedSidebarButton, activeMode === "differentials" && collapsedSidebarActiveButton)}
            aria-label="Differentials"
            title="Differentials"
            aria-current={activeMode === "differentials" ? "page" : undefined}
          >
            <BrainCircuit className="h-4 w-4" />
          </Link>
          <Link
            href="/?mode=tools"
            prefetch
            onFocus={onPrefetchApplications}
            onPointerEnter={onPrefetchApplications}
            className={cn(collapsedSidebarButton, activeMode === "tools" && collapsedSidebarActiveButton)}
            aria-label="Tools"
            title="Tools"
            aria-current={activeMode === "tools" ? "page" : undefined}
          >
            <Wrench className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onOpenGuide}
            className={collapsedSidebarButton}
            aria-label="Guide and help"
            title="Guide"
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className={collapsedSidebarButton}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <CollapsedThemeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className={collapsedSidebarButton}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="collapsed-account-settings"
          className="mt-auto grid h-11 w-11 place-items-center rounded-full border border-[color:var(--clinical-accent-border)]/60 bg-[color:var(--clinical-accent-soft)] text-xs font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          title={identity.detail}
          aria-label={identity.signedIn ? `Open account profile for ${identity.detail}` : "Open account profile"}
        >
          {identity.initials}
        </button>
      </aside>
    );
  }

  return (
    <aside
      id="clinical-tools-sidebar"
      aria-label="Clinical Guide sidebar"
      className="hidden min-h-0 w-[20rem] max-w-[20rem] shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] lg:flex lg:flex-col"
    >
      <ClinicalSidebarContent
        recentQueries={recentQueries}
        identity={identity}
        activeMode={activeMode}
        onCollapsedChange={onCollapsedChange}
        onNewChat={onNewChat}
        onPickRecent={onPickRecent}
        onOpenGuide={onOpenGuide}
        onOpenSettings={onOpenSettings}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onPrefetchApplications={onPrefetchApplications}
      />
    </aside>
  );
}

export function ClinicalMobileSidebar({
  open,
  recentQueries,
  identity,
  activeMode,
  onOpenChange,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
  theme,
  onToggleTheme,
  onPrefetchApplications,
}: {
  open: boolean;
  recentQueries: string[];
  identity: SidebarIdentity;
  activeMode: AppModeId;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onPickRecent: (query: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPrefetchApplications: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Clinical Guide"
      description="Recent chats, daily tools, help, and settings."
      closeLabel="Close Clinical Guide menu"
      placement="left"
      contentClassName="lg:hidden"
      headerLeading={<BrandMark className="h-8 w-8" />}
    >
      <ClinicalSidebarContent
        showHeader={false}
        recentQueries={recentQueries}
        identity={identity}
        activeMode={activeMode}
        onNewChat={onNewChat}
        onPickRecent={onPickRecent}
        onOpenGuide={onOpenGuide}
        onOpenSettings={onOpenSettings}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onPrefetchApplications={onPrefetchApplications}
        onNavigate={() => onOpenChange(false)}
      />
    </Sheet>
  );
}
