"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronsRight,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  Heart,
  LayoutGrid,
  List,
  MessageSquare,
  MoreVertical,
  Pill,
  Pin,
  Quote,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";

type FavouriteType = "Medication" | "Document" | "Table" | "Saved search" | "Source";

type FavouriteItem = {
  id: string;
  title: string;
  description: string;
  type: FavouriteType;
  set: string;
  evidence: string;
  lastUsed: string;
  action: string;
  href: string;
  icon: LucideIcon;
  selected?: boolean;
};

type FavouriteSet = {
  title: string;
  count: number;
};

type SourceRecord = {
  title: string;
  type: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const favouriteSets: FavouriteSet[] = [
  { title: "Ward round", count: 2 },
  { title: "Prescribing safety", count: 2 },
  { title: "Clozapine clinic", count: 1 },
];

const favouriteItems: FavouriteItem[] = [
  {
    id: "acamprosate-renal-screen",
    title: "Acamprosate renal screen",
    description: "Medication page · renal cautions / dose notes",
    type: "Medication",
    set: "Ward round",
    evidence: "3 sources",
    lastUsed: "Today 08:44",
    action: "Open",
    href: "/medications/acamprosate",
    icon: Pill,
    selected: true,
  },
  {
    id: "lithium-monitoring-guideline",
    title: "Lithium monitoring guideline",
    description: "PDF · p.4-9 · 2 tables",
    type: "Document",
    set: "Prescribing safety",
    evidence: "PDF verified",
    lastUsed: "Today 08:20",
    action: "Ask",
    href: "/documents?q=lithium+monitoring",
    icon: FileText,
  },
  {
    id: "clozapine-monitoring-table",
    title: "Clozapine monitoring table",
    description: "Saved table · ANC monitoring",
    type: "Table",
    set: "Clozapine clinic",
    evidence: "Table verified",
    lastUsed: "Yesterday 16:12",
    action: "Open",
    href: "/documents?q=clozapine+monitoring+table",
    icon: Quote,
  },
  {
    id: "renal-dose-saved-search",
    title: "renal dose saved search",
    description: "Medicines plus documents / eGFR cautions",
    type: "Saved search",
    set: "Ward round",
    evidence: "Saved query",
    lastUsed: "Today 07:55",
    action: "Run",
    href: "/?mode=answer&q=renal+dose&run=1",
    icon: Search,
  },
  {
    id: "qt-prolongation-quote",
    title: "QT prolongation quote",
    description: "Source card / prescribing safety",
    type: "Source",
    set: "Prescribing safety",
    evidence: "2 sources",
    lastUsed: "Mon 11:03",
    action: "Copy",
    href: "/documents?q=QT+prolongation",
    icon: Quote,
  },
];

const selectedItem = favouriteItems[0];

const sourceRecords: SourceRecord[] = [
  { title: "NICE CKS - Alcohol dependence", type: "Guideline" },
  { title: "BNF - Acamprosate", type: "BNF" },
  { title: "Medsafe - Acamprosate data sheet", type: "Datasheet" },
];

const typeStyles: Record<FavouriteType, string> = {
  Medication:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  Document: "border-blue-200 bg-blue-50 text-blue-700",
  Table: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Saved search": "border-slate-200 bg-slate-50 text-slate-700",
  Source: "border-violet-200 bg-violet-50 text-violet-700",
};

function MiniIconTile({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

function SmallChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-xs font-bold leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

type ToolbarButtonProps = ComponentPropsWithoutRef<"button"> & {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
};

function ToolbarButton({ children, active = false, className, ...props }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition",
        active
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        className,
      )}
    >
      {children}
    </button>
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[color:var(--border)] pb-4 last:border-b-0">
      <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SidebarRow({
  icon: Icon,
  label,
  meta,
  count,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "grid min-h-11 w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 text-left text-sm font-bold transition",
        active
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
        focusRing,
      )}
    >
      <MiniIconTile icon={Icon} active={active} />
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {meta ? <span className="block truncate text-xs font-semibold opacity-75">{meta}</span> : null}
      </span>
      {typeof count === "number" ? <span className="nums text-xs font-black">{count}</span> : null}
    </button>
  );
}

