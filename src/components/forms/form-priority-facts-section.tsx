"use client";

import { BookOpenText, ClipboardList, Clock3, MapPin, Scale, UserRound } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { cn, textMuted } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import {
  ACT_SECTION_CHIP_LIMIT,
  formCatalogDetails,
  PRIORITY_FACT_CARD_LABELS,
  type FormRecord,
} from "@/lib/form-catalog";
import type { FormActSection, FormPriorityFactCard } from "@/lib/form-ranker";
import { mhaActMetadata } from "@/lib/mha-act-sections";
import type { ServiceSummaryCard } from "@/lib/service-ranker";

function hasText(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function summaryIcon(card: ServiceSummaryCard) {
  const label = `${card.id} ${card.label} ${card.title}`.toLowerCase();
  const Icon =
    label.includes("act-section") || label.includes("act section")
      ? BookOpenText
      : label.includes("clock")
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

/**
 * The longer wording behind a Priority-facts card.
 *
 * Every form can produce one: a curated `priorityFacts` entry supplies its own `body`,
 * and otherwise the canonical catalogue prose is composed. Whether that body is worth
 * an affordance is decided by the caller, not here — see `hasExtraDetail`.
 */
export function priorityFactBody(
  form: FormRecord,
  cardId: string,
): { title: string; body: string; detail?: string } | null {
  const details = formCatalogDetails(form);
  if (!details) return null;

  const fromCard = (fact: FormPriorityFactCard | undefined, fallbackBody: string, fallbackDetail?: string) => {
    if (!fact && !fallbackBody.trim()) return null;
    const body = fact?.body?.trim() || fallbackBody.trim();
    if (!body) return null;
    return {
      title:
        fact?.title?.trim() || PRIORITY_FACT_CARD_LABELS[cardId as keyof typeof PRIORITY_FACT_CARD_LABELS] || cardId,
      detail: fact?.detail?.trim() || fallbackDetail,
      body,
    };
  };

  if (cardId === "clock") {
    return fromCard(details.priorityFacts?.clock, details.clock, details.indexedClock);
  }
  if (cardId === "authority") {
    return fromCard(
      details.priorityFacts?.authority,
      [details.maker, details.authorises, details.doesNotAuthorise].filter(Boolean).join(" "),
      details.authorises,
    );
  }
  if (cardId === "criteria") {
    return fromCard(details.priorityFacts?.criteria, details.threshold, details.doesNotAuthorise);
  }
  return null;
}

/**
 * Whether a card should offer "Tap for detail".
 *
 * This used to be gated on the form having a curated `priorityFacts` block, which is
 * why only Form 1A had working popups. The honest test is whether the sheet would show
 * anything the card face does not already say: on a form whose catalogue row is
 * boilerplate, the clock card's title IS its whole body, so it stays inert rather than
 * promising detail that does not exist. The authority card composes maker + authorises
 * + does-not-authorise, which is strictly more than its title on every form.
 */
function hasExtraDetail(card: ServiceSummaryCard, detail: { body: string } | null) {
  const body = detail?.body?.trim();
  if (!body) return false;
  return body !== (card.title ?? "").trim();
}

function DetailCardShell({
  card,
  children,
  footer,
}: {
  card: ServiceSummaryCard;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="flex min-h-[5.75rem] flex-col rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-1.5 shadow-[var(--shadow-inset)] sm:min-h-[7rem] sm:p-3">
      <div className="mb-1 flex items-start gap-1.5 sm:mb-2 sm:gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] sm:h-9 sm:w-9">
          {summaryIcon(card)}
        </span>
        <p className="min-w-0 pt-0.5 text-2xs font-bold uppercase leading-4 text-[color:var(--text-muted)]">
          {hasText(card.label) ? card.label.trim() : "Priority fact"}
        </p>
      </div>
      {children}
      {footer}
    </article>
  );
}

function DetailCard({
  card,
  onOpenDetail,
  hasDetail,
}: {
  card: ServiceSummaryCard;
  onOpenDetail?: () => void;
  hasDetail?: boolean;
}) {
  const label = hasText(card.label) ? card.label.trim() : "Priority fact";
  const title = hasText(card.title) ? card.title.trim() : "";
  const isInteractive = Boolean(hasDetail && onOpenDetail);

  const titleNode = isInteractive ? (
    <span className="block text-xs font-semibold leading-tight text-[color:var(--text-heading)] sm:text-sm sm:leading-5">
      {title}
    </span>
  ) : (
    <h3 className="text-xs font-semibold leading-tight text-[color:var(--text-heading)] sm:text-sm sm:leading-5">
      {title}
    </h3>
  );

  const content = (
    <>
      {titleNode}
      {/* Rendered only when there is a sub-line. The 34 forms with no indexed clock cue
          used to print "Not listed" here, which reads as a fact about the form rather
          than an absence of one, and there is no honest substitute in the catalogue. */}
      {hasText(card.detail) ? (
        <p className={cn("mt-0.5 text-2xs font-medium leading-4 sm:mt-1 sm:text-xs sm:leading-5", textMuted)}>
          {card.detail.trim()}
        </p>
      ) : null}
    </>
  );

  if (!isInteractive || !onOpenDetail) {
    return <DetailCardShell card={card}>{content}</DetailCardShell>;
  }

  return (
    <DetailCardShell
      card={card}
      footer={<p className={cn("mt-auto pt-1 text-2xs font-medium leading-4 sm:pt-1.5", textMuted)}>Tap for detail</p>}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        aria-haspopup="dialog"
        className="min-w-0 flex-1 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        aria-label={`${label}: ${title}${hasText(card.detail) ? ` — ${card.detail.trim()}` : ""}. Open detail.`}
      >
        {content}
      </button>
    </DetailCardShell>
  );
}

const actChipClass = cn(
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-xs font-semibold text-[color:var(--text-heading)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
);

function ActSectionsCard({
  card,
  sections,
  onOpenSection,
  onOpenIndex,
}: {
  card: ServiceSummaryCard;
  sections: FormActSection[];
  onOpenSection: (section: string) => void;
  onOpenIndex: () => void;
}) {
  const groupLabelId = useId();
  const visible = sections.slice(0, ACT_SECTION_CHIP_LIMIT);
  const overflow = sections.length - visible.length;
  // Say on the card face, not only inside the sheet, that these summaries carry no
  // clinician sign-off yet — otherwise the card reads as reviewed authority to anyone who
  // never opens a section.
  const awaitingReview = sections.some((entry) => entry.reviewStatus === "drafted");

  return (
    <DetailCardShell card={card}>
      <h3
        id={groupLabelId}
        className="text-xs font-semibold leading-tight text-[color:var(--text-heading)] sm:text-sm sm:leading-5"
      >
        {hasText(card.title) ? card.title.trim() : "Authority under the Act"}
      </h3>
      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-labelledby={groupLabelId}>
        {visible.map((entry) => (
          <button
            key={entry.section}
            type="button"
            onClick={() => onOpenSection(entry.section)}
            aria-haspopup="dialog"
            className={actChipClass}
            aria-label={`Section ${entry.section}: ${entry.title}. Open detail.`}
          >
            {entry.section}
          </button>
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            onClick={onOpenIndex}
            aria-haspopup="dialog"
            className={actChipClass}
            aria-label={`Show all ${sections.length} Act sections. Open detail.`}
          >
            {`+${overflow}`}
          </button>
        ) : null}
      </div>
      <p className={cn("mt-auto pt-1 text-2xs font-medium leading-4 sm:pt-1.5", textMuted)}>
        {awaitingReview ? "Tap a section — awaiting clinical review" : "Tap a section for authority detail"}
      </p>
    </DetailCardShell>
  );
}

/** Shown when a section's summary has been invalidated by an Act version bump. */
function PendingSectionBody({ formCode, pdfHref }: { formCode?: string; pdfHref?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[color:var(--text-body)]">
        A plain-English summary for this section has not been written yet. Read the section in the current consolidated
        Act, and confirm the requirement on the current approved form.
      </p>
      <ul className="space-y-1.5 text-sm leading-6">
        <li>
          <a
            className="text-[color:var(--clinical-accent)] underline underline-offset-2"
            href={mhaActMetadata.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {`Mental Health Act 2014 (WA), version ${mhaActMetadata.actVersion} as at ${mhaActMetadata.actAsAt}`}
          </a>
        </li>
        {pdfHref ? (
          <li>
            <a
              className="text-[color:var(--clinical-accent)] underline underline-offset-2"
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
            >
              {formCode ? `Official Form ${formCode} PDF` : "Official form PDF"}
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

type ActSheetState = { mode: "index" } | { mode: "section"; section: string } | null;

export function PriorityFactsSection({ form, cards }: { form: FormRecord; cards: ServiceSummaryCard[] }) {
  const details = formCatalogDetails(form);
  // catalogPayload arrives from the owner-record path as an unchecked cast, bypassing
  // the actSections() coercer, so a malformed stored entry must not render a bare chip.
  const actSections = (details?.actSections ?? []).filter((entry) => hasText(entry?.section) && hasText(entry?.title));
  const [activeFactId, setActiveFactId] = useState<string | null>(null);
  const [actSheet, setActSheet] = useState<ActSheetState>(null);

  const activeFact = activeFactId ? priorityFactBody(form, activeFactId) : null;
  const activeSection =
    actSheet?.mode === "section" ? (actSections.find((entry) => entry.section === actSheet.section) ?? null) : null;
  const pdfHref = details?.officialPdfUrl ?? details?.officialRegisterUrl;

  return (
    <>
      <section
        id="form-priority-facts"
        aria-label="Priority facts"
        className={cn(inPageAnchor, "space-y-2.5 sm:space-y-3")}
      >
        <h2 className="text-base-minus font-semibold leading-5 text-[color:var(--text-heading)] sm:text-base">
          Priority facts
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {cards.map((card) => {
            if (card.id === "act-sections" && actSections.length) {
              return (
                <ActSectionsCard
                  key={card.id}
                  card={card}
                  sections={actSections}
                  onOpenSection={(section) => setActSheet({ mode: "section", section })}
                  onOpenIndex={() => setActSheet({ mode: "index" })}
                />
              );
            }
            const detail = priorityFactBody(form, card.id);
            const hasDetail = hasExtraDetail(card, detail);
            return (
              <DetailCard
                key={card.id}
                card={card}
                hasDetail={hasDetail}
                onOpenDetail={hasDetail ? () => setActiveFactId(card.id) : undefined}
              />
            );
          })}
        </div>
      </section>

      <Sheet
        open={Boolean(activeFact)}
        onClose={() => setActiveFactId(null)}
        title={activeFact?.title?.trim() || "Priority fact"}
        description={activeFact?.detail}
        testId="form-priority-fact-sheet"
        mobilePlacement="bottom"
      >
        {activeFact ? <p className="text-sm leading-6 text-[color:var(--text-body)]">{activeFact.body}</p> : null}
      </Sheet>

      <Sheet
        open={Boolean(actSheet)}
        onClose={() => setActSheet(null)}
        title={activeSection ? `Section ${activeSection.section}` : "Act sections"}
        description={
          activeSection?.title ??
          (details?.form ? `Form ${details.form} cites ${actSections.length} sections` : undefined)
        }
        testId="form-act-section-sheet"
        mobilePlacement="bottom"
      >
        {activeSection ? (
          <div className="space-y-3">
            {hasText(activeSection.summary) ? (
              <p className="text-sm leading-6 text-[color:var(--text-body)]">{activeSection.summary}</p>
            ) : (
              <PendingSectionBody formCode={details?.form} pdfHref={pdfHref} />
            )}
            {activeSection.reviewStatus === "drafted" ? (
              // The summary was written from the statutory text but carries no clinician
              // sign-off yet. Say so rather than let it read as reviewed clinical content.
              <p className={cn("text-xs leading-5", textMuted)}>
                Drafted from the Act text and awaiting clinical review.
              </p>
            ) : null}
            <p className={cn("text-xs leading-5", textMuted)}>
              Condensed reference from the Mental Health Act 2014 (WA). Confirm against the current Act and approved
              form before clinical or legal use.
            </p>
          </div>
        ) : actSheet?.mode === "index" ? (
          <ul className="space-y-1">
            {actSections.map((entry) => (
              <li key={entry.section}>
                <button
                  type="button"
                  onClick={() => setActSheet({ mode: "section", section: entry.section })}
                  className="w-full min-h-12 rounded-md px-2 py-1.5 text-left text-sm leading-6 text-[color:var(--text-body)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  <span className="font-semibold text-[color:var(--text-heading)]">{`Section ${entry.section}`}</span>
                  {` — ${entry.title}`}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Sheet>
    </>
  );
}
