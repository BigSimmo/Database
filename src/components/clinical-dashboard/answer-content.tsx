"use client";

import { memo, useState } from "react";
import { CircleAlert, ChevronDown, Copy, ShieldCheck } from "lucide-react";

import { SafeBoldText } from "@/components/SafeBoldText";
import { chatActionRow, chatAnswerText, chatMicroAction, cn, textMuted } from "@/components/ui-primitives";
import { comparableAnswerText, sanitizeAnswerDisplayText } from "@/components/clinical-dashboard/display-text";
import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { AnswerSourceRail } from "@/components/clinical-dashboard/answer-source-rail";
import { buildAnswerSourceRows } from "@/components/clinical-dashboard/answer-source-rows";
import { SignedImage } from "@/components/clinical-dashboard/signed-image";
import { clinicalProseUsefulness } from "@/lib/source-text-sanitizer";
import { type SourceLink } from "@/lib/answer-render-policy";
import type {
  AnswerSection,
  AnswerSectionKind,
  BestSourceRecommendation,
  RagAnswer,
  SearchResult,
  VisualEvidenceCard,
} from "@/lib/types";

export const SourceImage = memo(function SourceImage({
  endpoint,
  caption,
  className = "max-h-52",
}: {
  endpoint: string;
  caption: string;
  className?: string;
}) {
  return (
    <SignedImage
      endpoint={endpoint}
      alt={caption?.trim() || "Clinical document image"}
      caption={caption}
      className={className}
      zoomable
    />
  );
});

export type AnswerDisplayTextOptions = {
  // Server-`preformatted` answers are display-ready by construction; skip the
  // noise-stripping prose sanitizer and fragment slicing so their document
  // names / facility codes survive.
  preformatted?: boolean;
  // Keep server high-yield bold (**…**) so <SafeBoldText> can render it.
  preserveBold?: boolean;
};

/**
 * Reports whether an answer is a server-`preformatted`, grounded answer whose
 * display text should bypass prose sanitization and be shown as-is.
 *
 * @param answer - The answer to check, or `null`/`undefined` when unavailable
 * @returns `true` when the answer is preformatted and grounded
 */
export function isPreformattedGroundedAnswer(answer: Pick<RagAnswer, "preformatted" | "grounded"> | null | undefined) {
  return Boolean(answer?.preformatted && answer?.grounded);
}

// Fragments carrying a safety-critical signal must never be dropped by the
// compact 3-fragment / 85-word cap — a withhold/threshold/escalation caveat
// hidden from the primary prose is a clinical-safety regression.
// Covers the common withhold / withdrawal / contraindication / negation /
// escalation directives so a short safety caveat is never dropped from the
// compact primary answer. Kept deliberately broad (matching a non-safety
// fragment only preserves it verbatim — the safe direction).
const primaryAnswerSafetySignalPattern =
  /\b(?:withhold|withheld|stop|cease|discontinue\w*|suspend\w*|hold|held|threshold|escalat\w*|urgent|immediately|never|avoid|contraindicat\w*|toxic|red\s*zone|amber|(?:do|must|should|will)\s+not|not\s+recommended)\b/i;

// Test against a de-bolded copy so server bold markers inside a phrase
// ("do **not** administer", "red **zone**") on the preserveBold path can never
// defeat the safety match and let a caveat be dropped by the compact cap.
function isPrimaryAnswerSafetyFragment(fragment: string) {
  return primaryAnswerSafetySignalPattern.test(fragment.replace(/\*\*/g, ""));
}

// Shared tail of the sanitize path: run the display sanitizer, then strip the
// synthetic-demo notice both plainAnswerText and primaryAnswerDisplayText need
// removed before the text reaches the screen.
function sanitizeAndStripSyntheticNotice(value: string, options: AnswerDisplayTextOptions) {
  return sanitizeAnswerDisplayText(value, {
    minLength: 8,
    minTokens: 2,
    preformatted: options.preformatted,
    preserveBold: options.preserveBold,
  })
    .replace(/(?:\s*\n\s*)?Synthetic demo only:.*$/i, "")
    .trim();
}