function FavouritesSidebar() {
  return (
    <aside className="hidden min-w-0 border-r border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-6 lg:block">
      <div className="grid gap-5">
        <SidebarSection
          title="Saved sets"
          action={
            <button type="button" className={cn("text-xs font-black text-[color:var(--clinical-accent)]", focusRing)}>
              View all
            </button>
          }
        >
          <div className="grid gap-1">
            {favouriteSets.map((set, index) => (
              <SidebarRow
                key={set.title}
                icon={Folder}
                label={set.title}
                meta={`${set.count} ${set.count === 1 ? "item" : "items"}`}
                active={index === 0}
              />
            ))}
            <SidebarRow icon={Folder} label="All favourites" meta="5 items" />
          </div>
        </SidebarSection>

        <SidebarSection title="Library views">
          <div className="grid gap-1">
            <SidebarRow icon={ShieldCheck} label="Source-backed" count={5} />
            <SidebarRow icon={Pin} label="Pinned items" count={2} />
            <SidebarRow icon={Search} label="Recently used" count={5} />
          </div>
        </SidebarSection>

        <SidebarSection title="Type filters">
          <div className="grid gap-1">
            <SidebarRow icon={Pill} label="Medications" count={1} />
            <SidebarRow icon={FileText} label="Documents" count={2} />
            <SidebarRow icon={LayoutGrid} label="Tables" count={1} />
            <SidebarRow icon={Quote} label="Sources" count={1} />
          </div>
        </SidebarSection>
      </div>
    </aside>
  );
}

