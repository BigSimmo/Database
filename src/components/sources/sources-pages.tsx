import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { InformationPageShell } from "@/components/information-page-shell";
import { SourceMethodReferenceContent } from "@/components/reference/source-method-reference-content";
import { SourcesBrowseClient } from "@/components/sources/sources-browse-client";
import { SourcesCatalogueClient } from "@/components/sources/sources-catalogue-client";
import { Chip } from "@/components/ui/chip";
import {
  derivePublisherBrowseSummaries,
  deriveTopicBrowseSummaries,
  sourceTopicLabel,
} from "@/lib/sources/browse-facets";
import {
  SOURCE_RATING_WEIGHTS,
  type ClinicalSourceCatalogueEntry,
  type SourceGeographyScope,
  type SourceQualityBand,
} from "@/lib/sources/catalogue-types";
import { loadSourceCatalogue } from "@/lib/sources/load-source-catalogue";
import { SOURCE_BAND_LABELS, SOURCE_BAND_TONES } from "@/lib/sources/rating-method";
import { sourceAttentionFlags, sourceProvenanceNotes } from "@/lib/sources/source-status-presentation";
import { groupSourceUsagesByMode } from "@/lib/sources/source-usage-presentation";

/** WA first: local applicability is the question this catalogue exists to answer. */
const PUBLISHER_SCOPES: readonly SourceGeographyScope[] = [
  "wa",
  "australian_national",
  "australian_state",
  "international",
  "unknown",
];

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateOrNull(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/**
 * The page's accessible name without a title block above the content.
 *
 * These pages are reached through the Sources mode navigation, which already
 * says which one you are on, so a repeated visual heading is chrome the reader
 * scrolls past. The heading still has to exist for assistive technology and for
 * the document outline, so it exists and is not painted.
 */
function PageName({ children }: { children: string }) {
  return <h1 className="sr-only">{children}</h1>;
}

export async function SourcesCataloguePage(): Promise<ReactNode> {
  const catalogue = await loadSourceCatalogue();
  // `hostedDocuments` travels with the entries: when the document lookup is
  // unavailable the catalogue is repository-only, and the page has to be able
  // to say so rather than presenting a partial list as the whole registry.
  return <SourcesCatalogueClient entries={catalogue.entries} hostedDocuments={catalogue.hostedDocuments} />;
}

export async function SourcesTopicsPage(): Promise<ReactNode> {
  const { entries, hostedDocuments } = await loadSourceCatalogue();
  return (
    <SourcesBrowseClient
      kind="topic"
      summaries={deriveTopicBrowseSummaries(entries)}
      hostedDocuments={hostedDocuments}
    />
  );
}

export async function SourcesPublishersPage(): Promise<ReactNode> {
  const { entries, hostedDocuments } = await loadSourceCatalogue();
  // Derived per jurisdiction, not globally: a publisher can appear under two
  // scopes, and the catalogue link carries the scope, so a merged row would
  // promise a count the filtered result cannot deliver.
  const summaries = PUBLISHER_SCOPES.flatMap((scope) => derivePublisherBrowseSummaries(entries, scope));
  return <SourcesBrowseClient kind="publisher" summaries={summaries} hostedDocuments={hostedDocuments} />;
}

export function SourcesMethodPage(): ReactNode {
  return (
    <InformationPageShell testId="sources-method-main" width="narrow">
      <PageName>Method</PageName>
      <SourceMethodReferenceContent variant="page" />
    </InformationPageShell>
  );
}

function CanonicalLocation({ entry }: { entry: ClinicalSourceCatalogueEntry }) {
  const location = entry.canonicalLocation;
  if (location.kind === "url") {
    return (
      <a
        href={location.href}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-[color:var(--primary)] underline"
      >
        Open canonical source
      </a>
    );
  }
  if (location.kind === "document") {
    return (
      <Link href={location.href} className="font-semibold text-[color:var(--primary)] underline">
        Open accessible document
      </Link>
    );
  }
  if (location.kind === "dataset") return <span>{location.label}</span>;
  return <span>Not provided</span>;
}

export async function SourceDetailPage({ sourceId }: { sourceId: string }): Promise<ReactNode> {
  const { entries } = await loadSourceCatalogue();
  const entry = entries.find((candidate) => candidate.id === sourceId);
  if (!entry) notFound();

  const usageGroups = groupSourceUsagesByMode(entry.usedBy);
  const recordTotal = usageGroups.reduce((total, group) => total + group.recordCount, 0);
  const flags = sourceAttentionFlags(entry);
  const provenanceNotes = sourceProvenanceNotes(entry);

  // Only the fields that carry a value. A grid of "Unknown" tiles reads as data
  // when it is the absence of data, and it pushes the usages below the fold.
  const identityRows: [string, string][] = (
    [
      ["Publisher", entry.publisher],
      ["Version", entry.version],
      ["Jurisdiction", entry.geography.label],
      ["Source type", titleCase(entry.sourceType)],
      ["Published", dateOrNull(entry.publicationDate)],
      ["Reviewed", dateOrNull(entry.reviewDate)],
      ["Expires", dateOrNull(entry.expiryDate)],
    ] as [string, string | null][]
  ).filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <>
      <InPageNavHeader
        back={{ href: "/sources/search", label: "Sources" }}
        title={entry.title}
        titleAs="h1"
        testIdPrefix="source"
      />
      <InformationPageShell testId="source-detail-main">
        <div className="flex flex-wrap items-center gap-2">
          <Chip appearance={{ kind: "status", tone: SOURCE_BAND_TONES[entry.rating.band] }} dot>
            {SOURCE_BAND_LABELS[entry.rating.band]}
          </Chip>
          <span className="text-sm font-semibold text-[color:var(--text-muted)]">
            Review score {entry.rating.score}/100
          </span>
          {flags.map((flag) => (
            <Chip key={flag.label} appearance={{ kind: "status", tone: flag.tone }}>
              {flag.label}
            </Chip>
          ))}
        </div>

        {/* A band letter says a source is questionable; it does not say why. When
            identity, location, completeness or clinical validation is the reason,
            the reason is what a clinician needs before relying on the source. */}
        {provenanceNotes.length ? (
          <section
            aria-labelledby="source-review-heading"
            className="grid gap-1.5 rounded-2xl border border-[color:var(--warning-border,var(--border))] bg-[color:var(--surface-subtle)] p-4"
          >
            <h2 id="source-review-heading" className="text-sm font-extrabold text-[color:var(--text-heading)]">
              Needs review before you rely on this
            </h2>
            <ul className="grid gap-1 text-sm text-[color:var(--text-muted)]">
              {provenanceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-3" aria-labelledby="source-usage-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="source-usage-heading" className="text-xl font-semibold">
              Where this source is used
            </h2>
            {recordTotal ? (
              <span className="text-sm text-[color:var(--text-muted)]">
                {recordTotal} {recordTotal === 1 ? "record" : "records"} across {usageGroups.length}{" "}
                {usageGroups.length === 1 ? "area" : "areas"}
              </span>
            ) : null}
          </div>
          {usageGroups.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {usageGroups.map((group) => (
                <section
                  key={group.modeId}
                  aria-labelledby={`source-usage-${group.modeId}`}
                  className="grid content-start gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                >
                  <h3
                    id={`source-usage-${group.modeId}`}
                    className="text-sm font-extrabold text-[color:var(--text-heading)]"
                  >
                    {group.modeLabel}{" "}
                    <span className="font-semibold text-[color:var(--text-muted)]">
                      · {group.recordCount} {group.recordCount === 1 ? "record" : "records"}
                    </span>
                  </h3>
                  <ul className="grid gap-1">
                    {group.usages.map((usage) => (
                      <li key={usage.key}>
                        <Link
                          href={usage.href}
                          className="grid min-h-12 content-center gap-0.5 rounded-lg px-2 py-1.5 transition hover:bg-[color:var(--surface-subtle)] motion-reduce:transition-none"
                        >
                          <span className="text-sm font-semibold text-[color:var(--primary)]">{usage.recordLabel}</span>
                          <span className="text-2xs font-medium text-[color:var(--text-muted)]">{usage.purpose}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]">
              No record in PsychSift currently cites this source.
            </p>
          )}
        </section>

        <section className="grid gap-3" aria-labelledby="source-record-heading">
          <h2 id="source-record-heading" className="text-xl font-semibold">
            Source record
          </h2>
          <p className="text-sm">
            <CanonicalLocation entry={entry} />
          </p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {identityRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 border-b border-[color:var(--border)] py-1.5"
              >
                <dt className="text-sm text-[color:var(--text-muted)]">{label}</dt>
                <dd className="text-sm font-medium">
                  {label === "Publisher" ? (
                    <Link
                      href={`/sources/search?publisher=${encodeURIComponent(value)}&jurisdiction=${entry.geography.scope}`}
                      className="text-[color:var(--primary)] underline"
                    >
                      {value}
                    </Link>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {entry.supersededBy.length ? (
            <p className="text-sm">
              <strong>Superseded by:</strong> {entry.supersededBy.join(", ")}
            </p>
          ) : null}
          {entry.supersedes.length ? (
            <p className="text-sm">
              <strong>Supersedes:</strong> {entry.supersedes.join(", ")}
            </p>
          ) : null}
          {/* Topics were a muted comma list, which made the record a dead end:
              the one question a reader has after reading a source is what else
              covers the same ground, and the catalogue can already answer it. */}
          {entry.topics.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-[color:var(--text-muted)]">Topics:</span>
              {entry.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/sources/search?topic=${encodeURIComponent(topic)}`}
                  className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-2xs font-semibold text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)] sm:min-h-compact-meta"
                >
                  {sourceTopicLabel(topic)}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </InformationPageShell>
    </>
  );
}