/**
 * Produces sanitized, display-ready text for an answer.
 *
 * @param value - The answer text to sanitize
 * @param options - Controls preformatted handling and bold-text preservation
 * @returns The sanitized answer text
 */
export function plainAnswerText(value: string, options: AnswerDisplayTextOptions = {}) {
  // clinicalProseUsefulness runs the source-noise stripper, so preformatted
  // answers bypass it and go straight to the lossless display path.
  const base = options.preformatted ? value : clinicalProseUsefulness(value).text || value;
  return sanitizeAndStripSyntheticNotice(base, options);
}

/**
 * Selects and compacts the primary answer text while preserving safety-critical guidance.
 *
 * @param value - The answer text to prepare for display
 * @param options - Formatting options, including preformatted mode
 * @returns The display-ready answer text
 */
export function primaryAnswerDisplayText(value: string, options: AnswerDisplayTextOptions = {}) {
  // Deterministic preformatted answers are already concise and display-ready;
  // the fragment-level usefulness pass below would re-strip the very names/codes
  // the preformatted path just preserved, so return them as-is.
  if (options.preformatted) return plainAnswerText(value, options);
  // Skip whole-text clinicalProseUsefulness: its 3-token floor drops short
  // safety sentences ("Stop lithium.") before the fragment-level safety
  // bypass below can rescue them.
  const cleaned = sanitizeAndStripSyntheticNotice(value, { preformatted: false, preserveBold: options.preserveBold });
  const fragments = cleaned
    .split(/\r?\n+/)
    .flatMap((line: string) =>
      line.split(/(?<=[.!?])\s+(?=(?:[A-Z]|\*\*|If\b|When\b|Do\b|Use\b|Monitor\b|Escalate\b|Document\b))/),
    )
    .map((fragment: string) =>
      fragment
        .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
        .replace(
          /^(?:\*\*)?(?:answer|summary|bottom line|direct answer|clinical point|key point|required actions?|monitoring(?:\/timing)?|thresholds?|dose detail|medication(?:\/dose details?)?|escalation(?:\/risk)?|risk|safety|documentation(?:\/forms)?|source gaps?)(?:\*\*)?:\s+/i,
          "",
        )
        .trim(),
    )
    // Safety-bearing fragments pass through untouched and are never dropped by
    // the usefulness/length gate — a short caveat like "Contraindicated in
    // pregnancy" (under the 8-word floor) must still reach the display.
    .map((fragment: string) =>
      isPrimaryAnswerSafetyFragment(fragment) ? fragment : clinicalProseUsefulness(fragment).text || fragment,
    )
    .filter((fragment: string) => {
      if (!fragment) return false;
      if (isPrimaryAnswerSafetyFragment(fragment)) return true;
      const useful = clinicalProseUsefulness(fragment);
      return useful.useful || fragment.split(/\s+/).length >= 8;
    });
  const uniqueFragments = Array.from(new Set(fragments));
  const selected: string[] = [];
  let nonSafetyKept = 0;
  let wordBudget = 85;
  for (const fragment of uniqueFragments) {
    if (isPrimaryAnswerSafetyFragment(fragment)) {
      selected.push(fragment);
      continue;
    }
    if (nonSafetyKept >= 3 || wordBudget <= 0) continue;
    nonSafetyKept += 1;
    const words = fragment.split(/\s+/).filter(Boolean);
    if (words.length <= wordBudget) {
      selected.push(fragment);
      wordBudget -= words.length;
    } else {
      selected.push(
        `${words
          .slice(0, wordBudget)
          .join(" ")
          .replace(/[;,:-]\s*$/, "")}...`,
      );
      wordBudget = 0;
    }
  }
  return selected.join(" ") || cleaned;
}

