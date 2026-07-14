import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Info, Tags } from "lucide-react";

import { cn, eyebrowText, pageContainer } from "@/components/ui-primitives";
import type { SpecifierRecord } from "@/lib/specifiers";

export const specifierCard =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";

export function SpecifierPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] text-[color:var(--text)] sm:px-5 sm:py-6 sm:pb-10 lg:px-7",
        className,
      )}
    >
      <div className={cn(pageContainer, "grid gap-5 sm:gap-6")}>{children}</div>
    </main>
  );
}

export function SpecifierBreadcrumbs({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-h-tap items-center gap-1 text-xs font-semibold text-[color:var(--text-muted)]"
    >
      <Link
        href="/specifiers"
        className="inline-flex min-h-tap items-center gap-1.5 rounded-md px-1.5 hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Specifiers
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

export function SpecifierSubnav({ active }: { active: "search" | "builder" | "compare" | "map" }) {
  const items = [
    { id: "search" as const, label: "Find", href: "/specifiers" },
    { id: "builder" as const, label: "Build wording", href: "/specifiers/builder" },
    { id: "compare" as const, label: "Compare", href: "/specifiers/compare" },
    { id: "map" as const, label: "Map", href: "/specifiers/map" },
  ];

  return (
    <nav
      aria-label="Specifier tools"
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
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SpecifierFamilyBadge({ record }: { record: SpecifierRecord }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-bold text-[color:var(--clinical-accent)]">
      <Tags className="h-3.5 w-3.5" aria-hidden />
      {record.familyLabel}
    </span>
  );
}

export function DiagnosisChips({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text-muted)]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

export function SpecifierSafetyNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-sm leading-5 text-[color:var(--text-muted)]",
        compact ? "px-3 py-2.5" : "p-4",
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden />
      <p>
        Use this as structured decision support. Confirm the current diagnostic manual criteria, exclusions, episode
        chronology, and local clinical requirements before documenting a specifier.
      </p>
    </aside>
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
