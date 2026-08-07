"use client";

import { ArrowLeft, Calculator, FileText, Pill, ShieldCheck, Wrench } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { AppShell, ComposerPill, DeviceFrame, Pair, SectionIntro } from "./shared";

const TOOLS = [
  {
    title: "Medication Prescribing",
    description: "Safe and effective prescribing",
    icon: Pill,
  },
  {
    title: "Dose converter",
    description: "Unit and formulation conversion",
    icon: Calculator,
  },
  {
    title: "Renal calculator",
    description: "eGFR-aware dose adjustment",
    icon: Calculator,
  },
  {
    title: "Clinical forms",
    description: "MHA and referral paperwork",
    icon: FileText,
  },
] as const;

const LANES = ["All tools", "Assess", "Evidence", "Treat", "Coordinate"] as const;

function ToolRow({
  title,
  description,
  icon: Icon,
  phone,
}: {
  title: string;
  description: string;
  icon: typeof Pill;
  phone?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        phone ? "px-3 py-3" : "px-4 py-3.5",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--clinical-accent)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
        <p className="truncate text-2xs text-[color:var(--text-muted)]">{description}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-3xs font-bold text-[color:var(--clinical-accent)]">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Source-backed
        </p>
      </div>
      <span className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[color:var(--border)] px-3 text-2xs font-bold text-[color:var(--text-heading)]">
        Open
      </span>
    </div>
  );
}

function ToolsSearchFrame({ device }: { device: "desktop" | "phone" }) {
  const phone = device === "phone";
  const query = "medications";

  return (
    <DeviceFrame device={device} label={phone ? "Phone results" : "Desktop results"}>
      <AppShell
        device={device}
        active="tools"
        modeLabel="Tools"
        ModeIcon={Wrench}
        dock={
          phone ? (
            <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <ComposerPill value={query} phone />
            </div>
          ) : undefined
        }
      >
        <div className={cn("mx-auto w-full", phone ? "max-w-none px-3 pb-4 pt-3" : "max-w-3xl px-6 py-5")}>
          <div className="mb-3 flex items-center gap-2 text-2xs font-bold text-[color:var(--text-muted)]">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Tools
          </div>
          <h3
            className={cn(
              "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
              phone ? "text-2xl" : "text-3xl",
            )}
          >
            {query}
          </h3>
          <p className="mt-1 text-2xs font-medium text-[color:var(--text-muted)]">4 tools · Tools mode</p>

          {!phone ? (
            <div className="mt-4">
              <ComposerPill value={query} />
            </div>
          ) : null}

          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[color:var(--border)] pb-px">
            {LANES.map((lane, index) => (
              <span
                key={lane}
                className={cn(
                  "shrink-0 px-3 py-2 text-2xs font-bold",
                  index === 0
                    ? "border-b-2 border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)]",
                )}
              >
                {lane}
              </span>
            ))}
          </div>

          <div className="mt-1 overflow-hidden rounded-xl border border-[color:var(--border)]">
            {TOOLS.map((tool) => (
              <ToolRow key={tool.title} {...tool} phone={phone} />
            ))}
          </div>

          <p className="mt-3 text-center text-2xs font-medium text-[color:var(--text-soft)]">
            Also in other modes (12) ▾
          </p>
        </div>
      </AppShell>
    </DeviceFrame>
  );
}

export function ToolsSearchPerfectedSection() {
  return (
    <section id="tools-search" aria-labelledby="tools-search-title" className="scroll-mt-8">
      <SectionIntro
        issue="#162"
        title="Tools search redesign"
        body="Results page focused on finding tools fast: query becomes the page title, dense rows, one search bar. Homepage-style clutter leaves when a search is running."
        pick="A — Compact Results Instrument. Phone docks one edge-to-edge composer; desktop keeps it under the query H1."
      />
      <Pair desktop={<ToolsSearchFrame device="desktop" />} phone={<ToolsSearchFrame device="phone" />} />
    </section>
  );
}
