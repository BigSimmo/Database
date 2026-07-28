import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Info, Network, ShieldCheck } from "lucide-react";

import { cn, eyebrowText, pageContainer } from "@/components/ui-primitives";

export const formulationCard =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";

export function FormulationPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        // Phone shell owns dock clearance; avoid 100dvh min-height overflowing the
        // inset scrollport the way service/form detail pages used to.
        "max-sm:min-h-0 bg-[color:var(--background)] px-3 py-4 pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-5 sm:py-6 sm:pb-10 lg:px-7",
        className,
      )}
    >
      <div className={cn(pageContainer, "grid gap-5 sm:gap-6")}>{children}</div>
    </main>
  );
}

export function FormulationBreadcrumbs({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-h-tap items-center gap-1 text-xs font-semibold text-[color:var(--text-muted)]"
    >
      <Link
        href="/formulation"
        className="inline-flex min-h-tap items-center gap-1.5 rounded-md px-1.5 hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Formulation
      </Link>
      {current ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
          <span aria-current="page" className="truncate text-[color:var(--text)]">
            {current}
          </span>
        </>
      ) : null}
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
