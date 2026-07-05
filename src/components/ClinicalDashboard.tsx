"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  Globe2,
  HelpCircle,
  Heart,
  Keyboard,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  LockKeyhole,
  Palette,
  PanelTop,
  Quote,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UploadCloud,
  UserRound,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DocumentDeleteResult } from "@/components/DocumentManagementActions";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { isLocalNoAuthMode, publicUploadsEnabled } from "@/lib/env";
import {
  appBackdrop,
  answerSurface,
  cn,
  fieldControlWithIcon,
  fieldIcon,
  floatingControl,
  primaryControl,
  textMuted,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/sheet";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { StagedAnswerResultSurface } from "@/components/clinical-dashboard/answer-result-surface";
import { RelatedDocumentsPanel } from "@/components/clinical-dashboard/document-results";
import { AuthPanel } from "@/components/clinical-dashboard/auth-panel";
import { useSidebarCollapsed } from "@/components/clinical-dashboard/use-sidebar-collapsed";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import {
  type SidebarIdentity,
  deriveSidebarIdentity,
  ClinicalDesktopSidebar,
  ClinicalMobileSidebar,
} from "@/components/clinical-dashboard/ClinicalSidebar";
import {
  SetupChecklist,
  UploadPanel,
  IndexingMonitor,
  IngestionQualityConsole,
  LibraryHealthStrip,
  fallbackSetupChecks,
  hasReadyRequiredPublicSearchConfig,
  hasReadyPublicSearchSetup,
  type SetupCheck,
  type IngestionQualityReviewItem,
} from "@/components/clinical-dashboard/DocumentManagerPanel";
import { GuideDialog, GuideTrigger, UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { sanitizeAnswerDisplayText, sanitizeDisplayText } from "@/components/clinical-dashboard/display-text";
import {
  NaturalLanguageAnswer,
  ScopeAndGovernanceNotice,
  UserQuestionBubble,
} from "@/components/clinical-dashboard/answer-content";
import { AnswerEmptyState, AnswerSkeleton } from "@/components/clinical-dashboard/answer-status";
import { evidenceMapRowsFromRenderModel } from "@/components/clinical-dashboard/evidence-panels";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import { errorCopy } from "@/lib/ui-copy";
import { applicationsLauncherItemCount } from "@/components/applications-launcher-page";
import {
  DrawerGroupLabel,
  type DocumentDrawerMode,
  type DocumentDrawerStatusFilter,
  type LabelReviewMutationBody,
} from "@/components/clinical-dashboard/document-admin";

const DifferentialsHome = dynamic(
  () => import("@/components/clinical-dashboard/differentials-home").then((m) => m.DifferentialsHome),
  { ssr: false },
);
const FavouritesHub = dynamic(
  () => import("@/components/clinical-dashboard/favourites-hub").then((m) => m.FavouritesHub),
  { ssr: false },
);
const MedicationPrescribingWorkspace = dynamic(
  () =>
    import("@/components/clinical-dashboard/medication-prescribing-workspace").then(
      (m) => m.MedicationPrescribingWorkspace,
    ),
  { ssr: false },
);
export const ApplicationsLauncherWorkspace = dynamic(
  () => import("@/components/applications-launcher-page").then((m) => m.ApplicationsLauncherWorkspace),
  { ssr: false },
);
const DocumentDrawer = dynamic(
  () => import("@/components/clinical-dashboard/document-admin").then((m) => m.DocumentDrawer),
  { ssr: false },
);

import { DocumentSearchResultsPanel, type SearchFacets } from "@/components/clinical-dashboard/document-search-results";
import { isWeakRelevance } from "@/components/clinical-dashboard/relevance";
import {
  answerPayloadIsUsable,
  isRetryableError,
  isRetryableMessage,
  isRetryableStatus,
  keywordQueryFromNaturalLanguage,
  makeSearchError,
  progressForRetry,
  searchRetryCount,
  searchRetryDelaysMs,
  sleep,
  type AnswerPayload,
  type SearchError,
} from "@/components/clinical-dashboard/search-utils";
import {
  appModeQueryMode,
  appModeHomeHref,
  appModeResultKind,
  appModeCanUseSourceLibraryShortcut,
  appModeSearchConfig,
  appModeSourceLibrarySearchMode,
  isAppModeId,
  isAppModeVisible,
  type AppModeId,
  type AppModeSearchKind,
} from "@/lib/app-modes";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { rankFormRecords } from "@/lib/forms";
import { rankServiceRecords } from "@/lib/services";
import { useRegistryRecords } from "@/lib/use-registry-records";
import { buildAnswerFollowUpQuery, buildAnswerFollowUpSuggestions } from "@/lib/answer-follow-up";
import {
  clearPersistedAnswerThread,
  loadPersistedAnswerThread,
  maxStoredAnswerTurns,
  savePersistedAnswerThread,
} from "@/lib/answer-thread-storage";
import { buildAnswerRenderModel } from "@/lib/answer-render-policy";
import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  type SourceGovernanceWarning,
} from "@/lib/source-governance";
import { type SmartDocumentTag, type SmartDocumentTagFacet } from "@/lib/document-tags";
import type {
  ClinicalDocument,
  DocumentMatch,
  EvidenceRelevance,
  ImportBatch,
  IngestionJob,
  QuoteCard,
  RagAnswer,
  AnswerSection,
  RelatedDocument,
  SearchResult,
  SearchScopeSummary,
  ClinicalQueryMode,
  DocumentLabel,
} from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { differentialsMobileCompareAddonSlotId, modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { createQuoteFollowUp, type AnswerViewMode, shouldPollForUpdates } from "@/lib/ward-output";

export const navigationHashes = ["#search", "#quotes", "#images", "#sources"] as const;
export const mobileSectionFabMediaQuery =
  "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";

export const recentQueryStorageKey = "clinical-kb-recent-queries";
const documentPageSize = 150;
const activeIndexingPollFallbackMs = 5_000;
const setupRecheckPollMs = 60_000;
const indexingWorkDetailsPollMs = 15_000;
const stagedDashboardExtraction = {
  answerSurface: true,
} as const;
export type DocumentPagination = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
};
type RefreshOptions = {
  includeSetup?: boolean;
  includeDashboardData?: boolean;
  includeDocumentMeta?: boolean;
};
type PollHint = {
  active?: boolean;
  pollAfterMs?: number | null;
};
type SetupStatusPayload = {
  demoMode?: boolean;
  checks?: SetupCheck[];
  indexingActive?: boolean;
  pollAfterMs?: number | null;
};
type DocumentsPayload = {
  documents?: ClinicalDocument[];
  pagination?: DocumentPagination | null;
  demoMode?: boolean;
  setupRequired?: boolean;
  error?: string;
  indexing?: PollHint;
};
type JobsPayload = {
  jobs?: IngestionJob[];
  demoMode?: boolean;
  setupRequired?: boolean;
  error?: string;
  hasActiveJobs?: boolean;
  pollAfterMs?: number | null;
};
type BatchesPayload = {
  batches?: ImportBatch[];
  demoMode?: boolean;
  hasActiveBatches?: boolean;
  pollAfterMs?: number | null;
};
import type { AnswerFeedbackType } from "@/lib/answer-feedback";
export type { AnswerFeedbackType } from "@/lib/answer-feedback";
type IngestionQualityPayload = {
  items?: IngestionQualityReviewItem[];
  demoMode?: boolean;
};

export const clinicalQueryModeOptions: Array<{ value: ClinicalQueryMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "monitoring_schedule", label: "Monitoring" },
  { value: "dose_threshold_lookup", label: "Dose / thresholds" },
  { value: "contraindications_cautions", label: "Cautions" },
  { value: "escalation_criteria", label: "Escalation" },
  { value: "required_documentation", label: "Documentation" },
  { value: "compare_guidance", label: "Compare" },
];

function compactScopeFilters(filters: SearchScopeFilters) {
  const next: SearchScopeFilters = {};
  if (filters.medications?.length) next.medications = filters.medications;
  if (filters.topics?.length) next.topics = filters.topics;
  if (filters.documentTypes?.length) next.documentTypes = filters.documentTypes;
  if (filters.sites?.length) next.sites = filters.sites;
  if (filters.services?.length) next.services = filters.services;
  if (filters.settings?.length) next.settings = filters.settings;
  if (filters.populations?.length) next.populations = filters.populations;
  if (filters.risks?.length) next.risks = filters.risks;
  if (filters.workflows?.length) next.workflows = filters.workflows;
  if (filters.clinicalActions?.length) next.clinicalActions = filters.clinicalActions;
  if (filters.carePhases?.length) next.carePhases = filters.carePhases;
  if (filters.documentIntents?.length) next.documentIntents = filters.documentIntents;
  if (filters.contentFeatures?.length) next.contentFeatures = filters.contentFeatures;
  if (filters.sourceStatuses?.length) next.sourceStatuses = filters.sourceStatuses;
  if (filters.validationStatuses?.length) next.validationStatuses = filters.validationStatuses;
  if (filters.extractionQualities?.length) next.extractionQualities = filters.extractionQualities;
  if (filters.locality) next.locality = filters.locality;
  if (filters.importBatchIds?.length) next.importBatchIds = filters.importBatchIds;
  if (filters.collections?.length) next.collections = filters.collections;
  if (filters.labelTypesAny?.length) next.labelTypesAny = filters.labelTypesAny;
  return next;
}

type SearchResultModePayload =
  | {
      kind: "documents";
      query: string;
      demoMode?: boolean;
      sources: SearchResult[];
      documentMatches: DocumentMatch[];
      relevance?: EvidenceRelevance;
      facets?: SearchFacets;
      scope?: SearchScopeSummary;
      sourceGovernanceWarnings?: SourceGovernanceWarning[];
    }
  | {
      kind: "answer";
      query: string;
      payload: AnswerPayload;
    };

type SourceLibrarySearchMode = Extract<AppModeSearchKind, "documents" | "differentials">;

function parseSseData(lines: string[]) {
  const data = lines.join("\n").trim();
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    throw makeSearchError("Answer stream returned malformed data.", 500, true);
  }
}

function answerStreamProgressMessage(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

async function readAnswerStream(response: Response, onProgress: (message: string) => void): Promise<AnswerPayload> {
  if (!response.body) throw makeSearchError("Answer stream could not be opened.", undefined, true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: AnswerPayload | null = null;

  function processEvent(block: string) {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
    }

    if (dataLines.length === 0) return;
    const data = parseSseData(dataLines);
    if (data === null) return;
    if (event === "progress") {
      const message = answerStreamProgressMessage(data);
      if (message) onProgress(message);
      return;
    }
    if (event === "error") {
      const message = data && typeof data === "object" ? (data as { error?: unknown }).error : null;
      const details =
        data && typeof data === "object" ? (data as { details?: { message?: unknown } | unknown }).details : null;
      const detailMessage =
        details && typeof details === "object" && "message" in details && typeof details.message === "string"
          ? details.message
          : null;
      const status = data && typeof data === "object" ? (data as { status?: unknown }).status : null;
      const statusCode = typeof status === "number" ? status : undefined;
      const errorMessage =
        typeof message === "string" && message.trim()
          ? message
          : typeof detailMessage === "string" && detailMessage.trim()
            ? detailMessage
            : "Answer generation failed due to a streaming error.";
      throw makeSearchError(
        errorMessage,
        statusCode,
        isRetryableStatus(statusCode ?? 0) || isRetryableMessage(errorMessage),
      );
    }
    if (event === "final") {
      finalPayload = data as AnswerPayload;
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      if (block) processEvent(block);
      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) break;
  }

  if (buffer.trim()) processEvent(buffer.trim());
  if (!finalPayload) throw makeSearchError("Answer stream ended before a final answer was received.", undefined, true);
  return finalPayload as AnswerPayload;
}

function normalizeNavigationHash(hash: string) {
  return navigationHashes.includes(hash as (typeof navigationHashes)[number]) ? hash : "#search";
}
/**
 * A completed Q&A exchange kept on screen after a newer answer arrives, so
 * Answer mode reads as a conversation thread instead of replacing each result.
 */
type AnswerTurn = {
  id: string;
  query: string;
  answer: RagAnswer;
  sources: SearchResult[];
};

const maxVisiblePriorTurns = 10;

/**
 * Read-only surface for a previous turn in the answer thread. Renders the
 * question bubble and the natural-language answer with its source capsule;
 * evidence drawers, clinical notes, and feedback stay on the latest turn only.
 */
function PriorAnswerTurnSurface({
  turn,
  copied,
  collapsed,
  onToggleCollapsed,
  onCopy,
}: {
  turn: AnswerTurn;
  copied: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCopy: (text: string) => void;
}) {
  const renderModel = useMemo(
    () => buildAnswerRenderModel(turn.answer, { sources: turn.sources }),
    [turn.answer, turn.sources],
  );
  const safeText = useMemo(() => sanitizeAnswerDisplayText(turn.answer.answer), [turn.answer.answer]);
  const weakEvidence = renderModel.trust === "unsupported" || renderModel.trust === "low";
  const grounded =
    turn.answer.grounded === true && turn.answer.confidence !== "unsupported" && renderModel.trust !== "unsupported";
  const sourceCount =
    renderModel.primarySources.length ||
    turn.sources.length ||
    turn.answer.sources?.length ||
    turn.answer.citations.length;
  const previewText = safeText || turn.answer.answer;

  return (
    <div
      className="min-w-0 space-y-4 sm:space-y-5"
      data-dashboard-stage="answer-thread-turn"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
        <UserQuestionBubble query={turn.query} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} aria-hidden="true" />
          {collapsed ? "Show previous answer" : "Hide previous answer"}
        </button>
        {collapsed ? (
          <p className={cn("line-clamp-2 text-sm leading-6", textMuted)}>{previewText}</p>
        ) : (
          <NaturalLanguageAnswer
            text={previewText}
            sourceCount={sourceCount}
            weakEvidence={weakEvidence}
            grounded={grounded}
            sourceOnly={turn.answer.answerQualityTier === "source_only"}
            bestSource={renderModel.bestSource}
            sources={renderModel.reviewSources}
            sourceLinks={renderModel.primarySources}
            copied={copied}
            onCopy={() => onCopy(renderModel.copyText || previewText)}
          />
        )}
      </div>
    </div>
  );
}

type LibraryHealthTarget = "documents" | "setup" | "indexing" | "failures";
type IndexingMonitorFilter = "all" | "active" | "failed";
type UploadIndexingTab = "setup" | "upload" | "jobs" | "quality";

