"use client";

import { useState } from "react";
import { ArrowLeft, Bookmark, HeartPulse } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { AppShell, ComposerPill, DeviceFrame, Pair, SectionIntro, focusRing } from "./shared";

type Service = {
  id: string;
  name: string;
  detail: string;
  tags: string[];
  bestFit?: boolean;
};

const SERVICES: Service[] = [
  {
    id: "camhs",
    name: "CAMHS Crisis Connect",
    detail: "24/7 phone triage · metro + regional handover",
    tags: ["Crisis / urgent", "Phone referral"],
    bestFit: true,
  },
  {
    id: "atsi",
    name: "ATSI Mental Health Line",
    detail: "Culturally safe crisis support · WA",
    tags: ["Culturally safe", "Phone referral", "Free"],
  },
  {
    id: "cmh",
    name: "Fremantle Adult CMH",
    detail: "Local catchment · same-day intake window",
    tags: ["Local CMH", "WA"],
  },
  {
    id: "perinatal",
    name: "Perinatal Psychiatry Metro",
    detail: "Mother–baby urgent assessment pathway",
    tags: ["Specialty", "Metro"],
  },
];

const STEPS = ["Search", "Shortlist", "Compare"] as const;
const FILTERS = ["Best fit", "Crisis", "Culturally safe", "Phone", "Free", "WA"] as const;

function StepDots({ active }: { active: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Referral workflow">
      {STEPS.map((step, index) => {
        const on = index === active;
        const done = index < active;
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? <span className="h-px w-4 bg-[color:var(--border-strong)]" aria-hidden /> : null}
            <span className="inline-flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  on
                    ? "bg-[color:var(--clinical-accent)]"
                    : done
                      ? "bg-[color:var(--clinical-accent)]/50"
                      : "bg-[color:var(--border-strong)]",
                )}
                aria-hidden
              />
              <span className={on ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]"}>
                {step}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ServiceRow({
  service,
  selected,
  onToggle,
  phone,
}: {
  service: Service;
  selected: boolean;
  onToggle: () => void;
  phone?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-b border-[color:var(--border)] last:border-b-0",
        selected ? "bg-[color:var(--clinical-accent-soft)]" : "bg-[color:var(--surface)]",
        phone ? "px-3 py-3" : "px-4 py-3.5",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border text-3xs font-extrabold",
            focusRing,
            selected
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
              : "border-[color:var(--border-strong)] text-[color:var(--text-soft)]",
          )}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${service.name} from shortlist` : `Add ${service.name} to shortlist`}
        >
          {selected ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">{service.name}</p>
            {service.bestFit ? (
              <span className="rounded-full bg-[color:var(--clinical-accent)] px-2 py-0.5 text-3xs font-extrabold text-[color:var(--surface)]">
                Best fit
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-2xs text-[color:var(--text-muted)]">{service.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {service.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-0.5 text-3xs font-semibold text-[color:var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <span className="text-[color:var(--text-soft)]" aria-hidden>
          <Bookmark className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "inline-flex h-9 items-center rounded-lg border px-3 text-2xs font-bold",
            focusRing,
            selected
              ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] text-[color:var(--text-heading)]",
          )}
        >
          {selected ? "In shortlist" : "Add to shortlist"}
        </button>
      </div>
    </div>
  );
}

function ServicesSearchFrame({ device }: { device: "desktop" | "phone" }) {
  const phone = device === "phone";
  const [shortlist, setShortlist] = useState<string[]>(["camhs", "atsi"]);
  const step = shortlist.length >= 2 ? 1 : 0;

  return (
    <DeviceFrame device={device} label={phone ? "Phone referral flow" : "Desktop referral flow"}>
      <AppShell
        device={device}
        active="services"
        modeLabel="Services"
        ModeIcon={HeartPulse}
        dock={
          phone ? (
            <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <ComposerPill value="crisis" phone />
            </div>
          ) : undefined
        }
      >
        <div className={cn(phone ? "px-3 pb-4 pt-3" : "px-6 py-5")}>
          <div className="mb-3 flex items-center gap-2 text-2xs font-bold text-[color:var(--text-muted)]">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Services
          </div>
          <h3
            className={cn(
              "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
              phone ? "text-2xl" : "text-3xl",
            )}
          >
            crisis
          </h3>
          <p className="mt-1 text-2xs font-medium text-[color:var(--text-muted)]">45 matches · quick referral</p>

          {!phone ? (
            <div className="mt-4 max-w-2xl">
              <ComposerPill value="crisis" />
            </div>
          ) : null}

          <div className="mt-4">
            <StepDots active={step} />
          </div>

          {shortlist.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2.5">
              <p className="text-2xs font-bold text-[color:var(--clinical-accent)]">{shortlist.length} in shortlist</p>
              <div className="flex gap-3 text-2xs font-bold text-[color:var(--clinical-accent)]">
                <span>Compare</span>
                <button
                  type="button"
                  className={cn("underline-offset-2 hover:underline", focusRing)}
                  onClick={() => setShortlist([])}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            <span className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[color:var(--border)] px-3 text-2xs font-bold">
              Filters
            </span>
            {FILTERS.map((filter, index) => (
              <span
                key={filter}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-2xs font-semibold",
                  index === 0
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] text-[color:var(--text-muted)]",
                )}
              >
                {filter}
              </span>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--border)]">
            {SERVICES.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                phone={phone}
                selected={shortlist.includes(service.id)}
                onToggle={() =>
                  setShortlist((current) =>
                    current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id],
                  )
                }
              />
            ))}
          </div>
        </div>
      </AppShell>
    </DeviceFrame>
  );
}

export function ServicesSearchPerfectedSection() {
  return (
    <section id="services-search" aria-labelledby="services-search-title" className="scroll-mt-8">
      <SectionIntro
        issue="#163"
        title="Services search redesign"
        body="Flow is search → shortlist → compare for quick referrals (crisis, ATSI, local CMH). No giant always-on decision panel — the shortlist banner appears only when items are selected."
        pick="B — Progressive Referral Workflow. Query-as-H1 (never match-count H1); tiny step dots instead of a step rail."
      />
      <Pair desktop={<ServicesSearchFrame device="desktop" />} phone={<ServicesSearchFrame device="phone" />} />
    </section>
  );
}
