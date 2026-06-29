import Image from "next/image";
import type { Metadata } from "next";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileImage,
  FileSearch,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers3,
  Link2,
  Menu,
  Mic,
  Plus,
  Quote,
  Search,
  Send,
  ShieldCheck,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Evidence Option Mockups - Clinical KB",
  description: "Premium Clinical KB evidence mockups for desktop and mobile.",
};

type EvidenceObject = {
  title: string;
  type: "Table" | "Quote" | "Image" | "PDF region";
  source: string;
  page: string;
  support: string;
  detail: string;
  icon: LucideIcon;
};

const objects: EvidenceObject[] = [
  {
    title: "ANC monitoring frequency table",
    type: "Table",
    source: "Clozapine physical health protocol",
    page: "p.12",
    support: "97% direct",
    detail: "Baseline checks, weekly cadence, and escalation thresholds.",
    icon: Table2,
  },
  {
    title: "Constipation escalation passage",
    type: "Quote",
    source: "Clozapine safety bulletin",
    page: "p.4",
    support: "Exact quote",
    detail: "Same-day review wording for severe constipation symptoms.",
    icon: Quote,
  },
  {
    title: "Observation pathway crop",
    type: "Image",
    source: "Acute behavioural disturbance pathway",
    page: "p.8",
    support: "Visual evidence",
    detail: "Flow diagram, labels, and adjacent explanatory text.",
    icon: FileImage,
  },
];

const objectCounts = [
  ["Tables", "621", Table2],
  ["Quotes", "8,904", Quote],
  ["Images", "2,840", ImageIcon],
  ["PDF regions", "4,221", FileSearch],
  ["Documents", "1,834", FileText],
] as const;

