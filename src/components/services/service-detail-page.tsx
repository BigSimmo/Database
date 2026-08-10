"use client";

import { useRouter } from "next/navigation";
import {
  TriangleAlert,
  BadgeCheck,
  BadgeDollarSign,
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  ChevronRight,
  Clipboard,
  Copy,
  DollarSign,
  Globe2,
  Info,
  LayoutGrid,
  Mail,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Tag,
  Users,
  X,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  cn,
  ignoreUnavailableActivation,
  metadataPillDensity,
  textMuted,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { InformationPageShell } from "@/components/information-page-shell";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { inPageActionRowClass, inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { appModeHomeHref } from "@/lib/app-modes";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { compactCatalogField } from "@/lib/compact-best-use-title";
import {
  serviceNavigatorQuery,
  type ServiceContact,
  type ServiceCriterion,
  type ServiceInfoRow,
  type ServiceRecord,
  type ServiceStatusChip,
  type ServiceSummaryCard,
} from "@/lib/service-ranker";
import { useAccountData } from "@/components/account-data-provider";

const missingText = "Not listed";

function hasText(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  return !/^(?:none|none listed|not listed|n\/a|na|unknown|not publicly stated|confirm locally)$/i.test(value.trim());
}

function displayText(value: string | null | undefined, fallback = missingText) {
  return hasText(value) ? value.trim() : fallback;
}

function bestUseCardTitle(bestUse: string | null | undefined) {
  if (!hasText(bestUse)) return "Assess service fit";
  return compactCatalogField(bestUse, 120);
}

/** Short label for website contacts so long URLs do not dominate the contact band. */
function contactDisplayValue(contact: ServiceContact | null | undefined) {
  const value = contact?.value?.trim();
  if (!value) return undefined;
  if (contact?.kind === "web" || /^https?:\/\//i.test(value)) {
    try {
      const host = new URL(value).hostname.replace(/^www\./i, "");
      return host || "Website";
    } catch {
      return "Website";
    }
  }
  return value.includes("|") ? compactCatalogField(value, 160) : value;
}

function summaryCardIsRenderable(card: ServiceSummaryCard) {
  return hasText(card.title) && !/\|/.test(card.title ?? "");
}

function chipToneClass(tone: ServiceStatusChip["tone"] | undefined | null) {
  if (tone === "danger") return toneDanger;
  if (tone === "info") return toneInfo;
  if (tone === "warning") return toneWarning;
  if (tone === "success") return toneSuccess;
  return toneNeutral;
}

function renderSummaryIcon(card: ServiceSummaryCard) {
  const className = "h-4 w-4";
  if (card.id === "route") return <Navigation className={className} aria-hidden />;
  if (card.id === "eligibility") return <Users className={className} aria-hidden />;
  if (card.id === "cost") return <BadgeDollarSign className={className} aria-hidden />;
  if (card.id === "confidence" || card.id === "best-use") return <ShieldCheck className={className} aria-hidden />;
  return <Info className={className} aria-hidden />;
}

function renderRowIcon(label: string) {
  const normalized = label.toLowerCase();
  const className = "h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]";
  if (normalized.includes("phone") || normalized.includes("route") || normalized.includes("contact")) {
    return <Phone className={className} aria-hidden />;
  }
  if (normalized.includes("email")) return <Mail className={className} aria-hidden />;
  if (normalized.includes("website") || normalized.includes("web")) return <Globe2 className={className} aria-hidden />;
  if (normalized.includes("region") || normalized.includes("catchment") || normalized.includes("location")) {
    return <MapPin className={className} aria-hidden />;
  }
  if (normalized.includes("patient") || normalized.includes("eligib")) {
    return <Users className={className} aria-hidden />;
  }
  if (normalized.includes("cost") || normalized.includes("funding")) {
    return <DollarSign className={className} aria-hidden />;
  }
  return <Info className={className} aria-hidden />;
}

function renderCriterionIcon(tone: ServiceCriterion["tone"]) {
  const className = cn(
    "mt-0.5 h-4 w-4 shrink-0",
    tone === "meet"
      ? "text-[color:var(--success)]"
      : tone === "reject"
        ? "text-[color:var(--danger)]"
        : "text-[color:var(--warning)]",
  );
  if (tone === "meet") return <CircleCheck className={className} aria-hidden />;
  if (tone === "reject") return <CircleX className={className} aria-hidden />;
  return <TriangleAlert className={className} aria-hidden />;
}

function criterionPill(tone: ServiceCriterion["tone"]) {
  if (tone === "meet") return { label: "Meets", className: toneSuccess };
  if (tone === "reject") return { label: "Reject", className: toneDanger };
  return { label: "Caution", className: toneWarning };
}

function contactHref(contact: ServiceContact | null | undefined) {
  const value = contact?.value?.trim();
  if (!contact || !hasText(value)) return undefined;
  if (contact.kind === "phone") {
    const compact = value.replace(/[^\d+]/g, "");
    return compact ? `tel:${compact}` : undefined;
  }
  if (contact.kind === "email") return `mailto:${value}`;
  if (contact.kind === "web") return value;
  return undefined;
}

function hrefIsExternal(href: string | undefined) {
  return Boolean(href && /^https?:\/\//i.test(href));
}

function summaryCardsFor(service: ServiceRecord): ServiceSummaryCard[] {
  if (Array.isArray(service.summaryCards)) {
    return service.summaryCards
      .map((card) => ({
        ...card,
        title: hasText(card.title) ? compactCatalogField(card.title, 120) : card.title,
        detail: hasText(card.detail) ? compactCatalogField(card.detail, 120) : undefined,
      }))
      .filter(summaryCardIsRenderable);
  }

  const cards: ServiceSummaryCard[] = [];
  if (hasText(service.route)) {
    cards.push({
      id: "route",
      label: "Route",
      title: compactCatalogField(service.route, 120),
      detail: hasText(service.referral) ? compactCatalogField(service.referral, 120) : undefined,
    });
  }
  if (hasText(service.eligibility)) {
    cards.push({
      id: "eligibility",
      label: "Eligibility",
      title: compactCatalogField(service.eligibility, 120),
    });
  }
  if (hasText(service.cost)) {
    cards.push({
      id: "cost",
      label: "Cost",
      title: compactCatalogField(service.cost, 120),
    });
  }
  if (hasText(service.bestUse)) {
    cards.push({
      id: "best-use",
      label: "Best use",
      title: bestUseCardTitle(service.bestUse),
    });
  }
  return cards.filter(summaryCardIsRenderable);
}

function referralRowsFor(service: ServiceRecord, primaryContact: ServiceContact | null): ServiceInfoRow[] {
  // Explicit arrays (including empty) mean the mapper already decided which rows exist.
  const sourceRows = Array.isArray(service.referralInfo)
    ? service.referralInfo
    : [
        { label: "Primary route", value: service.referral ?? primaryContact?.detail ?? "" },
        { label: "Phone", value: primaryContact?.kind === "phone" ? (primaryContact.value ?? "") : "" },
        { label: "Eligibility", value: service.eligibility ?? "" },
        { label: "Cost / funding", value: service.cost ?? "" },
        { label: "Region", value: service.location ?? service.catchments?.join(", ") ?? "" },
      ];

  return sourceRows
    .map((row) => ({
      ...row,
      value: hasText(row.value) ? compactCatalogField(row.value, 160) : undefined,
    }))
    .filter((row) => hasText(row.value));
}

function normalizeTagForList(tag: string) {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeTagItems(items: string[]) {
  const seen = new Set<string>();
  return items
    .map((tag) => tag.trim())
    .filter((tag) => hasText(tag))
    .filter((tag) => {
      const key = normalizeTagForList(tag);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Ids and labels carried over verbatim from `serviceSections` in the pill rail
 * this page's header replaces. Exported so the per-route section contract test
 * can assert every one of them against the rendered DOM.
 */
export const serviceNavSections: readonly PageSection[] = [
  { id: "service-overview", label: "Overview", icon: Info },
  { id: "service-quick-facts", label: "Quick facts", icon: LayoutGrid },
  { id: "service-referral", label: "Referral", icon: Clipboard },
  { id: "service-criteria", label: "Criteria", icon: ShieldCheck },
  { id: "service-verification", label: "Verification", icon: BadgeCheck },
];

function Section({
  id,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        inPageAnchor,
        "rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]",
      )}
    >
      <div className="border-b border-[color:var(--border)] px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h2>
            {description ? <p className={cn("mt-0.5 text-sm leading-6", textMuted)}>{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function SummaryCard({ card }: { card: ServiceSummaryCard }) {
  return (
    <article className="group min-h-[6.25rem] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface)]">
      <div className="mb-2 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
          {renderSummaryIcon(card)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[color:var(--text-muted)]">{displayText(card.label, "Detail")}</p>
          <h3 className="mt-0.5 text-base-minus font-semibold leading-5 text-[color:var(--text-heading)]">
            {displayText(card.title)}
          </h3>
        </div>
        <ChevronRight
          className="mt-2 h-4 w-4 shrink-0 text-[color:var(--decoration-soft)] transition group-hover:text-[color:var(--clinical-accent)]"
          aria-hidden
        />
      </div>
      {hasText(card.detail) ? (
        <p className={cn("pl-[3.25rem] text-xs leading-5", textMuted)}>{card.detail.trim()}</p>
      ) : null}
    </article>
  );
}

/**
 * Displays referral information rows with their values and copy actions.
 *
 * @param rows - The referral information rows to display
 * @param onCopy - Callback invoked with a row value and feedback label when copying is requested
 */
function ReferralTable({
  rows,
  onCopy,
}: {
  rows: ServiceInfoRow[];
  onCopy: (value: string | null | undefined, label: string) => void;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm">
        <p className="font-semibold text-[color:var(--text-heading)]">No referral information</p>
        <p className={cn("mt-1 leading-6", textMuted)}>This service record has no referral rows yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const isPrimary = index === 0;
        const isCost = row.label.toLowerCase().includes("cost");

        return (
          <article
            key={`${row.label}-${index}`}
            className={cn(
              "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
              isPrimary && "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/35",
              isCost && "bg-[color:var(--success-soft)]/25",
            )}
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 sm:grid-cols-[auto_minmax(8rem,0.55fr)_minmax(0,1fr)_auto] sm:items-center">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] shadow-[var(--shadow-inset)]">
                {renderRowIcon(row.label)}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{row.label}</h3>
                {isPrimary ? (
                  <p className="mt-0.5 text-xs font-medium leading-4 text-[color:var(--clinical-accent)]">
                    Primary access route
                  </p>
                ) : null}
              </div>
              <p className="col-start-2 min-w-0 whitespace-pre-line break-words text-sm font-medium leading-6 text-[color:var(--text-heading)] sm:col-start-auto">
                {displayText(row.value)}
              </p>
              <button
                type="button"
                disabled={!hasText(row.value)}
                onClick={() => onCopy(row.value, `${row.label} copied`)}
                aria-label={`Copy ${row.label}`}
                className="inline-grid h-tap w-tap place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CriteriaBoard({ criteria }: { criteria: ServiceCriterion[] }) {
  if (!criteria.length) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm">
        <p className="font-semibold text-[color:var(--text-heading)]">No criteria recorded</p>
        <p className={cn("mt-1 leading-6", textMuted)}>Eligibility and exclusion criteria have not been added yet.</p>
      </div>
    );
  }

  const meets = criteria.filter((item) => item.tone === "meet");
  const cautionReject = criteria.filter((item) => item.tone !== "meet");

  return (
    <div className="space-y-3">
      <CriteriaGroup title="MEETS" titleClassName="text-[color:var(--success)]" items={meets} />
      <CriteriaGroup title="CAUTION / REJECT" titleClassName="text-[color:var(--danger)]" items={cautionReject} />
    </div>
  );
}

function CriteriaGroup({
  title,
  titleClassName,
  items,
}: {
  title: string;
  titleClassName: string;
  items: ServiceCriterion[];
}) {
  return (
    <div>
      <h3 className={cn("mb-1.5 text-sm font-bold tracking-normal", titleClassName)}>{title}</h3>
      {items.length ? (
        <div className="divide-y divide-[color:var(--border)]">
          {items.map((item) => {
            const pill = criterionPill(item.tone);
            return (
              <div key={item.label} className="flex min-h-10 items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {renderCriterionIcon(item.tone)}
                  <p className="min-w-0 text-sm font-medium leading-5 text-[color:var(--text-heading)]">{item.label}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex min-h-6 shrink-0 items-center rounded-full border px-2.5 text-2xs font-bold lowercase",
                    pill.className,
                  )}
                >
                  {pill.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p
          className={cn(
            "rounded-lg border border-dashed border-[color:var(--border)] p-3 text-sm leading-6",
            textMuted,
          )}
        >
          No items in this group.
        </p>
      )}
    </div>
  );
}

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  const uniqueItems = dedupeTagItems(items);

  if (!uniqueItems.length) return <p className={cn("text-sm leading-6", textMuted)}>{emptyLabel}</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {uniqueItems.map((item) => (
        <span key={normalizeTagForList(item)} className={cn(metadataPillDensity.dense, "rounded-full")}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function ServiceDetailPage({ service }: { service: ServiceRecord }) {
  const router = useRouter();
  const accountData = useAccountData();
  const saved = accountData.isSaved("service", service.slug);
  const [notice, setNotice] = useState<string | null>(null);
  const { sections, activeId, selectSection } = useInPageSectionNav(serviceNavSections);
  const primaryContact = hasText(service.primaryContact?.value)
    ? service.primaryContact
    : (service.contacts?.find((contact) => hasText(contact.value)) ?? null);
  const summaryCards = summaryCardsFor(service);
  const referralRows = referralRowsFor(service, primaryContact);
  const callHref = contactHref(primaryContact);
  const verified = service.verification?.locallyVerified === true;
  const preferredCardOrder = ["route", "best-use", "eligibility", "cost"] as const;
  const summaryCardById = new Map(summaryCards.map((card) => [card.id, card]));
  const compactSummaryCards = preferredCardOrder
    .map((id) => summaryCardById.get(id))
    .filter((card): card is ServiceSummaryCard => Boolean(card && summaryCardIsRenderable(card)));
  const leftoverCards = summaryCards.filter(
    (card) => !preferredCardOrder.includes(card.id as (typeof preferredCardOrder)[number]),
  );
  const visibleSummaryCards = [...compactSummaryCards, ...leftoverCards.filter(summaryCardIsRenderable)];
  const compactedBestUse = hasText(service.bestUse) ? compactCatalogField(service.bestUse, 160) : "";
  const compactedSubtitle = hasText(service.subtitle) ? compactCatalogField(service.subtitle, 160) : "";
  const tagItems = dedupeTagItems([...(service.catchments ?? []), ...(service.tags ?? [])]);
  const criteria = service.criteria ?? [];
  const showReferralSection = referralRows.length > 0;
  const showCriteriaSection = criteria.length > 0 || Boolean(compactedBestUse);
  const showTagsSection = tagItems.length > 0;
  const showQuickFacts = visibleSummaryCards.length > 0;
  const meetCount = criteria.filter((item) => item.tone === "meet").length;
  const cautionCount = criteria.filter((item) => item.tone !== "meet").length;
  const contactLabel = contactDisplayValue(primaryContact);
  const localConfirmationDetail =
    service.verification?.notes?.find((note) => /hour/i.test(note)) ??
    service.verification?.notes?.find((note) => /local|confirm/i.test(note)) ??
    "Hours not public";

  async function copyValue(value: string | null | undefined, label: string) {
    if (!hasText(value)) {
      setNotice("Nothing available to copy");
      return;
    }

    try {
      await copyTextToClipboard(value.trim());
      setNotice(label);
    } catch {
      setNotice("Copy failed");
    }
  }

  async function toggleSaved() {
    try {
      const nowSaved = !saved;
      if (!(await accountData.setFavourite("service", service.slug, nowSaved))) {
        setNotice(
          accountData.isAuthenticated ? "Save failed. Try again." : "Sign in or create an account to save services",
        );
        return;
      }
      setNotice(nowSaved ? "Service saved" : "Service removed from saved items");
    } catch {
      setNotice("Save failed");
    }
  }

  function openInNavigator() {
    router.push(appModeHomeHref("services", { query: serviceNavigatorQuery(service), run: true, focus: true }));
  }

  // The mode home the back control returns to is the destination the removed
  // "Close service" icon button used, `focus: true` included, so the header
  // replaces that control rather than adding a second way out.
  const servicesHomeHref = appModeHomeHref("services", { focus: true });

  return (
    <>
      <InPageNavHeader
        back={{ href: servicesHomeHref, label: "Services" }}
        title={service.title}
        sections={sections}
        activeId={activeId}
        onSelectSection={selectSection}
        actionsNoun="service"
        actionsDescription="Choose how to use this service."
        testIdPrefix="service"
        actions={(close) => (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => {
                close();
                void toggleSaved();
              }}
              aria-pressed={saved}
              className={inPageActionRowClass}
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              ) : (
                <Bookmark className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              )}
              {saved ? "Remove saved service" : "Save service"}
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                void copyValue(primaryContact?.value, "Contact copied");
              }}
              className={inPageActionRowClass}
            >
              <Clipboard className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Copy contact
            </button>
            {callHref ? (
              <a
                href={callHref}
                target={hrefIsExternal(callHref) ? "_blank" : undefined}
                rel={hrefIsExternal(callHref) ? "noopener noreferrer" : undefined}
                onClick={close}
                className={inPageActionRowClass}
              >
                <Phone className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                Call
              </a>
            ) : (
              <button
                type="button"
                aria-disabled="true"
                onClick={ignoreUnavailableActivation}
                title="Call — no contact number listed for this service"
                aria-describedby="service-call-unavailable"
                className={inPageActionRowClass}
              >
                <Phone className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
                Call
                <span id="service-call-unavailable" className="sr-only">
                  No contact number is listed for this service.
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                close();
                openInNavigator();
              }}
              className={inPageActionRowClass}
            >
              <Navigation className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Use in navigator
            </button>
          </div>
        )}
      />
      <InformationPageShell testId="service-detail-page" gap={false}>
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
              aria-label="Dismiss service notification"
              className="grid size-tap place-items-center rounded-md transition hover:bg-[color:var(--surface)]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <div className="mt-3 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] sm:p-5">
          <div className="min-w-0 space-y-4">
            <section id="service-overview" className={cn(inPageAnchor, "rounded-lg bg-[color:var(--surface-lux)]")}>
              <div className="grid items-start gap-3 sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <h1 className="max-w-4xl text-3xl font-extrabold leading-display text-[color:var(--text-heading)] sm:text-4xl">
                      {service.title}
                    </h1>
                  </div>
                  {service.statusChips?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {service.statusChips.map((chip, index) => (
                        <span
                          key={chip.label ?? `status-chip-${index}`}
                          className={cn(
                            "inline-flex min-h-6 items-center gap-1.5 rounded-2xl border px-2.5 py-0.5 text-2xs font-bold",
                            chipToneClass(chip.tone),
                          )}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                          {displayText(chip.label, "Status")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {compactedSubtitle ? (
                    <p className="mt-3 max-w-4xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                      {compactedSubtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-3 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] sm:p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.85fr)]">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)]">
                  <Phone className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[color:var(--text-muted)]">Contact</p>
                  <h2 className="mt-1 break-words text-xl font-semibold text-[color:var(--text-heading)]">
                    {contactLabel
                      ? primaryContact?.kind === "web" || /^https?:\/\//i.test(primaryContact?.value ?? "")
                        ? contactLabel
                        : `Contact: ${contactLabel}`
                      : "Contact not listed"}
                  </h2>
                  {hasText(primaryContact?.detail) || hasText(service.route) ? (
                    <p className={cn("mt-1 text-sm leading-5", textMuted)}>
                      {hasText(primaryContact?.detail)
                        ? compactCatalogField(primaryContact.detail, 120)
                        : compactCatalogField(service.route, 120)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-[color:var(--border)] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <div className="flex gap-3">
                  <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-[color:var(--warning)]" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                      {verified ? "Verified for local use" : "Verify locally before use"}
                    </p>
                    <p className={cn("mt-1 text-xs leading-5", textMuted)}>{localConfirmationDetail}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-[color:var(--border)] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <p className="text-xs font-semibold text-[color:var(--text-muted)]">Confidence</p>
                <span className={cn(metadataPillDensity.standard, "mt-2 inline-flex rounded-full", toneWarning)}>
                  {service.verification?.confidence ?? "Unknown"}
                </span>
              </div>
              <div className="border-t border-[color:var(--border)] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <div className="flex min-h-10 items-center gap-2 text-sm font-medium text-[color:var(--text-heading)]">
                  <Bookmark className="h-5 w-5 shrink-0 text-[color:var(--text-heading)]" aria-hidden />
                  <span>{service.catalogueLabel ?? "Catalogue service"}</span>
                </div>
              </div>
            </section>

            {showQuickFacts ? (
              <section
                id="service-quick-facts"
                aria-label="Service quick facts"
                className={cn(inPageAnchor, "grid gap-3 pt-3 sm:grid-cols-2 sm:pt-0 xl:grid-cols-4")}
              >
                {visibleSummaryCards.map((card) => (
                  <SummaryCard key={card.id} card={card} />
                ))}
              </section>
            ) : null}

            <div
              className={cn(
                "grid gap-4",
                showReferralSection && showCriteriaSection
                  ? "xl:grid-cols-[minmax(28rem,0.86fr)_minmax(0,1fr)]"
                  : undefined,
              )}
            >
              {showReferralSection ? (
                <Section id="service-referral" icon={Clipboard} title="Referral information">
                  <ReferralTable rows={referralRows} onCopy={copyValue} />
                </Section>
              ) : null}

              <div className="min-w-0 space-y-3">
                {showCriteriaSection ? (
                  <Section
                    id="service-criteria"
                    icon={ShieldCheck}
                    title="Referral criteria"
                    action={
                      <div className="flex flex-wrap gap-2">
                        <span className={cn(metadataPillDensity.roomy, "rounded-full", toneSuccess)}>
                          {meetCount} meet
                        </span>
                        <span className={cn(metadataPillDensity.roomy, "rounded-full", toneWarning)}>
                          {cautionCount} caution
                        </span>
                      </div>
                    }
                  >
                    {compactedBestUse ? (
                      <p className="mb-3 border-b border-[color:var(--border)] pb-3 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                        <span className="font-semibold text-[color:var(--text-heading)]">Best use:</span>{" "}
                        {compactedBestUse}
                      </p>
                    ) : null}
                    {criteria.length > 0 ? <CriteriaBoard criteria={criteria} /> : null}
                  </Section>
                ) : null}

                <section
                  id="service-verification"
                  className={cn(
                    inPageAnchor,
                    "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                      <ShieldCheck className="h-5 w-5" aria-hidden />
                    </span>
                    <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Verification</h2>
                    <span
                      className="hidden h-1 w-1 rounded-full bg-[color:var(--decoration-soft)] sm:block"
                      aria-hidden
                    />
                    <span className="text-sm font-medium text-[color:var(--text-muted)]">
                      {verified ? "Locally verified" : "Verify locally before use"}
                    </span>
                    <span
                      className="hidden h-1 w-1 rounded-full bg-[color:var(--decoration-soft)] sm:block"
                      aria-hidden
                    />
                    <span className="text-sm font-medium text-[color:var(--text-muted)]">
                      {service.verification?.confidence ?? "Unknown"} confidence
                    </span>
                    {service.source?.status ? (
                      <>
                        <span
                          className="hidden h-1 w-1 rounded-full bg-[color:var(--decoration-soft)] sm:block"
                          aria-hidden
                        />
                        <span className="text-sm font-medium text-[color:var(--text-muted)]">
                          {service.source.status}
                        </span>
                      </>
                    ) : null}
                  </div>
                </section>

                {showTagsSection ? (
                  <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                        <Tag className="h-5 w-5" aria-hidden />
                      </span>
                      <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Tags & catchments</h2>
                      <TagList items={tagItems} emptyLabel="No tags listed." />
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            <p className="flex flex-wrap items-center justify-center gap-3 border-t border-[color:var(--border)] pt-4 text-center text-xs font-medium text-[color:var(--text-muted)]">
              <Info className="h-4 w-4" aria-hidden />
              Information accuracy may vary. Confirm locally before use.
              <span aria-hidden>·</span>
              <Bookmark className="h-4 w-4" aria-hidden />
              {service.catalogueLabel ?? "Catalogue service"}
            </p>
          </div>
        </div>
      </InformationPageShell>
    </>
  );
}
