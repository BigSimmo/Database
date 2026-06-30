"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  FileText,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  cn,
  sidebarItem,
  sidebarToolTile,
  statusDotReady,
  textMuted,
} from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { type AppModeId } from "@/lib/app-modes";

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
  { id: "prescribing", label: "Meds", icon: Pill, href: "/?mode=prescribing" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/?mode=tools" },
] as const;

const collapsedSidebarButton =
  "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
const collapsedSidebarActiveButton =
  "border-[color:var(--clinical-chat-teal)]/22 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]";
const collapsedSidebarPrimaryButton =
  "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-chat-teal)]/35 hover:text-[color:var(--clinical-chat-teal)]";

export function ClinicalSidebarContent({
  recentQueries,
  identity,
  activeMode,
  onNewChat,
  onPickRecent,
  onOpenGuide,
  onOpenSettings,
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[color:var(--text-heading)]">Clinical Guide</p>
              <p className={cn("truncate text-xs", textMuted)}>Source-backed workspace</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCollapsedChange?.(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:text-[color:var(--text)]"
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
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-3 text-sm font-semibold text-white shadow-[var(--shadow-tight)] hover:bg-[color:var(--primary-strong)]"
      >
        <Plus className="h-4 w-4" />
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
          className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-9 pr-3 text-sm font-medium text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
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
                    "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--clinical-chat-teal-soft)]",
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
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
                  active &&
                    "border-[color:var(--clinical-chat-teal)]/28 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-tight)]",
                )}
              >
                <Icon className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
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
          className="mt-2 inline-flex min-h-10 w-full items-center justify-between rounded-lg border border-[color:var(--clinical-chat-teal)]/16 bg-[color:var(--clinical-chat-teal-soft)]/70 px-3 text-sm font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]"
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
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/24 hover:bg-[color:var(--clinical-chat-teal-soft)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          aria-label={identity.signedIn ? `Open account profile for ${identity.detail}` : "Open account profile"}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-xs font-bold text-[color:var(--clinical-chat-teal)]">
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
  onPrefetchApplications: () => void;
}) {
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
            className={cn(collapsedSidebarButton, collapsedSidebarPrimaryButton)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-4 grid w-full justify-items-center gap-2 px-3">
          <button
            type="button"
            onClick={onNewChat}
            className={collapsedSidebarButton}
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
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
          className="mt-auto grid h-11 w-11 place-items-center rounded-full border border-[color:var(--clinical-chat-teal)]/14 bg-[color:var(--clinical-chat-teal-soft)] text-xs font-bold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 hover:bg-[color:var(--clinical-chat-teal-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
        onPrefetchApplications={onPrefetchApplications}
        onNavigate={() => onOpenChange(false)}
      />
    </Sheet>
  );
}
