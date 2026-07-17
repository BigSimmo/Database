import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Info, Minus, ShieldAlert, Tags } from "lucide-react";

import { cn, eyebrowText, pageContainer } from "@/components/ui-primitives";
import type { SpecifierRecord } from "@/lib/specifiers";
import type { SpecifierSourceStatus } from "@/lib/specifiers-search-index";

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
// ── Catalog additions (small stylistic upgrades borrowed from the Specifiers v2 design) ──

type CategoryTone = { color: string; background: string; borderColor: string };

// Categorical (taxonomy) palette drawn from existing tokens — never semantic status.
// Reuses the repo's `--type-*` categorical chips + tone tokens so it stays theme-aware.
const categoryPalette: CategoryTone[] = [
  {
    color: "var(--type-document)",
    background: "var(--type-document-soft)",
    borderColor: "var(--type-document-border)",
  },
  { color: "var(--type-table)", background: "var(--type-table-soft)", borderColor: "var(--type-table-border)" },
  { color: "var(--type-source)", background: "var(--type-source-soft)", borderColor: "var(--type-source-border)" },
  { color: "var(--type-service)", background: "var(--type-service-soft)", borderColor: "var(--type-service-border)" },
  { color: "var(--type-form)", background: "var(--type-form-soft)", borderColor: "var(--type-form-border)" },
  {
    color: "var(--clinical-accent-hover)",
    background: "var(--clinical-accent-soft)",
    borderColor: "var(--clinical-accent-border)",
  },
  {
    color: "var(--tone-rose)",
    background: "color-mix(in srgb, var(--tone-rose) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--tone-rose) 32%, transparent)",
  },
  {
    color: "var(--tone-indigo)",
    background: "color-mix(in srgb, var(--tone-indigo) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--tone-indigo) 32%, transparent)",
  },
  {
    color: "var(--tone-purple)",
    background: "color-mix(in srgb, var(--tone-purple) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--tone-purple) 32%, transparent)",
  },
  { color: "var(--type-search)", background: "var(--type-search-soft)", borderColor: "var(--type-search-border)" },
];

const categoryOrder = [
  "ndv",
  "psy",
  "bip",
  "dep",
  "anx",
  "ocd",
  "trm",
  "dis",
  "som",
  "eat",
  "eli",
  "slp",
  "sxd",
  "gen",
  "imp",
  "sub",
  "ncg",
  "per",
  "par",
  "icd",
];

export function categoryTone(categoryId: string): CategoryTone {
  const known = categoryOrder.indexOf(categoryId);
  const index = known >= 0 ? known : Array.from(categoryId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return categoryPalette[index % categoryPalette.length];
}

/** Strip the leading "1. " ordinal from a category name for compact chips. */
export function categoryShortName(name: string) {
  return name.replace(/^\s*\d+\.\s*/, "");
}

export function CategoryTag({ categoryId, name, className }: { categoryId: string; name: string; className?: string }) {
  const tone = categoryTone(categoryId);
  const style: CSSProperties = { color: tone.color, background: tone.background, borderColor: tone.borderColor };
  return (
    <span
      className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 text-2xs font-bold", className)}
      style={style}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} aria-hidden />
      {categoryShortName(name)}
    </span>
  );
}

const sourceStatusMeta: Record<
  SpecifierSourceStatus,
  { label: string; icon: ComponentType<{ className?: string }>; className: string }
> = {
  "source-verified": {
    label: "Source reviewed",
    icon: CheckCircle2,
    className: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  },
  "source-needs-formal-review": {
    label: "Review due",
    icon: ShieldAlert,
    className: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  },
  "source-not-applicable": {
    label: "Source n/a",
    icon: Minus,
    className: "border-[color:var(--border)] bg-[color:var(--surface-inset)] text-[color:var(--text-soft)]",
  },
};

export function ReviewStatusBadge({ status, className }: { status: SpecifierSourceStatus; className?: string }) {
  const meta = sourceStatusMeta[status] ?? sourceStatusMeta["source-needs-formal-review"];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 text-2xs font-bold",
        meta.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

export function DsmBadge({ label = "DSM-5-TR" }: { label?: string }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1.5 rounded-md border border-[color:var(--info-border)] bg-[color:var(--info-soft)] px-2 text-2xs font-bold text-[color:var(--info)]">
      <Info className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/** Compact 2×2-style reference tile (Specifiers v2 look). */
export function QuickTile({
  icon: Icon,
  label,
  body,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  body: string;
  tone?: "default" | "accent" | "info" | "success";
}) {
  const toneClass =
    tone === "accent"
      ? "border-[color:var(--clinical-accent-border)] text-[color:var(--clinical-accent)]"
      : tone === "info"
        ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]"
        : tone === "success"
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : "border-[color:var(--border)] text-[color:var(--text-soft)]";
  const bodyClass =
    tone === "info"
      ? "text-[color:var(--info)]"
      : tone === "success"
        ? "text-[color:var(--success)]"
        : "text-[color:var(--text-muted)]";
  return (
    <div className={cn("rounded-lg border bg-[color:var(--surface)] p-4", toneClass)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-2xs font-extrabold uppercase tracking-[0.05em]">{label}</span>
      </div>
      <p className={cn("text-xs font-medium leading-5", bodyClass)}>{body}</p>
    </div>
  );
}
