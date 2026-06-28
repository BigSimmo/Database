import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Brain,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Droplet,
  FileText,
  FlaskConical,
  Lock,
  Mic,
  Paperclip,
  Pill,
  Plus,
  Send,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type LedgerColumn = {
  label: string;
  value: string;
  meta?: string;
};

type LedgerRowData = {
  label: string;
  icon: LucideIcon;
  body?: string | readonly string[];
  columns?: readonly LedgerColumn[];
  tone?: "danger";
  compact?: boolean;
};

const badges = ["333 mg EC tablet", "PBS streamlined", "Reviewed"] as const;

const decisionTiles = [
  {
    label: "Prescribing answer",
    value: "Maintenance after detox",
    meta: "with psychosocial support",
    icon: CheckCircle2,
    tone: "teal",
  },
  {
    label: "Dosing",
    value: "666 mg TID",
    meta: "2 x 333 mg",
    icon: CalendarDays,
    tone: "teal",
  },
  {
    label: "Dose ceiling",
    value: "1,998 mg/day",
    meta: "MAX",
    icon: ChartNoAxesColumnIncreasing,
    tone: "teal",
  },
  {
    label: "Avoid",
    value: "Cr >120",
    meta: "micromol/L",
    icon: AlertTriangle,
    tone: "danger",
  },
] as const;

const ledgerRows: readonly LedgerRowData[] = [
  {
    label: "Prescribing answer",
    icon: ClipboardList,
    body: [
      "Use for maintenance of abstinence after detox when renal function is acceptable.",
      "Start after withdrawal and continue if relapse occurs. Not for use in acute withdrawal.",
    ],
  },
  {
    label: "Dosing",
    icon: CalendarDays,
    columns: [
      { label: "Usual dose", value: "666 mg (2 x 333 mg) TID with meals" },
      { label: "Dose ceiling", value: "1,998 mg/day", meta: "MAX" },
      { label: "Under 60 kg", value: "2 tablets morning, 1 midday, 1 night" },
      { label: "Treatment duration", value: "Around 1 year" },
    ],
  },
  {
    label: "Administration",
    icon: Pill,
    body: ["Take with food. Swallow EC tablets whole with water.", "Do not crush or chew."],
  },
  {
    label: "Do not use",
    icon: AlertTriangle,
    tone: "danger",
    body: [
      "Renal insufficiency: serum creatinine >120 micromol/L (contraindicated)",
      "Severe hepatic failure (Child-Pugh C) (contraindicated)",
      "Pregnancy (DO NOT USE)",
      "Breastfeeding (DO NOT USE)",
    ],
  },
  {
    label: "Populations",
    icon: UserRound,
    body: "Avoid in children/adolescents under 18 years and in adults over 65 years: safety and efficacy not established.",
  },
  {
    label: "Key risks",
    icon: ShieldCheck,
    columns: [
      { label: "GI", value: "Diarrhea, nausea, flatulence (high)" },
      { label: "Dermatologic", value: "Rash, pruritus" },
      { label: "Neuropsychiatric", value: "Mood swings, depression" },
    ],
  },
  {
    label: "Pearls / PK",
    icon: FlaskConical,
    compact: true,
    body: "Mechanism not fully established  -  Not metabolized; excreted unchanged in urine  -  Half-life 13-28.4 h  -  Minimal protein binding",
  },
] as const;

const monitoringRows = [
  { label: "Renal", body: "Check baseline and periodically", icon: Droplet },
  { label: "Hepatic (severe disease)", body: "Assess if severe liver disease suspected", icon: ShieldCheck },
  { label: "Mood / suicidality", body: "Monitor, especially early treatment", icon: Brain },
  { label: "Adherence", body: "Reinforce adherence and support", icon: ClipboardCheck },
] as const;

const interactionRows = [
  "Diazepam, disulfiram, imipramine: no major PK interactions.",
  "Naltrexone: increases acamprosate exposure; no dose adjustment required.",
  "Other psychotropics: not well studied.",
] as const;

