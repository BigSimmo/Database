"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  CircleCheck,
  ChevronRight,
  Clipboard,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Info,
  MapPin,
  Navigation,
  Phone,
  Route,
  Scale,
  ShieldCheck,
  Tag,
  UserRound,
  X,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  cn,
  codeText,
  floatingControl,
  metadataPill,
  pageContainer,
  primaryControl,
  textMuted,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { FormCodeBadge, splitFormCode } from "@/components/forms/form-code-badge";
import { appModeHomeHref } from "@/lib/app-modes";
import { formCatalogDetails, formTitleForCode, type FormRecord } from "@/lib/form-catalog";
import type { ServiceChipTone, ServiceContact, ServiceCriterion, ServiceSummaryCard } from "@/lib/service-ranker";
import { useAccountData } from "@/components/account-data-provider";

const missingText = "Not listed";

function hasText(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function displayText(value: string | null | undefined, fallback = missingText) {
  return hasText(value) ? value.trim() : fallback;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy selection path for restricted browser contexts.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    const copied = document.execCommand?.("copy");
    if (copied === false) throw new Error("copy command rejected");
  } finally {
    document.body.removeChild(textArea);
  }
}

function chipToneClass(tone: ServiceChipTone | null | undefined) {
  if (tone === "danger") return toneDanger;
  if (tone === "info") return toneInfo;
  if (tone === "warning") return toneWarning;
  if (tone === "success") return toneSuccess;
  return toneNeutral;
}

export function sourceToneClass(form: FormRecord) {
  const status = form.source?.status?.toLowerCase() ?? "";
  if (/required|review|unverified|not verified|unchecked|pending|unknown|confirm/.test(status)) return toneWarning;
  if (form.verification?.locallyVerified === true) return toneSuccess;
  return toneNeutral;
}