/**
 * The cited-source derivations moved to `answer-source-rows`, which the rail,
 * the drawer, and this module all read. They are re-exported here so existing
 * import paths (and the tests that pin them) keep resolving.
 */
export {
  buildAnswerSourceRows,
  sourceCapsuleDisplay,
  sourceStatusDotClass,
  sourceStatusDotTone,
  sourceStatusShortLabel,
  type AnswerSourceRow,
  type CapsulePreviewSource,
} from "@/components/clinical-dashboard/answer-source-rows";

/**
 * Displays a sanitized clinical answer with source status, source previews, and copy actions.
 *
 * @param text - The raw answer text to display.
 * @param query - The user's query context for logging.
 * @param preformatted - Whether to preserve the supplied formatting during display processing.
 * @param sourceOnly - Whether to show a notice that the answer was assembled solely from source passages.
 * @param bestSource - The highest-priority source recommendation, when available.
 * @param sources - Search results used to build the source preview.
 * @param sourceLinks - Source links and snippets associated with the answer.
 * @param copied - Whether the answer has been copied.
 * @param onCopy - Callback invoked to copy the answer with source status.
 * @returns The rendered answer section, or `null` when the answer has no displayable text.
 */
export function NaturalLanguageAnswer({
  text,
  query,
  preformatted = false,
  sourceOnly,
  bestSource,
  sources,
  sourceLinks,
  copied,
  onCopy,
  onOpenSource,
}: {
  // Raw answer text (server bold intact); this component owns display
  // sanitization so <SafeBoldText> can render the high-yield emphasis.
  text: string;
  query?: string;
  preformatted?: boolean;
  sourceOnly: boolean;
  bestSource: BestSourceRecommendation | null;
  sources: SearchResult[];
  sourceLinks: SourceLink[];
  copied: boolean;
  onCopy: () => void;
  /**
   * Opens the source drawer at the given rail row. The drawer is mounted by the
   * answer surface rather than here, so the rail reports the row and the surface
   * owns which one is open.
   */
  onOpenSource?: (index: number) => void;
}) {
  const [sourceOnlyNoticeOpen, setSourceOnlyNoticeOpen] = useState(false);
  const { preferences } = useAppPreferences();
  const cleaned = primaryAnswerDisplayText(text, { preformatted, preserveBold: true });
  if (!cleaned) return null;
  const railSources = buildAnswerSourceRows(bestSource, sources, sourceLinks);
  return (
    <section
      data-testid="plain-answer-response"
      aria-label="Primary natural-language answer"
      className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[color:var(--text-heading)]"
    >
      <span
        data-testid="answer-clinical-icon"
        className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/25 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
        aria-hidden="true"
      >
        <ShieldCheck aria-hidden="true" className="size-icon-lg" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className={chatAnswerText}>
          <span data-testid="plain-answer-prose">
            <SafeBoldText text={cleaned} />
          </span>
        </p>
        <div className="space-y-1 -mb-2">
          {sourceOnly ? (
            <section
              data-testid="source-only-disclosure"
              role="note"
              className={cn(
                "w-fit max-w-full overflow-hidden border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/40 text-xs transition-[border-radius] duration-[var(--duration-quick)]",
                sourceOnlyNoticeOpen ? "rounded-lg" : "rounded-full",
                textMuted,
              )}
            >
              <button
                type="button"
                onClick={() => setSourceOnlyNoticeOpen((current) => !current)}
                className="inline-flex min-h-7 w-full max-w-[68ch] items-center gap-1.5 px-2.5 py-1 text-left transition hover:bg-[color:var(--warning-soft)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
                aria-expanded={sourceOnlyNoticeOpen}
                aria-controls="source-only-disclosure-detail"
              >
                <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
                <span className="min-w-0 truncate font-semibold text-[color:var(--text-heading)]">Source-only</span>
                <span className="shrink-0 text-2xs text-[color:var(--text-muted)]">· verify passages</span>
                <ChevronDown
                  className={cn(
                    "ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)] transition-transform",
                    sourceOnlyNoticeOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {sourceOnlyNoticeOpen ? (
                <div
                  id="source-only-disclosure-detail"
                  className="border-t border-[color:var(--warning)]/15 px-3 py-2 text-2xs leading-5 text-[color:var(--text-muted)] motion-safe:animate-fade-up"
                >
                  <p>
                    This answer was assembled from your documents without the AI model, so it may be less complete.
                    Verify dose, threshold, route, timing, monitoring, and risk details against the cited passages
                    below.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
        <AnswerSourceRail
          sources={railSources}
          query={query}
          onOpenSource={onOpenSource}
          compact={preferences.compactCitations}
        />
        <div className={cn(chatActionRow, "mt-0.5")} aria-label="Answer actions">
          <button
            type="button"
            onClick={onCopy}
            className={chatMicroAction}
            aria-label="Copy answer with source status"
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            {copied ? "Copied with sources" : "Copy with sources"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function UserQuestionBubble({ query }: { query: string }) {
  const cleaned = query.trim();
  if (!cleaned) return null;

  return (
    <section className="flex justify-end px-1" aria-label="User question">
      <div
        data-testid="user-question-bubble"
        className="ml-auto max-w-[min(28rem,86%)] rounded-lg border border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2 text-right shadow-[var(--shadow-inset)] sm:max-w-[28rem]"
      >
        <p className="text-sm font-medium leading-6 text-[color:var(--text-heading)]">{cleaned}</p>
      </div>
    </section>
  );
}

type KeyClinicalItem = {
  id: string;
  label?: string;
  detail: string;
};

function keyClinicalItemFromText(item: string): KeyClinicalItem | null {
  const cleaned = item.replace(/^[-*•]\s*/, "").trim();
  if (cleaned.length < 24) return null;
  const [labelCandidate, ...detailParts] = cleaned.split(/\s+(?:—|-)\s+/);
  const label = labelCandidate?.trim();
  const detail = detailParts.join(" — ").trim();
  const id = comparableAnswerText(cleaned);
  if (label && detail && label.length <= 64) return { id, label, detail };
  return { id, detail: cleaned };
}

export function keyClinicalItemsFromSections(
  sections: Array<AnswerSection & { citationSources: SearchResult[] }>,
): KeyClinicalItem[] {
  const usefulKinds = new Set<AnswerSectionKind | undefined>([
    "required_actions",
    "monitoring_timing",
    "medication_dose",
    "thresholds",
    "escalation_risk",
    "contraindications_cautions",
    "comparison",
  ]);
  return sections
    .filter((section) => usefulKinds.has(section.kind))
    .flatMap((section) =>
      section.body
        .split(/\n+|(?<=\.)\s+(?=(?:Monitor|Check|Use|Avoid|Escalate|Withhold|Review|Document|Repeat|Consider)\b)/)
        .map((item) => keyClinicalItemFromText(item))
        .filter((item): item is KeyClinicalItem => Boolean(item)),
    )
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 5);
}

export function keyClinicalItemsFromTable(item: VisualEvidenceCard | null): KeyClinicalItem[] {
  const rows = item?.tableRows?.filter((row) => row.some((cell) => cell.trim())) ?? [];
  if (rows.length < 2) return [];

  return rows
    .slice(0, 3)
    .map((row): KeyClinicalItem | null => {
      const [domain, baseline] = row.map((cell) => cell.trim()).filter(Boolean);
      if (!domain || !baseline) return null;
      return {
        id: comparableAnswerText([domain, baseline].join(" ")),
        label: domain,
        detail: baseline,
      };
    })
    .filter((value): value is KeyClinicalItem => value !== null)
    .slice(0, 5);
}