const mobileRows = [
  {
    label: "Prescribing answer",
    icon: ClipboardList,
    body: "Use for maintenance after detox when renal function is acceptable. Start after withdrawal and continue if relapse occurs.",
  },
  {
    label: "Dosing",
    icon: CalendarDays,
    body: "Usual: 666 mg (2 x 333 mg) TID with meals. Max: 1,998 mg/day. <60 kg: 2 tabs morning, 1 midday, 1 night. Duration: around 1 year.",
  },
  {
    label: "Administration",
    icon: Pill,
    body: "Take with food. Swallow EC tablets whole with water. Do not crush or chew.",
  },
  {
    label: "Do not use",
    icon: AlertTriangle,
    body: "Renal insufficiency (Cr >120), severe hepatic failure (Child-Pugh C), pregnancy, breastfeeding.",
    tone: "danger",
  },
  {
    label: "Populations",
    icon: UserRound,
    body: "Avoid <18 years and >65 years: safety and efficacy not established.",
  },
] as const;

function IconFrame({
  icon: Icon,
  tone = "teal",
  className = "h-9 w-9",
}: {
  icon: LucideIcon;
  tone?: "teal" | "danger" | "slate";
  className?: string;
}) {
  return (
    <span
      className={[
        "grid shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
        tone === "danger"
          ? "border-red-300 bg-red-50 text-red-600"
          : tone === "slate"
            ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
            : "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
        className,
      ].join(" ")}
    >
      <Icon className="h-[54%] w-[54%]" aria-hidden="true" />
    </span>
  );
}

function TopNav({ compact = false }: { compact?: boolean }) {
  return (
    <header
      className={[
        "grid items-center border-b border-[color:var(--border)] bg-white",
        compact ? "h-[78px] grid-cols-[1fr_auto] px-5 pt-5" : "h-[68px] grid-cols-[1fr_auto_1fr] px-9",
      ].join(" ")}
    >
      <h1
        className={
          compact
            ? "text-base font-bold text-[color:var(--text-heading)]"
            : "text-2xl font-bold text-[color:var(--text-heading)]"
        }
      >
        Clinical KB
      </h1>
      <nav className={compact ? "col-span-2 mt-3 grid grid-cols-3 text-center" : "flex items-center gap-14"}>
        {["Answer", "Sources", "Medication"].map((item) => (
          <span
            key={item}
            className={[
              "relative pb-4 text-sm font-medium",
              item === "Medication"
                ? "font-semibold text-[color:var(--clinical-chat-teal)] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[color:var(--clinical-chat-teal)]"
                : "text-[color:var(--text-muted)]",
            ].join(" ")}
          >
            {item}
          </span>
        ))}
      </nav>
    </header>
  );
}

function MedicationBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div className={["flex", compact ? "mt-2 flex-nowrap gap-1" : "mt-3 flex-wrap gap-2"].join(" ")}>
      {badges.map((badge, index) => (
        <span
          key={badge}
          className={[
            "inline-flex items-center gap-1.5 rounded-md border font-semibold shadow-[var(--shadow-inset)]",
            compact ? "min-h-[22px] px-1.5 text-[9.5px]" : "min-h-7 px-3 text-xs",
            index === 2
              ? "border-emerald-500/20 bg-emerald-50 text-emerald-700"
              : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
          ].join(" ")}
        >
          {index === 2 ? <BadgeCheck className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" /> : null}
          {badge}
        </span>
      ))}
    </div>
  );
}