function ContinueStrip() {
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]">
      <div className="grid min-h-[68px] grid-cols-[3px_minmax(0,1fr)]">
        <span className="bg-[color:var(--success)]" aria-hidden />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <MiniIconTile icon={Pill} active />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[color:var(--success)]">Continue</p>
                <span className="hidden h-1 w-1 rounded-full bg-[color:var(--border-strong)] sm:block" aria-hidden />
                <p className="truncate text-sm font-black text-[color:var(--text-heading)]">Acamprosate renal screen</p>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-[color:var(--text-muted)]">
                Ward round · 3 sources · last opened Today 08:44
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <Link
              href="/medications/acamprosate"
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-black text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]",
                focusRing,
              )}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open
            </Link>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
                focusRing,
              )}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Ask
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FavouritesTable() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set([selectedItem.id]));
  const selectedCount = selectedIds.size;

  const tableRows = useMemo(
    () =>
      favouriteItems.map((item) => ({
        ...item,
        selected: selectedIds.has(item.id),
      })),
    [selectedIds],
  );

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="grid gap-3 border-b border-[color:var(--border)] px-3 py-3 xl:grid-cols-[auto_minmax(13rem,1fr)_auto] xl:items-center">
        <ToolbarButton className="justify-between xl:w-36">
          <span>All favourites</span>
          <span className="nums rounded-full bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs">5</span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </ToolbarButton>
        <label className="relative block min-w-0">
          <span className="sr-only">Search within favourites</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
          <input
            type="search"
            placeholder="Search within results..."
            className={cn(
              "h-9 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-9 pr-3 text-sm font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20",
            )}
          />
        </label>
        <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end">
          <ToolbarButton>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Type
          </ToolbarButton>
          <ToolbarButton>
            <Folder className="h-4 w-4" aria-hidden />
            Set
          </ToolbarButton>
          <ToolbarButton>
            <ArrowUpDown className="h-4 w-4" aria-hidden />
            Sort: Last used
          </ToolbarButton>
          <div className="inline-flex h-9 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
            <ToolbarButton active className="h-full rounded-none border-0 border-r border-[color:var(--border)]">
              <List className="h-4 w-4" aria-hidden />
              Table
            </ToolbarButton>
            <ToolbarButton className="h-full rounded-none border-0 px-2.5">
              <LayoutGrid className="h-4 w-4" aria-hidden />
              <span className="sr-only">List view</span>
            </ToolbarButton>
          </div>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-wash)] px-3 py-2">
          <span className="text-sm font-black text-[color:var(--text-heading)]">{selectedCount} selected</span>
          <ToolbarButton>
            <Folder className="h-4 w-4" aria-hidden />
            Move to set
          </ToolbarButton>
          <ToolbarButton>
            <Copy className="h-4 w-4" aria-hidden />
            Copy citation
          </ToolbarButton>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden />
            Clear
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[44rem] w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-11" />
            <col className="w-[34%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="h-12 border-b border-[color:var(--border)] bg-[color:var(--surface)] text-2xs font-black uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              <th scope="col" className="w-12 px-3">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col" className="px-3">
                Item
              </th>
              <th scope="col" className="px-3">
                Type
              </th>
              <th scope="col" className="px-3">
                Set
              </th>
              <th scope="col" className="px-3">
                Evidence
              </th>
              <th scope="col" className="px-3">
                Last used
              </th>
              <th scope="col" className="px-3 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {tableRows.map((item) => {
              const Icon = item.icon;
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "relative h-[5.25rem] transition hover:bg-[color:var(--surface-subtle)]",
                    item.selected &&
                      "bg-[color:var(--clinical-accent-soft)]/45 shadow-[inset_2px_0_0_var(--clinical-accent)]",
                  )}
                >
                  <td className="px-3 align-middle">
                    <button
                      type="button"
                      onClick={() => toggleRow(item.id)}
                      aria-pressed={item.selected}
                      aria-label={`${item.selected ? "Deselect" : "Select"} ${item.title}`}
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded border transition",
                        item.selected
                          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-white"
                          : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                        focusRing,
                      )}
                    >
                      {item.selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    </button>
                  </td>
                  <td className="px-3 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <MiniIconTile icon={Icon} active={item.selected} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[color:var(--text-heading)]">{item.title}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-[color:var(--text-muted)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 align-middle">
                    <SmallChip className={typeStyles[item.type]}>{item.type}</SmallChip>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--text-muted)]">
                      <Folder className="h-3.5 w-3.5" aria-hidden />
                      {item.set}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--clinical-accent)]">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      {item.evidence}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="text-xs font-bold text-[color:var(--text-heading)]">{item.lastUsed}</span>
                  </td>
                  <td className="px-3 align-middle">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={item.href}
                        className={cn(
                          "inline-flex h-9 min-w-16 items-center justify-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-xs font-black text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                          focusRing,
                          item.action === "Run" && "border-violet-300 text-violet-700 hover:bg-violet-50",
                          item.action === "Ask" && "border-blue-300 text-blue-700 hover:bg-blue-50",
                        )}
                      >
                        {item.action}
                      </Link>
                      <button
                        type="button"
                        aria-label={`More actions for ${item.title}`}
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                          focusRing,
                        )}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] px-4 py-2 text-xs font-bold text-[color:var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />5 source-backed items
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Pin className="h-4 w-4" aria-hidden />2 pinned
          </span>
          <span aria-hidden>·</span>
          <span>Favourites updated 08:45</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <ToolbarButton className="h-8 px-3">
            25
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton className="h-8 w-8 px-0" aria-label="Previous page">
            ‹
          </ToolbarButton>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--command)] text-sm font-black text-[color:var(--command-contrast)]">
            1
          </span>
          <ToolbarButton className="h-8 w-8 px-0" aria-label="Next page">
            ›
          </ToolbarButton>
        </div>
      </div>
    </section>
  );
}