const tableRows = [
  ["Baseline", "FBC, LFT, U&E, lipids, glucose", "Before initiation"],
  ["Weekly", "FBC/ANC", "Initial titration"],
  ["Escalate", "Chest pain, fever, constipation", "Urgent review"],
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function IconTile({ icon: Icon, strong = false }: { icon: LucideIcon; strong?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg shadow-[var(--shadow-inset)]",
        strong
          ? "h-11 w-11 bg-[color:var(--clinical-chat-teal)] text-white"
          : "h-10 w-10 border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function Pill({
  children,
  active = false,
  tone = "neutral",
}: {
  children: ReactNode;
  active?: boolean;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-bold shadow-[var(--shadow-inset)]",
        active && "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
        !active &&
          tone === "success" &&
          "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
        !active &&
          tone === "warning" &&
          "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
        !active &&
          tone === "neutral" &&
          "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function ActionButton({
  children,
  icon: Icon,
  primary = false,
}: {
  children: ReactNode;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-[var(--shadow-inset)] transition",
        focusRing,
        primary
          ? "bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]"
          : "border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  );
}

function Composer({ placeholder = "Ask a clinical question..." }: { placeholder?: string }) {
  return (
    <div className="flex min-h-[56px] items-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 shadow-[var(--shadow-lux)] ring-1 ring-white/35 backdrop-blur-xl">
      <button type="button" aria-label="Add" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Plus className="h-5 w-5" />
      </button>
      <span className="min-w-0 flex-1 truncate px-1 text-base font-medium text-[color:var(--text-soft)]">{placeholder}</span>
      <Mic className="h-5 w-5 shrink-0 text-[color:var(--text-muted)]" />
      <button type="button" aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]">
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

function DesktopChrome({ children, mode = "Evidence" }: { children: ReactNode; mode?: string }) {
  return (
    <div className="relative h-[620px] overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text)] shadow-[0_24px_70px_rgb(15_31_38_/_14%)]">
      <header className="flex h-16 items-center border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 shadow-[var(--shadow-tight)]">
        <button type="button" aria-label="Menu" className="grid h-11 w-11 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Menu className="h-5 w-5" />
        </button>
        <div className="ml-3 inline-grid h-11 min-w-56 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 shadow-[var(--shadow-inset)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white">
            <Layers3 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Mode</span>
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{mode}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-muted)]">
            <BookOpen className="h-4 w-4" /> All sources
          </button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-heading)]">
            <Plus className="h-4 w-4" /> New chat
          </button>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-xs font-bold text-[color:var(--clinical-chat-teal)]">
            AK
          </span>
        </div>
      </header>
      <div className="grid h-[calc(100%-4rem)] grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-4">
          <div className="flex items-center gap-3">
            <IconTile icon={ShieldCheck} />
            <div>
              <p className="font-semibold text-[color:var(--text-heading)]">Clinical Guide</p>
              <p className="text-xs text-[color:var(--text-muted)]">Source-backed workspace</p>
            </div>
          </div>
          <button type="button" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] text-sm font-semibold text-white shadow-[var(--shadow-tight)]">
            <Plus className="h-4 w-4" /> New chat
          </button>
          <div className="mt-5 space-y-1">
            {[
              ["Answer", Activity],
              ["Documents", FileText],
              ["Evidence", Layers3],
              ["Favourites", ClipboardCheck],
            ].map(([label, Icon]) => (
              <div
                key={label as string}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold",
                  label === "Evidence"
                    ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                    : "text-[color:var(--text-muted)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {label as string}
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 left-3 right-[calc(100%-14rem+0.75rem)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
            <p className="text-xs font-bold text-[color:var(--text-soft)]">Indexed evidence</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">18,420</p>
          </div>
        </aside>
        <main className="relative min-w-0 overflow-hidden px-6 py-5">
          {children}
          <div className="absolute inset-x-8 bottom-4">
            <Composer placeholder="Search evidence objects..." />
          </div>
        </main>
      </div>
    </div>
  );
}

function PhoneChrome({ children, sheet = false }: { children: ReactNode; sheet?: boolean }) {
  return (
    <div className="relative h-[620px] overflow-hidden rounded-[2rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text)] shadow-[0_24px_70px_rgb(15_31_38_/_18%)]">
      <header className="flex h-[4.5rem] items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 shadow-[var(--shadow-tight)]">
        <Menu className="h-6 w-6 text-[color:var(--text-muted)]" />
        <div className="inline-grid h-12 min-w-40 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-inset)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white">
            <Layers3 className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Mode</span>
            <span className="block text-sm font-semibold text-[color:var(--text-heading)]">Evidence</span>
          </span>
          <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" />
        </div>
        <Plus className="h-6 w-6 text-[color:var(--text-muted)]" />
      </header>
      <main className={cn("h-[calc(100%-4.5rem)] overflow-hidden", sheet && "bg-[color:var(--text-heading)]/30")}>{children}</main>
      <div className="absolute inset-x-3 bottom-3">
        <Composer placeholder="Search evidence..." />
      </div>
    </div>
  );
}

function MockupPair({
  id,
  title,
  description,
  desktop,
  phone,
}: {
  id: string;
  title: string;
  description: string;
  desktop: ReactNode;
  phone: ReactNode;
}) {
  return (
    <section data-mockup={id} className="rounded-[1.5rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Evidence option</p>
          <h2 className="mt-1 text-xl font-semibold text-[color:var(--text-heading)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p>
        </div>
        <Pill active>PC + phone</Pill>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {desktop}
        <div className="mx-auto w-full max-w-[320px]">{phone}</div>
      </div>
    </section>
  );
}

function EvidenceObjectRow({ item, selected = false }: { item: EvidenceObject; selected?: boolean }) {
  const Icon = item.icon;
  return (
    <div
      className={cn(
        "grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 shadow-[var(--shadow-inset)]",
        selected
          ? "border-[color:var(--clinical-chat-teal)]/30 bg-[color:var(--clinical-chat-teal-soft)]/45"
          : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <IconTile icon={Icon} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{item.title}</p>
          <Pill active={selected}>{item.type}</Pill>
        </div>
        <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">
          {item.source} - {item.page} - {item.support}
        </p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--text-soft)]">{item.detail}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-[color:var(--text-soft)]" />
    </div>
  );
}

function EvidenceHomeDesktop() {
  return (
    <DesktopChrome>
      <div className="mx-auto max-w-3xl pt-12 text-center">
        <IconTile icon={Layers3} strong />
        <h3 className="mt-5 text-3xl font-semibold text-[color:var(--text-heading)]">Evidence</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">
          Find, inspect, and reuse exact tables, images, quotes, PDF regions, and document spans.
        </p>
        <div className="mx-auto mt-7 overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-left shadow-[var(--shadow-soft)]">
          {[
            ["Search evidence objects", "Search every extracted table, quote, figure, and page region", Search],
            ["Review recent evidence", "Continue checking the objects used in recent answers", ClipboardCheck],
            ["Open source map", "Follow an evidence object back through document, section, and page", Link2],
          ].map(([title, body, Icon]) => (
            <div key={title as string} className="grid min-h-[78px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-4 last:border-b-0">
              <IconTile icon={Icon as LucideIcon} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">{title as string}</p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">{body as string}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[color:var(--text-soft)]" />
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-left">
          {objectCounts.slice(0, 3).map(([label, count, Icon]) => (
            <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <span className="text-xs font-bold text-[color:var(--clinical-chat-teal)]">{count}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-heading)]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </DesktopChrome>
  );
}

function EvidenceHomePhone() {
  return (
    <PhoneChrome>
      <div className="px-4 py-5">
        <IconTile icon={Layers3} strong />
        <h3 className="mt-4 text-2xl font-semibold text-[color:var(--text-heading)]">Evidence</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">Open the exact object behind an answer.</p>
        <div className="mt-5 overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]">
          {[
            ["Search evidence", Search],
            ["Recent objects", ClipboardCheck],
            ["Source map", Link2],
          ].map(([label, Icon]) => (
            <div key={label as string} className="grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 last:border-b-0">
              <IconTile icon={Icon as LucideIcon} />
              <p className="font-semibold text-[color:var(--text-heading)]">{label as string}</p>
              <ChevronRight className="h-5 w-5 text-[color:var(--text-soft)]" />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Recent</p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--text-heading)]">ANC monitoring frequency table</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">p.12 - 97% direct</p>
        </div>
      </div>
    </PhoneChrome>
  );
}

function EvidenceSearchDesktop() {
  return (
    <DesktopChrome>
      <div className="grid h-[calc(100%-5rem)] grid-cols-[minmax(0,1fr)_22rem] gap-4 pb-16">
        <section className="min-w-0 space-y-3">
          <div className="flex min-h-14 items-center gap-3 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-4 shadow-[var(--shadow-soft)]">
            <Search className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-heading)]">clozapine constipation monitoring table</span>
            <Filter className="h-4 w-4 text-[color:var(--text-muted)]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill active>All objects</Pill>
            <Pill>Tables</Pill>
            <Pill>Quotes</Pill>
            <Pill>Images</Pill>
            <Pill>Reviewed only</Pill>
          </div>
          <div className="space-y-2">
            {objects.map((item, index) => (
              <EvidenceObjectRow key={item.title} item={item} selected={index === 0} />
            ))}
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Source trail</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
              <Pill active>Clozapine protocol</Pill>
              <ChevronRight className="h-4 w-4" />
              <Pill>Monitoring</Pill>
              <ChevronRight className="h-4 w-4" />
              <Pill>Table 2</Pill>
            </div>
          </div>
        </section>
        <aside className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]">
          <div className="border-b border-[color:var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <IconTile icon={Table2} />
              <Pill tone="success">97% direct</Pill>
            </div>
            <h3 className="mt-3 text-base font-semibold text-[color:var(--text-heading)]">ANC monitoring frequency table</h3>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">Clozapine physical health protocol - p.12</p>
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[color:var(--clinical-chat-table-header)] text-[color:var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-bold">Stage</th>
                    <th className="px-3 py-2 font-bold">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)]">
                  {tableRows.map(([stage, evidence]) => (
                    <tr key={stage}>
                      <td className="px-3 py-2 font-semibold text-[color:var(--text-heading)]">{stage}</td>
                      <td className="px-3 py-2 text-[color:var(--text-muted)]">{evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ActionButton icon={ExternalLink}>Open source</ActionButton>
              <ActionButton icon={Copy}>Copy citation</ActionButton>
            </div>
          </div>
        </aside>
      </div>
    </DesktopChrome>
  );
}

function EvidenceSearchPhone() {
  return (
    <PhoneChrome sheet>
      <div className="h-full px-4 py-4 blur-[1px]">
        <div className="flex min-h-12 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
          <Search className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
          <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">clozapine table</span>
        </div>
        <div className="mt-4 space-y-2">
          {objects.slice(0, 2).map((item) => (
            <EvidenceObjectRow key={item.title} item={item} />
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[72%] rounded-t-[1.75rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[0_28px_90px_rgb(4_24_35_/_36%)]">
        <span className="mx-auto block h-1 w-12 rounded-full bg-[color:var(--border-strong)]/60" />
        <div className="mt-4 flex items-start gap-3">
          <IconTile icon={Table2} />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">ANC monitoring table</h3>
            <p className="mt-1 text-sm font-semibold text-[color:var(--clinical-chat-teal)]">p.12 - 97% direct</p>
          </div>
          <X className="h-5 w-5 text-[color:var(--text-muted)]" />
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
          {tableRows.map(([stage, evidence]) => (
            <div key={stage} className="grid grid-cols-[5.75rem_minmax(0,1fr)] border-b border-[color:var(--border)] last:border-b-0">
              <span className="bg-[color:var(--clinical-chat-table-header)] px-3 py-2 text-xs font-bold text-[color:var(--text-muted)]">{stage}</span>
              <span className="px-3 py-2 text-xs font-semibold text-[color:var(--text-heading)]">{evidence}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ActionButton icon={ExternalLink}>Open</ActionButton>
          <ActionButton icon={Copy} primary>Copy</ActionButton>
        </div>
      </div>
    </PhoneChrome>
  );
}

function EvidenceDetailDesktop() {
  return (
    <DesktopChrome>
      <div className="h-[calc(100%-5rem)] pb-16">
        <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]">
          <header className="border-b border-[color:var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <IconTile icon={Quote} />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Constipation escalation passage</h3>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--clinical-chat-teal)]">Clozapine safety bulletin - p.4 - exact extracted quote</p>
                </div>
              </div>
              <Pill tone="success">
                <BadgeCheck className="h-3.5 w-3.5" /> Reviewed
              </Pill>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill active>Quote</Pill>
              <Pill>Table</Pill>
              <Pill>Image</Pill>
              <Pill>PDF region</Pill>
              <Pill>Document context</Pill>
            </div>
          </header>
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_15rem] gap-3">
              <figure className="rounded-xl border border-[color:var(--border-lux)] border-l-4 border-l-[color:var(--clinical-chat-teal)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
                <blockquote className="text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
                  &quot;Patients reporting severe constipation, abdominal pain, vomiting, or reduced bowel motions require same-day clinical review.&quot;
                </blockquote>
                <figcaption className="mt-2 text-xs font-semibold text-[color:var(--text-muted)]">Direct wording used in answer support.</figcaption>
              </figure>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Citation packet</p>
                <div className="mt-2 space-y-1.5">
                  {["Document", "Page", "Section", "Quote span", "Reviewed"].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-md bg-[color:var(--surface-raised)] px-2 py-1.5 text-[11px] font-semibold text-[color:var(--text-muted)]">
                      {item}
                      <Check className="h-3.5 w-3.5 text-[color:var(--clinical-chat-teal)]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                <Image src="/demo-documents/clozapine-table.png" alt="Clozapine monitoring table evidence crop" width={560} height={320} className="h-24 w-full object-cover object-top" />
                <p className="px-2 py-1.5 text-xs font-bold text-[color:var(--text-heading)]">Linked table</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                <Image src="/demo-documents/risk-flow.png" alt="Risk flow evidence image crop" width={560} height={320} className="h-24 w-full object-cover object-center" />
                <p className="px-2 py-1.5 text-xs font-bold text-[color:var(--text-heading)]">Linked image</p>
              </div>
              <div className="rounded-lg border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] p-3">
                <p className="text-xs font-bold text-[color:var(--text-heading)]">Document context</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">Previous and next paragraphs retained with page coordinates.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DesktopChrome>
  );
}

function EvidenceDetailPhone() {
  return (
    <PhoneChrome sheet>
      <div className="h-full px-4 py-4 blur-[1px]">
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">Clozapine evidence</p>
        <div className="mt-3 space-y-2">
          {objects.map((item) => (
            <EvidenceObjectRow key={item.title} item={item} selected={item.type === "Quote"} />
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[78%] overflow-hidden rounded-t-[1.75rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[0_28px_90px_rgb(4_24_35_/_36%)]">
        <div className="border-b border-[color:var(--border)] px-4 pb-3 pt-3">
          <span className="mx-auto block h-1 w-12 rounded-full bg-[color:var(--border-strong)]/60" />
          <div className="mt-4 flex items-start gap-3">
            <IconTile icon={Quote} />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Constipation escalation passage</h3>
              <p className="mt-1 text-xs font-semibold text-[color:var(--clinical-chat-teal)]">Exact quote - p.4</p>
            </div>
            <X className="h-5 w-5 text-[color:var(--text-muted)]" />
          </div>
          <div className="mt-3 flex gap-2 overflow-hidden">
            <Pill active>Quote</Pill>
            <Pill>Image</Pill>
            <Pill>Context</Pill>
          </div>
        </div>
        <div className="max-h-[22rem] space-y-3 overflow-hidden p-4">
          <figure className="rounded-xl border border-[color:var(--border-lux)] border-l-4 border-l-[color:var(--clinical-chat-teal)] bg-[color:var(--surface)] p-4">
            <blockquote className="text-base font-semibold leading-7 text-[color:var(--text-heading)]">
              &quot;Patients reporting severe constipation, abdominal pain, vomiting, or reduced bowel motions require same-day clinical review.&quot;
            </blockquote>
          </figure>
          <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
            <Image src="/demo-documents/risk-flow.png" alt="Risk flow evidence image crop" width={560} height={320} className="h-32 w-full object-cover object-center" />
          </div>
        </div>
        <footer className="grid grid-cols-2 gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)]/96 p-3">
          <ActionButton icon={ExternalLink}>Open</ActionButton>
          <ActionButton icon={Copy} primary>Copy quote</ActionButton>
        </footer>
      </div>
    </PhoneChrome>
  );
}

export default function EvidenceOptionMockupsPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="rounded-[1.5rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <IconTile icon={Layers3} />
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Clinical KB evidence option</p>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)]">Premium evidence mockups</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                Three product-native mockups for evidence home, evidence search, and individual evidence review. Each pairs the PC layout with the phone bottom-sheet treatment.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill active>Source-backed</Pill>
              <Pill>Tables</Pill>
              <Pill>Images</Pill>
              <Pill>Quotes</Pill>
            </div>
          </div>
        </header>

        <MockupPair
          id="home"
          title="1. Evidence home"
          description="A focused mode home: search evidence, review recent objects, or open the source map without turning the feature into a dashboard."
          desktop={<EvidenceHomeDesktop />}
          phone={<EvidenceHomePhone />}
        />

        <MockupPair
          id="search"
          title="2. Evidence search"
          description="Search results prioritise clinical objects with provenance, confidence, and immediate inspection actions."
          desktop={<EvidenceSearchDesktop />}
          phone={<EvidenceSearchPhone />}
        />

        <MockupPair
          id="detail"
          title="3. Individual evidence"
          description="A premium evidence detail view for quotes, tables, images, PDF regions, and document context with citation actions."
          desktop={<EvidenceDetailDesktop />}
          phone={<EvidenceDetailPhone />}
        />
      </div>
    </main>
  );
}
