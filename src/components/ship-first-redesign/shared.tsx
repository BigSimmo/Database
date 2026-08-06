"use client";

import {
  FileText,
  Heart,
  HeartPulse,
  MessageSquareText,
  Settings,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export type Device = "desktop" | "phone";

export type NavId = "answer" | "documents" | "services" | "medications" | "factsheets" | "tools" | "favourites";

const NAV: Array<{ id: NavId; label: string; icon: LucideIcon }> = [
  { id: "answer", label: "Answer", icon: MessageSquareText },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "services", label: "Services", icon: HeartPulse },
  { id: "medications", label: "Medications", icon: Stethoscope },
  { id: "factsheets", label: "Factsheets", icon: FileText },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "favourites", label: "Favourites", icon: Heart },
];

export function DeviceFrame({
  device,
  label,
  children,
  className,
}: {
  device: Device;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const phone = device === "phone";
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold tabular-nums text-[color:var(--text-soft)]">
          {phone ? "390 × 844" : "1280 × 900"}
        </span>
      </figcaption>
      <div
        className={cn(
          "overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--text)] shadow-[var(--shadow-soft)]",
          phone ? "mx-auto w-full max-w-[24.375rem] rounded-[1.65rem]" : "rounded-2xl",
        )}
      >
        <div
          className={cn(
            "relative flex flex-col overflow-hidden",
            phone ? "h-[52.75rem]" : "h-[35.5rem] min-h-[35.5rem]",
          )}
        >
          {children}
        </div>
      </div>
    </figure>
  );
}

function BrandMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.65rem] bg-[color:var(--text-heading)] text-[color:var(--surface)]">
      <HeartPulse className="h-4 w-4" aria-hidden />
    </span>
  );
}

export function AppShell({
  device,
  active,
  modeLabel,
  ModeIcon,
  children,
  dock,
}: {
  device: Device;
  active: NavId;
  modeLabel: string;
  ModeIcon: LucideIcon;
  children: ReactNode;
  dock?: ReactNode;
}) {
  const phone = device === "phone";

  if (phone) {
    return (
      <>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
          <BrandMark />
          <span
            className={cn(
              "inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold",
              focusRing,
            )}
          >
            <ModeIcon className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
            {modeLabel}
          </span>
          <span className="ml-auto text-2xs font-bold text-[color:var(--text-muted)]">New chat</span>
        </header>
        <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
        {dock}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[13.5rem] shrink-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
        <div className="mb-3 flex items-center gap-2 px-1">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-[-0.02em] text-[color:var(--text-heading)]">
              Clinical Guide
            </p>
            <p className="text-3xs font-medium text-[color:var(--text-soft)]">Clinical reference</p>
          </div>
        </div>
        <span className="mb-3 inline-flex h-10 items-center justify-center rounded-xl bg-[color:var(--text-heading)] text-xs font-bold text-[color:var(--surface)]">
          + New chat
        </span>
        <nav className="grid gap-0.5" aria-label="Modes">
          {NAV.map((item) => {
            const Icon = item.icon;
            const selected = item.id === active;
            return (
              <span
                key={item.id}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold",
                  selected
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </span>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-[color:var(--border)] pt-3">
          <span className="inline-flex items-center gap-2 px-2 text-xs font-medium text-[color:var(--text-muted)]">
            <Settings className="h-3.5 w-3.5" aria-hidden />
            Settings
          </span>
          <span className="px-2 text-2xs text-[color:var(--text-soft)]">Guest · not signed in</span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-center border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4">
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold">
            <ModeIcon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
            {modeLabel}
          </span>
        </header>
        <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
        {dock}
      </div>
    </div>
  );
}

export function ComposerPill({
  value,
  phone,
  placeholder = "Search…",
}: {
  value: string;
  phone?: boolean;
  placeholder?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-4 pr-2 shadow-[var(--shadow-inset)]",
        phone ? "min-h-12" : "min-h-14",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-heading)]">
        {value || <span className="text-[color:var(--text-soft)]">{placeholder}</span>}
      </span>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
        aria-hidden
      >
        →
      </span>
    </div>
  );
}

export function Pair({ desktop, phone }: { desktop: ReactNode; phone: ReactNode }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.9fr)]">
      {desktop}
      {phone}
    </div>
  );
}

export function SectionIntro({
  issue,
  title,
  body,
  pick,
}: {
  issue: string;
  title: string;
  body: string;
  pick: string;
}) {
  return (
    <div className="mb-4 max-w-3xl">
      <p className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">{issue}</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[color:var(--text-muted)]">{body}</p>
      <p className="mt-2 text-2xs font-semibold text-[color:var(--text-heading)]">
        Perfected pick: <span className="font-medium text-[color:var(--text-muted)]">{pick}</span>
      </p>
    </div>
  );
}
