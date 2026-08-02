import Link from "next/link";
import type { ReactNode } from "react";
import { Info, Network, ShieldCheck } from "lucide-react";

import { InformationPageBreadcrumbs, InformationPageShell } from "@/components/information-page-shell";
import { cn, eyebrowText } from "@/components/ui-primitives";

export const formulationCard =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";

export function FormulationPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <InformationPageShell className={className}>{children}</InformationPageShell>;
}

export function FormulationBreadcrumbs({ current }: { current?: string }) {
  return <InformationPageBreadcrumbs home={{ label: "Formulation", href: "/formulation" }} current={current} />;
}

export function FormulationSubnav({ active }: { active: "search" | "builder" | "compare" | "map" }) {
  const items = [
    { id: "search" as const, label: "Find mechanisms", shortLabel: "Find", href: "/formulation" },
    { id: "builder" as const, label: "Build formulation", shortLabel: "Build", href: "/formulation/builder" },
    { id: "compare" as const, label: "Compare", shortLabel: "Compare", href: "/formulation/compare" },
    { id: "map" as const, label: "Mechanism map", shortLabel: "Map", href: "/formulation/map" },
  ];

  return (
    <nav
      aria-label="Formulation tools"
      className="polished-scroll flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-1 shadow-[var(--shadow-inset)]"
    >
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={cn(
            "inline-flex min-h-tap shrink-0 items-center justify-center rounded-md px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-sm",
            active === item.id
              ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
              : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]",
          )}
        >
          <span className="sm:hidden">{item.shortLabel}</span>
          <span className="hidden sm:inline">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function MechanismDomainChips({ values, limit }: { values: string[]; limit?: number }) {
  const visible = typeof limit === "number" ? values.slice(0, limit) : values;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((value) => (
        <span
          key={value}
          className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-bold text-[color:var(--clinical-accent)]"
        >
          {value}
        </span>
      ))}
      {typeof limit === "number" && values.length > limit ? (
        <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text-muted)]">
          +{values.length - limit}
        </span>
      ) : null}
    </div>
  );
}

export function MechanismBadge({ label = "Formulation mechanism" }: { label?: string }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-bold text-[color:var(--text-muted)]">
      <Network className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
      {label}
    </span>
  );
}

export function FormulationSafetyNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-sm leading-5 text-[color:var(--text-muted)]",
        compact ? "px-3 py-2.5" : "p-4",
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden />
      <p>
        Treat each mechanism as a hypothesis, not a diagnosis. Check the person’s context, culture, development, mental
        state, risk, and alternative explanations, then revise the formulation when new evidence does not fit.
      </p>
    </aside>
  );
}

export function SessionPrivacyNote() {
  return (
    <div className="flex items-start gap-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
      <p>Keep notes de-identified. Builder text remains in this browser session unless you copy it.</p>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <header className="grid gap-1.5">
      {eyebrow ? <p className={eyebrowText}>{eyebrow}</p> : null}
      <h2 className="text-xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-2xl">{title}</h2>
      {body ? <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">{body}</p> : null}
    </header>
  );
}
