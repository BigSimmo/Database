import { AlertTriangle, Building2, FileText, Tag } from "lucide-react";

import { cn, metadataPill, toneInfo, toneNeutral, toneWarning } from "@/components/ui-primitives";
import { canonicalDocumentDisplayTitle } from "@/lib/document-organization";
import type { DocumentLabel, DocumentOrganizationProfile } from "@/lib/types";

type OrganizationDocument = {
  title: string;
  file_name: string;
  metadata?: unknown;
  labels?: Array<Pick<DocumentLabel, "label" | "label_type" | "source" | "confidence">> | null;
};

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function documentOrganizationProfile(document: Pick<OrganizationDocument, "metadata">) {
  const profile = metadataRecord(document.metadata).organization_profile;
  return profile && typeof profile === "object" && !Array.isArray(profile)
    ? (profile as Partial<DocumentOrganizationProfile>)
    : null;
}

export function documentDisplayTitle(document: Pick<OrganizationDocument, "title" | "file_name" | "metadata">) {
  const profile = documentOrganizationProfile(document);
  return typeof profile?.canonical_display_title === "string" && profile.canonical_display_title.trim()
    ? profile.canonical_display_title
    : canonicalDocumentDisplayTitle(document);
}

function displayLabel(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word.length <= 4 && word === word.toUpperCase() ? word : `${word[0]?.toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");
}

function labelFromLabels(
  labels: OrganizationDocument["labels"],
  type: DocumentLabel["label_type"],
): Pick<DocumentLabel, "label" | "confidence"> | null {
  const match = labels?.find((label) => label.label_type === type && label.confidence >= 0.5);
  return match ? { label: match.label, confidence: match.confidence } : null;
}

export function DocumentOrganizationBadges({
  document,
  compact = false,
  className,
}: {
  document: OrganizationDocument;
  compact?: boolean;
  className?: string;
}) {
  const profile = documentOrganizationProfile(document);
  const siteLabel =
    typeof profile?.site?.label === "string" && profile.site.label.trim()
      ? profile.site.label
      : labelFromLabels(document.labels, "site")?.label;
  const typeLabel =
    typeof profile?.document_type?.label === "string" && profile.document_type.label !== "unknown"
      ? profile.document_type.label
      : labelFromLabels(document.labels, "document_type")?.label;
  const needsReview = profile?.review_status === "needs_review";
  const manualOverride = profile?.review_status === "manual_override";
  const candidateCount = profile?.site?.candidates?.length ?? 0;
  const sizeClass = compact ? "min-h-6 px-2 text-[10px]" : "min-h-7 px-2 text-[11px]";

  if (!siteLabel && !typeLabel && !needsReview && !manualOverride) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {siteLabel ? (
        <span className={cn(metadataPill, toneInfo, sizeClass)} title="Hospital or service site">
          <Building2 className="mr-1 h-3.5 w-3.5" />
          {displayLabel(siteLabel)}
        </span>
      ) : needsReview && candidateCount > 0 ? (
        <span className={cn(metadataPill, toneWarning, sizeClass)} title="Site candidate needs review">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
          Ambiguous site
        </span>
      ) : null}
      {typeLabel ? (
        <span className={cn(metadataPill, toneNeutral, sizeClass)} title="Document type">
          <FileText className="mr-1 h-3.5 w-3.5" />
          {displayLabel(typeLabel)}
        </span>
      ) : null}
      {needsReview ? (
        <span className={cn(metadataPill, toneWarning, sizeClass)} title="Organisation profile needs review">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
          Needs review
        </span>
      ) : null}
      {manualOverride ? (
        <span className={cn(metadataPill, toneInfo, sizeClass)} title="Organisation profile was manually curated">
          <Tag className="mr-1 h-3.5 w-3.5" />
          Manual override
        </span>
      ) : null}
    </div>
  );
}