function MedicationHeader({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section>
        <div className="flex items-start gap-3">
          <IconFrame icon={Pill} className="h-14 w-14 rounded-lg" />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-[color:var(--text-heading)]">Acamprosate</h2>
            <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              Alcohol abstinence maintenance <span className="mx-1.5 text-[color:var(--text-soft)]">·</span> GABA /
              glutamate modulator
            </p>
          </div>
        </div>
        <MedicationBadges compact />
      </section>
    );
  }

  return (
    <section className="flex items-center gap-10">
      <IconFrame icon={Pill} className="h-[88px] w-[88px] rounded-xl" />
      <div className="min-w-0">
        <h2 className="text-[2.35rem] font-bold leading-none text-[color:var(--text-heading)]">Acamprosate</h2>
        <p className="mt-3 text-base font-medium text-[color:var(--text-muted)]">
          Alcohol abstinence maintenance <span className="mx-2 text-[color:var(--text-soft)]">·</span> GABA / glutamate
          modulator
        </p>
        <MedicationBadges />
      </div>
    </section>
  );
}

function DecisionTile({ tile, compact = false }: { tile: (typeof decisionTiles)[number]; compact?: boolean }) {
  const danger = tile.tone === "danger";
  const compactBody =
    tile.label === "Prescribing answer" || tile.label === "Avoid" ? `${tile.value} ${tile.meta}` : tile.value;
  const showMeta = !compact || (tile.label !== "Prescribing answer" && tile.label !== "Avoid");

  return (
    <article
      className={[
        "rounded-lg border bg-white shadow-[var(--shadow-inset)]",
        compact ? "min-h-[82px] p-2.5" : "min-h-[96px] p-4",
        danger ? "border-red-300 bg-red-50/25" : "border-[color:var(--border)]",
      ].join(" ")}
    >
      <div className={compact ? "flex items-start gap-2" : "flex items-start gap-3"}>
        <IconFrame icon={tile.icon} tone={danger ? "danger" : "teal"} className={compact ? "h-6 w-6" : "h-9 w-9"} />
        <div className="min-w-0">
          <p
            className={[
              compact ? "text-[10px] leading-3" : "text-sm",
              "font-bold",
              danger ? "text-red-600" : "text-[color:var(--text-heading)]",
            ].join(" ")}
          >
            {tile.label}
          </p>
          <p
            className={[
              compact ? "mt-0.5 text-[10px] leading-3" : "mt-1 text-sm leading-5",
              "text-[color:var(--text-heading)]",
            ].join(" ")}
          >
            {compact ? compactBody : tile.value}
          </p>
          {showMeta ? (
            <p
              className={[
                compact ? "text-[10px] leading-3" : "text-xs leading-5",
                tile.meta === "MAX" ? "font-semibold uppercase tracking-[0.06em]" : "",
                "text-[color:var(--text-muted)]",
              ].join(" ")}
            >
              {tile.meta}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function normalizeBody(body: string | readonly string[] | undefined): readonly string[] {
  if (!body) {
    return [];
  }

  return typeof body === "string" ? [body] : body;
}

function LedgerRow({ row }: { row: (typeof ledgerRows)[number] }) {
  const Icon = row.icon;
  const danger = row.tone === "danger";
  const body = normalizeBody(row.body);
  const columns = row.columns;

  return (
    <div className="grid min-h-[64px] grid-cols-[190px_minmax(0,1fr)] border-b border-[color:var(--border)] last:border-b-0">
      <div className="flex items-center gap-3 px-4">
        <IconFrame icon={Icon} tone={danger ? "danger" : "teal"} className="h-9 w-9" />
        <p
          className={["text-[13px] font-bold", danger ? "text-red-600" : "text-[color:var(--text-heading)]"].join(" ")}
        >
          {row.label}
        </p>
      </div>
      <div className="min-w-0 px-4 py-2.5 text-[13px] leading-5 text-[color:var(--text-heading)]">
        {columns ? (
          <div className={["grid gap-3", columns.length === 4 ? "grid-cols-4" : "grid-cols-3"].join(" ")}>
            {columns.map((column, index) => (
              <div key={column.label} className={index === 0 ? "" : "border-l border-[color:var(--border)] pl-4"}>
                <p className="text-xs font-bold text-[color:var(--text-heading)]">{column.label}</p>
                <p className="mt-1 leading-5">{column.value}</p>
                {"meta" in column && column.meta ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                    {column.meta}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : danger ? (
          <ul className="grid gap-1">
            {body.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              {body.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            {row.compact ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function MonitoringPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-white shadow-[var(--shadow-inset)]">
      <div className={compact ? "flex items-center gap-2 px-3 py-2.5" : "flex items-center gap-3 px-4 pt-3"}>
        <Activity className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h3
          className={
            compact
              ? "text-sm font-bold text-[color:var(--text-heading)]"
              : "text-base font-bold text-[color:var(--text-heading)]"
          }
        >
          Checks and monitoring
        </h3>
      </div>
      <div
        className={
          compact
            ? "divide-y divide-[color:var(--border)] px-3 pb-1"
            : "divide-y divide-[color:var(--border)] px-4 py-2"
        }
      >
        {monitoringRows.map((item) => (
          <div key={item.label} className={compact ? "flex gap-2 py-2" : "flex gap-3 py-2.5 first:pt-2 last:pb-1"}>
            <IconFrame icon={item.icon} className={compact ? "h-7 w-7" : "h-8 w-8"} />
            <div>
              <p
                className={
                  compact
                    ? "text-xs font-bold text-[color:var(--text-heading)]"
                    : "text-sm font-bold text-[color:var(--text-heading)]"
                }
              >
                {item.label}
              </p>
              <p
                className={
                  compact
                    ? "mt-0.5 text-[11px] leading-4 text-[color:var(--text-muted)]"
                    : "mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]"
                }
              >
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InteractionsPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-white p-4 shadow-[var(--shadow-inset)]">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h3 className="text-base font-bold text-[color:var(--text-heading)]">Interactions</h3>
      </div>
      <ul className="mt-3 grid gap-2 text-[13px] leading-5 text-[color:var(--text-heading)]">
        {interactionRows.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--text-heading)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccessPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-white p-4 shadow-[var(--shadow-inset)]">
      <div className="flex items-center gap-3">
        <Lock className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h3 className="text-base font-bold text-[color:var(--text-heading)]">Access</h3>
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        {[
          ["Brand", "Campral"],
          ["PBS status", "PBS streamlined"],
          ["PBS item", "8357W"],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={[
              "flex justify-between gap-4",
              index < 2 ? "border-b border-[color:var(--border)] pb-2" : "",
            ].join(" ")}
          >
            <dt className="font-bold text-[color:var(--text-heading)]">{label}</dt>
            <dd className="font-medium text-[color:var(--text-muted)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SourcesRow({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={[
        "flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-white shadow-[var(--shadow-inset)]",
        compact ? "min-h-10 px-3" : "min-h-14 px-4",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <FileText className="h-4.5 w-4.5 text-[color:var(--text-muted)]" aria-hidden="true" />
        <p
          className={
            compact
              ? "text-xs font-bold text-[color:var(--text-heading)]"
              : "text-sm font-bold text-[color:var(--text-heading)]"
          }
        >
          Sources and provenance
        </p>
      </div>
      <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
    </section>
  );
}

function DesktopComposer() {
  return (
    <footer className="mt-4 rounded-xl border border-[color:var(--border)] bg-white p-2.5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3">
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-white text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
          type="button"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-h-10 flex-1 items-center rounded-lg border border-[color:var(--border)] bg-white px-4 text-sm font-medium text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          Ask follow-up or add context...
        </div>
        <Paperclip className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
        <Mic className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
        <button
          className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-soft)]"
          type="button"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}

function DesktopMockup() {
  return (
    <section className="min-h-[1024px] flex-1 overflow-hidden rounded-xl border border-[color:var(--border)] bg-white shadow-[var(--shadow-soft)]">
      <TopNav />
      <div className="grid gap-4 px-9 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <MedicationHeader />
          <div className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-3">
            {decisionTiles.map((tile) => (
              <DecisionTile key={tile.label} tile={tile} />
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-white shadow-[var(--shadow-inset)]">
            {ledgerRows.map((row) => (
              <LedgerRow key={row.label} row={row} />
            ))}
          </section>
          <DesktopComposer />
        </div>
        <aside className="space-y-3 pt-[116px]">
          <MonitoringPanel />
          <InteractionsPanel />
          <AccessPanel />
          <SourcesRow />
        </aside>
      </div>
    </section>
  );
}

function MobileTabs() {
  return (
    <div className="grid grid-cols-4 border-b border-[color:var(--border)] text-center">
      {["Summary", "Dosing", "Safety", "More"].map((tab, index) => (
        <span
          key={tab}
          className={[
            "relative py-3 text-xs font-bold",
            index === 0
              ? "text-[color:var(--clinical-chat-teal)] after:absolute after:inset-x-4 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[color:var(--clinical-chat-teal)]"
              : "text-[color:var(--text-muted)]",
          ].join(" ")}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

function MobileRow({ row }: { row: (typeof mobileRows)[number] }) {
  const danger = "tone" in row && row.tone === "danger";
  return (
    <div className="flex gap-3 border-b border-[color:var(--border)] px-3 py-2.5 last:border-b-0">
      <IconFrame icon={row.icon} tone={danger ? "danger" : "teal"} className="h-7 w-7" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={["text-[11px] font-bold", danger ? "text-red-600" : "text-[color:var(--text-heading)]"].join(
              " ",
            )}
          >
            {row.label}
          </p>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
        </div>
        <p className="mt-1 text-[10.5px] leading-[1.42] text-[color:var(--text-muted)]">{row.body}</p>
      </div>
    </div>
  );
}

function MobileCollapsedRow({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="flex min-h-9 items-center justify-between border-b border-[color:var(--border)] px-3 last:border-b-0">
      <span className="flex items-center gap-2 text-[11px] font-bold text-[color:var(--text-heading)]">
        <Icon className="h-3.5 w-3.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        {label}
      </span>
      <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden="true" />
    </div>
  );
}

function MobileComposer() {
  return (
    <footer className="sticky bottom-0 border-t border-[color:var(--border)] bg-white px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-white text-[color:var(--text-muted)]"
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex h-8 flex-1 items-center rounded-lg border border-[color:var(--border)] bg-white px-3 text-[11px] font-medium text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          Ask follow-up...
        </div>
        <Paperclip className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
        <Mic className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-soft)]"
          type="button"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}

function PhoneMockup() {
  return (
    <aside className="h-[1020px] w-[344px] shrink-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-white shadow-[var(--shadow-soft)]">
      <TopNav compact />
      <div className="h-[942px] overflow-hidden">
        <div className="space-y-3 px-4 py-5">
          <MedicationHeader compact />
          <div className="grid grid-cols-2 gap-2">
            {decisionTiles.map((tile) => (
              <DecisionTile key={tile.label} tile={tile} compact />
            ))}
          </div>
          <MobileTabs />
          <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-white shadow-[var(--shadow-inset)]">
            {mobileRows.map((row) => (
              <MobileRow key={row.label} row={row} />
            ))}
          </section>
          <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-white shadow-[var(--shadow-inset)]">
            <MobileCollapsedRow label="Key risks" icon={ShieldCheck} />
            <MobileCollapsedRow label="Interactions" icon={ArrowLeftRight} />
            <MobileCollapsedRow label="Access" icon={Lock} />
            <MobileCollapsedRow label="Sources and provenance" icon={FileText} />
          </section>
        </div>
        <MobileComposer />
      </div>
    </aside>
  );
}

export default function MedicationPrescribingMockupsPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] p-0 text-[color:var(--text)]">
      <div className="mx-auto flex max-w-[1536px] items-start gap-3">
        <DesktopMockup />
        <PhoneMockup />
      </div>
    </main>
  );
}
