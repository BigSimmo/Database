"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
} from "lucide-react";

import { DocumentManagementActions, type DocumentDeleteResult } from "@/components/DocumentManagementActions";
import {
  DocumentOrganizationBadges,
  documentDisplayTitle,
  documentOrganizationProfile,
} from "@/components/DocumentOrganizationBadges";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { SafeBoldText } from "@/components/SafeBoldText";
import { StatusBadge } from "@/components/clinical-dashboard/badges";
import type {
  DocumentDrawerMode,
  DocumentDrawerStatusFilter,
  DocumentPagination,
  LabelReviewMutationBody,
} from "@/components/clinical-dashboard/dashboard-contracts";
import {
  cn,
  EmptyState,
  fieldControlPlain,
  fieldControlWithIcon,
  fieldIcon,
  floatingControl,
  iconTilePremium,
  metadataPill,
  panelSubtle,
  primaryControl,
  sourceCard,
  SourceDesignationBadge,
  SourceProvenance,
  SourceStatusBadge,
  textMuted,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import {
  documentLabelReviewStatus,
  documentLabelTier,
  formatDocumentLabelDisplay,
  normalizeDocumentLabelForStorage,
  reviewDocumentTagQuality,
  type SmartDocumentTag,
  type SmartDocumentTagQualityIssueKind,
  type SmartDocumentTagTier,
  tagSearchText,
} from "@/lib/document-tags";
import { classifySourceAuthority, type SourceDesignation } from "@/lib/source-authority-registry";
import type { ClinicalDocument, DocumentLabel, DocumentLabelType } from "@/lib/types";
import { emptyStates } from "@/lib/ui-copy";

const tagQualityTone: Record<SmartDocumentTagQualityIssueKind, string> = {
  noisy: toneDanger,
  duplicate: toneWarning,
  low_confidence: toneInfo,
  overused: toneNeutral,
};

const labelTierTone: Record<SmartDocumentTagTier, string> = {
  primary: toneSuccess,
  secondary: toneNeutral,
  ranking: toneInfo,
};

const documentLabelTypeOptions: Array<{ value: DocumentLabelType; label: string }> = [
  { value: "site", label: "Site" },
  { value: "topic", label: "Topic" },
  { value: "document_type", label: "Document type" },
  { value: "medication", label: "Medication" },
  { value: "risk", label: "Risk" },
  { value: "setting", label: "Setting" },
  { value: "workflow", label: "Workflow" },
  { value: "population", label: "Population" },
  { value: "service", label: "Service" },
  { value: "clinical_action", label: "Clinical action" },
  { value: "care_phase", label: "Care phase" },
  { value: "document_intent", label: "Document intent" },
  { value: "content_feature", label: "Content feature" },
  { value: "custom", label: "Manual" },
];

function tagQualityLabel(kind: SmartDocumentTagQualityIssueKind) {
  if (kind === "low_confidence") return "low confidence";
  return kind;
}

function normalizedLabelReviewRow(label: DocumentLabel) {
  const normalized = normalizeDocumentLabelForStorage(label);
  const fallbackLabelType = documentLabelTypeOptions.some((option) => option.value === label.label_type)
    ? label.label_type
    : "custom";
  const labelType = normalized?.label_type ?? fallbackLabelType;
  const labelText = normalized?.label ?? label.label?.trim() ?? "";
  const tier: SmartDocumentTagTier = normalized
    ? documentLabelTier(normalized.label, normalized.label_type)
    : "secondary";
  const reviewStatus = documentLabelReviewStatus(label);
  return {
    id: label.id,
    label: labelText,
    displayLabel: labelText ? formatDocumentLabelDisplay(labelText, labelType) : "Unreviewed label",
    labelType,
    tier,
    reviewStatus,
    source: label.source,
    confidence: normalized?.confidence ?? label.confidence ?? 0,
  };
}

function labelTypeDisplay(value: DocumentLabelType) {
  return documentLabelTypeOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}

function DocumentLabelReviewPanel({
  documents,
  canManage,
  onMutateLabel,
}: {
  documents: ClinicalDocument[];
  canManage: boolean;
  onMutateLabel: (documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody) => Promise<boolean>;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { label: string; labelType: DocumentLabelType }>>(
    {},
  );

  const items = useMemo(() => {
    return documents
      .map((document) => {
        const rows = (document.labels ?? [])
          .map((label) => normalizedLabelReviewRow(label))
          .filter((row): row is NonNullable<ReturnType<typeof normalizedLabelReviewRow>> => Boolean(row));
        const visible = rows.filter((row) => row.reviewStatus !== "hidden" && row.tier !== "ranking");
        const ranking = rows.filter((row) => row.reviewStatus !== "hidden" && row.tier === "ranking");
        const hidden = rows.filter((row) => row.reviewStatus === "hidden");
        const needsReview = rows.some((row) => row.reviewStatus === "new" && row.source === "generated");
        return { document, rows, visible, ranking, hidden, needsReview };
      })
      .filter((item) => item.rows.length)
      .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || b.ranking.length - a.ranking.length)
      .slice(0, 8);
  }, [documents]);

  if (!items.length) return null;

  async function mutate(documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody, actionId: string) {
    setBusyAction(actionId);
    try {
      return await onMutateLabel(documentId, method, body);
    } finally {
      setBusyAction(null);
    }
  }

  function draftFor(documentId: string) {
    return overrideDrafts[documentId] ?? { label: "", labelType: "topic" as DocumentLabelType };
  }

  function setDraft(documentId: string, next: { label: string; labelType: DocumentLabelType }) {
    setOverrideDrafts((current) => ({ ...current, [documentId]: next }));
  }

  return (
    <details className={cn(sourceCard, "group p-3")}>
      <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Label review</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              Visible labels, ranking labels, hidden labels, confidence, and manual overrides
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 grid gap-3 border-t border-[color:var(--border)] pt-3">
        {items.map((item) => {
          const draft = draftFor(item.document.id);
          return (
            <article
              key={item.document.id}
              className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/documents/${item.document.id}`}
                    className="line-clamp-2 text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                  >
                    {documentDisplayTitle(item.document)}
                  </Link>
                  <p className={cn("mt-1 text-2xs font-semibold", textMuted)}>
                    {item.visible.length} visible · {item.ranking.length} ranking · {item.hidden.length} hidden
                  </p>
                </div>
                {item.needsReview ? (
                  <span className={cn(metadataPill, toneWarning, "min-h-7 text-2xs")}>Needs review</span>
                ) : (
                  <span className={cn(metadataPill, toneSuccess, "min-h-7 text-2xs")}>Reviewed</span>
                )}
              </div>

              {(
                [
                  { title: "Visible", rows: item.visible },
                  { title: "Ranking", rows: item.ranking },
                  { title: "Hidden", rows: item.hidden },
                ] satisfies Array<{ title: string; rows: typeof item.rows }>
              ).map(({ title, rows: labelRows }) => {
                if (!labelRows.length) return null;
                return (
                  <section key={title} className="grid gap-1.5">
                    <p className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                      {title}
                    </p>
                    <div className="grid gap-1.5">
                      {labelRows.slice(0, 8).map((label) => (
                        <div
                          key={label.id}
                          className="grid gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-[color:var(--text)]">
                                {label.displayLabel}
                              </span>
                              <span className={cn(metadataPill, labelTierTone[label.tier], "min-h-6 text-2xs")}>
                                {label.tier}
                              </span>
                              <span className={cn(metadataPill, "min-h-6 text-2xs")}>
                                {labelTypeDisplay(label.labelType)}
                              </span>
                            </div>
                            <p className={cn("mt-1 text-2xs font-semibold", textMuted)}>
                              {label.source} · {Math.round(label.confidence * 100)}% · {label.reviewStatus}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {label.reviewStatus === "hidden" ? (
                              <button
                                type="button"
                                disabled={!canManage || busyAction !== null}
                                onClick={() =>
                                  void mutate(
                                    item.document.id,
                                    "PATCH",
                                    { labelId: label.id, action: "restore" },
                                    `restore:${label.id}`,
                                  )
                                }
                                className={cn(floatingControl, "min-h-8 px-2 text-2xs")}
                              >
                                Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={!canManage || busyAction !== null || label.reviewStatus === "approved"}
                                  onClick={() =>
                                    void mutate(
                                      item.document.id,
                                      "PATCH",
                                      { labelId: label.id, action: "approve" },
                                      `approve:${label.id}`,
                                    )
                                  }
                                  className={cn(floatingControl, "min-h-8 px-2 text-2xs")}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManage || busyAction !== null}
                                  onClick={() =>
                                    void mutate(
                                      item.document.id,
                                      "PATCH",
                                      { labelId: label.id, action: "hide" },
                                      `hide:${label.id}`,
                                    )
                                  }
                                  className={cn(floatingControl, "min-h-8 px-2 text-2xs text-[color:var(--danger)]")}
                                >
                                  Hide
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              <form
                className="grid gap-2 border-t border-[color:var(--border)] pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = draft.label.trim();
                  if (!trimmed) return;
                  void mutate(
                    item.document.id,
                    "POST",
                    { label: trimmed, label_type: draft.labelType },
                    `override:${item.document.id}`,
                  ).then((ok) => {
                    if (ok) setDraft(item.document.id, { label: "", labelType: draft.labelType });
                  });
                }}
              >
                <input
                  value={draft.label}
                  onChange={(event) => setDraft(item.document.id, { ...draft, label: event.target.value })}
                  disabled={!canManage || busyAction !== null}
                  placeholder="Manual override label"
                  aria-label="Manual override label"
                  className={fieldControlPlain}
                />
                <select
                  value={draft.labelType}
                  onChange={(event) =>
                    setDraft(item.document.id, { ...draft, labelType: event.target.value as DocumentLabelType })
                  }
                  disabled={!canManage || busyAction !== null}
                  aria-label="Manual override label type"
                  className={fieldControlPlain}
                >
                  {documentLabelTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!canManage || busyAction !== null || !draft.label.trim()}
                  className={cn(primaryControl, "justify-center text-xs")}
                >
                  {busyAction === `override:${item.document.id}` ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  )}
                  Override
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </details>
  );
}

function DocumentTagQualityPanel({ documents }: { documents: ClinicalDocument[] }) {
  const issues = useMemo(() => reviewDocumentTagQuality(documents), [documents]);
  const counts = issues.reduce<Record<SmartDocumentTagQualityIssueKind, number>>(
    (current, issue) => ({ ...current, [issue.kind]: current[issue.kind] + 1 }),
    { noisy: 0, duplicate: 0, low_confidence: 0, overused: 0 },
  );

  return (
    <details className={cn(panelSubtle, "group p-3")}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <Tag aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Tag quality review</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              {issues.length
                ? `${issues.length} issue${issues.length === 1 ? "" : "s"} across loaded documents`
                : "No obvious tag cleanup issues in loaded documents"}
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(counts) as SmartDocumentTagQualityIssueKind[]).map((kind) => (
            <span key={kind} className={cn(metadataPill, "min-h-7 px-2 text-2xs", tagQualityTone[kind])}>
              {tagQualityLabel(kind)}: {counts[kind]}
            </span>
          ))}
        </div>
        {issues.length ? (
          <div className="grid gap-2">
            {issues.slice(0, 12).map((issue, index) => (
              <div
                key={`${issue.kind}:${issue.label}:${index}`}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(metadataPill, "min-h-6 px-2 text-2xs", tagQualityTone[issue.kind])}>
                    {tagQualityLabel(issue.kind)}
                  </span>
                  <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">{issue.label}</p>
                  {issue.count > 1 ? (
                    <span className={cn("text-2xs font-semibold", textMuted)}>{issue.count} hits</span>
                  ) : null}
                </div>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>{issue.reason}</p>
                {issue.examples.length || issue.documentTitles.length ? (
                  <p className={cn("mt-1 truncate text-2xs font-semibold", textMuted)}>
                    {[
                      issue.examples.length ? `examples: ${issue.examples.join(", ")}` : "",
                      issue.documentTitles.length ? `docs: ${issue.documentTitles.join(", ")}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className={cn("text-sm", textMuted)}>Loaded tags are clean enough for the current smart-tag rules.</p>
        )}
      </div>
    </details>
  );
}

function DocumentIndexRepairPanel({ documents }: { documents: ClinicalDocument[] }) {
  const items = useMemo(() => {
    return documents
      .map((document) => {
        const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
        const score = Number((metadata as Record<string, unknown>).index_quality_score ?? 1);
        const issues = Array.isArray((metadata as Record<string, unknown>).index_quality_issues)
          ? ((metadata as Record<string, unknown>).index_quality_issues as unknown[]).map(String)
          : [];
        const sectionCount = Number((metadata as Record<string, unknown>).section_count ?? 0);
        const memoryCardCount = Number((metadata as Record<string, unknown>).memory_card_count ?? 0);
        const extractionQuality = String((metadata as Record<string, unknown>).extraction_quality ?? "unknown");
        const needsRepair =
          score < 0.72 ||
          issues.length > 0 ||
          sectionCount === 0 ||
          memoryCardCount === 0 ||
          extractionQuality === "poor" ||
          extractionQuality === "partial";
        return { document, score, issues, sectionCount, memoryCardCount, extractionQuality, needsRepair };
      })
      .filter((item) => item.needsRepair)
      .sort((a, b) => a.score - b.score || b.issues.length - a.issues.length)
      .slice(0, 10);
  }, [documents]);

  if (!items.length) return null;

  return (
    <details className={cn(sourceCard, "p-3")}>
      <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Index repair queue</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              {items.length} loaded document{items.length === 1 ? "" : "s"} need quality review or reindexing
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 grid gap-2 border-t border-[color:var(--border)] pt-3">
        {items.map((item) => (
          <article
            key={item.document.id}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">{item.document.title}</p>
              <span className={cn(metadataPill, "nums text-2xs")}>
                index {Number.isFinite(item.score) ? item.score.toFixed(2) : "n/a"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn(metadataPill, "text-2xs")}>extraction:{item.extractionQuality}</span>
              <span className={cn(metadataPill, "text-2xs")}>sections:{item.sectionCount}</span>
              <span className={cn(metadataPill, "text-2xs")}>memory:{item.memoryCardCount}</span>
              {item.issues.slice(0, 4).map((issue) => (
                <span key={issue} className={cn(metadataPill, "text-2xs")}>
                  {issue}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

export function DocumentDrawer({
  documents,
  pagination,
  loadingMoreDocuments,
  mode,
  selectedDocumentIds,
  statusFilter,
  onToggleScope,
  onLoadMoreDocuments,
  onDocumentRenamed,
  onDocumentDeleted,
  onBulkReindex,
  onBulkAssignCollection,
  onBulkMetadataUpdate,
  bulkActionStatus,
  bulkActionBusy,
  canManageDocuments,
  onTagSearch,
  onMutateLabel,
}: {
  documents: ClinicalDocument[];
  pagination: DocumentPagination | null;
  loadingMoreDocuments: boolean;
  mode: DocumentDrawerMode;
  selectedDocumentIds: string[];
  statusFilter: DocumentDrawerStatusFilter;
  onToggleScope: (documentId: string) => void;
  onLoadMoreDocuments: () => void;
  onDocumentRenamed: (document: ClinicalDocument) => void;
  onDocumentDeleted: (result: DocumentDeleteResult) => void;
  onBulkReindex: (mode: "enrichment" | "full" | "retry_failed") => void;
  onBulkAssignCollection: (collection: string) => void;
  onBulkMetadataUpdate: (metadata: Record<string, unknown>) => void;
  bulkActionStatus: string | null;
  bulkActionBusy: boolean;
  canManageDocuments: boolean;
  onTagSearch: (tag: SmartDocumentTag) => void;
  onMutateLabel: (documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedPopulation, setSelectedPopulation] = useState<string>("all");
  const [selectedDesignation, setSelectedDesignation] = useState<SourceDesignation | "all">("all");
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState<boolean>(false);

  const [collectionDraft, setCollectionDraft] = useState("");
  const [metadataDraft, setMetadataDraft] = useState({
    sourceStatus: "",
    validationStatus: "",
    extractionQuality: "",
    reviewDate: "",
    publicationDate: "",
    jurisdiction: "",
    sourceType: "",
    category: "",
  });

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const doc of documents) {
      const typeLabel = doc.labels?.find((l) => l.label_type === "document_type" && l.confidence >= 0.5)?.label;
      if (typeLabel) types.add(typeLabel);
      const profile = documentOrganizationProfile(doc);
      if (profile?.document_type?.label && profile.document_type.label !== "unknown") {
        types.add(profile.document_type.label);
      }
    }
    return Array.from(types).sort();
  }, [documents]);

  const allSites = useMemo(() => {
    const sites = new Set<string>();
    for (const doc of documents) {
      const siteLabels = doc.labels?.filter((l) => l.label_type === "site" && l.confidence >= 0.5) ?? [];
      for (const l of siteLabels) sites.add(l.label);
      const profile = documentOrganizationProfile(doc);
      if (profile?.site?.label) sites.add(profile.site.label);
    }
    return Array.from(sites).sort();
  }, [documents]);

  const allTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const doc of documents) {
      const topicLabels =
        doc.labels?.filter((l) => (l.label_type === "topic" || l.label_type === "custom") && l.confidence >= 0.5) ?? [];
      for (const l of topicLabels) topics.add(l.label);
      const profile = documentOrganizationProfile(doc);
      if (profile?.secondary_facets?.topic) {
        for (const t of profile.secondary_facets.topic) topics.add(t);
      }
    }
    return Array.from(topics).sort();
  }, [documents]);

  const allPopulations = useMemo(() => {
    const populations = new Set<string>();
    for (const doc of documents) {
      const popLabels = doc.labels?.filter((l) => l.label_type === "population" && l.confidence >= 0.5) ?? [];
      for (const l of popLabels) populations.add(l.label);
      const profile = documentOrganizationProfile(doc);
      if (profile?.secondary_facets?.population) {
        for (const p of profile.secondary_facets.population) populations.add(p);
      }
    }
    return Array.from(populations).sort();
  }, [documents]);

  const isAdminMode = mode === "admin" && canManageDocuments;
  const modeLabel =
    mode === "recent"
      ? "Recent documents"
      : mode === "source"
        ? "Source PDFs"
        : mode === "admin"
          ? statusFilterLabel(statusFilter)
          : "Source library";
  const modeSummary =
    mode === "recent"
      ? "Recently updated indexed sources."
      : mode === "source"
        ? "PDF source documents ready to open."
        : mode === "admin"
          ? "Document maintenance and indexing tools."
          : "Search and open indexed clinical sources.";
  const filterValue = filter.toLowerCase();

  const filtered = documents
    .filter((document) => {
      if (!documentStatusMatchesFilter(document, statusFilter)) return false;
      if (mode === "source") {
        const typeText = `${document.file_type} ${document.file_name}`.toLowerCase();
        if (!typeText.includes("pdf")) return false;
      }

      // Filter by Type
      if (selectedType !== "all") {
        const typeLabel = document.labels?.find((l) => l.label_type === "document_type" && l.confidence >= 0.5)?.label;
        const profile = documentOrganizationProfile(document);
        const hasTypeMatch = typeLabel === selectedType || profile?.document_type?.label === selectedType;
        if (!hasTypeMatch) return false;
      }

      // Filter by Site
      if (selectedSite !== "all") {
        const siteLabels = document.labels?.filter((l) => l.label_type === "site" && l.confidence >= 0.5) ?? [];
        const profile = documentOrganizationProfile(document);
        const hasSiteMatch = siteLabels.some((l) => l.label === selectedSite) || profile?.site?.label === selectedSite;
        if (!hasSiteMatch) return false;
      }

      // Filter by Topic
      if (selectedTopic !== "all") {
        const topicLabels =
          document.labels?.filter(
            (l) => (l.label_type === "topic" || l.label_type === "custom") && l.confidence >= 0.5,
          ) ?? [];
        const profile = documentOrganizationProfile(document);
        const hasTopicMatch =
          topicLabels.some((l) => l.label === selectedTopic) ||
          profile?.secondary_facets?.topic?.includes(selectedTopic);
        if (!hasTopicMatch) return false;
      }

      // Filter by Population
      if (selectedPopulation !== "all") {
        const popLabels = document.labels?.filter((l) => l.label_type === "population" && l.confidence >= 0.5) ?? [];
        const profile = documentOrganizationProfile(document);
        const hasPopMatch =
          popLabels.some((l) => l.label === selectedPopulation) ||
          profile?.secondary_facets?.population?.includes(selectedPopulation);
        if (!hasPopMatch) return false;
      }

      if (
        selectedDesignation !== "all" &&
        classifySourceAuthority(document.metadata).designation !== selectedDesignation
      ) {
        return false;
      }

      // Filter by Needs Review
      if (showNeedsReviewOnly) {
        const profile = documentOrganizationProfile(document);
        if (profile?.review_status !== "needs_review") return false;
      }

      const labelText = tagSearchText(document);
      const summaryText = document.summary?.summary ?? "";
      const sourceDesignation = classifySourceAuthority(document.metadata).designation;
      const haystack =
        `${document.title} ${document.file_name} ${labelText} ${summaryText} ${sourceDesignation}`.toLowerCase();
      return haystack.includes(filterValue);
    })
    .sort((left, right) => {
      if (mode !== "recent") return 0;
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

  return (
    <div className="space-y-3">
      <div className={cn(panelSubtle, "flex flex-wrap items-center justify-between gap-2 p-3")}>
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">{modeLabel}</p>
          <p className={cn("text-xs", textMuted)}>
            {modeSummary} {filtered.length} matching document{filtered.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>
      <label className="relative block">
        <Search aria-hidden="true" className={fieldIcon} />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={mode === "source" ? "Find a source PDF" : "Find a document"}
          aria-label={mode === "source" ? "Find a source PDF" : "Find a document"}
          className={fieldControlWithIcon}
        />
      </label>

      {/* Dynamic Browse Library Filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <label
            htmlFor="browse-filter-type"
            className="text-2xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]"
          >
            Type
          </label>
          <select
            id="browse-filter-type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
            aria-label="Filter by document type"
          >
            <option value="all">All Types</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="browse-filter-site"
            className="text-2xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]"
          >
            Site
          </label>
          <select
            id="browse-filter-site"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
            aria-label="Filter by site"
          >
            <option value="all">All Sites</option>
            {allSites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="browse-filter-topic"
            className="text-2xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]"
          >
            Topic
          </label>
          <select
            id="browse-filter-topic"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
            aria-label="Filter by topic"
          >
            <option value="all">All Topics</option>
            {allTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="browse-filter-population"
            className="text-2xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]"
          >
            Population
          </label>
          <select
            id="browse-filter-population"
            value={selectedPopulation}
            onChange={(e) => setSelectedPopulation(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
            aria-label="Filter by population"
          >
            <option value="all">All Populations</option>
            {allPopulations.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="browse-filter-designation"
            className="text-2xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]"
          >
            Provenance
          </label>
          <select
            id="browse-filter-designation"
            value={selectedDesignation}
            onChange={(e) => setSelectedDesignation(e.target.value as SourceDesignation | "all")}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
            aria-label="Filter by source provenance designation"
          >
            <option value="all">All provenance</option>
            <option value="official">Official</option>
            <option value="trusted">Trusted</option>
            <option value="unclassified">Unclassified</option>
          </select>
        </div>
      </div>

      {/* Admin Queue Toggle */}
      {isAdminMode ? (
        <div className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            id="needs-review-filter"
            checked={showNeedsReviewOnly}
            onChange={(e) => setShowNeedsReviewOnly(e.target.checked)}
            className="rounded border-[color:var(--border)] text-[color:var(--primary)] focus:ring-[color:var(--primary)] h-4 w-4"
          />
          <label
            htmlFor="needs-review-filter"
            className="text-xs font-semibold text-[color:var(--text-soft)] cursor-pointer select-none"
          >
            Show &quot;Needs review&quot; queue only
          </label>
        </div>
      ) : null}
      {pagination && pagination.total > documents.length ? (
        <p className={cn("text-xs", textMuted)}>
          Showing {documents.length} of {pagination.total} documents. Load more to manage older files.
        </p>
      ) : null}
      {isAdminMode ? (
        <DocumentLabelReviewPanel documents={documents} canManage={canManageDocuments} onMutateLabel={onMutateLabel} />
      ) : null}
      {isAdminMode ? <DocumentTagQualityPanel documents={documents} /> : null}
      {isAdminMode ? <DocumentIndexRepairPanel documents={documents} /> : null}
      {isAdminMode && selectedDocumentIds.length ? (
        <div className={cn(panelSubtle, "space-y-3 p-3")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text)]">
                {selectedDocumentIds.length} selected document{selectedDocumentIds.length === 1 ? "" : "s"}
              </p>
              <p className={cn("text-xs", textMuted)}>Bulk actions apply only to explicitly selected documents.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canManageDocuments || bulkActionBusy}
                onClick={() => onBulkReindex("enrichment")}
                className={cn(floatingControl, "px-3 text-xs")}
              >
                {bulkActionBusy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                )}
                Regenerate summaries
              </button>
              <button
                type="button"
                disabled={!canManageDocuments || bulkActionBusy}
                onClick={() => onBulkReindex("full")}
                className={cn(floatingControl, "px-3 text-xs")}
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Full reindex
              </button>
              <button
                type="button"
                disabled={!canManageDocuments || bulkActionBusy}
                onClick={() => onBulkReindex("retry_failed")}
                className={cn(floatingControl, "px-3 text-xs")}
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry failed
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={collectionDraft}
              onChange={(event) => setCollectionDraft(event.target.value)}
              placeholder="Collection name for selected documents"
              aria-label="Collection name for selected documents"
              className={fieldControlPlain}
            />
            <button
              type="button"
              disabled={!canManageDocuments || bulkActionBusy || !collectionDraft.trim()}
              onClick={() => onBulkAssignCollection(collectionDraft)}
              className={cn(primaryControl, "justify-center")}
            >
              Assign collection
            </button>
          </div>
          <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
              Bulk metadata editor
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={metadataDraft.sourceStatus}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, sourceStatus: event.target.value }))}
                aria-label="Bulk edit source status"
                className={fieldControlPlain}
              >
                <option value="">Source status unchanged</option>
                <option value="current">Current</option>
                <option value="review_due">Review due</option>
                <option value="outdated">Outdated</option>
                <option value="unknown">Unknown</option>
              </select>
              <select
                value={metadataDraft.validationStatus}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, validationStatus: event.target.value }))
                }
                aria-label="Bulk edit validation status"
                className={fieldControlPlain}
              >
                <option value="">Validation unchanged</option>
                <option value="unverified">Unverified</option>
                <option value="locally_reviewed">Locally reviewed</option>
                <option value="approved">Approved</option>
              </select>
              <select
                value={metadataDraft.extractionQuality}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, extractionQuality: event.target.value }))
                }
                aria-label="Bulk edit extraction quality"
                className={fieldControlPlain}
              >
                <option value="">Extraction unchanged</option>
                <option value="good">Good</option>
                <option value="partial">Partial</option>
                <option value="poor">Poor</option>
                <option value="unknown">Unknown</option>
              </select>
              <input
                type="date"
                value={metadataDraft.reviewDate}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, reviewDate: event.target.value }))}
                className={fieldControlPlain}
                aria-label="Bulk review date"
              />
              <input
                type="date"
                value={metadataDraft.publicationDate}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, publicationDate: event.target.value }))
                }
                className={fieldControlPlain}
                aria-label="Bulk publication date"
              />
              <input
                value={metadataDraft.jurisdiction}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, jurisdiction: event.target.value }))}
                placeholder="Jurisdiction/locality"
                aria-label="Bulk edit jurisdiction/locality"
                className={fieldControlPlain}
              />
              <input
                value={metadataDraft.sourceType}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, sourceType: event.target.value }))}
                placeholder="Source type"
                aria-label="Bulk edit source type"
                className={fieldControlPlain}
              />
              <input
                value={metadataDraft.category}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Category"
                aria-label="Bulk edit category"
                className={fieldControlPlain}
              />
            </div>
            <button
              type="button"
              disabled={!canManageDocuments || bulkActionBusy}
              onClick={() => {
                const metadata = Object.fromEntries(
                  Object.entries(metadataDraft).filter(([, value]) => String(value).trim()),
                );
                onBulkMetadataUpdate(metadata);
              }}
              className={cn(primaryControl, "mt-3 justify-center")}
            >
              Apply metadata to selected
            </button>
          </details>
          {bulkActionStatus ? <p className={cn("text-xs font-semibold", textMuted)}>{bulkActionStatus}</p> : null}
        </div>
      ) : null}
      <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={documents.length === 0 ? emptyStates.documentsNoneIndexed.title : emptyStates.documentsNoMatch.title}
            body={
              documents.length === 0
                ? "Upload a guideline to start indexing."
                : "Try another document title or file name."
            }
          />
        ) : (
          filtered.slice(0, 12).map((document) => {
            const selected = selectedDocumentIds.includes(document.id);
            return (
              <div key={document.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <Link
                    href={`/documents/${document.id}`}
                    className="flex min-h-tap min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                  >
                    <span className="truncate">{documentDisplayTitle(document)}</span>
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
                  </Link>
                  <DocumentOrganizationBadges document={document} compact className="mt-1" />
                  <p className={cn("mt-1 truncate text-xs", textMuted)}>
                    {document.page_count} pages · {document.chunk_count} chunks · {document.image_count} images
                  </p>
                  {document.summary?.summary && (
                    <p className={cn("mt-2 line-clamp-2 text-sm-minus leading-5", textMuted)}>
                      <SafeBoldText text={document.summary.summary} />
                    </p>
                  )}
                  <DocumentTagCloud
                    labels={document.labels}
                    query={filter}
                    limit={5}
                    compact
                    className="mt-2"
                    onTagClick={onTagSearch}
                  />
                  <SourceProvenance metadata={document.metadata} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={document.status} />
                  <SourceDesignationBadge metadata={document.metadata} />
                  <SourceStatusBadge metadata={document.metadata} />
                  {isAdminMode ? (
                    <DocumentManagementActions
                      document={document}
                      disabled={!canManageDocuments}
                      onRenamed={onDocumentRenamed}
                      onDeleted={onDocumentDeleted}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onToggleScope(document.id)}
                    className={cn(
                      "inline-flex min-h-tap items-center rounded-lg border px-3 text-xs font-semibold transition",
                      selected
                        ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {selected ? "In scope" : "Add scope"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {pagination?.hasMore ? (
        <button
          type="button"
          onClick={onLoadMoreDocuments}
          disabled={loadingMoreDocuments}
          className={cn(floatingControl, "w-full justify-center")}
        >
          {loadingMoreDocuments ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          )}
          Load more documents
        </button>
      ) : null}
    </div>
  );
}

export type LibraryHealthTarget = "documents" | "setup" | "indexing" | "failures";
export type IndexingMonitorFilter = "all" | "active" | "failed";
export type UploadIndexingTab = "setup" | "upload" | "jobs" | "quality";

function documentStatusMatchesFilter(document: ClinicalDocument, filter: DocumentDrawerStatusFilter) {
  if (filter === "all") return true;
  if (filter === "indexed") return document.status === "indexed";
  if (filter === "indexing") return document.status === "queued" || document.status === "processing";
  return document.status === "failed";
}

function statusFilterLabel(filter: DocumentDrawerStatusFilter) {
  if (filter === "indexed") return "Indexed documents";
  if (filter === "indexing") return "Indexing documents";
  if (filter === "failed") return "Failed documents";
  return "All documents";
}