function formCode(form: FormRecord) {
  const details = formCatalogDetails(form);
  if (details?.form) return details.form;
  if (form.slug.includes("transport")) return "4A";
  if (form.slug.includes("capacity")) return "CAP";
  if (form.slug.includes("clozapine")) return "CLZ";
  if (form.slug.includes("handover")) return "SAFE";
  return form.title
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function formShortTitle(form: FormRecord) {
  const details = formCatalogDetails(form);
  return details?.form ? `Form ${details.form}` : displayText(form.catalogueLabel, "Form");
}

function summaryIcon(card: ServiceSummaryCard) {
  const label = `${card.id} ${card.label} ${card.title}`.toLowerCase();
  const Icon = label.includes("clock")
    ? Clock3
    : label.includes("destination") || label.includes("place") || label.includes("route")
      ? MapPin
      : label.includes("authority") || label.includes("maker")
        ? UserRound
        : label.includes("criteria") || label.includes("threshold")
          ? Scale
          : ClipboardList;
  return <Icon className="h-5 w-5" aria-hidden />;
}

function summaryCardsFor(form: FormRecord): ServiceSummaryCard[] {
  if (form.summaryCards?.length) return form.summaryCards.slice(0, 4);

  return [
    { id: "route", label: "Route", title: "Use pathway", detail: form.route },
    { id: "eligibility", label: "Eligibility", title: "Patient fit", detail: form.eligibility },
    { id: "authority", label: "Authority", title: "Referral / maker", detail: form.referral },
    { id: "source", label: "Source", title: form.source?.status, detail: form.source?.label },
  ];
}

function joinNotes(notes: string[] | null | undefined) {
  if (!notes?.length) return undefined;
  return notes
    .map((note) => note.trim())
    .filter(Boolean)
    .map((note) => (/[.!?]$/.test(note) ? note : `${note}.`))
    .join(" ");
}

function detailRowsFor(form: FormRecord) {
  const referralRows = form.referralInfo?.length
    ? form.referralInfo
    : [
        { label: "Use only when", value: form.eligibility },
        { label: "Before signing", value: form.referral },
        { label: "Clinical pearls", value: form.bestUse },
        { label: "Source details", value: form.source?.label },
      ];

  return [
    ...referralRows,
    { label: "Verification", value: joinNotes(form.verification?.notes) },
    { label: "Related pathway", value: form.route },
  ].filter((row) => hasText(row.value));
}

export function formDetailsClipboardText(form: FormRecord) {
  const lines = [form.title, `Form code: ${formCode(form)}`];

  if (hasText(form.subtitle)) lines.push(displayText(form.subtitle));
  const statuses = (form.statusChips ?? []).map((chip) => chip.label?.trim()).filter(hasText);
  if (statuses.length) lines.push(`Status: ${statuses.join(", ")}`);

  for (const card of summaryCardsFor(form)) {
    const label = displayText(card.label, "Priority fact");
    const values = [card.title, card.detail].filter(hasText).map((value) => value.trim());
    if (values.length) lines.push(`${label}: ${values.join(" — ")}`);
  }

  if (hasText(form.bestUse)) lines.push(`Legal boundary: ${displayText(form.bestUse)}`);
  for (const row of detailRowsFor(form)) lines.push(`${row.label}: ${displayText(row.value)}`);

  const primaryContact = hasText(form.primaryContact?.value)
    ? form.primaryContact
    : form.contacts?.find((contact) => hasText(contact.value));
  if (primaryContact) {
    lines.push(`${displayText(primaryContact.label, "Contact")}: ${displayText(primaryContact.value)}`);
  }

  if (hasText(form.source?.label)) lines.push(`Source: ${displayText(form.source.label)}`);
  if (hasText(form.source?.status)) lines.push(`Source status: ${displayText(form.source.status)}`);
  if (hasText(form.source?.reviewed)) lines.push(`Source reviewed: ${displayText(form.source.reviewed)}`);
  if (hasText(form.source?.url)) lines.push(`Source URL: ${displayText(form.source.url)}`);

  return lines.join("\n");
}

function callHref(contact: ServiceContact | null) {
  if (!contact || contact.kind !== "phone" || !hasText(contact.value)) return null;
  return `tel:${contact.value.replace(/[^\d+]/g, "")}`;
}

function criterionToneClass(tone: ServiceCriterion["tone"]) {
  if (tone === "meet") return toneSuccess;
  if (tone === "reject") return toneDanger;
  return toneWarning;
}

function DetailCard({ card }: { card: ServiceSummaryCard }) {
  return (
    <article className="min-h-[5.75rem] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-1.5 shadow-[var(--shadow-inset)] sm:min-h-[7rem] sm:p-3">
      <div className="mb-1 flex items-start gap-1.5 sm:mb-2 sm:gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] sm:h-9 sm:w-9">
          {summaryIcon(card)}
        </span>
        <p className="min-w-0 pt-0.5 text-2xs font-bold uppercase leading-4 text-[color:var(--text-muted)]">
          {displayText(card.label, "Priority fact")}
        </p>
      </div>
      <h3 className="text-xs font-semibold leading-[15px] text-[color:var(--text-heading)] sm:text-sm sm:leading-5">
        {displayText(card.title)}
      </h3>
      <p className={cn("mt-0.5 text-2xs font-medium leading-4 sm:mt-1 sm:text-xs sm:leading-5", textMuted)}>
        {displayText(card.detail)}
      </p>
    </article>
  );
}

// Compact code cell for the pathway before/parallel/after lists. Visually it
// shows only the short head ("6B") so a qualifier like "6B attachment" can't
// overflow the fixed-width column, but the full code is exposed to assistive
// tech via an sr-only label (the decorative head is aria-hidden) and to sighted
// users via a tooltip — matching FormCodeBadge's pattern.
function PathwayStepCode({ code }: { code: string }) {
  const { head, qualifier } = splitFormCode(code);
  const fullCode = qualifier ? `${head} ${qualifier}` : head;
  return (
    <span
      className={cn("truncate text-sm font-bold text-[color:var(--text-heading)]", codeText)}
      title={qualifier ? fullCode : undefined}
    >
      <span className="sr-only">{fullCode}</span>
      <span aria-hidden>{head}</span>
    </span>
  );
}

function PathwayContextCard({
  form,
  code,
  criteria,
  testId,
}: {
  form: FormRecord;
  code: string;
  criteria: ServiceCriterion[];
  testId?: string;
}) {
  const details = formCatalogDetails(form);
  const [activeTab, setActiveTab] = useState<"pathway" | "source">("pathway");
  const pathwayItems = (items: string[] | undefined, emptyTitle: string, emptyMeta: string) =>
    items?.length
      ? items.map((item) => {
          const knownTitle = formTitleForCode(item);
          return {
            code: knownTitle ? item : "Context",
            title: knownTitle ?? item,
            meta: knownTitle ? `Form ${item}` : "Pathway step",
            isEmpty: false,
          };
        })
      : [{ code: "None", title: emptyTitle, meta: emptyMeta, isEmpty: true }];
  const beforeForms = pathwayItems(details?.before, "No form is listed before this step", "No prior form");
  const parallelForms = pathwayItems(details?.parallel, "No parallel form is listed for this step", "No parallel form");
  const afterForms = pathwayItems(
    details?.after,
    "No next form is listed; confirm the lawful off-ramp or local workflow",
    "No next form",
  );
  const confirmChecks = [
    ...(details?.preUseChecks ?? []),
    ...(details?.copies ? [details.copies] : []),
    ...(details?.safetyPearl ? [details.safetyPearl] : []),
  ].filter((value, index, values) => value.trim().length > 0 && values.indexOf(value) === index);

  return (
    <section
      data-testid={testId}
      className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Navigation className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">Decision context</h2>
        </div>
        <Info className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      </div>
      <div
        className="grid grid-cols-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 text-xs font-semibold"
        role="tablist"
        aria-label="Decision context sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pathway"}
          onClick={() => setActiveTab("pathway")}
          className={cn(
            "rounded-md px-3 py-2 text-center transition",
            activeTab === "pathway"
              ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          Pathway
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "source"}
          onClick={() => setActiveTab("source")}
          className={cn(
            "rounded-md px-3 py-2 text-center transition",
            activeTab === "source"
              ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          Source info
        </button>
      </div>
      {activeTab === "pathway" ? (
        <div className="mt-3 space-y-3 border-l border-[color:var(--border-strong)] pl-4">
          <div className="relative">
            <span className="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)]" />
            <p className="text-2xs font-bold uppercase text-[color:var(--text-soft)]">Before</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
              {beforeForms.map((item) => (
                <div
                  key={`${item.code}-${item.title}`}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2 border-b border-[color:var(--border)] p-2.5 last:border-b-0"
                >
                  <PathwayStepCode code={item.code} />
                  <p
                    className={cn(
                      "text-xs font-medium leading-5",
                      item.isEmpty ? textMuted : "text-[color:var(--text-heading)]",
                    )}
                  >
                    <span className="font-semibold">{item.meta}</span>
                    {item.isEmpty ? "" : " — "}
                    {item.isEmpty ? item.title : <span className={textMuted}>{item.title}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]/35 p-3">
            <span className="absolute -left-[1.55rem] top-4 h-4 w-4 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--clinical-accent)]" />
            <p className="mb-2 text-2xs font-bold uppercase text-[color:var(--text-soft)]">Current</p>
            <div className="flex items-center gap-2.5">
              <FormCodeBadge code={code} variant="sm" />
              <p className="min-w-0 text-sm font-semibold text-[color:var(--text-heading)]">{form.title}</p>
            </div>
            <span className="mt-2 inline-flex min-h-6 items-center rounded-full bg-[color:var(--clinical-accent-soft)] px-2 text-2xs font-bold text-[color:var(--clinical-accent)]">
              You are here
            </span>
            <p className={cn("mt-2 text-xs leading-5", textMuted)}>{displayText(form.subtitle)}</p>
          </div>
          <div className="relative">
            <span className="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)]" />
            <p className="text-2xs font-bold uppercase text-[color:var(--text-soft)]">Parallel</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
              {parallelForms.map((item) => (
                <div
                  key={`${item.code}-${item.title}`}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2 border-b border-[color:var(--border)] p-2.5 last:border-b-0"
                >
                  <PathwayStepCode code={item.code} />
                  <p
                    className={cn(
                      "text-xs font-medium leading-5",
                      item.isEmpty ? textMuted : "text-[color:var(--text-heading)]",
                    )}
                  >
                    <span className="font-semibold">{item.meta}</span>
                    {item.isEmpty ? "" : " — "}
                    {item.isEmpty ? item.title : <span className={textMuted}>{item.title}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <span className="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)]" />
            <p className="text-2xs font-bold uppercase text-[color:var(--text-soft)]">After</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
              {afterForms.map((item) => (
                <div
                  key={`${item.code}-${item.title}`}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2 border-b border-[color:var(--border)] p-2.5 last:border-b-0"
                >
                  <PathwayStepCode code={item.code} />
                  <p
                    className={cn(
                      "text-xs font-medium leading-5",
                      item.isEmpty ? textMuted : "text-[color:var(--text-heading)]",
                    )}
                  >
                    <span className="font-semibold">{item.meta}</span>
                    {item.isEmpty ? "" : " — "}
                    {item.isEmpty ? item.title : <span className={textMuted}>{item.title}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <span className="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)]" />
            <p className="text-2xs font-bold uppercase text-[color:var(--text-soft)]">Confirm</p>
            <div className="mt-2 grid gap-1.5">
              {confirmChecks.slice(0, 4).map((check) => (
                <span
                  key={check}
                  className={cn(
                    "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold",
                    toneWarning,
                  )}
                >
                  <CircleCheck className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {check.replace(/^Before use:\s*/i, "Before use: ")}
                </span>
              ))}
              {criteria
                .filter((criterion) => criterion.tone === "reject")
                .slice(0, 1)
                .map((criterion) => (
                  <span
                    key={criterion.label}
                    className={cn(
                      "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold",
                      criterionToneClass(criterion.tone),
                    )}
                  >
                    <CircleX className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Avoid: {criterion.label}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">
            {displayText(details?.sourceFacts?.documentTitle, form.title)}
          </p>
          <dl className="grid gap-2 text-xs">
            <div>
              <dt className="font-bold uppercase text-[color:var(--text-soft)]">Official source</dt>
              <dd className={textMuted}>{displayText(form.source?.label)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase text-[color:var(--text-soft)]">Reviewed</dt>
              <dd className={textMuted}>{displayText(form.source?.reviewed ?? details?.officialTitleCheckedAt)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase text-[color:var(--text-soft)]">Availability</dt>
              <dd className={textMuted}>
                {details?.availability === "downloadable"
                  ? "Official PDF stored locally; confirm against the register before use"
                  : details?.availability === "unavailable"
                    ? "Marked unavailable on the official register"
                    : "Contact OCP monitoring"}
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase text-[color:var(--text-soft)]">Act / cue</dt>
              <dd className={textMuted}>{displayText(details?.sourceFacts?.sectionCue, details?.sourceNote)}</dd>
            </div>
          </dl>
        </div>
      )}
      <a
        href={form.source?.url ?? details?.officialRegisterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(floatingControl, "mt-3 min-h-10 w-full rounded-lg px-3 text-xs")}
      >
        <Navigation className="h-4 w-4" aria-hidden />
        Open official source / pathway
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </section>
  );
}

function SourceSnapshotCard({ form }: { form: FormRecord }) {
  const details = formCatalogDetails(form);
  const rows = [
    {
      icon: FileText,
      label: "Official form",
      value:
        details?.availability === "downloadable"
          ? `${formShortTitle(form)} · stored official copy`
          : details?.availability === "unavailable"
            ? "Currently unavailable"
            : "Contact OCP monitoring",
    },
    { icon: ShieldCheck, label: "Source currency", value: displayText(form.source?.reviewed, "Review locally") },
    {
      icon: Scale,
      label: "Act sections",
      value: displayText(details?.sourceFacts?.sectionCue, "See current approved form"),
    },
    {
      icon: CalendarDays,
      label: "Use safeguard",
      value: "Check current source before every use",
    },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      {rows.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[color:var(--border)] px-3 py-2 last:border-b-0"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-xs font-semibold text-[color:var(--text-heading)]">{label}</p>
          <p className="max-w-[12rem] text-right text-xs font-medium leading-5 text-[color:var(--text-muted)]">
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}

function ActionPanel({
  sourceHref,
  onCopy,
  hrefForCall,
}: {
  sourceHref: string | null;
  onCopy: () => void;
  hrefForCall: string | null;
}) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-2">
        {sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(primaryControl, "min-h-tap w-full px-3")}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open official source
          </a>
        ) : (
          <span className={cn(floatingControl, "min-h-tap w-full px-3 opacity-70")}>Source unavailable</span>
        )}
        <button type="button" onClick={onCopy} className={cn(floatingControl, "min-h-tap w-full px-3")}>
          <Download className="h-4 w-4" aria-hidden />
          Copy details
        </button>
      </div>
      {hrefForCall ? (
        <a href={hrefForCall} className={cn(floatingControl, "mt-2 min-h-tap w-full px-3")}>
          <Phone className="h-4 w-4" aria-hidden />
          Call contact
        </a>
      ) : null}
    </section>
  );
}

function RailCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon: LucideIcon }) {
  return (
    <article className="group grid min-h-[4.25rem] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)]">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">{label}</h3>
        <p className={cn("mt-0.5 truncate text-xs font-medium sm:whitespace-normal sm:leading-5", textMuted)}>
          {displayText(value)}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
    </article>
  );
}

export function FormDetailPage({ form }: { form: FormRecord }) {
  const router = useRouter();
  const accountData = useAccountData();
  const saved = accountData.isSaved("form", form.slug);
  const [notice, setNotice] = useState<string | null>(null);
  const code = formCode(form);
  const details = formCatalogDetails(form);
  const summaryCards = summaryCardsFor(form);
  const detailRows = detailRowsFor(form);
  const primaryContact = hasText(form.primaryContact?.value)
    ? form.primaryContact
    : (form.contacts?.find((contact) => hasText(contact.value)) ?? null);
  const hrefForCall = callHref(primaryContact);
  const verified = form.verification?.locallyVerified === true;
  const criteria = form.criteria ?? [];
  const relatedTags = useMemo(() => [...(form.tags ?? []), ...(form.catchments ?? [])].slice(0, 8), [form]);

  function goBack() {
    router.push(appModeHomeHref("forms", { focus: true }));
  }

  async function copyValue(value: string | null | undefined, label: string) {
    if (!hasText(value)) {
      setNotice("Nothing available to copy");
      return;
    }

    try {
      await copyText(value.trim());
      setNotice(label);
    } catch {
      setNotice("Copy failed");
    }
  }

  async function toggleSaved() {
    try {
      const nowSaved = !saved;
      if (!(await accountData.setFavourite("form", form.slug, nowSaved))) {
        setNotice(
          accountData.isAuthenticated ? "Save failed. Try again." : "Sign in or create an account to save forms",
        );
        return;
      }
      setNotice(nowSaved ? "Form saved" : "Form removed from saved items");
    } catch {
      setNotice("Save failed");
    }
  }

  return (
    <main
      data-testid="form-detail-page"
      className="max-sm:min-h-0 bg-[color:var(--background)] px-3 pb-4 pt-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-5 sm:pb-10 sm:pt-6 lg:px-8"
    >
      <div className={pageContainer}>
        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "mb-3 flex min-h-tap items-center justify-between gap-3 rounded-lg border p-3 text-sm font-semibold shadow-[var(--shadow-inset)]",
              notice.includes("failed") || notice.includes("Nothing") ? toneWarning : toneSuccess,
            )}
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss form notification"
              className="grid size-tap place-items-center rounded-md transition hover:bg-[color:var(--surface)]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={goBack} aria-label="Back to forms" className={cn(floatingControl, "px-3")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <nav
            aria-label="Form breadcrumbs"
            className="hidden min-w-0 items-center gap-2 text-xs font-semibold sm:flex"
          >
            <span className="text-[color:var(--clinical-accent)]">Forms</span>
            <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
            <span className="truncate text-[color:var(--text-muted)]">
              {displayText(form.catalogueLabel, "Catalogue")}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
            <span className="truncate text-[color:var(--text-muted)]">{form.title}</span>
          </nav>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] sm:p-5">
              <div className="grid grid-cols-[3.75rem_minmax(0,1fr)_2.75rem] gap-x-3 gap-y-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:gap-y-3 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-start">
                <FormCodeBadge code={code} variant="hero" />
                <div className="min-w-0">
                  <h1 className="max-w-4xl text-3xl font-extrabold leading-[1.05] text-[color:var(--text-heading)] sm:text-4xl">
                    {form.title}
                  </h1>
                  <p className="mt-1.5 max-w-4xl text-xs font-medium leading-4 text-[color:var(--text-muted)] sm:mt-3 sm:text-base sm:leading-6">
                    {displayText(form.subtitle, "Psychiatry form and workflow details.")}
                  </p>
                  {form.statusChips?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3">
                      {form.statusChips.map((chip, index) => (
                        <span
                          key={chip.label ?? `form-chip-${index}`}
                          className={cn(
                            "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 text-2xs font-bold uppercase leading-none sm:min-h-7 sm:px-2.5 sm:text-xs",
                            chipToneClass(chip.tone),
                          )}
                        >
                          <span className="hidden h-2 w-2 rounded-full bg-current sm:inline-block" aria-hidden />
                          {displayText(chip.label, "Status")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-start justify-end gap-2 xl:justify-end">
                  <button
                    type="button"
                    onClick={toggleSaved}
                    aria-label={saved ? "Remove saved form" : "Save form"}
                    aria-pressed={saved}
                    className="grid h-tap w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    {saved ? (
                      <BookmarkCheck className="h-5 w-5" aria-hidden />
                    ) : (
                      <Bookmark className="h-5 w-5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!form.source?.url}
                    onClick={() => {
                      if (form.source?.url) window.open(form.source.url, "_blank", "noopener,noreferrer");
                    }}
                    aria-label={form.source?.url ? "Open official source for this form" : "Official source unavailable"}
                    title={form.source?.url ? undefined : "Official source unavailable"}
                    className="hidden min-h-tap shrink-0 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition enabled:hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                    <span>Source</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2.5 shadow-[var(--shadow-inset)] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-3 sm:p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--danger-soft)] text-[color:var(--danger)] sm:h-10 sm:w-10">
                  <FileText className="size-icon-md sm:size-icon-lg" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
                    {formShortTitle(form)}
                    {details?.availability === "downloadable" ? ".pdf" : ""}
                  </h2>
                  <p className={cn("mt-0.5 text-xs", textMuted)}>{displayText(form.source?.label, "Official form")}</p>
                </div>
              </div>
              <span className="hidden text-xs font-semibold text-[color:var(--text-muted)] sm:block">
                {displayText(form.source?.status, "Source status pending")}
              </span>
              <span className="hidden text-xs font-semibold text-[color:var(--text-muted)] sm:block">
                {details?.officialPdfPasswordProtected ? "Password protected" : "Check source"}
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)] sm:hidden">
                <span>{details?.officialPdfPasswordProtected ? "Password protected" : "Check source"}</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </div>
              {form.source?.url || details?.localPdfPath ? (
                <div className="hidden items-center gap-3 sm:flex">
                  {form.source?.url ? (
                    <a
                      href={form.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-[color:var(--clinical-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                    >
                      Official
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  ) : null}
                  {details?.localPdfPath ? (
                    <a
                      href={details.localPdfPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-[color:var(--text-muted)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                    >
                      Stored copy
                      <Download className="h-4 w-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
              ) : (
                <span className="hidden text-xs font-semibold text-[color:var(--text-muted)] sm:inline">
                  Source link pending
                </span>
              )}
            </section>

            <div className="hidden lg:block">
              <ActionPanel
                sourceHref={form.source?.url ?? null}
                onCopy={() => copyValue(formDetailsClipboardText(form), "Form details copied")}
                hrefForCall={hrefForCall}
              />
            </div>

            <section aria-label="Priority facts" className="space-y-2.5 sm:space-y-3">
              <h2 className="text-base-minus font-semibold leading-5 text-[color:var(--text-heading)] sm:text-base">
                Priority facts
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <DetailCard key={card.id} card={card} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/30 p-4 shadow-[var(--shadow-inset)]">
              <div className="grid gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--warning-soft)] text-[color:var(--warning)] shadow-[var(--shadow-inset)]">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Legal boundary</h2>
                    <span className={cn(metadataPill, "rounded-full text-2xs uppercase", toneWarning)}>Governance</span>
                  </div>
                  <p className="mt-2 max-w-5xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {displayText(
                      form.bestUse,
                      "Use the current approved form, confirm authority, and document the least restrictive safe option before signing.",
                    )}
                  </p>
                </div>
              </div>
            </section>

            <section aria-label="Form information" className="grid gap-2">
              {detailRows.map((row) => {
                const label = row.label.toLowerCase();
                const Icon = label.includes("only")
                  ? Route
                  : label.includes("sign")
                    ? Clipboard
                    : label.includes("clinical")
                      ? Info
                      : label.includes("source")
                        ? FileText
                        : label.includes("pathway")
                          ? Navigation
                          : CircleCheck;
                return <InfoRow key={row.label} label={row.label} value={row.value} icon={Icon} />;
              })}
            </section>

            <div className="grid gap-3 lg:hidden">
              <SourceSnapshotCard form={form} />
              <ActionPanel
                sourceHref={form.source?.url ?? null}
                onCopy={() => copyValue(formDetailsClipboardText(form), "Form details copied")}
                hrefForCall={hrefForCall}
              />
            </div>

            <div className="lg:hidden">
              <PathwayContextCard form={form} code={code} criteria={criteria} testId="form-decision-context-mobile" />
            </div>
          </div>

          <aside className="polished-scroll hidden min-w-0 space-y-3 lg:sticky lg:top-[5.75rem] lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <PathwayContextCard form={form} code={code} criteria={criteria} testId="form-decision-context-desktop" />
            <SourceSnapshotCard form={form} />

            <RailCard icon={FileText} title="Source status">
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[color:var(--text-heading)]">
                    {displayText(form.source?.label, "Source")}
                  </p>
                  <span
                    className={cn(
                      "inline-flex min-h-6 shrink-0 items-center rounded-md border px-2 text-2xs font-bold",
                      sourceToneClass(form),
                    )}
                  >
                    {displayText(form.source?.status, "Unreviewed")}
                  </span>
                </div>
                {form.source?.reviewed ? (
                  <p className={cn("mt-2 text-xs leading-5", textMuted)}>{form.source.reviewed}</p>
                ) : null}
                {form.source?.notes?.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {form.source.notes.map((note) => (
                      <li
                        key={note}
                        className="flex gap-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
                      >
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </RailCard>

            <RailCard icon={ShieldCheck} title="Verification">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn(metadataPill, "rounded-full", verified ? toneSuccess : toneWarning)}>
                    {verified ? "Locally verified" : "Verify locally"}
                  </span>
                  <span className={cn(metadataPill, "rounded-full")}>
                    {form.verification?.confidence ?? "Unknown"} confidence
                  </span>
                </div>
                {form.verification?.notes?.length ? (
                  <ul className="space-y-1.5">
                    {form.verification.notes.map((note) => (
                      <li
                        key={note}
                        className="flex gap-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
                      >
                        <CircleCheck
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]"
                          aria-hidden
                        />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-sm leading-6", textMuted)}>No verification notes are listed.</p>
                )}
              </div>
            </RailCard>

            <RailCard icon={Tag} title="Tags & context">
              {relatedTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {relatedTags.map((tag) => (
                    <span key={tag} className={cn(metadataPill, "rounded-full text-2xs")}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={cn("text-sm leading-6", textMuted)}>No tags listed.</p>
              )}
            </RailCard>
          </aside>
        </div>
      </div>
    </main>
  );
}
