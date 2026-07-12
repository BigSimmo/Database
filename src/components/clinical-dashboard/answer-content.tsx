"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SafeBoldText } from "@/components/SafeBoldText";
import { Sheet } from "@/components/ui/sheet";
import {
  chatActionRow,
  chatAnswerText,
  chatMicroAction,
  cn,
  sourceCapsule,
  sourceCapsuleCountBadge,
  statusDotMuted,
  statusDotReady,
  statusDotReview,
  subtleStatusPill,
  textMuted,
} from "@/components/ui-primitives";
import { sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import {
  cleanDisplayTitle,
  comparableAnswerText,
  sanitizeAnswerDisplayText,
} from "@/components/clinical-dashboard/display-text";
import { useMobilePreviewSheet } from "@/components/clinical-dashboard/use-mobile-preview-sheet";
import { SourcePreviewPopover } from "@/components/clinical-dashboard/source-preview-popover";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { normalizeSourceMetadata, sourceStatusLabel } from "@/lib/source-metadata";
import { clinicalProseUsefulness } from "@/lib/source-text-sanitizer";
import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  type SourceGovernanceWarning,
} from "@/lib/source-governance";
import { type SourceLink } from "@/lib/answer-render-policy";
import { useAuthSession } from "@/lib/supabase/client";
import type {
  AnswerSection,
  AnswerSectionKind,
  BestSourceRecommendation,
  SearchResult,
  SearchScopeSummary,
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
  const [url, setUrl] = useState(() => getCachedSignedUrl(endpoint)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const { authorizationHeader, markSessionExpired } = useAuthSession();

  useEffect(() => {
    const cached = getCachedSignedUrl(endpoint);
    if (cached) return () => undefined;

    let active = true;
    fetch(endpoint, { headers: authorizationHeader })
      .then((response) => {
        if (response.status === 401) markSessionExpired();
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (active && data?.url) {
          setCachedSignedUrl(endpoint, data);
          setUrl(data.url);
          setFailed(false);
        } else if (active) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, authorizationHeader, endpoint, markSessionExpired]);

  function retryImage() {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(false);
    setLoaded(false);
    setAttempt((current) => current + 1);
  }

  function handleImageError() {
    clearCachedSignedUrl(endpoint);
    setLoaded(false);
    setFailed(true);
  }

  if (failed) {
    return (
      <div
        className={cn(
          className,
          "grid aspect-[4/3] w-full place-items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-4 text-center text-xs font-semibold text-[color:var(--warning)]",
        )}
      >
        <div>
          <AlertCircle className="mx-auto mb-2 h-5 w-5" />
          Image preview could not load.
          <button
            type="button"
            onClick={retryImage}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3 text-[color:var(--warning)]"
          >
            Retry image
          </button>
        </div>
      </div>
    );
  }

  // A fixed-aspect frame reserves the image's box up front so the loaded image
  // never resizes the layout (the placeholder and the image share one box). The
  // image object-contains within it and fades in on decode, so nothing below
  // shifts when it arrives.
  return (
    <div
      className={cn(
        className,
        "relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[color:var(--surface-inset)]",
      )}
    >
      {url ? (
        <img
          src={url}
          alt={caption?.trim() || "Clinical document image"}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
          className={cn(
            "absolute inset-0 h-full w-full rounded-lg object-contain transition-opacity duration-300 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {!url || !loaded ? (
        <div className="absolute inset-0 grid place-items-center gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading image
        </div>
      ) : null}
    </div>
  );
});

export function ScopeAndGovernanceNotice({
  scope,
  warnings,
}: {
  scope: SearchScopeSummary | null;
  warnings: SourceGovernanceWarning[];
}) {
  const groupedWarnings = groupSourceGovernanceWarnings(frontendSourceGovernanceWarnings(warnings)).slice(0, 4);
  const showScope =
    Boolean(scope && scope.activeFilterCount > 0) ||
    Boolean(scope?.warnings?.length) ||
    scope?.matchedDocumentCount === 0;
  if (!showScope && groupedWarnings.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-md border border-[color:var(--warning)]/20 border-l-2 border-l-[color:var(--warning)] bg-[color:var(--warning-soft)]/30 px-2.5 py-2 text-xs text-[color:var(--text)]">
      {showScope && scope ? (
        <p className="font-semibold leading-5">
          Scope: {scope.summary}
          {scope.queryMode && scope.queryMode !== "auto" ? ` · ${scope.queryMode.replaceAll("_", " ")}` : ""}
        </p>
      ) : null}
      {scope?.warnings?.length ? (
        <ul className="grid gap-0.5 text-2xs font-medium text-[color:var(--warning)]">
          {scope.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {groupedWarnings.length ? (
        <ul className="grid gap-0.5 text-2xs font-medium text-[color:var(--warning)]">
          {groupedWarnings.map((warning) => (
            <li key={warning.code}>
              {warning.message}
              {warning.titles.length ? (
                <details className="mt-0.5 font-normal text-[color:var(--text-muted)]">
                  <summary className="cursor-pointer">Sources affected</summary>
                  <span className="mt-0.5 block">{warning.titles.slice(0, 5).join(", ")}</span>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type AnswerDisplayTextOptions = {
  // Server-`preformatted` answers are display-ready by construction; skip the
  // noise-stripping prose sanitizer and fragment slicing so their document
  // names / facility codes survive.
  preformatted?: boolean;
  // Keep server high-yield bold (**…**) so <SafeBoldText> can render it.
  preserveBold?: boolean;
};

// Fragments carrying a safety-critical signal must never be dropped by the
// compact 3-fragment / 85-word cap — a withhold/threshold/escalation caveat
// hidden from the primary prose is a clinical-safety regression.
const primaryAnswerSafetySignalPattern =
  /\b(?:withhold|withheld|stop|cease|hold|threshold|escalat|urgent|red\s*zone|amber|immediately|do not|contraindicat|toxic)\b/i;

export function plainAnswerText(value: string, options: AnswerDisplayTextOptions = {}) {
  // clinicalProseUsefulness runs the source-noise stripper, so preformatted
  // answers bypass it and go straight to the lossless display path.
  const base = options.preformatted ? value : clinicalProseUsefulness(value).text || value;
  return sanitizeAnswerDisplayText(base, {
    minLength: 8,
    minTokens: 2,
    preformatted: options.preformatted,
    preserveBold: options.preserveBold,
  })
    .replace(/(?:\s*\n\s*)?Synthetic demo only:.*$/i, "")
    .trim();
}

function primaryAnswerDisplayText(value: string, options: AnswerDisplayTextOptions = {}) {
  const cleaned = plainAnswerText(value, options);
  // Deterministic preformatted answers are already concise and display-ready;
  // the fragment-level usefulness pass below would re-strip the very names/codes
  // the preformatted path just preserved, so return them as-is.
  if (options.preformatted) return cleaned;
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
    .map((fragment: string) => clinicalProseUsefulness(fragment).text || fragment)
    .filter((fragment: string) => {
      if (!fragment) return false;
      const useful = clinicalProseUsefulness(fragment);
      return useful.useful || fragment.split(/\s+/).length >= 8;
    });
  const uniqueFragments = Array.from(new Set(fragments));
  // Compact head (unchanged when no later fragment is safety-critical), plus any
  // safety-signal fragment beyond the head appended in full so the cap can never
  // hide it. When safetyTail is empty this is byte-identical to the prior cap.
  const head = uniqueFragments.slice(0, 3);
  const safetyTail = uniqueFragments.slice(3).filter((fragment) => primaryAnswerSafetySignalPattern.test(fragment));
  const headWords = head.join(" ").split(/\s+/).filter(Boolean);
  const headText =
    headWords.length <= 85
      ? head.join(" ")
      : `${headWords
          .slice(0, 85)
          .join(" ")
          .replace(/[;,:-]\s*$/, "")}...`;
  const selected = [headText, ...safetyTail].filter(Boolean).join(" ");
  return selected || cleaned;
}

// One compact "Sources" pill in every state: the amber Source-only pill and the
// "Review source match" banner already carry the verify-first caveat, so the
// capsule label no longer restates grounding strength.
function sourceCapsuleDisplay({ sourceCount }: { sourceCount: number }): {
  label: string;
  showCountBadge: boolean;
} {
  if (sourceCount <= 0) return { label: "No direct source found", showCountBadge: false };
  return { label: "Sources", showCountBadge: true };
}

export function sourceStatusDotClass(metadata: ReturnType<typeof normalizeSourceMetadata> | null | undefined) {
  if (!metadata) return statusDotMuted;
  if (metadata.document_status === "current") return statusDotReady;
  if (metadata.document_status === "review_due" || metadata.document_status === "outdated") return statusDotReview;
  return statusDotMuted;
}

type CapsulePreviewSource = {
  id: string;
  title: string;
  pageNumber: number | null;
  metadata: ReturnType<typeof normalizeSourceMetadata>;
  score: number;
  href: string;
  snippet?: string;
  sourceStrength?:
    SourceLink["sourceStrength"] | BestSourceRecommendation["source_strength"] | SearchResult["source_strength"];
};

function sourceBadgeLabel(index: number) {
  return `S${index + 1}`;
}

function sourceBadgeToneClass(metadata: ReturnType<typeof normalizeSourceMetadata>, index: number) {
  if (metadata.document_status === "review_due" || metadata.document_status === "outdated") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  if (index === 0) {
    return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]";
  }
  return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
}

function sourceSupportLabel(source: CapsulePreviewSource, index: number) {
  if (!source.sourceStrength || source.sourceStrength === "none") return "Unsupported";
  if (source.sourceStrength === "limited") return "Partial";
  if (source.sourceStrength === "moderate") return "Partial";
  if (index === 0 || source.sourceStrength === "strong") return "Direct";
  return "Partial";
}

function sourceStatusShortLabel(metadata: ReturnType<typeof normalizeSourceMetadata>) {
  if (metadata.document_status === "review_due") return "Review due";
  if (metadata.document_status === "outdated") return "Outdated";
  if (metadata.document_status === "current") return "Current";
  return sourceStatusLabel(metadata);
}

function sourcePreviewPageCountLabel(previewSources: CapsulePreviewSource[]) {
  const uniquePages = new Set(previewSources.map((source) => source.pageNumber).filter((page) => page !== null));
  const count = uniquePages.size || previewSources.length;
  return `${count} page${count === 1 ? "" : "s"}`;
}

function capsulePreviewSources(
  bestSource: BestSourceRecommendation | null,
  sources: SearchResult[],
  sourceLinks: SourceLink[] = [],
) {
  const rows: CapsulePreviewSource[] = [];
  const seen = new Set<string>();
  const pushRow = (row: CapsulePreviewSource) => {
    const key = `${row.id}:${row.title}:${row.pageNumber ?? "n/a"}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  sourceLinks.slice(0, 5).forEach((source) => {
    pushRow({
      id: source.chunk_id,
      title: source.title || source.file_name || "Source",
      pageNumber: source.page_number,
      metadata: normalizeSourceMetadata(source.sourceMetadata),
      score: source.score ?? 0,
      href: source.href,
      snippet: source.snippet,
      sourceStrength: source.sourceStrength,
    });
  });

  if (bestSource) {
    pushRow({
      id: bestSource.chunk_id,
      title: bestSource.title || bestSource.file_name || "Source",
      pageNumber: bestSource.page_number,
      metadata: normalizeSourceMetadata(bestSource.source_metadata),
      score: bestSource.score,
      href: bestSource.viewer_href,
      sourceStrength: bestSource.source_strength,
    });
  }

  sources.slice(0, 5).forEach((source) => {
    pushRow({
      id: source.id,
      title: source.title || source.file_name || "Source",
      pageNumber: source.page_number,
      metadata: normalizeSourceMetadata(source.source_metadata),
      score: source.hybrid_score ?? source.similarity ?? source.lexical_score ?? 0,
      href: sourceResultHref(source),
      sourceStrength: source.source_strength,
    });
  });

  return rows.slice(0, 4);
}

function SourcePreviewContent({
  previewSources,
  quoteText,
  copiedQuote,
  onCopyQuote,
  showHeader = true,
}: {
  previewSources: CapsulePreviewSource[];
  quoteText?: string | null;
  copiedQuote: boolean;
  onCopyQuote: () => void;
  showHeader?: boolean;
}) {
  const primaryPreviewSource = previewSources[0] ?? null;
  const reviewDueSource = previewSources.find(
    (source) => source.metadata.document_status === "review_due" || source.metadata.document_status === "outdated",
  );

  return (
    <>
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-[color:var(--text-heading)]">Sources</p>
              <span className={cn(subtleStatusPill, "nums min-h-6 px-2 text-2xs")}>
                {sourcePreviewPageCountLabel(previewSources)}
              </span>
            </div>
            <p className={cn("mt-1 text-xs leading-5", textMuted)}>Open the original PDF page.</p>
          </div>
        </div>
      ) : null}
      <div
        className={cn("grid gap-0 divide-y divide-[color:var(--border)]", showHeader ? "mt-3" : "")}
        role="list"
        aria-label="Sources behind this answer"
      >
        {previewSources.map((source, index) => (
          <div
            key={`${source.id}:${index}`}
            role="listitem"
            className={cn(
              "min-w-0 py-2.5",
              index === 0 &&
                "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 shadow-[var(--shadow-inset)]",
            )}
          >
            {index === 0 ? (
              <p className="mb-2 inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                Best match
              </p>
            ) : index === 1 ? (
              <p className="mb-1.5 text-xs font-semibold text-[color:var(--text-muted)]">Also used</p>
            ) : null}
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
              <span
                className={cn(
                  "nums grid h-8 min-w-8 place-items-center rounded-md border px-1 text-xs font-bold shadow-[var(--shadow-inset)]",
                  sourceBadgeToneClass(source.metadata, index),
                )}
              >
                {sourceBadgeLabel(index)}
              </span>
              <span className="min-w-0">
                <Link
                  href={source.href}
                  data-testid="source-capsule-preview-row"
                  className="flex min-h-12 items-center rounded-md text-sm font-semibold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label={`Open source ${cleanDisplayTitle(source.title)}, page ${source.pageNumber ?? "not available"}`}
                >
                  <span className="line-clamp-2">{cleanDisplayTitle(source.title)}</span>
                </Link>
                <span className={cn("mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs", textMuted)}>
                  <span className="font-mono tabular-nums">p. {source.pageNumber ?? "n/a"}</span>
                  <span aria-hidden>·</span>
                  <span>{sourceSupportLabel(source, index)}</span>
                  <span className={sourceStatusDotClass(source.metadata)} aria-hidden="true" />
                  <span
                    className={
                      source.metadata.document_status === "review_due" || source.metadata.document_status === "outdated"
                        ? "font-semibold text-[color:var(--warning)]"
                        : undefined
                    }
                  >
                    {sourceStatusShortLabel(source.metadata)}
                  </span>
                </span>
              </span>
              <Link
                href={source.href}
                className={cn(
                  index === 0
                    ? "inline-flex min-h-12 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)]"
                    : "grid h-12 w-12 place-items-center rounded-md text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                )}
                aria-label={`Open ${sourceBadgeLabel(index)} source page`}
              >
                <ExternalLink className="h-4 w-4" />
                {index === 0 ? <span>Open</span> : null}
              </Link>
            </div>
          </div>
        ))}
      </div>
      {quoteText ? (
        <blockquote className="mt-3 border-l-2 border-[color:var(--clinical-accent)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]">
          &ldquo;{quoteText}&rdquo;
        </blockquote>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {primaryPreviewSource ? (
          <Link
            href={primaryPreviewSource.href}
            className={chatMicroAction}
            aria-label={`Open source page for ${primaryPreviewSource.title}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open source page
          </Link>
        ) : null}
        {quoteText ? (
          <button type="button" className={chatMicroAction} onClick={onCopyQuote}>
            <Copy className="h-3.5 w-3.5" />
            {copiedQuote ? "Copied quote" : "Copy quote"}
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-2 text-xs font-semibold">
        <span
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5",
            reviewDueSource ? "text-[color:var(--warning)]" : "text-[color:var(--success)]",
          )}
        >
          {reviewDueSource ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {reviewDueSource
            ? `${sourceBadgeLabel(previewSources.indexOf(reviewDueSource))} review due`
            : "Sources current"}
        </span>
        {primaryPreviewSource ? (
          <Link
            href={primaryPreviewSource.href}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            Evidence details
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </>
  );
}

export function NaturalLanguageAnswer({
  text,
  preformatted = false,
  sourceCount,
  sourceOnly,
  bestSource,
  sources,
  sourceLinks,
  copied,
  onCopy,
}: {
  // Raw answer text (server bold intact); this component owns display
  // sanitization so <SafeBoldText> can render the high-yield emphasis.
  text: string;
  preformatted?: boolean;
  sourceCount: number;
  sourceOnly: boolean;
  bestSource: BestSourceRecommendation | null;
  sources: SearchResult[];
  sourceLinks: SourceLink[];
  copied: boolean;
  onCopy: () => void;
}) {
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [sourceOnlyNoticeOpen, setSourceOnlyNoticeOpen] = useState(false);
  const [copiedSourceQuote, setCopiedSourceQuote] = useState(false);
  const sourceCapsuleRef = useRef<HTMLButtonElement>(null);
  const copySourceQuoteTimerRef = useRef<number | null>(null);
  const usePreviewSheet = useMobilePreviewSheet();
  useEffect(() => {
    return () => {
      if (copySourceQuoteTimerRef.current !== null) window.clearTimeout(copySourceQuoteTimerRef.current);
    };
  }, []);
  const cleaned = primaryAnswerDisplayText(text, { preformatted, preserveBold: true });
  if (!cleaned) return null;
  const capsuleDisplay = sourceCapsuleDisplay({ sourceCount });
  const previewSources = capsulePreviewSources(bestSource, sources, sourceLinks);
  const quoteText = sourceLinks.find((source) => source.snippet)?.snippet || bestSource?.quote || bestSource?.snippet;
  const canOpenSourcePreview = previewSources.length > 0;
  async function copySourceQuote() {
    if (!quoteText) return;
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopiedSourceQuote(true);
      if (copySourceQuoteTimerRef.current !== null) window.clearTimeout(copySourceQuoteTimerRef.current);
      copySourceQuoteTimerRef.current = window.setTimeout(() => setCopiedSourceQuote(false), 1600);
    } catch {
      setCopiedSourceQuote(false);
    }
  }
  const sourceCapsuleButton = (
    <button
      type="button"
      ref={sourceCapsuleRef}
      className={cn(sourceCapsule, "w-fit")}
      aria-label="Open answer sources"
      aria-expanded={sourcePreviewOpen}
      onClick={() => {
        if (canOpenSourcePreview) setSourcePreviewOpen((current) => !current);
      }}
    >
      <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{capsuleDisplay.label}</span>
      {capsuleDisplay.showCountBadge ? <span className={sourceCapsuleCountBadge}>{sourceCount}</span> : null}
      {canOpenSourcePreview ? (
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", sourcePreviewOpen && "rotate-180")}
          strokeWidth={2.25}
          aria-hidden
        />
      ) : null}
    </button>
  );

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
        <ShieldCheck className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className={chatAnswerText}>
          <span data-testid="plain-answer-prose">
            <SafeBoldText text={cleaned} />
          </span>
        </p>
        <div className="space-y-1">
          {sourceOnly ? (
            <section
              data-testid="source-only-disclosure"
              role="note"
              className={cn(
                "w-fit max-w-full overflow-hidden border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/40 text-xs transition-[border-radius] duration-150",
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
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
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
          {sourceCapsuleButton}
        </div>
        {canOpenSourcePreview && !usePreviewSheet ? (
          <SourcePreviewPopover
            open={sourcePreviewOpen}
            onClose={() => setSourcePreviewOpen(false)}
            anchorRef={sourceCapsuleRef}
          >
            <SourcePreviewContent
              previewSources={previewSources}
              quoteText={quoteText}
              copiedQuote={copiedSourceQuote}
              onCopyQuote={copySourceQuote}
            />
          </SourcePreviewPopover>
        ) : null}
        <Sheet
          open={sourcePreviewOpen && canOpenSourcePreview && usePreviewSheet}
          onClose={() => setSourcePreviewOpen(false)}
          title="Sources"
          description="Open the original PDF page."
          titleAccessory={
            <span className={cn(subtleStatusPill, "nums min-h-6 px-2 text-2xs")}>
              {sourcePreviewPageCountLabel(previewSources)}
            </span>
          }
          closeLabel="Close answer sources"
          contentClassName="sm:max-w-xl"
          returnFocusRef={sourceCapsuleRef}
          portal
        >
          <div data-testid="source-capsule-preview">
            <SourcePreviewContent
              previewSources={previewSources}
              quoteText={quoteText}
              copiedQuote={copiedSourceQuote}
              onCopyQuote={copySourceQuote}
              showHeader={false}
            />
          </div>
        </Sheet>
        <div className={cn(chatActionRow, "mt-0.5")} aria-label="Answer actions">
          <button
            type="button"
            onClick={onCopy}
            className={chatMicroAction}
            aria-label="Copy answer with source status"
          >
            <Copy className="h-3.5 w-3.5" />
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