export function SettingsDialog({
  open,
  onClose,
  identity,
  theme,
  onToggleTheme,
  onSignOut,
  onOpenGuide,
}: {
  open: boolean;
  onClose: () => void;
  identity: SidebarIdentity;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
  onOpenGuide: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsEmailInputRef = useRef<HTMLInputElement | null>(null);
  const currentThemeLabel = theme === "dark" ? "Dark" : "Light";
  const auth = useAuthSession();
  const [settingsEmail, setSettingsEmail] = useState("");
  const [emailEntryOpen, setEmailEntryOpen] = useState(false);
  const [settingsEmailAttempted, setSettingsEmailAttempted] = useState(false);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const settingsAuthBusy = auth.status === "loading";
  const signedOutAccount = !identity.signedIn;

  async function submitSettingsEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsEmail.trim()) return;
    setAccountNotice(null);
    setSettingsEmailAttempted(true);
    await auth.signInWithEmail(settingsEmail.trim());
  }

  function openSettingsEmailEntry() {
    setEmailEntryOpen(true);
    setAccountNotice(null);
  }

  function chooseSettingsProvider(provider: string) {
    setAccountNotice(`${provider} sign-in is a placeholder for now. Continue with email to use this workspace.`);
  }

  useEffect(() => {
    if (!emailEntryOpen) return;
    const focusFrame = window.requestAnimationFrame(() => {
      settingsEmailInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [emailEntryOpen]);

  const settingSections = [
    {
      title: "Account",
      rows: [
        { icon: UserRound, label: "Profile", value: identity.displayName },
        { icon: Stethoscope, label: "Clinical role", value: "Consultant psychiatrist" },
      ],
    },
    {
      title: "Clinical defaults",
      rows: [
        { icon: Globe2, label: "Jurisdiction", value: "Western Australia", active: true },
        { icon: CircleUserRound, label: "Default population", value: "Adults" },
        { icon: SlidersHorizontal, label: "Answer style", value: "Conservative" },
      ],
    },
    {
      title: "App preferences",
      rows: [
        {
          icon: Palette,
          label: "Appearance",
          value: currentThemeLabel,
          onClick: onToggleTheme,
          actionLabel: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        },
        { icon: SettingsIcon, label: "Interface density", value: "Comfortable" },
      ],
    },
  ];
  const navItems = [
    { icon: SettingsIcon, label: "General" },
    { icon: Stethoscope, label: "Clinical defaults" },
    { icon: Sparkles, label: "Personalisation" },
    { icon: Bell, label: "Notifications" },
    { icon: LockKeyhole, label: "Security" },
    { icon: CircleUserRound, label: "Account", active: true },
    { icon: Keyboard, label: "Keyboard" },
    {
      icon: HelpCircle,
      label: "Help & About",
      onClick: () => {
        onClose();
        onOpenGuide();
      },
    },
  ];

  const closeButton = (
    <button
      ref={closeButtonRef}
      type="button"
      onClick={onClose}
      aria-label="Close settings"
      className="absolute right-2.5 top-[max(0.45rem,env(safe-area-inset-top))] z-10 grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:left-4 lg:right-auto lg:top-4 lg:h-10 lg:w-10"
    >
      <X className="h-4.5 w-4.5" />
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel="Close settings"
      labelledBy="account-settings-title"
      initialFocusRef={closeButtonRef}
      mobilePlacement="fullscreen"
      contentClassName="w-full max-w-none border-[color:var(--border-lux)] bg-[color:var(--background)] font-sans shadow-none lg:max-w-[900px] lg:bg-[color:var(--surface-lux)] lg:shadow-[var(--shadow-lux)]"
      bodyClassName="p-0"
    >
      <div className="relative grid h-dvh max-h-dvh min-h-0 overflow-hidden lg:h-auto lg:max-h-[min(86dvh,820px)] lg:grid-cols-[250px_minmax(0,1fr)]">
        {closeButton}
        <aside className="hidden border-r border-[color:var(--border-lux)] bg-[color:var(--surface)]/72 px-4 pb-5 pt-16 lg:flex lg:flex-col">
          <nav aria-label="Settings sections" className="grid gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    active
                      ? "bg-[color:var(--surface-lux)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] ring-1 ring-[color:var(--clinical-accent)]/10"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-lux)]/80 hover:text-[color:var(--text-heading)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="mx-auto min-h-0 w-full max-w-[460px] overflow-y-auto bg-[color:var(--background)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[max(2.45rem,calc(0.7rem+env(safe-area-inset-top)))] polished-scroll sm:px-5 lg:mx-0 lg:max-w-none lg:bg-transparent lg:px-7 lg:pb-7 lg:pt-6">
          <div className="mb-2 flex items-center justify-between gap-4 lg:mb-5">
            <div className="min-w-0">
              <h2
                id="account-settings-title"
                className="truncate text-[18px] font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-xl lg:text-[1.45rem] lg:leading-8"
              >
                Account &amp; app
              </h2>
            </div>
            <span className="hidden min-h-7 shrink-0 items-center rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-xs font-semibold leading-none text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] lg:inline-flex">
              Clinician account
            </span>
          </div>

          <section className="rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.06),var(--shadow-inset)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:p-4 lg:shadow-[var(--shadow-inset)]">
            <h3 className="mb-3 px-0.5 text-[15px] font-semibold leading-5 text-[color:var(--text-heading)]">
              Clinical Guide account
            </h3>
            <div className="flex items-center gap-3 lg:gap-3">
              <span
                className={cn(
                  "relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold leading-none ring-1 lg:h-12 lg:w-12",
                  signedOutAccount
                    ? "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] ring-[color:var(--border)]"
                    : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] ring-[color:var(--clinical-accent)]/10",
                )}
              >
                {signedOutAccount ? <UserRound className="h-5 w-5" /> : identity.initials}
                {identity.signedIn ? (
                  <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-6 text-[color:var(--text-heading)]">
                  {identity.displayName}
                </p>
                <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  {signedOutAccount ? "Sign in or create an account" : "Consultant psychiatrist, Western Australia"}
                </p>
              </div>
              {signedOutAccount ? (
                <div className="hidden w-[220px] shrink-0 grid-cols-1 gap-2 lg:grid">
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(primaryControl, "min-h-10 whitespace-nowrap px-3 text-sm leading-none")}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(floatingControl, "min-h-10 whitespace-nowrap px-3 text-sm leading-none")}
                  >
                    Sign in
                  </button>
                </div>
              ) : (
                <div className="hidden shrink-0 items-center gap-2 lg:flex">
                  <SettingsChip label="Private" />
                  <SettingsChip label="No PHI" />
                </div>
              )}
            </div>

            {signedOutAccount ? (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(primaryControl, "min-h-10 whitespace-nowrap px-2.5 text-sm leading-none")}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(floatingControl, "min-h-10 whitespace-nowrap px-2.5 text-sm leading-none")}
                  >
                    Sign in
                  </button>
                </div>

                {emailEntryOpen ? (
                  <form
                    onSubmit={submitSettingsEmail}
                    className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]"
                  >
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-[color:var(--text-muted)]">
                        Email address
                      </span>
                      <div className="relative">
                        <Mail className={fieldIcon} />
                        <input
                          ref={settingsEmailInputRef}
                          type="email"
                          value={settingsEmail}
                          onChange={(event) => setSettingsEmail(event.target.value)}
                          placeholder="you@clinic.example"
                          className={fieldControlWithIcon}
                        />
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={settingsAuthBusy || !settingsEmail.trim() || !auth.isConfigured}
                      className={cn(primaryControl, "w-full")}
                    >
                      {settingsAuthBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Continue with email
                    </button>
                  </form>
                ) : null}

                <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-soft)]">
                  <span className="h-px flex-1 bg-[color:var(--border)]" />
                  <span>or continue with</span>
                  <span className="h-px flex-1 bg-[color:var(--border)]" />
                </div>

                <div className="grid gap-2">
                  <SettingsProviderRow provider="Apple" onClick={() => chooseSettingsProvider("Apple")} />
                  <SettingsProviderRow provider="Google" onClick={() => chooseSettingsProvider("Google")} />
                  <SettingsProviderRow provider="Microsoft" onClick={() => chooseSettingsProvider("Microsoft")} />
                  <SettingsProviderRow provider="email" onClick={openSettingsEmailEntry} />
                </div>

                <p className="flex items-start gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
                  Accounts save preferences and search history. Do not enter PHI.
                </p>

                {(accountNotice || !auth.isConfigured || (settingsEmailAttempted && auth.error)) && (
                  <p
                    role="alert"
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
                  >
                    {accountNotice ??
                      (settingsEmailAttempted ? auth.error : null) ??
                      "Supabase browser authentication is not configured for account sign-in."}
                  </p>
                )}
              </div>
            ) : (
              <SettingsClinicalContextStrip />
            )}
          </section>

          <div className={cn("hidden lg:mt-4 lg:grid-cols-3 lg:gap-3", signedOutAccount ? "lg:hidden" : "lg:grid")}>
            <SettingsSummaryTile icon={UserRound} label="Profile" value={identity.displayName} />
            <SettingsSummaryTile icon={Stethoscope} label="Clinical setup" value="WA, adults" emphasized />
            <SettingsSummaryTile icon={PanelTop} label="Default view" value="Ask" />
          </div>

          <section className="mt-3.5 grid gap-3 lg:mt-4 lg:rounded-xl lg:border lg:border-[color:var(--border-lux)] lg:bg-[color:var(--surface)] lg:px-5 lg:py-4 lg:shadow-[var(--shadow-inset)]">
            <div className="grid gap-3 lg:gap-4">
              {settingSections.map((section) => (
                <div key={section.title} className="min-w-0">
                  <h3 className="mb-1 px-1 text-[12px] font-semibold tracking-normal text-[color:var(--text-muted)] lg:mb-1.5 lg:text-[13px] lg:text-[color:var(--text-heading)]">
                    {section.title}
                  </h3>
                  <div className="overflow-hidden rounded-[1.1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[0_8px_22px_rgba(0,0,0,0.04),var(--shadow-inset)] dark:shadow-[0_12px_26px_rgba(0,0,0,0.24),var(--shadow-inset)] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
                    {section.rows.map((row) => (
                      <SettingsRow key={`${section.title}-${row.label}`} {...row} />
                    ))}
                    {section.title === "Account" && identity.signedIn ? (
                      <SettingsRow
                        icon={LogOut}
                        label="Sign out"
                        value=""
                        onClick={() => {
                          onSignOut();
                          onClose();
                        }}
                        actionLabel="Sign out"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <SettingsHelpFooter
              onClick={() => {
                onClose();
                onOpenGuide();
              }}
            />
          </section>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsChip({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full border border-[color:var(--clinical-accent)]/18 bg-[color:var(--clinical-accent-soft)] px-2.5 text-[11px] font-semibold leading-none text-[color:var(--clinical-accent)] lg:min-h-7 lg:px-3 lg:text-xs">
      {label}
    </span>
  );
}

function SettingsProviderRow({
  provider,
  onClick,
}: {
  provider: "Apple" | "Google" | "Microsoft" | "email";
  onClick: () => void;
}) {
  const label = provider === "email" ? "Use email instead" : provider;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      {provider === "email" ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          <Mail className="h-4 w-4" />
        </span>
      ) : (
        <SettingsProviderMark provider={provider} />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
    </button>
  );
}

function SettingsProviderMark({ provider }: { provider: "Apple" | "Google" | "Microsoft" }) {
  if (provider === "Microsoft") {
    return (
      <span
        className="grid h-7 w-7 shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)]"
        aria-hidden="true"
      >
        <span className="bg-[#f25022]" />
        <span className="bg-[#7fba00]" />
        <span className="bg-[#00a4ef]" />
        <span className="bg-[#ffb900]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-base font-bold leading-none shadow-[var(--shadow-inset)]",
        provider === "Apple" ? "text-[color:var(--text-heading)]" : "text-[#4285f4]",
      )}
    >
      {provider === "Apple" ? "A" : "G"}
    </span>
  );
}

function SettingsClinicalContextStrip() {
  return (
    <div className="mt-2.5 flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--clinical-accent)]/14 bg-[color:var(--clinical-accent-soft)]/60 px-3 text-[12px] font-semibold leading-none text-[color:var(--clinical-accent)] lg:hidden">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        Private<span className="hidden min-[360px]:inline"> workspace</span>{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> WA{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> No PHI
      </span>
    </div>
  );
}

function SettingsSummaryTile({
  icon: Icon,
  label,
  value,
  emphasized = false,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-2 shadow-[var(--shadow-inset)] lg:rounded-xl lg:p-3",
        emphasized
          ? "border-[color:var(--clinical-accent)]/26 bg-[color:var(--clinical-accent-soft)]/72"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface)]",
      )}
    >
      <div className="flex min-w-0 flex-col items-center justify-center gap-1 text-center lg:min-h-[44px] lg:flex-row lg:justify-start lg:gap-2.5 lg:text-left">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-[var(--shadow-inset)] lg:rounded-lg",
            emphasized
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold leading-3 text-[color:var(--text-muted)] lg:text-xs lg:leading-4">
            {label}
          </span>
          <span className="block truncate text-xs font-semibold leading-4 text-[color:var(--text-heading)] lg:text-[13px]">
            {value}
          </span>
        </span>
      </div>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  active = false,
  onClick,
  actionLabel,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full transition sm:h-8 sm:w-8 lg:rounded-lg lg:border lg:shadow-[var(--shadow-inset)]",
          active
            ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[0_7px_16px_color-mix(in_srgb,var(--clinical-accent)_24%,transparent)] lg:border-[color:var(--clinical-accent)]"
            : "bg-transparent text-[color:var(--text-muted)] lg:border-[color:var(--border)] lg:bg-[color:var(--surface-lux)]",
        )}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <span className="min-w-0 flex-1 min-[360px]:flex min-[360px]:items-center min-[360px]:justify-between min-[360px]:gap-3">
        <span className="block truncate text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{label}</span>
        {value ? (
          <span className="mt-0.5 block max-w-full truncate text-[13px] font-medium leading-5 text-[color:var(--text-muted)] min-[360px]:mt-0 min-[360px]:max-w-[50%] min-[360px]:text-right sm:max-w-[58%] sm:text-sm sm:text-[color:var(--text)] lg:max-w-[52%] lg:text-[13px]">
            {value}
          </span>
        ) : null}
      </span>
      <ChevronDown className="-rotate-90 h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)] lg:h-4 lg:w-4" />
    </>
  );

  const className =
    "flex min-h-[50px] w-full items-center gap-2.5 border-b border-[color:var(--border)]/70 px-3 py-1.5 text-left last:border-b-0 transition hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:min-h-[54px] sm:gap-3 sm:px-3.5 sm:py-2 lg:min-h-10 lg:gap-3 lg:px-0 lg:py-0 lg:hover:bg-[color:var(--surface-lux)]/55";
  const testId = `settings-row-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel ?? label}
        className={className}
        data-testid={testId}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  );
}

function SettingsHelpFooter({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-1 pt-0.5 lg:hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-lux)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        data-testid="settings-row-guide-help"
      >
        <BookOpen className="h-4 w-4" />
        <span>Guide &amp; help</span>
        <ChevronDown className="-rotate-90 h-3.5 w-3.5 text-[color:var(--text-soft)]" />
      </button>
    </div>
  );
}

function ToolsHub({ query, desktopComposerSlotId }: { query: string; desktopComposerSlotId?: string }) {
  return <ApplicationsLauncherWorkspace query={query} desktopComposerSlotId={desktopComposerSlotId} />;
}

type MobileSectionFabItem = {
  label: string;
  description: string;
  icon: typeof FileText;
  href: (typeof navigationHashes)[number];
  count: number | null;
  empty?: boolean;
};

type MobileSectionFabTone = "neutral" | "ready" | "warning" | "empty";

type MobileSectionFabState = {
  statusLabel: string;
  statusTone: MobileSectionFabTone;
  nextStep: string;
  badgeLabel: string | null;
  badgeTone: MobileSectionFabTone;
};

function mobileSectionItemLabel(item: MobileSectionFabItem) {
  if (item.count === null) return item.label;
  return `${item.label}, ${item.count} item${item.count === 1 ? "" : "s"}`;
}

function fabToneClassName(tone: MobileSectionFabTone) {
  if (tone === "ready") {
    return "border-[color:var(--success)]/25 bg-[color:var(--success-soft)] text-[color:var(--success)]";
  }
  if (tone === "warning") {
    return "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  if (tone === "empty") {
    return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
  }
  return "border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
}

function buildMobileSectionFabState({
  hasAnswer,
  searchMode,
  sourceCount,
  quoteCount,
  weakEvidence,
  governanceWarningCount,
}: {
  hasAnswer: boolean;
  searchMode: AppModeId;
  sourceCount: number;
  quoteCount: number;
  weakEvidence: boolean;
  governanceWarningCount: number;
}): MobileSectionFabState {
  const modeSearch = appModeSearchConfig(searchMode);
  if (!hasAnswer) {
    if (modeSearch.resultKind === "tools") {
      return {
        statusLabel: "Tools",
        statusTone: "neutral",
        nextStep: "Launch a clinical tool",
        badgeLabel: null,
        badgeTone: "neutral",
      };
    }
    if (modeSearch.resultKind === "differentials") {
      return {
        statusLabel: "Diffs",
        statusTone: "neutral",
        nextStep: modeSearch.nextStep,
        badgeLabel: null,
        badgeTone: "neutral",
      };
    }
    return {
      statusLabel: modeSearch.resultKind === "documents" ? modeSearch.statusLabel : "No answer yet",
      statusTone: "empty",
      nextStep: modeSearch.nextStep,
      badgeLabel: modeSearch.badgeLabel,
      badgeTone: "empty",
    };
  }

  if (weakEvidence) {
    return {
      statusLabel: "Weak support",
      statusTone: "warning",
      nextStep: "Verify source before using",
      badgeLabel: "!",
      badgeTone: "warning",
    };
  }

  if (governanceWarningCount > 0) {
    return {
      statusLabel: "Needs source check",
      statusTone: "warning",
      nextStep: `${governanceWarningCount} source warning${governanceWarningCount === 1 ? "" : "s"}`,
      badgeLabel: "!",
      badgeTone: "warning",
    };
  }

  if (quoteCount > 0) {
    return {
      statusLabel: "Ready to verify",
      statusTone: "ready",
      nextStep: "Next: review exact quotes",
      badgeLabel: String(quoteCount),
      badgeTone: "ready",
    };
  }

  if (sourceCount > 0) {
    return {
      statusLabel: "Ready to verify",
      statusTone: "ready",
      nextStep: "Next: verify sources",
      badgeLabel: String(sourceCount),
      badgeTone: "ready",
    };
  }

  return {
    statusLabel: "Answer ready",
    statusTone: "neutral",
    nextStep: "Review answer structure",
    badgeLabel: null,
    badgeTone: "neutral",
  };
}

function MobileSectionFab({
  items,
  activeHash,
  state,
  hidden = false,
  onNavigate,
}: {
  items: readonly MobileSectionFabItem[];
  activeHash: string;
  state: MobileSectionFabState;
  hidden?: boolean;
  onNavigate: (href: MobileSectionFabItem["href"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelId = "mobile-section-fab-menu";
  const labelId = "mobile-section-fab-label";
  const activeItem = items.find((item) => item.href === activeHash) ?? items[0];
  const ActiveIcon = activeItem.icon;
  const activeItemLabel = mobileSectionItemLabel(activeItem);

  const closeMenu = useCallback((options: { restoreFocus?: boolean } = {}) => {
    setOpen(false);
    if (options.restoreFocus ?? true) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }, []);
  const dismissMobileSectionMenu = useCallback(() => closeMenu(), [closeMenu]);

  useDismissableLayer({
    enabled: open,
    refs: [buttonRef, panelRef],
    restoreFocusRef: buttonRef,
    onDismiss: dismissMobileSectionMenu,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileSectionFabMediaQuery);
    const syncActivation = () => {
      const matches = mediaQuery.matches;
      setActive(matches);
      if (!matches) closeMenu({ restoreFocus: false });
    };

    const frame = window.requestAnimationFrame(syncActivation);
    mediaQuery.addEventListener("change", syncActivation);
    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener("change", syncActivation);
    };
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;
    const closeForRouteChange = () => closeMenu({ restoreFocus: false });
    window.addEventListener("hashchange", closeForRouteChange);
    return () => window.removeEventListener("hashchange", closeForRouteChange);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!hidden) return;
    const frame = window.requestAnimationFrame(() => closeMenu({ restoreFocus: false }));
    return () => window.cancelAnimationFrame(frame);
  }, [closeMenu, hidden]);

  if (hidden || !active) return null;

  return (
    <div data-testid="mobile-section-fab">
      {open ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-transparent"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        />
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        data-testid="mobile-section-fab-button"
        aria-label={open ? "Close answer section menu" : `Open answer section menu, current section ${activeItemLabel}`}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "fixed z-40 grid h-14 w-14 place-items-center rounded-full border border-[color:var(--command)] bg-[color:var(--command)] text-[color:var(--command-contrast)] shadow-[var(--shadow-elevated)] transition motion-safe:duration-150 hover:-translate-y-0.5 hover:bg-[color:var(--command-hover)] active:translate-y-px",
          open && "bg-[color:var(--command-hover)]",
        )}
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="h-6 w-6" /> : <ActiveIcon className="h-6 w-6" />}
        {(state.badgeLabel ?? (activeItem.count !== null ? String(activeItem.count) : null)) ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-0 top-0 grid min-h-5 min-w-5 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full border px-1 text-[10px] font-bold leading-4 shadow-[var(--shadow-tight)]",
              fabToneClassName(state.badgeTone),
            )}
          >
            {state.badgeLabel ?? activeItem.count}
          </span>
        ) : null}
      </button>

      <section
        ref={panelRef}
        id={panelId}
        data-testid="mobile-section-fab-menu"
        role="region"
        aria-labelledby={labelId}
        aria-hidden={!open}
        inert={!open}
        hidden={!open}
        className="fixed z-40 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-[color:var(--border-strong)]/20 backdrop-blur-md dark:ring-[color:var(--border-strong)]/10"
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.5rem)",
          maxHeight: "min(25rem, calc(100dvh - 7rem))",
          width: "min(20rem, calc(100vw - 1.5rem))",
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5 shadow-[var(--shadow-inset)]">
          <span
            aria-hidden="true"
            className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/70"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <p
                id={labelId}
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]"
              >
                Answer navigator
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">
                Current: {activeItem.label}
              </p>
            </div>
            <span
              data-testid="mobile-section-fab-status"
              className={cn("rounded-full border px-2 py-1 text-[11px] font-bold", fabToneClassName(state.statusTone))}
            >
              {state.statusLabel}
            </span>
          </div>
          <p
            data-testid="mobile-section-fab-next-step"
            className="mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
          >
            {state.nextStep}
          </p>
        </div>

        <div className="polished-scroll grid max-h-[min(17rem,calc(100dvh-14rem))] gap-1 overflow-y-auto overscroll-contain p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeHash === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-label={mobileSectionItemLabel(item)}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                  closeMenu();
                }}
                className={cn(
                  "relative grid min-h-[58px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-transparent py-1.5 pl-3 pr-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                  item.empty && !active && "opacity-75",
                  active &&
                    "border-[color:var(--clinical-accent)]/25 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-2 left-1 top-2 w-1 rounded-full bg-transparent",
                    active && "bg-[color:var(--clinical-accent)]",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]",
                    item.empty && !active && "bg-[color:var(--surface-subtle)]",
                    active &&
                      "border-[color:var(--clinical-accent)]/25 bg-[color:var(--surface)] text-[color:var(--clinical-accent)]",
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--text-soft)]">
                    {item.description}
                  </span>
                </span>
                {item.count !== null ? (
                  <span
                    className={cn(
                      "min-w-6 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-1.5 text-center text-[11px] font-bold leading-5 text-[color:var(--text)] shadow-[var(--shadow-inset)]",
                      item.empty && "text-[color:var(--text-muted)]",
                      active &&
                        "border-[color:var(--clinical-accent)]/20 bg-[color:var(--surface)] text-[color:var(--clinical-accent)]",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function answerReferencesDocument(answer: RagAnswer | null, documentId: string) {
  if (!answer) return false;
  return (
    answer.citations.some((citation) => citation.document_id === documentId) ||
    answer.sources.some((source) => source.document_id === documentId) ||
    Boolean(answer.bestSource?.document_id === documentId) ||
    Boolean(answer.relatedDocuments?.some((document) => document.document_id === documentId)) ||
    Boolean(answer.visualEvidence?.some((image) => image.document_id === documentId))
  );
}

function applyRenamedDocumentToAnswer(answer: RagAnswer | null, document: ClinicalDocument) {
  if (!answer || !answerReferencesDocument(answer, document.id)) return answer;
  const renameCitation = <T extends { document_id: string; title: string }>(item: T): T =>
    item.document_id === document.id ? { ...item, title: document.title } : item;
  const renameRelated = (item: RelatedDocument): RelatedDocument =>
    item.document_id === document.id ? { ...item, title: document.title } : item;

  return {
    ...answer,
    citations: answer.citations.map(renameCitation),
    quoteCards: answer.quoteCards?.map(renameCitation),
    sources: answer.sources.map(renameCitation),
    visualEvidence: answer.visualEvidence?.map(renameCitation),
    bestSource: answer.bestSource ? renameCitation(answer.bestSource) : answer.bestSource,
    relatedDocuments: answer.relatedDocuments?.map(renameRelated),
    smartPanel: answer.smartPanel
      ? {
          ...answer.smartPanel,
          bestSource: answer.smartPanel.bestSource
            ? renameCitation(answer.smartPanel.bestSource)
            : answer.smartPanel.bestSource,
          relatedDocuments: answer.smartPanel.relatedDocuments?.map(renameRelated),
        }
      : answer.smartPanel,
  } satisfies RagAnswer;
}

function normalizedPollDelay(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.max(parsed, 3_000), setupRecheckPollMs);
}

function shorterPollDelay(current: number | null, next: unknown) {
  const normalized = normalizedPollDelay(next);
  if (!normalized) return current;
  return current === null ? normalized : Math.min(current, normalized);
}

function hasActiveIndexingWork(
  documents: ClinicalDocument[],
  jobs: IngestionJob[] = [],
  batches: ImportBatch[] = [],
  routeHint = false,
) {
  return (
    routeHint ||
    documents.some((document) => document.status === "queued" || document.status === "processing") ||
    jobs.some((job) => job.status === "pending" || job.status === "processing") ||
    batches.some((batch) => batch.status === "queued" || batch.status === "processing")
  );
}

function setupNeedsSlowRecheck(checks: SetupCheck[]) {
  return checks.some((check) => check.status !== "ready");
}

function mergeDocumentRefresh(current: ClinicalDocument[], updates: ClinicalDocument[]) {
  const currentById = new Map(current.map((document) => [document.id, document]));
  return updates.map((document) => {
    const existing = currentById.get(document.id);
    if (!existing) return document;
    return {
      ...existing,
      ...document,
      labels: document.labels ?? existing.labels,
      summary: document.summary ?? existing.summary,
    };
  });
}

export function ClinicalDashboard({
  initialSearchMode = "answer",
  initialQuery = "",
  focusSearch = false,
  autoRunSearch = false,
}: { initialSearchMode?: AppModeId; initialQuery?: string; focusSearch?: boolean; autoRunSearch?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const navSyncLockRef = useRef<number | null>(null);
  const autoRunSearchSignatureRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const nextWorkStatePollRef = useRef(0);
  const urlSearchBootstrappedRef = useRef(false);
  const urlDocumentSearchBootstrappedRef = useRef(false);
  const lastSyncedSearchParamsRef = useRef(searchParams.toString());
  const modeChangeFromUiRef = useRef(false);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [documentsPagination, setDocumentsPagination] = useState<DocumentPagination | null>(null);
  const indexedDocumentTotal = documentsPagination?.total ?? documents.length;
  const [dashboardDataLoading, setDashboardDataLoading] = useState(true);
  const [loadingMoreDocuments, setLoadingMoreDocuments] = useState(false);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [qualityItems, setQualityItems] = useState<IngestionQualityReviewItem[]>([]);
  const jobsRef = useRef(jobs);
  const batchesRef = useRef(batches);
  const answerThreadBootstrappedRef = useRef(false);
  const [answerThreadBootstrapped, setAnswerThreadBootstrapped] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<AppModeId>(initialSearchMode);
  const [modeSearchSubmitted, setModeSearchSubmitted] = useState(false);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  // Answer-mode conversation thread. `priorAnswerTurns` holds completed
  // exchanges displayed above the latest answer; `latestAnswerQuery` is the
  // question that produced the current `answer` (the composer `query` is a
  // draft that clears after each successful answer). The ref mirrors the
  // latest committed turn so async search completions can archive it without
  // reading stale closure state.
  const [priorAnswerTurns, setPriorAnswerTurns] = useState<AnswerTurn[]>([]);
  const [latestAnswerQuery, setLatestAnswerQuery] = useState<string | null>(null);
  const [collapsedTurnIds, setCollapsedTurnIds] = useState<Set<string>>(() => new Set());
  const [showEarlierTurns, setShowEarlierTurns] = useState(false);
  const threadRestoreScrolledRef = useRef(false);
  const restoredThreadFromStorageRef = useRef(false);
  const latestAnswerTurnRef = useRef<Omit<AnswerTurn, "id"> | null>(null);
  const answerTurnSeqRef = useRef(0);
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);
  const [searchRelevance, setSearchRelevance] = useState<EvidenceRelevance | null>(null);
  const [searchFacets, setSearchFacets] = useState<SearchFacets | null>(null);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const activeModeSearch = appModeSearchConfig(searchMode);
  const activeModeResultKind = appModeResultKind(searchMode);
  const requestQueryMode = appModeQueryMode(searchMode, queryMode);

  // Record matches come from the owner-scoped registry API (mock fixtures in
  // demo mode); ranking stays client-side so live-typing behaviour is
  // unchanged and the registry is fetched once per active mode.
  const registryRecords = useRegistryRecords(searchMode === "forms" ? "form" : "service", {
    enabled: searchMode === "services" || searchMode === "forms",
  });
  const serviceSearchMatches = useMemo(
    () => (searchMode === "services" ? rankServiceRecords(registryRecords.records, query) : []),
    [query, searchMode, registryRecords.records],
  );
  const formSearchMatches = useMemo(
    () => (searchMode === "forms" ? rankFormRecords(registryRecords.records, query) : []),
    [query, searchMode, registryRecords.records],
  );
  const recordSearchMatches = useMemo(
    () => (searchMode === "forms" ? formSearchMatches : searchMode === "services" ? serviceSearchMatches : []),
    [searchMode, formSearchMatches, serviceSearchMatches],
  );
  const recordSearchMode = searchMode === "forms" ? "forms" : "services";
  // The thread mirror ref must never outlive the answer it describes: every
  // reset path nulls `answer`, so clearing here covers them all (mode
  // switches, new chat, differentials/services clears) without each caller
  // having to remember the ref.
  useEffect(() => {
    if (!answerThreadBootstrappedRef.current) return;
    if (answer === null) latestAnswerTurnRef.current = null;
  }, [answer]);
  useEffect(() => {
    queueMicrotask(() => {
      const persisted = loadPersistedAnswerThread();
      if (persisted) {
        restoredThreadFromStorageRef.current = true;
        setPriorAnswerTurns(persisted.priorTurns);
        setLatestAnswerQuery(persisted.latestTurn?.query ?? null);
        if (persisted.latestTurn) {
          latestAnswerTurnRef.current = persisted.latestTurn;
          setAnswer(persisted.latestTurn.answer);
          setSources(persisted.latestTurn.sources);
          setModeSearchSubmitted(true);
          setQuery("");
          const restoredQuery = persisted.latestTurn.query.trim();
          if (restoredQuery) {
            autoRunSearchSignatureRef.current = `answer:${restoredQuery}`;
          }
        }
        answerTurnSeqRef.current = persisted.priorTurns.reduce((max, turn) => {
          const match = /^answer-turn-(\d+)$/.exec(turn.id);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        setCollapsedTurnIds(
          persisted.collapsedTurnIds.length
            ? new Set(persisted.collapsedTurnIds)
            : new Set(persisted.priorTurns.map((turn) => turn.id)),
        );
      }
      answerThreadBootstrappedRef.current = true;
      setAnswerThreadBootstrapped(true);
    });
  }, []);
  useEffect(() => {
    if (
      !answerThreadBootstrappedRef.current ||
      !answer ||
      !restoredThreadFromStorageRef.current ||
      threadRestoreScrolledRef.current
    ) {
      return;
    }
    threadRestoreScrolledRef.current = true;
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: mainRef.current?.scrollHeight ?? 0, behavior: "auto" });
    });
  }, [answer]);
  const resetAnswerThread = useCallback(() => {
    setPriorAnswerTurns([]);
    setLatestAnswerQuery(null);
    setCollapsedTurnIds(new Set());
    setShowEarlierTurns(false);
    clearPersistedAnswerThread();
  }, []);
  function toggleAnswerTurnCollapsed(turnId: string) {
    setCollapsedTurnIds((current) => {
      const next = new Set(current);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }
  const clearDifferentialModeResultState = useCallback(() => {
    resetAnswerThread();
    setAnswer(null);
    setSources([]);
    setDocumentMatches([]);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setError(null);
    setAnswerProgress(null);
  }, [resetAnswerThread]);
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [searchScope, setSearchScope] = useState<SearchScopeSummary | null>(null);
  const [sourceGovernanceWarnings, setSourceGovernanceWarnings] = useState<SourceGovernanceWarning[]>([]);
  const [answerViewMode, setAnswerViewMode] = useState<AnswerViewMode>("high_yield");
  const [bulkActionStatus, setBulkActionStatus] = useState<string | null>(null);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answerProgress, setAnswerProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [setupChecks, setSetupChecks] = useState<SetupCheck[]>(fallbackSetupChecks);
  const [demoMode, setDemoMode] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [localProjectReady, setLocalProjectReady] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<AnswerFeedbackType | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "warning"; message: string } | null>(null);
  const [activeHash, setActiveHash] = useState("#search");
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [documentsDrawerOpen, setDocumentsDrawerOpen] = useState(false);
  const [documentsDrawerMode, setDocumentsDrawerMode] = useState<DocumentDrawerMode>("library");
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadMobileTab, setUploadMobileTab] = useState<UploadIndexingTab>("upload");
  const [documentDrawerStatusFilter, setDocumentDrawerStatusFilter] = useState<DocumentDrawerStatusFilter>("indexed");
  const [indexingMonitorFilter, setIndexingMonitorFilter] = useState<IndexingMonitorFilter>("all");
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [commandScopes, setCommandScopes] = useState<string[]>([]);
  const [indexingActionId, setIndexingActionId] = useState<string | null>(null);
  const [indexingActive, setIndexingActive] = useState(false);
  const [nextRefreshDelayMs, setNextRefreshDelayMs] = useState<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const { status: authStatus, authorizationHeader, markSessionExpired } = auth;
  const prevAuthStatusRef = useRef(authStatus);
  useEffect(() => {
    const previous = prevAuthStatusRef.current;
    prevAuthStatusRef.current = authStatus;
    if ((authStatus === "signed_out" || authStatus === "expired") && previous === "authenticated") {
      resetAnswerThread();
      setAnswer(null);
      setSources([]);
      latestAnswerTurnRef.current = null;
    }
  }, [authStatus, resetAnswerThread]);
  const supabaseEnvStatus = setupChecks.find((check) => check.id === "env")?.status;
  const browserAuthUnavailableDemoFallback = !auth.isConfigured && supabaseEnvStatus !== "ready";
  const localNoAuthMode = isLocalNoAuthMode();
  const explicitDemoMode = demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const clientDemoMode = explicitDemoMode || browserAuthUnavailableDemoFallback || localNoAuthMode;
  const uploadReadOnlyMode =
    demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || browserAuthUnavailableDemoFallback;
  const localDevCanAttemptPrivateApis = process.env.NODE_ENV !== "production" && hasReadyPublicSearchSetup(setupChecks);
  const canUsePublicSearchApis = localProjectReady && hasReadyPublicSearchSetup(setupChecks);
  const canUseDegradedLocalSearchApis =
    process.env.NODE_ENV !== "production" && localProjectReady && hasReadyRequiredPublicSearchConfig(setupChecks);
  const canUsePrivateApis =
    localProjectReady && (localNoAuthMode || localDevCanAttemptPrivateApis || authStatus === "authenticated");
  const canUploadDocuments = canUsePrivateApis || (publicUploadsEnabled() && canUsePublicSearchApis);
  const canAttemptDeployedPublicSearch = isDeployedClinicalKb() && localProjectReady;
  const canRunSearch =
    explicitDemoMode || canUsePublicSearchApis || canUseDegradedLocalSearchApis || canAttemptDeployedPublicSearch;
  const closeDashboardTransientSurfaces = useCallback(
    (except?: "guide" | "settings" | "accountSetup" | "mobileSidebar" | "documents" | "upload") => {
      if (except !== "guide") setGuideOpen(false);
      if (except !== "settings") setSettingsOpen(false);
      if (except !== "accountSetup") setAccountSetupOpen(false);
      if (except !== "mobileSidebar") setMobileSidebarOpen(false);
      if (except !== "documents") setDocumentsDrawerOpen(false);
      if (except !== "upload") setUploadDrawerOpen(false);
    },
    [],
  );
  const openGuide = useCallback(() => {
    closeDashboardTransientSurfaces("guide");
    setGuideOpen(true);
  }, [closeDashboardTransientSurfaces]);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const openSettings = useCallback(() => {
    closeDashboardTransientSurfaces("settings");
    setSettingsOpen(true);
  }, [closeDashboardTransientSurfaces]);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const sidebarIdentity = useMemo(() => deriveSidebarIdentity(auth.session?.user.email), [auth.session?.user.email]);
  const openAccountProfile = useCallback(() => {
    if (sidebarIdentity.signedIn) {
      closeDashboardTransientSurfaces("settings");
      setSettingsOpen(true);
      return;
    }
    closeDashboardTransientSurfaces("accountSetup");
    setAccountSetupOpen(true);
  }, [closeDashboardTransientSurfaces, sidebarIdentity.signedIn]);
  const closeAccountSetup = useCallback(() => setAccountSetupOpen(false), []);
  const prefetchApplications = useCallback(() => {
    router.prefetch("/?mode=tools");
    router.prefetch("/favourites");
    router.prefetch("/differentials");
  }, [router]);
  const openLibraryHealthTarget = useCallback(
    (target: LibraryHealthTarget) => {
      const targetId =
        target === "documents"
          ? "dashboard-documents-drawer"
          : target === "setup"
            ? "dashboard-setup-section"
            : "dashboard-indexing-section";

      if (target === "documents") {
        closeDashboardTransientSurfaces("documents");
        setDocumentDrawerStatusFilter("indexed");
        setDocumentsDrawerMode("admin");
        setDocumentsDrawerOpen(true);
      } else if (target === "indexing") {
        closeDashboardTransientSurfaces("upload");
        setUploadMobileTab("jobs");
        setIndexingMonitorFilter("active");
        setUploadDrawerOpen(true);
      } else if (target === "failures") {
        closeDashboardTransientSurfaces("upload");
        setUploadMobileTab("jobs");
        setIndexingMonitorFilter("failed");
        setUploadDrawerOpen(true);
      } else {
        closeDashboardTransientSurfaces("upload");
        setUploadMobileTab("setup");
        setIndexingMonitorFilter("all");
        setUploadDrawerOpen(true);
      }

      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    },
    [closeDashboardTransientSurfaces],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(prefetchApplications, 250);
    return () => window.clearTimeout(timeoutId);
  }, [prefetchApplications]);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(recentQueryStorageKey) ?? "[]");
        if (Array.isArray(stored) && !cancelled) {
          setRecentQueries(
            stored.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 5),
          );
        }
      } catch {
        if (!cancelled) setRecentQueries([]);
      }
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const rememberRecentQuery = useCallback((value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    setRecentQueries((current) => {
      const next = [trimmedValue, ...current.filter((item) => item.toLowerCase() !== trimmedValue.toLowerCase())].slice(
        0,
        5,
      );
      try {
        window.localStorage.setItem(recentQueryStorageKey, JSON.stringify(next));
      } catch {
        // Recent questions are a convenience only; ignore storage failures.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!answerThreadBootstrapped) return;
    if (searchMode !== "answer") return;
    if (!answer && priorAnswerTurns.length === 0) {
      clearPersistedAnswerThread();
      return;
    }
    savePersistedAnswerThread({
      version: 1,
      priorTurns: priorAnswerTurns,
      latestTurn: latestAnswerTurnRef.current,
      collapsedTurnIds: [...collapsedTurnIds],
    });
  }, [searchMode, answer, priorAnswerTurns, collapsedTurnIds, latestAnswerQuery, answerThreadBootstrapped]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const refresh = useCallback(
    async (options: RefreshOptions = {}) => {
      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      const promise = (async () => {
        const trackDashboardLoading = options.includeDashboardData ?? true;
        await Promise.resolve();
        if (trackDashboardLoading) setDashboardDataLoading(true);

        const includeSetup = options.includeSetup ?? true;
        const includeDashboardData = options.includeDashboardData ?? true;
        const includeDocumentMeta = options.includeDocumentMeta ?? true;
        let nextDemoMode = clientDemoMode;
        let routeIndexingActive = false;
        let routePollDelayMs: number | null = null;

        setApiUnavailable(false);

        const localIdentity = await readLocalProjectIdentity().catch(() => null);
        if (!localIdentity?.localServer?.safeLocalOrigin) {
          setLocalProjectReady(false);
          setApiUnavailable(true);
          setSetupWarning(unsafeLocalProjectMessage(localIdentity));
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
          setQualityItems([]);
          setIndexingActive(false);
          setNextRefreshDelayMs(null);
          return;
        }
        setLocalProjectReady(true);

        if (includeSetup) {
          const setupResponse = await fetch("/api/setup-status", { cache: "no-store" }).catch(() => null);

          if (!setupResponse) {
            if (isDeployedClinicalKb()) {
              setSetupWarning("Setup status could not be loaded. You can still try search.");
            } else {
              setApiUnavailable(true);
              setSetupWarning("The local API is unavailable.");
              return;
            }
          } else if (setupResponse.ok) {
            const payload = (await setupResponse.json()) as SetupStatusPayload;
            setSetupChecks(payload.checks ?? fallbackSetupChecks);
            nextDemoMode = Boolean(payload.demoMode);
            routeIndexingActive = Boolean(payload.indexingActive);
            routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
            if (nextDemoMode) setDemoMode(true);
          } else if (isDeployedClinicalKb()) {
            setSetupWarning("Setup status could not be loaded. You can still try search.");
          } else {
            setApiUnavailable(true);
            return;
          }
        }

        if (!nextDemoMode && !canUsePrivateApis) {
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
          setQualityItems([]);
          setIndexingActive(routeIndexingActive);
          setNextRefreshDelayMs(routePollDelayMs);
          return;
        }

        if (!includeDashboardData) {
          setIndexingActive(routeIndexingActive);
          setNextRefreshDelayMs(routePollDelayMs);
          return;
        }

        const protectedHeaders = nextDemoMode ? undefined : authorizationHeader;
        const documentParams = new URLSearchParams({ limit: String(documentPageSize) });
        if (!includeDocumentMeta) {
          documentParams.set("includeMeta", "false");
        }

        const now = Date.now();
        const shouldRefreshWorkState = now >= nextWorkStatePollRef.current;
        if (shouldRefreshWorkState) nextWorkStatePollRef.current = now + indexingWorkDetailsPollMs;

        const [documentsResponse, jobsResponse, batchesResponse, qualityResponse] = await Promise.all([
          fetch(`/api/documents?${documentParams.toString()}`, { headers: protectedHeaders }),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/jobs", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/batches", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/quality", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
        ]);

        if (
          documentsResponse.status === 401 ||
          (jobsResponse !== null && jobsResponse.status === 401) ||
          (batchesResponse !== null && batchesResponse.status === 401) ||
          (qualityResponse !== null && qualityResponse.status === 401)
        ) {
          markSessionExpired();
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
          setQualityItems([]);
          setIndexingActive(false);
          setNextRefreshDelayMs(null);
          return;
        }

        let nextDocuments: ClinicalDocument[] = [];
        let nextJobs: IngestionJob[] = shouldRefreshWorkState ? [] : jobsRef.current;
        let nextBatches: ImportBatch[] = shouldRefreshWorkState ? [] : batchesRef.current;

        if (documentsResponse.ok) {
          const payload = (await documentsResponse.json()) as DocumentsPayload;
          nextDocuments = payload.documents ?? [];
          setDocuments((current) =>
            includeDocumentMeta ? nextDocuments : mergeDocumentRefresh(current, nextDocuments),
          );
          setDocumentsPagination(payload.pagination ?? null);
          routeIndexingActive ||= Boolean(payload.indexing?.active);
          routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.indexing?.pollAfterMs);
          if (payload.demoMode) setDemoMode(true);
          if (payload.setupRequired) setSetupWarning(payload.error ?? null);
        } else {
          setApiUnavailable(true);
        }

        if (shouldRefreshWorkState && jobsResponse && jobsResponse.ok) {
          const payload = (await jobsResponse.json()) as JobsPayload;
          nextJobs = payload.jobs ?? [];
          setJobs(nextJobs);
          routeIndexingActive ||= Boolean(payload.hasActiveJobs);
          routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
          if (payload.demoMode) setDemoMode(true);
          if (payload.setupRequired) setSetupWarning(payload.error ?? null);
        } else if (shouldRefreshWorkState) {
          setApiUnavailable(true);
        }

        if (shouldRefreshWorkState && batchesResponse && batchesResponse.ok) {
          const payload = (await batchesResponse.json()) as BatchesPayload;
          nextBatches = payload.batches ?? [];
          setBatches(nextBatches);
          routeIndexingActive ||= Boolean(payload.hasActiveBatches);
          routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
          if (payload.demoMode) setDemoMode(true);
        } else if (shouldRefreshWorkState) {
          setApiUnavailable(true);
        }

        if (shouldRefreshWorkState && qualityResponse && qualityResponse.ok) {
          const payload = (await qualityResponse.json()) as IngestionQualityPayload;
          setQualityItems(payload.items ?? []);
          if (payload.demoMode) setDemoMode(true);
        } else if (shouldRefreshWorkState) {
          setApiUnavailable(true);
        }

        const activeWork = hasActiveIndexingWork(nextDocuments, nextJobs, nextBatches, routeIndexingActive);
        setIndexingActive(activeWork);
        setNextRefreshDelayMs(routePollDelayMs ?? (activeWork ? activeIndexingPollFallbackMs : null));
      })();

      refreshInFlightRef.current = promise;
      try {
        return await promise;
      } finally {
        if ((options.includeDashboardData ?? true) === true) setDashboardDataLoading(false);
        if (refreshInFlightRef.current === promise) {
          refreshInFlightRef.current = null;
        }
      }
    },
    [authorizationHeader, canUsePrivateApis, clientDemoMode, markSessionExpired],
  );

  const loadMoreDocuments = useCallback(async () => {
    if (!documentsPagination?.hasMore || loadingMoreDocuments || !canUsePrivateApis) {
      return;
    }

    setLoadingMoreDocuments(true);
    try {
      const protectedHeaders = clientDemoMode ? undefined : authorizationHeader;
      const response = await fetch(
        `/api/documents?limit=${documentPageSize}&offset=${documentsPagination.nextOffset}`,
        { headers: protectedHeaders },
      );
      if (response.status === 401) {
        markSessionExpired();
        return;
      }
      if (!response.ok) {
        setApiUnavailable(true);
        return;
      }
      const payload = await response.json();
      const nextDocuments = (payload.documents ?? []) as ClinicalDocument[];
      setDocuments((current) => {
        const seen = new Set(current.map((document) => document.id));
        return [...current, ...nextDocuments.filter((document) => !seen.has(document.id))];
      });
      setDocumentsPagination(payload.pagination ?? null);
    } finally {
      setLoadingMoreDocuments(false);
    }
  }, [
    authorizationHeader,
    canUsePrivateApis,
    clientDemoMode,
    documentsPagination,
    loadingMoreDocuments,
    markSessionExpired,
  ]);

  const retryJob = useCallback(
    async (jobId: string) => {
      setIndexingActionId(jobId);
      try {
        const response = await fetch(`/api/ingestion/jobs/${jobId}/retry`, {
          method: "POST",
          headers: authorizationHeader,
        });
        if (response.status === 401) {
          markSessionExpired();
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Job retry could not be started.");
        }
        setActionNotice({
          tone: "success",
          message: "Ingestion job retry queued.",
        });
        await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
      } catch (error) {
        setActionNotice({
          tone: "warning",
          message: error instanceof Error ? error.message : "Job retry could not be started.",
        });
      } finally {
        setIndexingActionId(null);
      }
    },
    [authorizationHeader, markSessionExpired, refresh],
  );

  const reindexDocument = useCallback(
    async (documentId: string, mode: "full" | "enrichment" = "full") => {
      setIndexingActionId(documentId);
      try {
        const response = await fetch(`/api/documents/${documentId}/reindex`, {
          method: "POST",
          headers: {
            ...authorizationHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode }),
        });
        if (response.status === 401) {
          markSessionExpired();
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : mode === "enrichment"
                ? "Document enrichment could not be started."
                : "Document reindex could not be started.",
          );
        }
        setActionNotice({
          tone: "success",
          message: mode === "enrichment" ? "Document enrichment refreshed." : "Document reindex queued.",
        });
        await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
      } catch (error) {
        setActionNotice({
          tone: "warning",
          message: error instanceof Error ? error.message : "Document reindex could not be started.",
        });
      } finally {
        setIndexingActionId(null);
      }
    },
    [authorizationHeader, markSessionExpired, refresh],
  );
  const enrichDocument = useCallback(
    (documentId: string) => reindexDocument(documentId, "enrichment"),
    [reindexDocument],
  );

  const handleDocumentRenamed = useCallback((updatedDocument: ClinicalDocument) => {
    setDocuments((current) =>
      current.map((document) => (document.id === updatedDocument.id ? { ...document, ...updatedDocument } : document)),
    );
    setSources((current) =>
      current.map((source) =>
        source.document_id === updatedDocument.id ? { ...source, title: updatedDocument.title } : source,
      ),
    );
    setDocumentMatches((current) =>
      current.map((document) =>
        document.document_id === updatedDocument.id ? { ...document, title: updatedDocument.title } : document,
      ),
    );
    setAnswer((current) => applyRenamedDocumentToAnswer(current, updatedDocument));
  }, []);

  const handleDocumentLabelsUpdated = useCallback((documentId: string, labels: DocumentLabel[]) => {
    setDocuments((current) =>
      current.map((document) => (document.id === documentId ? { ...document, labels } : document)),
    );
    setDocumentMatches((current) =>
      current.map((document) => (document.document_id === documentId ? { ...document, labels } : document)),
    );
    setSources((current) =>
      current.map((source) => (source.document_id === documentId ? { ...source, document_labels: labels } : source)),
    );
  }, []);

  const handleDocumentLabelPatched = useCallback((documentId: string, label: DocumentLabel) => {
    function mergeLabel(labels: DocumentLabel[] | null | undefined) {
      const current = labels ?? [];
      let replaced = false;
      const next = current.map((item) => {
        if (item.id !== label.id) return item;
        replaced = true;
        return label;
      });
      return replaced ? next : [label, ...next];
    }

    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, labels: mergeLabel(document.labels) } : document,
      ),
    );
    setDocumentMatches((current) =>
      current.map((document) =>
        document.document_id === documentId ? { ...document, labels: mergeLabel(document.labels) } : document,
      ),
    );
    setSources((current) =>
      current.map((source) =>
        source.document_id === documentId ? { ...source, document_labels: mergeLabel(source.document_labels) } : source,
      ),
    );
  }, []);

  const mutateDocumentLabel = useCallback(
    async (documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody) => {
      if (!canUsePrivateApis) return false;
      try {
        const response = await fetch(`/api/documents/${documentId}/labels`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(clientDemoMode ? {} : authorizationHeader),
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          markSessionExpired();
          return false;
        }
        if (!response.ok) {
          setActionNotice({
            tone: "warning",
            message: typeof payload?.error === "string" ? payload.error : "Label update failed.",
          });
          return false;
        }
        if (Array.isArray(payload.labels)) {
          handleDocumentLabelsUpdated(documentId, payload.labels as DocumentLabel[]);
        } else if (payload.label && typeof payload.label === "object") {
          handleDocumentLabelPatched(documentId, payload.label as DocumentLabel);
        }
        setActionNotice({ tone: "success", message: "Document label review updated." });
        return true;
      } catch {
        setActionNotice({ tone: "warning", message: "Label update failed." });
        return false;
      }
    },
    [
      authorizationHeader,
      canUsePrivateApis,
      clientDemoMode,
      handleDocumentLabelPatched,
      handleDocumentLabelsUpdated,
      markSessionExpired,
    ],
  );

  const handleDocumentDeleted = useCallback(
    (result: DocumentDeleteResult) => {
      setDocuments((current) => current.filter((document) => document.id !== result.documentId));
      setSelectedDocumentIds((current) => current.filter((documentId) => documentId !== result.documentId));
      setSources((current) => current.filter((source) => source.document_id !== result.documentId));
      setDocumentMatches((current) => current.filter((document) => document.document_id !== result.documentId));
      setAnswer((current) => (answerReferencesDocument(current, result.documentId) ? null : current));
      if (result.storageWarnings.length > 0) {
        setActionNotice({
          tone: "warning",
          message: `Document deleted. Storage cleanup needs review: ${result.storageWarnings.join("; ")}`,
        });
      } else {
        setActionNotice({ tone: "success", message: "Document deleted." });
      }
      void refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false }).catch(
        () => undefined,
      );
    },
    [refresh],
  );

  useEffect(() => {
    if (actionNotice?.tone !== "success") return undefined;
    const timer = window.setTimeout(() => setActionNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const activeIndexingWork = useMemo(
    () => hasActiveIndexingWork(documents, jobs, batches, indexingActive),
    [documents, jobs, batches, indexingActive],
  );
  const needsSetupRecheck = useMemo(() => setupNeedsSlowRecheck(setupChecks), [setupChecks]);

  useEffect(() => {
    refresh({ includeSetup: true, includeDashboardData: true, includeDocumentMeta: true }).catch(() => undefined);
  }, [authStatus, authorizationHeader, clientDemoMode, refresh]);

  useEffect(() => {
    const hasScheduledWork = activeIndexingWork || needsSetupRecheck;
    if (!shouldPollForUpdates(demoMode, document.visibilityState, hasScheduledWork)) {
      return;
    }

    const delay = activeIndexingWork ? (nextRefreshDelayMs ?? activeIndexingPollFallbackMs) : setupRecheckPollMs;
    const timeout = window.setTimeout(() => {
      if (!shouldPollForUpdates(demoMode, document.visibilityState, hasScheduledWork)) {
        return;
      }

      refresh({
        includeSetup: !activeIndexingWork,
        includeDashboardData: activeIndexingWork,
        includeDocumentMeta: false,
      }).catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [activeIndexingWork, demoMode, needsSetupRecheck, nextRefreshDelayMs, refresh]);

  useEffect(() => {
    const refreshVisibleDashboard = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      refresh({
        includeSetup: true,
        includeDashboardData: activeIndexingWork || canUsePrivateApis || clientDemoMode,
        includeDocumentMeta: false,
      }).catch(() => undefined);
    };

    document.addEventListener("visibilitychange", refreshVisibleDashboard);
    window.addEventListener("focus", refreshVisibleDashboard);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
      window.removeEventListener("focus", refreshVisibleDashboard);
    };
  }, [activeIndexingWork, canUsePrivateApis, clientDemoMode, refresh]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!focusSearch) return undefined;
    focusComposerInput();
    const timeout = window.setTimeout(focusComposerInput, 500);
    return () => window.clearTimeout(timeout);
  }, [focusSearch]);

  useEffect(() => {
    const searchParamString = searchParams.toString();
    if (lastSyncedSearchParamsRef.current === searchParamString) return;
    lastSyncedSearchParamsRef.current = searchParamString;
    if (searchParams.get("run") === "1") return;

    const mode = searchParams.get("mode");
    if (!isAppModeId(mode) || !isAppModeVisible(mode)) return;

    if (modeChangeFromUiRef.current) {
      modeChangeFromUiRef.current = false;
      return;
    }

    const nextQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
    const shouldFocusComposer = searchParams.get("focus") === "1";
    const hasUrlQuery = searchParams.has("q") || searchParams.has("query");
    const frame = window.requestAnimationFrame(() => {
      if (mode === "differentials") clearDifferentialModeResultState();
      setSearchMode(mode);
      if (hasUrlQuery) setQuery(nextQuery);
      setModeSearchSubmitted(false);
      setLoading(false);
      setError(null);
      setAnswerProgress(null);
      if (shouldFocusComposer) focusComposerInput();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchParams, clearDifferentialModeResultState]);

  useEffect(() => {
    if (urlSearchBootstrappedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const searchText = params.get("q")?.trim();
    const shouldFocusComposer = params.get("focus") === "1";
    if (!isAppModeId(mode) || !isAppModeVisible(mode)) return;
    urlSearchBootstrappedRef.current = true;
    const targetMode = mode;
    const frame = window.requestAnimationFrame(() => {
      if (targetMode === "differentials") clearDifferentialModeResultState();
      setSearchMode(targetMode);
      // run=1 URLs name the latest answered question; the composer stays empty
      // while an answer thread is active (including after localStorage restore).
      if (searchText && params.get("run") !== "1") setQuery(searchText);
      if (shouldFocusComposer) focusComposerInput();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [clearDifferentialModeResultState]);

  useEffect(() => {
    if (urlDocumentSearchBootstrappedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const searchText = params.get("q")?.trim();
    if (!searchText || !isAppModeId(mode) || !isAppModeVisible(mode)) return;
    if (mode === "prescribing") return;
    const modeSearch = appModeSearchConfig(mode);
    // Answer-mode run=1 URLs are submitted by the autoRunSearch effect after
    // localStorage thread restore completes; running here would archive a
    // restored latest turn into a duplicate prior turn on reload.
    if (modeSearch.resultKind === "answer") {
      if (!answerThreadBootstrapped) return;
      urlDocumentSearchBootstrappedRef.current = true;
      return;
    }
    const shouldRun =
      params.get("run") === "1" ||
      modeSearch.kind === "documents" ||
      modeSearch.kind === "favourites" ||
      modeSearch.kind === "differentials";
    if (!shouldRun) return;
    const isRegistryOnlyMode = mode === "services" || mode === "forms";
    if (modeSearch.kind !== "tools" && modeSearch.kind !== "favourites" && !isRegistryOnlyMode && !canRunSearch) return;
    urlDocumentSearchBootstrappedRef.current = true;
    void executeSearch(searchText, mode, scopeFilters);
    // URL search intentionally runs once when the selected mode can execute.
  }, [canRunSearch, answerThreadBootstrapped]);

  useEffect(() => {
    const updateHash = () => {
      const nextHash = normalizeNavigationHash(window.location.hash || "#search");
      window.requestAnimationFrame(() => navigateMobileSection(nextHash, { updateHistory: false }));
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (navSyncLockRef.current !== null) {
        window.clearTimeout(navSyncLockRef.current);
      }
    };
  }, []);

  function searchNetworkFailure(label: string) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const origin = typeof window !== "undefined" ? window.location.origin : "Clinical KB";
    return makeSearchError(
      offline
        ? `${label} could not run because the browser is offline.`
        : isDeployedClinicalKb()
          ? `${label} could not reach Clinical KB at ${origin}. Check your connection and try again shortly.`
          : `${label} could not reach Clinical KB at ${origin}. The local server may still be starting or restarting; retry shortly or run npm run ensure.`,
      undefined,
      true,
    );
  }

  async function requestSourceLibrarySearch(
    queryText: string,
    mode: SourceLibrarySearchMode = "documents",
    filtersOverride?: SearchScopeFilters,
    queryModeOverride: ClinicalQueryMode = requestQueryMode,
  ) {
    const searchLabel = mode === "differentials" ? "Differentials search" : "Document search";
    let response: Response;
    try {
      response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({
          query: queryText,
          mode,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          filters: compactScopeFilters(filtersOverride ?? scopeFilters),
          queryMode: queryModeOverride,
          documentLimit: 30,
          topK: 20,
        }),
      });
    } catch {
      throw searchNetworkFailure(searchLabel);
    }

    if (response.status === 401) {
      markSessionExpired();
      throw makeSearchError("Search request was not authorized by the server.", 401, false);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : `${searchLabel} failed`;
      throw makeSearchError(message, response.status, isRetryableStatus(response.status));
    }
    const payload = await response.json();
    if (payload.demoMode) setDemoMode(true);

    return {
      kind: "documents" as const,
      query: queryText,
      sources: (payload.results ?? []) as SearchResult[],
      documentMatches: (payload.documentMatches ?? []) as DocumentMatch[],
      relevance: payload.relevance as EvidenceRelevance | undefined,
      facets: payload.facets as SearchFacets | undefined,
      scope: payload.scope as SearchScopeSummary | undefined,
      sourceGovernanceWarnings: payload.sourceGovernanceWarnings as SourceGovernanceWarning[] | undefined,
      demoMode: payload.demoMode,
    };
  }

  async function requestAnswer(
    queryText: string,
    filtersOverride: SearchScopeFilters = scopeFilters,
    queryModeOverride: ClinicalQueryMode = requestQueryMode,
    onProgress: (message: string) => void = setAnswerProgress,
  ) {
    let response: Response;
    try {
      response = await fetch("/api/answer/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({
          query: queryText,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          filters: compactScopeFilters(filtersOverride),
          queryMode: queryModeOverride,
        }),
      });
    } catch {
      throw searchNetworkFailure("Answer search");
    }

    if (response.status === 401) {
      markSessionExpired();
      throw makeSearchError("Search request was not authorized by the server.", 401, false);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Answer generation failed";
      throw makeSearchError(message, response.status, isRetryableStatus(response.status));
    }

    const payload = await readAnswerStream(response, onProgress);
    return {
      kind: "answer" as const,
      query: queryText,
      payload,
    };
  }

  async function runWithRetries<T>(
    operation: () => Promise<T>,
    onProgress: (message: string) => void = setAnswerProgress,
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= searchRetryCount; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt >= searchRetryCount) break;

        const message = progressForRetry(attempt + 1);
        onProgress(message);
        await sleep(searchRetryDelaysMs[attempt] ?? searchRetryDelaysMs[searchRetryDelaysMs.length - 1]);
      }
    }
    throw lastError;
  }

  function resultUsable(payload: SearchResultModePayload) {
    if (payload.kind === "documents") {
      return payload.sources.length > 0 || payload.documentMatches.length > 0;
    }
    return answerPayloadIsUsable(payload.payload);
  }

  // Audit M10: monotonically increasing token identifying the latest search.
  // Concurrent searches (URL-bootstrap auto-search racing a user submit) can
  // resolve out of order; only the latest request may commit answer/sources/
  // error/loading state, or a stale response would display one query's answer
  // under another query's composer text.
  const searchRequestSeqRef = useRef(0);

  function applySearchResult(payload: SearchResultModePayload, displayQuery?: string) {
    if (payload.kind === "documents") {
      setDocumentMatches(payload.documentMatches);
      setSources(payload.sources);
      setSearchRelevance(payload.relevance ?? null);
      setSearchFacets(payload.facets ?? null);
      setSearchScope(payload.scope ?? null);
      setSourceGovernanceWarnings((payload.sourceGovernanceWarnings ?? []) as SourceGovernanceWarning[]);
      return;
    }

    const answerData = payload.payload;
    // Archive the previous exchange before the new answer replaces it, so the
    // thread keeps every turn visible in the same window.
    const priorTurn = latestAnswerTurnRef.current;
    if (priorTurn) {
      const turnId = `answer-turn-${++answerTurnSeqRef.current}`;
      setPriorAnswerTurns((turns) => [...turns, { id: turnId, ...priorTurn }].slice(-maxStoredAnswerTurns));
      setCollapsedTurnIds((current) => new Set(current).add(turnId));
    }
    const committedQuery = displayQuery ?? payload.query;
    latestAnswerTurnRef.current = {
      query: committedQuery,
      answer: answerData,
      sources: answerData.sources ?? [],
    };
    setLatestAnswerQuery(committedQuery);
    setAnswer(answerData);
    setSources(answerData.sources ?? []);
    setSearchRelevance(answerData.relevance ?? answerData.smartPanel?.relevance ?? null);
    setSearchScope(answerData.scope ?? null);
    setSourceGovernanceWarnings((answerData.sourceGovernanceWarnings ?? []) as SourceGovernanceWarning[]);
    setSearchFacets(null);
    setDocumentMatches(
      answerData.relatedDocuments?.map((document) => ({
        document_id: document.document_id,
        title: document.title,
        file_name: document.file_name,
        labels: document.labels,
        summarySnippet: document.summary,
        bestPages: document.best_pages,
        bestChunkIds: document.best_chunk_ids,
        imageCount: document.image_count,
        tableCount: document.table_count ?? 0,
        matchReason: document.match_reason,
        score: document.score,
      })) ?? [],
    );
    if (answerData.demoMode) setDemoMode(true);
  }

  async function executeSearch(searchText: string, targetMode: AppModeId = searchMode, filtersOverride = scopeFilters) {
    const trimmedQuery = searchText.trim();
    if (!trimmedQuery) return;
    const modeSearch = appModeSearchConfig(targetMode);
    const targetQueryMode = appModeQueryMode(targetMode, queryMode);
    const isDifferentialsMode = modeSearch.resultKind === "differentials";
    // Note: no automatic mode-default label scope for Services/Forms. Applying
    // one on every search routed resolveSearchScope's label path over the whole
    // library, whose single `document_labels.in(<all ids>)` request produces an
    // over-long PostgREST URL that fails on large corpora. Corpus search runs
    // unscoped (like Documents); users opt into label filters explicitly.
    const requestId = ++searchRequestSeqRef.current;

    setSearchMode(targetMode);
    // Answer mode keeps the composer as the draft source until a successful
    // response clears it. Syncing query here on follow-ups used to fire the
    // URL-backed autoRunSearch effect before loading flipped true, which
    // duplicated the in-flight answer request and produced extra thread turns.
    if (modeSearch.resultKind !== "answer") {
      setQuery(trimmedQuery);
    }
    if (modeSearch.kind !== "tools") setModeSearchSubmitted(true);
    if (isDifferentialsMode) clearDifferentialModeResultState();

    if (modeSearch.kind === "tools") {
      setLoading(false);
      setAnswerProgress(null);
      setError(null);
      rememberRecentQuery(trimmedQuery);
      setActionNotice({ tone: "success", message: "Tools filtered from the composer." });
      return;
    }
    if (modeSearch.kind === "favourites") {
      setLoading(false);
      setAnswerProgress(null);
      setError(null);
      rememberRecentQuery(trimmedQuery);
      setActionNotice({ tone: "success", message: "Favourites filtered from the composer." });
      return;
    }
    if (modeSearch.kind === "services" || targetMode === "forms") {
      resetAnswerThread();
      setAnswer(null);
      setSources([]);
      setDocumentMatches([]);
      setSearchRelevance(null);
      setSearchFacets(null);
      setSearchScope(null);
      setSourceGovernanceWarnings([]);
      setAnswerProgress(null);
      setLoading(false);
      setError(null);
      rememberRecentQuery(trimmedQuery);
      window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
      return;
    }
    if (!canRunSearch) {
      setError(errorCopy.searchSetupNotReady);
      return;
    }
    // M10 (diff-review hardening): progress updates emitted by this request's
    // in-flight machinery (retry messages, keyword fallback, stream progress)
    // must also be discarded once a newer search takes over, or a slow stale
    // request repaints the progress banner under the newer query.
    const onProgress = (message: string | null) => {
      if (requestId === searchRequestSeqRef.current) setAnswerProgress(message);
    };
    setLoading(true);
    setError(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    onProgress(modeSearch.progressLabel);
    rememberRecentQuery(trimmedQuery);

    // Answer-mode follow-ups: the API takes a single query string, so a short
    // ambiguous follow-up ("what about renal impairment?") is wrapped with the
    // previous turn's question before retrieval. The raw text the user typed
    // is what the thread displays (via displayQuery below).
    const isAnswerRequest = modeSearch.resultKind === "answer";
    const priorTurnQuery = isAnswerRequest ? latestAnswerTurnRef.current?.query : undefined;
    const isAnswerFollowUp = isAnswerRequest && Boolean(priorTurnQuery);
    const requestQuery = isAnswerRequest ? buildAnswerFollowUpQuery(priorTurnQuery, trimmedQuery) : trimmedQuery;

    const fallbackQuery = keywordQueryFromNaturalLanguage(requestQuery);
    const queryPlan =
      fallbackQuery && fallbackQuery !== requestQuery
        ? [
            { query: requestQuery, isKeyword: false },
            { query: fallbackQuery, isKeyword: true },
          ]
        : [{ query: requestQuery, isKeyword: false }];

    try {
      let successfulPayload: SearchResultModePayload | null = null;
      let lastError: SearchError | null = null;

      for (const entry of queryPlan) {
        if (entry.isKeyword) onProgress("Trying keyword-based search...");

        try {
          const payload =
            modeSearch.kind === "documents" || modeSearch.kind === "differentials"
              ? await runWithRetries(
                  () => requestSourceLibrarySearch(entry.query, modeSearch.kind, filtersOverride, targetQueryMode),
                  onProgress,
                )
              : await runWithRetries(
                  () => requestAnswer(entry.query, filtersOverride, targetQueryMode, onProgress),
                  onProgress,
                );

          if (!resultUsable(payload)) {
            lastError = makeSearchError("No usable results were found.", 404, false);
            if (!entry.isKeyword) {
              continue;
            }
            break;
          }

          successfulPayload = payload;
          break;
        } catch (requestError) {
          lastError = requestError as SearchError;
          if (queryPlan.length > 1 && !entry.isKeyword) {
            continue;
          }
          throw requestError;
        }
      }

      if (!successfulPayload) {
        if (lastError) throw lastError;
        throw new Error("Search did not return usable results.");
      }

      // M10: discard a stale response — a newer search owns the UI state.
      if (requestId === searchRequestSeqRef.current) {
        applySearchResult(successfulPayload, trimmedQuery);
        if (successfulPayload.kind === "answer") {
          // The composer is a draft box in a conversation: clear it so the
          // user can type the next follow-up immediately.
          setQuery("");
          // Keep only the latest question in the URL; the full thread lives in
          // React state until refresh or New chat.
          modeChangeFromUiRef.current = true;
          window.history.replaceState(null, "", appModeHomeHref(targetMode, { query: trimmedQuery, run: true }));
          if (isAnswerFollowUp) {
            window.requestAnimationFrame(() => {
              const main = mainRef.current;
              main?.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
            });
          }
        }
      }
    } catch (requestError) {
      if (requestId === searchRequestSeqRef.current) {
        setError(requestError instanceof Error ? requestError.message : "Search failed");
      }
    } finally {
      if (requestId === searchRequestSeqRef.current) {
        setLoading(false);
        setAnswerProgress(null);
      }
    }
  }

  function setMedicationSearchQuery(searchText: string, updateUrl = true) {
    modeChangeFromUiRef.current = true;
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) return;
    setSearchMode("prescribing");
    setQuery(trimmedSearchText);
    setModeSearchSubmitted(true);
    setLoading(false);
    setError(null);
    setAnswerProgress(null);
    rememberRecentQuery(trimmedSearchText);
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    if (updateUrl) router.replace(appModeHomeHref("prescribing", { query: trimmedSearchText }));
  }

  async function ask() {
    const trimmedQuery = query.trim();
    if (searchMode === "documents" && trimmedQuery) {
      rememberRecentQuery(trimmedQuery);
      router.push(documentsSearchHref({ query: trimmedQuery, focus: true, run: true }));
      return;
    }
    if (searchMode === "prescribing") {
      setMedicationSearchQuery(query);
      return;
    }
    await executeSearch(query, searchMode, scopeFilters);
  }
  const askRef = useRef(ask);
  askRef.current = ask;

  useEffect(() => {
    const trimmedQuery = query.trim();
    const canAutoRunMode = searchMode === "documents" || searchMode === "prescribing" || canRunSearch;
    if (!autoRunSearch || !trimmedQuery || !canAutoRunMode || loading) return;
    if (searchMode === "answer" && !answerThreadBootstrapped) return;
    // Once an answer is on screen, composer edits are follow-up drafts and must
    // only run on explicit submit — not on every query keystroke while run=1
    // keeps autoRunSearch enabled from the URL.
    if (searchMode === "answer" && answer) return;
    // After reload, the URL query matches the restored latest turn — do not
    // archive it again into a duplicate prior turn.
    if (searchMode === "answer" && latestAnswerQuery?.trim() === trimmedQuery) {
      autoRunSearchSignatureRef.current = `${searchMode}:${trimmedQuery}`;
      return;
    }
    const signature = `${searchMode}:${trimmedQuery}`;
    if (autoRunSearchSignatureRef.current === signature) return;
    autoRunSearchSignatureRef.current = signature;
    void askRef.current();
  }, [autoRunSearch, canRunSearch, loading, query, searchMode, answer, answerThreadBootstrapped, latestAnswerQuery]);

  function pickRecentQuery(recentQuery: string) {
    if (searchMode === "prescribing") {
      setMedicationSearchQuery(recentQuery);
      return;
    }
    setQuery(recentQuery);
  }

  function crossModeSearch(mode: AppModeId, crossQuery: string) {
    modeChangeFromUiRef.current = true;
    if (mode === "differentials") clearDifferentialModeResultState();
    setCommandScopes([]);
    setQuery(crossQuery);
    setModeSearchSubmitted(false);
    setLoading(false);
    setError(null);
    setAnswerProgress(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setDocumentMatches([]);
    if (mode === "answer") {
      resetAnswerThread();
      setAnswer(null);
      setSources([]);
    }
    if (mode === "prescribing") {
      setMedicationSearchQuery(crossQuery);
    }
    setSearchMode(mode);
    router.push(appModeHomeHref(mode, { query: crossQuery, focus: true, run: true }));
  }

  async function submitAnswerFeedback(feedbackType: AnswerFeedbackType) {
    if (!answer || pendingFeedback) return;
    if (clientDemoMode) {
      setActionNotice({ tone: "warning", message: "Answer review is available after signing in to a real library." });
      return;
    }

    setPendingFeedback(feedbackType);
    try {
      const sourceChunkIds = Array.from(new Set(sources.map((source) => source.id).filter(Boolean)));
      const citedChunkIds = Array.from(new Set(answer.citations.map((citation) => citation.chunk_id).filter(Boolean)));
      const sourceFiles = Array.from(
        new Set([
          ...sources.map((source) => source.file_name).filter(Boolean),
          ...answer.citations.map((citation) => citation.file_name).filter(Boolean),
        ]),
      );
      const response = await fetch("/api/eval-cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({
          query,
          feedbackType,
          rating: feedbackType === "verified" ? "good" : "needs_fixing",
          answer: answer.answer,
          queryMode,
          queryClass: answer.queryClass,
          filters: compactScopeFilters(scopeFilters),
          sourceChunkIds,
          citedChunkIds,
          sourceFiles,
          sourceGovernanceWarnings: sourceGovernanceWarnings.map((warning) => warning.message),
          unverifiedNumericTokens: answer.unverifiedNumericTokens ?? [],
        }),
      });

      if (response.status === 401) {
        markSessionExpired();
        setActionNotice({ tone: "warning", message: "Sign in again before saving answer review." });
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "Answer review could not be saved.");
      }
      setActionNotice({
        tone: "success",
        message:
          feedbackType === "verified"
            ? "Verified answer saved for eval coverage."
            : "Answer issue saved for eval coverage.",
      });
    } catch (feedbackError) {
      setActionNotice({
        tone: "warning",
        message: feedbackError instanceof Error ? feedbackError.message : "Answer review could not be saved.",
      });
    } finally {
      setPendingFeedback(null);
    }
  }

  function toggleDocumentScope(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId],
    );
  }

  function scopeOnlyDocument(documentId: string) {
    setSelectedDocumentIds([documentId]);
  }

  function answerFromDocument(documentId: string) {
    setSelectedDocumentIds([documentId]);
    setSearchMode("answer");
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function updateDocumentSearchUrl(searchText: string, mode: AppModeId = "documents") {
    window.history.replaceState(null, "", appModeHomeHref(mode, { query: searchText }));
  }

  async function runDocumentSearchShortcut(
    searchText: string,
    filtersOverride = scopeFilters,
    updateUrl = true,
    targetMode: AppModeId = "documents",
  ) {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) return;
    if (targetMode === "documents") {
      setQuery(trimmedSearchText);
      setSearchMode("documents");
      setModeSearchSubmitted(true);
      setLoading(false);
      setError(null);
      setAnswerProgress(null);
      rememberRecentQuery(trimmedSearchText);
      window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
      if (updateUrl) router.push(documentsSearchHref({ query: trimmedSearchText, focus: true, run: true }));
      return;
    }
    if (!canRunSearch) {
      setError(errorCopy.searchSetupNotReady);
      return;
    }

    setQuery(trimmedSearchText);
    setSearchMode(targetMode);
    setModeSearchSubmitted(true);
    setLoading(true);
    setError(null);
    const targetModeSearch = appModeSearchConfig(targetMode);
    const sourceLibraryMode = appModeSourceLibrarySearchMode(targetMode);
    setAnswerProgress(targetModeSearch.progressLabel);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    rememberRecentQuery(trimmedSearchText);
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    if (updateUrl) updateDocumentSearchUrl(trimmedSearchText, targetMode);

    try {
      const shortcutQueryMode = appModeQueryMode(targetMode, queryMode);
      const payload = await runWithRetries(() =>
        requestSourceLibrarySearch(trimmedSearchText, sourceLibraryMode, filtersOverride, shortcutQueryMode),
      );
      applySearchResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Document search failed");
    } finally {
      setLoading(false);
      setAnswerProgress(null);
    }
  }

  function handleTagSearch(tag: SmartDocumentTag | SmartDocumentTagFacet) {
    const searchText = tag.searchText || tag.label;
    const nextFilters: SearchScopeFilters = { ...scopeFilters };
    if (tag.group === "Site") nextFilters.sites = [searchText];
    if (tag.group === "Medication") nextFilters.medications = [tag.searchText || tag.label];
    if (tag.group === "Document type") nextFilters.documentTypes = [tag.searchText || tag.label];
    if (tag.group === "Topic") nextFilters.topics = [tag.searchText || tag.label];
    if (tag.group === "Service") nextFilters.services = [searchText];
    if (tag.group === "Setting") nextFilters.settings = [searchText];
    if (tag.group === "Population") nextFilters.populations = [searchText];
    if (tag.group === "Risk") nextFilters.risks = [searchText];
    if (tag.group === "Workflow") nextFilters.workflows = [searchText];
    if (tag.group === "Clinical action") nextFilters.clinicalActions = [searchText];
    if (tag.group === "Care phase") nextFilters.carePhases = [searchText];
    if (tag.group === "Document intent") nextFilters.documentIntents = [searchText];
    if (tag.group === "Content feature") nextFilters.contentFeatures = [searchText];
    setScopeFilters(nextFilters);
    const targetMode = appModeCanUseSourceLibraryShortcut(searchMode) ? searchMode : "documents";
    void runDocumentSearchShortcut(searchText, nextFilters, true, targetMode);
  }

  async function bulkReindexSelected(mode: "enrichment" | "full" | "retry_failed") {
    if (!selectedDocumentIds.length) return;
    setBulkActionBusy(true);
    setBulkActionStatus(null);
    try {
      const response = await fetch("/api/documents/bulk/reindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds, mode }),
      });
      if (response.status === 401) {
        markSessionExpired();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || errorCopy.bulkReindexFailed);
      setBulkActionStatus(
        `${payload.results?.filter((result: { ok: boolean }) => result.ok).length ?? 0} selected documents updated.`,
      );
      await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
    } catch (error) {
      setBulkActionStatus(error instanceof Error ? error.message : errorCopy.bulkReindexFailed);
    } finally {
      setBulkActionBusy(false);
    }
  }

  async function bulkAssignCollection(collection: string) {
    if (!selectedDocumentIds.length || !collection.trim()) return;
    await bulkUpdateMetadata({ collection: collection.trim() });
  }

  async function bulkUpdateMetadata(metadata: Record<string, unknown>) {
    if (!selectedDocumentIds.length || Object.keys(metadata).length === 0) return;
    setBulkActionBusy(true);
    setBulkActionStatus(null);
    try {
      const response = await fetch("/api/documents/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds, metadata }),
      });
      if (response.status === 401) {
        markSessionExpired();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || errorCopy.bulkMetadataUpdateFailed);
      setBulkActionStatus(`${payload.updatedCount ?? 0} selected documents updated.`);
      await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
    } catch (error) {
      setBulkActionStatus(error instanceof Error ? error.message : errorCopy.bulkMetadataUpdateFailed);
    } finally {
      setBulkActionBusy(false);
    }
  }

  function selectSearchMode(mode: AppModeId) {
    modeChangeFromUiRef.current = true;
    if (mode === "differentials") clearDifferentialModeResultState();
    setQuery("");
    setCommandScopes([]);
    if (mode === "answer") {
      resetAnswerThread();
      setAnswer(null);
      setSources([]);
    }
    setModeSearchSubmitted(false);
    setLoading(false);
    setError(null);
    setAnswerProgress(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setDocumentMatches([]);
    setSearchMode(mode);
    router.push(appModeHomeHref(mode));
  }

  function focusComposerInput() {
    window.requestAnimationFrame(() => {
      composerInputRef.current?.focus({ preventScroll: true });
      window.setTimeout(() => composerInputRef.current?.focus({ preventScroll: true }), 150);
    });
  }

  function stageAnswerFollowUpDraft(draft: string) {
    setQuery(draft);
    focusComposerInput();
  }

  function handleFollowUpQuote(quote: QuoteCard) {
    stageAnswerFollowUpDraft(createQuoteFollowUp(quote));
  }

  function handlePickFollowUpSuggestion(suggestion: string) {
    void executeSearch(suggestion);
  }

  function startNewChat() {
    modeChangeFromUiRef.current = true;
    const href = appModeHomeHref("answer", { focus: true });
    setQuery("");
    setModeSearchSubmitted(false);
    setSearchMode("answer");
    setQueryMode("auto");
    setSelectedDocumentIds([]);
    setScopeFilters({});
    resetAnswerThread();
    setAnswer(null);
    setSources([]);
    setDocumentMatches([]);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setError(null);
    setAnswerProgress(null);
    setAnswerViewMode("high_yield");
    router.replace(href);
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
    focusComposerInput();
  }

  function openDocumentsDrawer(mode: DocumentDrawerMode) {
    closeDashboardTransientSurfaces("documents");
    setSearchMode("documents");
    setDocumentDrawerStatusFilter("indexed");
    setDocumentsDrawerMode(mode);
    setDocumentsDrawerOpen(true);
    if (window.matchMedia("(min-width: 1024px)").matches) {
      window.requestAnimationFrame(() => {
        document.getElementById("dashboard-documents-drawer")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }

  function openRecentDocuments() {
    openDocumentsDrawer("recent");
  }

  function openSourceLibrary() {
    openDocumentsDrawer("library");
  }

  function openSourcePdfBrowser() {
    openDocumentsDrawer("source");
  }

  function openUploadDrawer() {
    if (!canUsePrivateApis) {
      openDocumentsDrawer("library");
      setActionNotice({
        tone: "warning",
        message: "Upload and indexing tools are admin-only. Use the source library to open indexed documents.",
      });
      return;
    }
    closeDashboardTransientSurfaces("upload");
    setSearchMode("documents");
    setDocumentsDrawerMode("admin");
    setUploadDrawerOpen(true);
    window.requestAnimationFrame(() => {
      const drawer = document.getElementById("dashboard-upload-drawer") as HTMLDetailsElement | null;
      drawer?.scrollIntoView({ block: "start", behavior: "smooth" });
      if (drawer && !drawer.open) {
        drawer.querySelector<HTMLElement>("summary")?.click();
      }
    });
  }

  function openEvidenceDrawer() {
    closeDashboardTransientSurfaces();
    const reviewTrigger = document.getElementById("answer-evidence-drawer-mobile-trigger") as HTMLButtonElement | null;
    if (reviewTrigger) {
      reviewTrigger.scrollIntoView({ block: "center", behavior: "smooth" });
      reviewTrigger.click();
      return;
    }

    const drawer = document.getElementById("answer-evidence-drawer") as HTMLDetailsElement | null;
    if (!drawer) {
      setActionNotice({
        tone: "warning",
        message: "Evidence appears after a source-backed answer is generated.",
      });
      return;
    }
    drawer.scrollIntoView({ block: "start", behavior: "smooth" });
    if (!drawer.open) {
      drawer.querySelector<HTMLElement>("summary")?.click();
    }
  }

  function navigateMobileSection(href: string, options: { updateHistory?: boolean } = {}) {
    const shouldUpdateHistory = options.updateHistory ?? true;
    const main = mainRef.current;
    if (!main) return;

    if (navSyncLockRef.current !== null) {
      window.clearTimeout(navSyncLockRef.current);
    }

    if (href === "#search") {
      setActiveHash(href);
      main.scrollTo({ top: 0, behavior: "auto" });
      if (shouldUpdateHistory) window.history.replaceState(null, "", href);
      navSyncLockRef.current = window.setTimeout(() => {
        navSyncLockRef.current = null;
      }, 350);
      return;
    }

    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    setActiveHash(href);
    const mainTop = main.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    main.scrollTo({
      top: main.scrollTop + targetTop - mainTop - 8,
      behavior: "auto",
    });
    if (shouldUpdateHistory) window.history.replaceState(null, "", href);
    navSyncLockRef.current = window.setTimeout(() => {
      navSyncLockRef.current = null;
    }, 350);
  }

  function syncActiveSectionFromScroll() {
    const main = mainRef.current;
    if (!main) return;
    if (main.scrollLeft !== 0) main.scrollLeft = 0;
    if (navSyncLockRef.current !== null) return;

    if (main.scrollTop < 120) {
      setActiveHash((current) => (current === "#search" ? current : "#search"));
      return;
    }

    const mainTop = main.getBoundingClientRect().top;
    const marker = mainTop + 96;
    const sections = ["#quotes", "#images", "#sources"];
    const current =
      sections
        .map((section) => {
          const target = document.querySelector<HTMLElement>(section);
          if (!target) return null;
          const rect = target.getBoundingClientRect();
          if (rect.top > marker + 220) return null;
          return { section, distance: Math.abs(rect.top - marker) };
        })
        .filter((item): item is { section: string; distance: number } => Boolean(item))
        .sort((a, b) => a.distance - b.distance)[0]?.section ?? "#search";
    setActiveHash((active) => (active === current ? active : current));
  }

  function scheduleActiveSectionSync() {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      syncActiveSectionFromScroll();
    });
  }

  async function copyText(action: string, text: string) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      setError(errorCopy.clipboardCopyFailed);
      return;
    }
    setCopiedAction(action);
    window.setTimeout(() => setCopiedAction((current) => (current === action ? null : current)), 1800);
  }

  const answerRenderModel = useMemo(
    () => (answer ? buildAnswerRenderModel(answer, { sources, includeDebugReasons: true }) : null),
    [answer, sources],
  );
  const visualEvidence = useMemo(() => answerRenderModel?.visualEvidence ?? [], [answerRenderModel]);
  const relatedDocuments = useMemo(() => answerRenderModel?.relatedDocuments ?? [], [answerRenderModel]);
  const currentRelevance = answer?.relevance ?? answer?.smartPanel?.relevance ?? searchRelevance;
  const weakEvidence = answerRenderModel
    ? answerRenderModel.trust === "unsupported" || answerRenderModel.trust === "low"
    : (currentRelevance ? isWeakRelevance(currentRelevance) : answer?.grounded !== true) ||
      answer?.retrievalDiagnostics?.gateStatus === "blocked";
  const safetyFindings = useMemo(() => extractSafetyFindings(answer), [answer]);
  const bestSource = answerRenderModel?.bestSource ?? null;
  const sourceSummary = answer?.evidenceSummary ?? answer?.smartPanel?.evidenceSummary;
  const answerGrounded =
    answer?.grounded === true &&
    answer.confidence !== "unsupported" &&
    currentRelevance?.isSourceBacked !== false &&
    answerRenderModel?.trust !== "unsupported";
  const sourceLookup = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const safeAnswerText = useMemo(() => sanitizeAnswerDisplayText(answer?.answer ?? ""), [answer?.answer]);
  const answerFollowUpSuggestions = useMemo(() => {
    if (!answer || !latestAnswerQuery) return [];
    const priorQueries = [...priorAnswerTurns.map((turn) => turn.query), latestAnswerQuery];
    return buildAnswerFollowUpSuggestions(latestAnswerQuery, answer, priorQueries);
  }, [answer, latestAnswerQuery, priorAnswerTurns]);
  const hiddenPriorTurnCount = Math.max(0, priorAnswerTurns.length - maxVisiblePriorTurns);
  const visiblePriorTurns = useMemo(() => {
    if (showEarlierTurns || hiddenPriorTurnCount === 0) return priorAnswerTurns;
    return priorAnswerTurns.slice(-maxVisiblePriorTurns);
  }, [hiddenPriorTurnCount, priorAnswerTurns, showEarlierTurns]);
  const safeAnswerSections = useMemo(() => {
    return (answer?.answerSections ?? [])
      .map((section) => {
        const heading = sanitizeDisplayText(section.heading, { minLength: 1, minTokens: 1 });
        const body = sanitizeAnswerDisplayText(section.body, { minLength: 8, minTokens: 2 });
        if (!heading || !body) return null;

        const citationSources: SearchResult[] = [];
        const seenCitationIds = new Set<string>();
        for (const id of section.citation_chunk_ids) {
          if (seenCitationIds.has(id)) continue;
          const source = sourceLookup.get(id);
          if (!source) continue;
          seenCitationIds.add(id);
          citationSources.push(source);
        }

        return {
          ...section,
          heading,
          body,
          citationSources,
        };
      })
      .filter((section): section is AnswerSection & { citationSources: SearchResult[] } => section !== null);
  }, [answer?.answerSections, sourceLookup]);
  const answerEvidenceMapRows = useMemo(() => {
    if (!answerRenderModel?.allowedBlocks.includes("evidenceMap")) return [];
    return evidenceMapRowsFromRenderModel(answerRenderModel).slice(0, answerRenderModel.trust === "high" ? 8 : 6);
  }, [answerRenderModel]);

  const showSystemNotice = Boolean(setupWarning && !demoMode);
  const groupedGovernanceWarningCount = useMemo(
    () =>
      groupSourceGovernanceWarnings(frontendSourceGovernanceWarnings(sourceGovernanceWarnings)).reduce(
        (total, warning) => total + warning.count,
        0,
      ),
    [sourceGovernanceWarnings],
  );
  const mobileFabState = useMemo(
    () =>
      buildMobileSectionFabState({
        hasAnswer: Boolean(answer),
        searchMode,
        sourceCount: sources.length,
        quoteCount: answerRenderModel?.quoteCards.length ?? 0,
        weakEvidence,
        governanceWarningCount: groupedGovernanceWarningCount,
      }),
    [answer, answerRenderModel, groupedGovernanceWarningCount, searchMode, sources.length, weakEvidence],
  );
  const bottomNavItems = [
    {
      label: activeModeSearch.statusLabel,
      description:
        activeModeResultKind === "tools"
          ? query.trim()
            ? "Filtered tools"
            : "Browse tools"
          : activeModeResultKind === "favourites"
            ? query.trim()
              ? "Filtered favourites"
              : "Browse favourites"
            : activeModeResultKind === "answer"
              ? answer
                ? weakEvidence
                  ? "Read synthesis carefully"
                  : "Clinical synthesis"
                : activeModeSearch.nextStep
              : documentMatches.length
                ? "Document results"
                : activeModeSearch.readyTitle,
      icon:
        activeModeResultKind === "tools"
          ? Wrench
          : activeModeResultKind === "favourites"
            ? Heart
            : activeModeResultKind === "answer"
              ? Search
              : FileText,
      href: "#search",
      count:
        activeModeResultKind === "tools"
          ? applicationsLauncherItemCount
          : activeModeResultKind === "favourites"
            ? null
            : activeModeResultKind === "documents"
              ? documentMatches.length
              : null,
      empty: activeModeResultKind === "documents" && documentMatches.length === 0,
    },
    {
      label: "Quotes",
      description: answer
        ? answerRenderModel?.quoteCards.length
          ? "Exact source excerpts"
          : "No quotes yet"
        : "No quotes yet",
      icon: Quote,
      href: "#quotes",
      count: answer ? (answerRenderModel?.quoteCards.length ?? 0) : null,
      empty: !answer || (answerRenderModel?.quoteCards.length ?? 0) === 0,
    },
    {
      label: "Images",
      description: answer ? (visualEvidence.length ? "Tables and diagrams" : "No images yet") : "No images yet",
      icon: FileImage,
      href: "#images",
      count: answer ? visualEvidence.length : null,
      empty: !answer || visualEvidence.length === 0,
    },
    {
      label: "Sources",
      description: answer
        ? answerRenderModel?.reviewSources.length
          ? "Passages and documents"
          : "No sources yet"
        : "No sources yet",
      icon: FileText,
      href: "#sources",
      count: answer ? (answerRenderModel?.reviewSources.length ?? 0) : null,
      empty: !answer || (answerRenderModel?.reviewSources.length ?? 0) === 0,
    },
  ] as const;
  const renderSystemNotice = (className?: string) => (
    <UtilityDrawer
      icon={AlertCircle}
      title={demoMode ? "Demo mode" : "Setup required"}
      summary={
        demoMode ? "Synthetic data only; not clinical guidance." : "Configuration is needed before real uploads."
      }
      mobileSummary={demoMode ? "Synthetic data" : "Setup needed"}
      className={className}
    >
      <p className="text-[15px] leading-6 text-[color:var(--warning)]">
        {demoMode
          ? "Demo mode is active with three synthetic indexed documents, citations, source cards, image captions, and document links. Synthetic data only; not clinical guidance."
          : `Configure .env.local and run supabase/schema.sql before uploading or searching. ${setupWarning}`}
      </p>
    </UtilityDrawer>
  );
  const showAuthPanel = false;
  const showDegradedNotice = !isOnline || (apiUnavailable && !canRunSearch);
  const hasMobileBottomSearch = searchMode !== "answer";
  const showDesktopHomeComposer =
    !error &&
    (activeModeResultKind === "tools" ||
      activeModeResultKind === "favourites" ||
      (!loading &&
        ((activeModeResultKind === "answer" && !answer && !modeSearchSubmitted) ||
          (searchMode === "documents" &&
            activeModeResultKind === "documents" &&
            documentMatches.length === 0 &&
            !modeSearchSubmitted) ||
          (searchMode === "prescribing" && activeModeResultKind === "documents" && !modeSearchSubmitted) ||
          (activeModeResultKind === "differentials" && !modeSearchSubmitted))));
  const desktopHomeComposerSlotId = showDesktopHomeComposer ? modeHomeDesktopComposerSlotId : undefined;
  // Favourites and Tools are content-rich hubs: they share the centred hero but
  // stay top-aligned so their lists start in a stable position.
  const centeredModeHome =
    showDesktopHomeComposer && activeModeResultKind !== "tools" && activeModeResultKind !== "favourites";
  // Short mode homes (centred homes plus the services/forms registry homes)
  // drop the large mobile bottom padding so phones don't get a scrollbar for
  // content that already fits. Result views keep the full clearance.
  const compactMobileModeHome =
    centeredModeHome ||
    ((searchMode === "services" || searchMode === "forms") && !modeSearchSubmitted && !query.trim() && !loading);
  // Submitted (non-answer) searches are result views, not mode homes: on phones
  // the bottom composer drops its chip row and hugs the screen edge so results
  // keep maximum vertical space. Mode homes keep the default chip-row layout.
  const compactMobileBottomSearch = hasMobileBottomSearch && modeSearchSubmitted;
  const differentialsCompareAddonActive =
    searchMode === "differentials" && modeSearchSubmitted && Boolean(query.trim());
  const renderDegradedNotice = () => (
    <UtilityDrawer
      icon={!isOnline ? WifiOff : AlertCircle}
      title={!isOnline ? "Offline" : "Service unavailable"}
      summary={
        !isOnline
          ? "Your browser is offline. Existing content may remain visible, but private search and uploads need network access."
          : isDeployedClinicalKb()
            ? "The app could not reach its API. Try again in a moment."
            : "The local API did not respond. Check the app server and setup status before retrying."
      }
      mobileSummary={!isOnline ? "Offline" : "API unavailable"}
    >
      <p className="text-[15px] leading-6 text-[color:var(--warning)]">
        {!isOnline
          ? "Reconnect before uploading documents, refreshing source URLs, or generating answers."
          : isDeployedClinicalKb()
            ? "The app will preserve the current view. If this keeps happening, check your connection and try again shortly."
            : "The app will preserve the current view. Retry after confirming the local server, Supabase, OpenAI, and worker setup."}
      </p>
    </UtilityDrawer>
  );
  const setupReadyCount = setupChecks.filter((check) => check.status === "ready").length;
  const setupCheckCount = setupChecks.length || fallbackSetupChecks.length;
  const activeUploadWork =
    jobs.filter((job) => job.status === "pending" || job.status === "processing").length +
    batches.filter((batch) => batch.status === "queued" || batch.status === "processing").length;
  const failedUploadWork =
    jobs.filter((job) => job.status === "failed").length + batches.filter((batch) => batch.status === "failed").length;
  const uploadTabs: Array<{
    id: UploadIndexingTab;
    label: string;
    summary: string;
    panelId: string;
    icon: typeof UploadCloud;
  }> = [
    {
      id: "setup",
      label: "Setup",
      summary: `${setupReadyCount}/${setupCheckCount} ready`,
      panelId: "dashboard-setup-section",
      icon: ListChecks,
    },
    {
      id: "upload",
      label: "Upload",
      summary: uploadReadOnlyMode || !canUploadDocuments ? "Locked" : "Ready",
      panelId: "dashboard-upload-section",
      icon: UploadCloud,
    },
    {
      id: "jobs",
      label: "Jobs",
      summary: activeUploadWork
        ? `${activeUploadWork} active`
        : failedUploadWork
          ? `${failedUploadWork} failed`
          : "Idle",
      panelId: "dashboard-indexing-section",
      icon: RefreshCw,
    },
    {
      id: "quality",
      label: "Quality",
      summary: qualityItems.length ? `${qualityItems.length} review` : "Clear",
      panelId: "dashboard-quality-section",
      icon: ShieldAlert,
    },
  ];
  const handleUploadQueued = () => {
    setUploadMobileTab("jobs");
    void refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
  };
  const documentsDrawerIsAdmin = documentsDrawerMode === "admin" && canUsePrivateApis;
  const documentsDrawerTitle =
    documentsDrawerMode === "recent"
      ? "Recent documents"
      : documentsDrawerMode === "source"
        ? "Source PDFs"
        : documentsDrawerIsAdmin
          ? "Document admin"
          : "Source library";
  const documentsDrawerSummary = dashboardDataLoading
    ? "Loading indexed document status."
    : documentsDrawerMode === "recent"
      ? "Continue reading from recently updated sources."
      : documentsDrawerMode === "source"
        ? "Open original PDF source documents."
        : documentsDrawerIsAdmin
          ? `${indexedDocumentTotal.toLocaleString()} indexed documents available.`
          : "Search and open indexed clinical sources.";
  const documentsDrawerMobileSummary = dashboardDataLoading
    ? "Loading library"
    : documentsDrawerMode === "recent"
      ? "Recent sources"
      : documentsDrawerMode === "source"
        ? "PDF sources"
        : documentsDrawerIsAdmin
          ? "Admin"
          : "Library";
  const DocumentsDrawerIcon =
    documentsDrawerMode === "recent"
      ? Clock3
      : documentsDrawerMode === "source"
        ? ExternalLink
        : documentsDrawerIsAdmin
          ? UploadCloud
          : FolderOpen;
  const drawerGroupTitle = uploadDrawerOpen || documentsDrawerIsAdmin ? "Library and admin" : "Sources";

  return (
    <div
      className={cn(
        appBackdrop,
        "mobile-app-shell flex flex-col overflow-hidden text-[color:var(--text)] md:grid md:grid-cols-[5.25rem_minmax(0,1fr)] md:overflow-hidden",
        "motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-safe:ease-out",
        sidebarCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[20rem_minmax(0,1fr)]",
      )}
      style={
        {
          "--clinical-sidebar-width": sidebarCollapsed ? "5.25rem" : "20rem",
          "--clinical-sidebar-width-md": "5.25rem",
        } as CSSProperties
      }
    >
      <ClinicalDesktopSidebar
        collapsed={sidebarCollapsed}
        recentQueries={recentQueries}
        identity={sidebarIdentity}
        activeMode={searchMode}
        onCollapsedChange={setSidebarCollapsed}
        onNewChat={startNewChat}
        onPickRecent={pickRecentQuery}
        onOpenGuide={openGuide}
        onOpenSettings={openSettings}
        onOpenAccount={openAccountProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPrefetchApplications={prefetchApplications}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:h-full">
        <MasterSearchHeader
          documents={documents}
          documentTotal={indexedDocumentTotal}
          query={query}
          searchMode={searchMode}
          loading={loading}
          selectedDocumentIds={selectedDocumentIds}
          queryMode={queryMode}
          scopeFilters={scopeFilters}
          realDataReady={canRunSearch}
          onQueryChange={setQuery}
          onSearchModeChange={selectSearchMode}
          onAsk={ask}
          onClearQuery={() => {
            setQuery("");
            if (!answer) setModeSearchSubmitted(false);
          }}
          onClearScope={() => setSelectedDocumentIds([])}
          onQueryModeChange={setQueryMode}
          onScopeFiltersChange={setScopeFilters}
          onToggleScope={toggleDocumentScope}
          onOpenUpload={openUploadDrawer}
          onOpenEvidence={openEvidenceDrawer}
          onOpenRecentDocuments={openRecentDocuments}
          onOpenLibrary={openSourceLibrary}
          onOpenSourcePdf={openSourcePdfBrowser}
          onNewChat={startNewChat}
          onOpenMobileSidebar={() => {
            closeDashboardTransientSurfaces("mobileSidebar");
            setMobileSidebarOpen(true);
          }}
          queryModeOptions={clinicalQueryModeOptions}
          queryInputRef={composerInputRef}
          queryInputAutoFocus={focusSearch}
          recentQueries={recentQueries}
          commandScopes={commandScopes}
          onCommandScopesChange={setCommandScopes}
          onPickRecent={(recent) => {
            pickRecentQuery(recent);
            void ask();
          }}
          onCrossModeSearch={crossModeSearch}
          composerPlaceholder={searchMode === "answer" && latestAnswerQuery ? "Ask a follow-up..." : undefined}
          mobileSearchPlacement={hasMobileBottomSearch ? "bottom" : "default"}
          mobileBottomSearchVariant={compactMobileBottomSearch ? "compact" : "default"}
          mobileBottomSearchAddonSlotId={
            differentialsCompareAddonActive ? differentialsMobileCompareAddonSlotId : undefined
          }
          desktopHomeComposerSlotId={desktopHomeComposerSlotId}
          heroComposerFromTablet={Boolean(desktopHomeComposerSlotId)}
          // Phone-only: the header sits above the internally scrolling <main>,
          // so hiding must collapse its layout space to hand it to content.
          hideOnScroll={{ strategy: "collapse", containerRef: mainRef }}
        />

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          onScroll={scheduleActiveSectionSync}
          className={cn(
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] focus:outline-none",
            searchMode === "answer"
              ? compactMobileModeHome
                ? "mb-0"
                : "mb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:mb-24"
              : hasMobileBottomSearch
                ? compactMobileBottomSearch
                  ? differentialsCompareAddonActive
                    ? "mb-[calc(8.75rem+env(safe-area-inset-bottom))] sm:mb-0"
                    : "mb-[calc(5rem+env(safe-area-inset-bottom))] sm:mb-0"
                  : compactMobileModeHome
                    ? "mb-0"
                    : "mb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:mb-0"
                : "mb-0",
          )}
        >
          <h1 className="sr-only">Clinical Guide</h1>
          <SearchCommandProvider
            value={{
              query,
              modeId: searchMode,
              commandScopes,
              onRemoveScope: (scopeId) => setCommandScopes((current) => current.filter((scope) => scope !== scopeId)),
              onClearScopes: () => setCommandScopes([]),
            }}
          >
            <div
              className={cn(
                "mx-auto max-w-7xl space-y-4 overflow-x-hidden px-3 py-4 sm:space-y-5 sm:px-4 sm:py-5 lg:px-8",
                // Centred mode homes carry little content, so drop the large
                // mobile bottom padding (the fixed composer already has its own
                // reserved margin on <main>) to avoid a needless scrollbar.
                // sm+/lg values stay identical to the result-view treatment.
                searchMode === "answer"
                  ? compactMobileModeHome
                    ? "pb-4"
                    : "pb-32 sm:pb-36 lg:pb-40"
                  : hasMobileBottomSearch
                    ? compactMobileModeHome
                      ? "pb-4 sm:pb-10 lg:pb-12"
                      : compactMobileBottomSearch
                        ? "pb-8 sm:pb-10 lg:pb-12"
                        : "pb-32 sm:pb-10 lg:pb-12"
                    : "pb-8 sm:pb-10 lg:pb-12",
              )}
            >
              {actionNotice && (
                <div
                  role="status"
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-3 text-sm font-medium motion-safe:animate-fade-up",
                    actionNotice.tone === "success" ? toneSuccess : toneWarning,
                  )}
                >
                  <span className="min-w-0">{actionNotice.message}</span>
                  <button
                    type="button"
                    onClick={() => setActionNotice(null)}
                    aria-label="Dismiss notification"
                    className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-70 transition hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showDegradedNotice && renderDegradedNotice()}
              {showSystemNotice && answer ? renderSystemNotice("hidden sm:block") : null}

              <section
                className={cn(
                  "min-h-[calc(100dvh-12.5rem)] sm:min-h-[calc(100dvh-11rem)]",
                  centeredModeHome || (activeModeResultKind === "answer" && !answer && !loading)
                    ? // On tall phones the centred home leans slightly toward the
                      // bottom composer (matches the committed vertical-weighting
                      // guard); short phones skip the bias so content still fits.
                      "grid w-full place-items-center max-sm:[@media(min-height:800px)]:pt-[5vh]"
                    : activeModeResultKind === "tools" ||
                        activeModeResultKind === "favourites" ||
                        activeModeResultKind === "differentials"
                      ? "mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden"
                      : activeModeResultKind === "documents" || activeModeResultKind === "services"
                        ? "mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden"
                        : "mx-auto w-full max-w-3xl space-y-4 overflow-x-hidden",
                )}
              >
                <h2 data-testid="answer-section-heading" className="sr-only">
                  {activeModeSearch.resultHeading}
                </h2>
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-3 text-sm font-medium text-[color:var(--danger)]"
                  >
                    <AlertCircle className="mr-2 inline h-4 w-4" />
                    {error}
                  </div>
                )}

                {loading && answerProgress && searchMode !== "prescribing" && (
                  <div
                    role="status"
                    className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-medium text-[color:var(--text-heading)]"
                  >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[color:var(--clinical-accent)]" />
                    <span className="min-w-0 truncate">{answerProgress}</span>
                  </div>
                )}

                {activeModeResultKind === "differentials" ? (
                  <DifferentialsHome
                    query={query}
                    loading={loading}
                    documentMatches={documentMatches}
                    realDataReady={canRunSearch}
                    authUnavailable={false}
                    apiUnavailable={apiUnavailable}
                    setupWarning={setupWarning}
                    onQueryChange={setQuery}
                    desktopComposerSlotId={desktopHomeComposerSlotId}
                    onSuggestedSearch={(nextQuery) => {
                      setQuery(nextQuery);
                      focusComposerInput();
                    }}
                    onRunSearch={(nextQuery) => {
                      void executeSearch(nextQuery, "differentials", scopeFilters);
                    }}
                    onOpenPresentations={(nextQuery) => {
                      const queryParams = new URLSearchParams();
                      const normalizedQuery = nextQuery.trim();
                      if (normalizedQuery) queryParams.set("q", normalizedQuery);
                      router.push(`/differentials/presentations${queryParams.toString() ? `?${queryParams}` : ""}`);
                    }}
                    onOpenDiagnoses={(nextQuery) => {
                      const queryParams = new URLSearchParams();
                      const normalizedQuery = nextQuery.trim();
                      if (normalizedQuery) queryParams.set("q", normalizedQuery);
                      router.push(`/differentials/diagnoses${queryParams.toString() ? `?${queryParams}` : ""}`);
                    }}
                  />
                ) : activeModeResultKind === "tools" ? (
                  <ToolsHub query={query} desktopComposerSlotId={desktopHomeComposerSlotId} />
                ) : activeModeResultKind === "favourites" ? (
                  <FavouritesHub
                    query={query}
                    onClearQuery={() => {
                      setQuery("");
                      setModeSearchSubmitted(false);
                      router.replace(appModeHomeHref("favourites", { focus: true }));
                    }}
                    onAddFavourite={() =>
                      setActionNotice({ tone: "success", message: "Favourite creation is ready to connect." })
                    }
                    desktopComposerSlotId={desktopHomeComposerSlotId}
                  />
                ) : activeModeResultKind === "documents" || activeModeResultKind === "services" ? (
                  searchMode === "prescribing" ? (
                    <MedicationPrescribingWorkspace
                      query={query}
                      loading={false}
                      realDataReady
                      authUnavailable={false}
                      apiUnavailable={false}
                      setupWarning={null}
                      onSuggestedSearch={setMedicationSearchQuery}
                      showHome={!query.trim() && !modeSearchSubmitted}
                      desktopComposerSlotId={desktopHomeComposerSlotId}
                    />
                  ) : (
                    <>
                      <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
                      <DocumentSearchResultsPanel
                        matches={documentMatches}
                        recordMatches={recordSearchMatches}
                        recordMode={recordSearchMode}
                        recordStatus={registryRecords.status}
                        showRecordMatches={searchMode === "services" || searchMode === "forms"}
                        query={query}
                        loading={loading}
                        documentCount={indexedDocumentTotal}
                        recentDocuments={documents}
                        realDataReady={searchMode === "services" || searchMode === "forms" ? true : canRunSearch}
                        authUnavailable={false}
                        apiUnavailable={apiUnavailable}
                        setupWarning={setupWarning}
                        facets={searchFacets}
                        onScopeDocument={scopeOnlyDocument}
                        onAnswerFromDocument={answerFromDocument}
                        onOpenRecentDocuments={openRecentDocuments}
                        onOpenLibrary={openSourceLibrary}
                        onOpenSourcePdf={openSourcePdfBrowser}
                        onTagSearch={handleTagSearch}
                        showHome={searchMode === "documents" && !modeSearchSubmitted}
                        desktopComposerSlotId={desktopHomeComposerSlotId}
                      />
                    </>
                  )
                ) : loading && !answer ? (
                  <AnswerSkeleton />
                ) : answer && answerRenderModel ? (
                  stagedDashboardExtraction.answerSurface ? (
                    <>
                      {hiddenPriorTurnCount > 0 && !showEarlierTurns ? (
                        <button
                          type="button"
                          data-testid="answer-thread-show-earlier"
                          onClick={() => setShowEarlierTurns(true)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        >
                          Show earlier messages ({hiddenPriorTurnCount})
                        </button>
                      ) : null}
                      {visiblePriorTurns.map((turn) => (
                        <PriorAnswerTurnSurface
                          key={turn.id}
                          turn={turn}
                          copied={copiedAction === turn.id}
                          collapsed={collapsedTurnIds.has(turn.id)}
                          onToggleCollapsed={() => toggleAnswerTurnCollapsed(turn.id)}
                          onCopy={(text) => copyText(turn.id, text)}
                        />
                      ))}
                      <StagedAnswerResultSurface
                        answer={answer}
                        query={latestAnswerQuery ?? query}
                        safeAnswerText={safeAnswerText}
                        bestSource={bestSource}
                        sourceGovernanceWarnings={sourceGovernanceWarnings}
                        sourceSummary={sourceSummary}
                        renderModel={answerRenderModel}
                        weakEvidence={weakEvidence}
                        answerViewMode={answerViewMode}
                        answerEvidenceMapRows={answerEvidenceMapRows}
                        onScopeDocument={scopeOnlyDocument}
                        answerGrounded={answerGrounded}
                        sources={answerRenderModel.reviewSources}
                        demoMode={demoMode}
                        safeAnswerSections={safeAnswerSections}
                        safetyFindings={safetyFindings}
                        copiedAnswer={copiedAction === "answer"}
                        pendingFeedback={pendingFeedback}
                        onCopyAnswer={() =>
                          copyText("answer", answerRenderModel.copyText || safeAnswerText || answer.answer)
                        }
                        onSubmitFeedback={submitAnswerFeedback}
                        onFollowUpQuote={handleFollowUpQuote}
                        followUpSuggestions={answerFollowUpSuggestions}
                        onPickFollowUpSuggestion={handlePickFollowUpSuggestion}
                        followUpSuggestionsDisabled={loading}
                      />
                    </>
                  ) : null
                ) : (
                  <AnswerEmptyState
                    onPickSample={setQuery}
                    onSearchDocuments={() => setSearchMode("documents")}
                    onUploadDocument={openUploadDrawer}
                    desktopComposerSlotId={desktopHomeComposerSlotId}
                  />
                )}
              </section>

              {showSystemNotice && answer ? renderSystemNotice("sm:hidden") : null}

              {activeModeResultKind === "answer" && answer && (
                <RelatedDocumentsPanel
                  documents={relatedDocuments}
                  onScopeDocument={scopeOnlyDocument}
                  onTagSearch={handleTagSearch}
                />
              )}
              {(documentsDrawerOpen || uploadDrawerOpen) && (
                <section id="sources" className="mx-auto grid w-full max-w-4xl gap-3 scroll-mt-4 sm:scroll-mt-6">
                  <DrawerGroupLabel title={drawerGroupTitle} />
                  {documentsDrawerOpen ? (
                    <UtilityDrawer
                      id="dashboard-documents-drawer"
                      icon={BookOpen}
                      title={documentsDrawerTitle}
                      summary={documentsDrawerSummary}
                      mobileSummary={documentsDrawerMobileSummary}
                      open={documentsDrawerOpen}
                      onOpenChange={setDocumentsDrawerOpen}
                      sheetBreakpoint="lg"
                      sheetHeaderLeading={
                        <span className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                          <DocumentsDrawerIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      }
                      sheetTitleAccessory={
                        documentsDrawerIsAdmin ? (
                          <span className="nums hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-2xs font-bold text-[color:var(--text-muted)] sm:inline-flex">
                            {indexedDocumentTotal.toLocaleString()} indexed
                          </span>
                        ) : null
                      }
                      sheetDescription={documentsDrawerSummary}
                      sheetHeaderClassName="bg-[color:var(--surface-raised)] px-4 py-3 sm:px-5 sm:py-4"
                      sheetCloseButtonClassName="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                      sheetContentClassName="max-h-[min(82dvh,40rem)] sm:max-h-[min(88dvh,46rem)] sm:max-w-2xl lg:max-w-3xl"
                      sheetBodyClassName="bg-[color:var(--surface-subtle)] p-3 sm:p-4"
                      sheetChildrenClassName="space-y-3"
                    >
                      {documentsDrawerIsAdmin ? (
                        <LibraryHealthStrip
                          documents={documents}
                          jobs={jobs}
                          batches={batches}
                          checks={setupChecks}
                          loading={dashboardDataLoading}
                          onSelectTarget={openLibraryHealthTarget}
                        />
                      ) : null}
                      <DocumentDrawer
                        documents={documents}
                        pagination={documentsPagination}
                        loadingMoreDocuments={loadingMoreDocuments}
                        mode={documentsDrawerIsAdmin ? "admin" : documentsDrawerMode}
                        selectedDocumentIds={selectedDocumentIds}
                        statusFilter={documentDrawerStatusFilter}
                        onToggleScope={toggleDocumentScope}
                        onLoadMoreDocuments={loadMoreDocuments}
                        onDocumentRenamed={handleDocumentRenamed}
                        onDocumentDeleted={handleDocumentDeleted}
                        onBulkReindex={bulkReindexSelected}
                        onBulkAssignCollection={bulkAssignCollection}
                        onBulkMetadataUpdate={bulkUpdateMetadata}
                        bulkActionStatus={bulkActionStatus}
                        bulkActionBusy={bulkActionBusy}
                        canManageDocuments={canUsePrivateApis}
                        onTagSearch={handleTagSearch}
                        onMutateLabel={mutateDocumentLabel}
                      />
                    </UtilityDrawer>
                  ) : null}

                  {uploadDrawerOpen ? (
                    <UtilityDrawer
                      id="dashboard-upload-drawer"
                      icon={UploadCloud}
                      title="Upload and indexing"
                      summary="Real uploads require Supabase, OpenAI keys, schema setup, and the worker."
                      mobileSummary="Setup & uploads"
                      open={uploadDrawerOpen}
                      onOpenChange={setUploadDrawerOpen}
                    >
                      <LibraryHealthStrip
                        documents={documents}
                        jobs={jobs}
                        batches={batches}
                        checks={setupChecks}
                        loading={dashboardDataLoading}
                        onSelectTarget={openLibraryHealthTarget}
                      />
                      <div
                        role="tablist"
                        aria-label="Upload and indexing sections"
                        className="grid grid-cols-4 gap-2 lg:hidden"
                      >
                        {uploadTabs.map((tab) => {
                          const active = uploadMobileTab === tab.id;
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              aria-controls={tab.panelId}
                              onClick={() => setUploadMobileTab(tab.id)}
                              className={cn(
                                "min-h-[56px] rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] active:translate-y-px",
                                active
                                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--glow-soft)]"
                                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                              )}
                            >
                              <span className="flex items-center gap-1.5 text-xs font-bold">
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                              </span>
                              <span className="mt-1 block truncate text-[11px] font-semibold opacity-80">
                                {tab.summary}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div
                          id="dashboard-setup-section"
                          role="tabpanel"
                          aria-label="Setup"
                          className={cn(
                            "space-y-3 scroll-mt-4 lg:col-start-1 lg:row-start-1",
                            uploadMobileTab !== "setup" && "hidden lg:block",
                          )}
                        >
                          <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                            Developer setup status
                          </p>
                          <SetupChecklist checks={setupChecks} />
                          {showAuthPanel && <AuthPanel />}
                        </div>
                        <div
                          id="dashboard-upload-section"
                          role="tabpanel"
                          aria-label="Upload"
                          className={cn(
                            "space-y-3 scroll-mt-4 lg:col-start-1 lg:row-start-2",
                            uploadMobileTab !== "upload" && "hidden lg:block",
                          )}
                        >
                          <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                            Clinical upload
                          </p>
                          <UploadPanel
                            onUploaded={handleUploadQueued}
                            demoMode={uploadReadOnlyMode}
                            canUpload={canUploadDocuments}
                            authorizationHeader={authorizationHeader}
                          />
                        </div>
                        <div
                          id="dashboard-indexing-section"
                          role="tabpanel"
                          aria-label="Jobs"
                          className={cn(
                            "space-y-3 scroll-mt-4 lg:col-start-2 lg:row-span-2 lg:row-start-1",
                            uploadMobileTab !== "jobs" && "hidden lg:block",
                          )}
                        >
                          <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                            Indexing progress
                          </p>
                          <IndexingMonitor
                            jobs={jobs}
                            batches={batches}
                            filter={indexingMonitorFilter}
                            actionId={indexingActionId}
                            onRetry={retryJob}
                            onReindex={reindexDocument}
                            onEnrich={enrichDocument}
                          />
                        </div>
                        <div
                          id="dashboard-quality-section"
                          role="tabpanel"
                          aria-label="Quality"
                          className={cn(
                            "space-y-3 scroll-mt-4 lg:col-span-2 lg:row-start-3",
                            uploadMobileTab !== "quality" && "hidden lg:block",
                          )}
                        >
                          <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                            Ingestion quality console
                          </p>
                          <IngestionQualityConsole
                            items={qualityItems}
                            actionId={indexingActionId}
                            onRetry={retryJob}
                            onReindex={reindexDocument}
                            onEnrich={enrichDocument}
                          />
                        </div>
                      </div>
                    </UtilityDrawer>
                  ) : null}
                </section>
              )}

              {(documentsDrawerOpen || uploadDrawerOpen) && <GuideTrigger onOpen={openGuide} />}
            </div>
          </SearchCommandProvider>
        </main>

        <MobileSectionFab
          items={bottomNavItems}
          activeHash={activeHash}
          state={mobileFabState}
          hidden
          onNavigate={navigateMobileSection}
        />
        <GuideDialog open={guideOpen} onClose={closeGuide} />
        <SettingsDialog
          open={settingsOpen}
          onClose={closeSettings}
          identity={sidebarIdentity}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={auth.signOut}
          onOpenGuide={openGuide}
        />
        <AccountSetupDialog open={accountSetupOpen} onClose={closeAccountSetup} />
        <ClinicalMobileSidebar
          open={mobileSidebarOpen}
          recentQueries={recentQueries}
          identity={sidebarIdentity}
          activeMode={searchMode}
          onOpenChange={setMobileSidebarOpen}
          onNewChat={startNewChat}
          onPickRecent={pickRecentQuery}
          onOpenGuide={openGuide}
          onOpenSettings={openSettings}
          onOpenAccount={openAccountProfile}
          theme={theme}
          onToggleTheme={toggleTheme}
          onPrefetchApplications={prefetchApplications}
        />
      </div>
    </div>
  );
}