function ItemWorkspace() {
  const [activeTab, setActiveTab] = useState<"summary" | "evidence" | "notes">("summary");

  return (
    <aside className="hidden min-w-0 border-l border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-6 2xl:block">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3">
        <h2 className="text-sm font-black text-[color:var(--text-heading)]">Item workspace</h2>
        <button
          type="button"
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
            focusRing,
          )}
          aria-label="Collapse item workspace"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-start gap-3">
          <MiniIconTile icon={Pill} active />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-xl font-black leading-tight text-[color:var(--text-heading)]">
                Acamprosate renal screen
              </h3>
              <button
                type="button"
                className={cn("text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)]", focusRing)}
                aria-label="Pin Acamprosate renal screen"
              >
                <Pin className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SmallChip className={typeStyles.Medication}>Medication</SmallChip>
              <SmallChip className="border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]">
                Source-backed
              </SmallChip>
            </div>
          </div>
        </div>

        <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--text-muted)]">
          Saved in <Folder className="h-4 w-4" aria-hidden />{" "}
          <span className="text-[color:var(--text-heading)]">Ward round</span>
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 border-b border-[color:var(--border)]">
        {[
          ["summary", "Summary"],
          ["evidence", "Evidence"],
          ["notes", "Notes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as "summary" | "evidence" | "notes")}
            className={cn(
              "min-h-10 border-b-2 text-sm font-bold transition",
              activeTab === id
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5">
        <section className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/45 p-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
            Next action
          </p>
          <p className="mt-2 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
            Open for renal dose cautions, eGFR thresholds, and source links.
          </p>
          <Link
            href="/medications/acamprosate"
            className={cn(
              "mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-black text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]",
              focusRing,
            )}
          >
            Open item
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-2 text-xs font-bold text-[color:var(--text-muted)]">Last opened Today 08:44</p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Sources (3)
            </h3>
            <button
              type="button"
              className={cn(
                "inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 text-xs font-black text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                focusRing,
              )}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy citation
            </button>
          </div>
          <div className="grid gap-2">
            {sourceRecords.map((source, index) => (
              <button
                key={source.title}
                type="button"
                className={cn(
                  "grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left hover:bg-[color:var(--surface-subtle)]",
                  focusRing,
                )}
              >
                <span className="nums grid h-5 w-5 place-items-center rounded bg-[color:var(--surface-subtle)] text-xs font-black text-[color:var(--text-muted)]">
                  {index + 1}
                </span>
                <span className="truncate text-xs font-bold text-[color:var(--text-heading)]">{source.title}</span>
                <SmallChip className="border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
                  {source.type}
                </SmallChip>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cn("mt-2 text-xs font-black text-[color:var(--clinical-accent)] hover:underline", focusRing)}
          >
            View all sources
          </button>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Personal note
            </h3>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 text-xs font-black text-[color:var(--clinical-accent)]",
                focusRing,
              )}
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
              Useful for older patients with fluctuating eGFR. Check adherence section on page 4.
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[color:var(--text-muted)]">Updated 11 May 2024</span>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-black text-[color:var(--success)]",
                  focusRing,
                )}
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                Save note
              </button>
            </div>
          </div>
        </section>

        <section className="border-t border-[color:var(--border)] pt-4">
          <h3 className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            Actions
          </h3>
          <div className="grid gap-2">
            {[
              { label: "Ask a question", icon: MessageSquare },
              { label: "Copy citation", icon: Copy },
              { label: "Move to set", icon: Folder },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className={cn(
                    "inline-flex h-9 items-center justify-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
                    focusRing,
                  )}
                >
                  <Icon className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                  {action.label}
                </button>
              );
            })}
            <button
              type="button"
              className={cn(
                "mt-2 inline-flex h-9 items-center justify-start gap-2 rounded-lg border border-[color:var(--danger-border)] bg-transparent px-3 text-sm font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]",
                focusRing,
              )}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove favourite
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function FavouritesCommandLibraryPage() {
  return (
    <main
      data-testid="favourites-command-library"
      className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] pb-32 text-[color:var(--text)] md:pb-0"
    >
      <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[16.5rem_minmax(0,1fr)] 2xl:grid-cols-[16.5rem_minmax(0,1fr)_23rem]">
        <FavouritesSidebar />
        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-7">
          <div className="mx-auto grid max-w-[70rem] gap-5">
            <header>
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                  <Heart className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1 className="text-balance text-2xl font-black leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                    Favourites command library
                  </h1>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--text-muted)]">
                    Your saved clinical knowledge, sets and searches - action-ready and source-backed.
                  </p>
                </div>
              </div>
            </header>
            <ContinueStrip />
            <FavouritesTable />
          </div>
        </div>
        <ItemWorkspace />
      </div>
    </main>
  );
}
