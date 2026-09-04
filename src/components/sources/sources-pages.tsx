import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { InformationPageShell } from "@/components/information-page-shell";
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

const bandLabels: Record<SourceQualityBand, string> = {
  A: "A · Preferred",
  B: "B · Strong",
  C: "C · Supplementary",
  D: "D · Review required",
  excluded: "Excluded",
};

const bandTone = {
  A: "success",
  B: "info",
  C: "neutral",
  D: "warning",
  excluded: "danger",
} as const satisfies Record<SourceQualityBand, "success" | "info" | "neutral" | "warning" | "danger">;

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
  const weights = [
    ["Accuracy assurance", SOURCE_RATING_WEIGHTS.accuracyAssurance, "Version review, validation or an explicit check"],
    ["Reliability", SOURCE_RATING_WEIGHTS.reliability, "Publisher authority, provenance and independence"],
    ["Evidence quality", SOURCE_RATING_WEIGHTS.evidenceQuality, "The declared evidence or reference type"],
    ["Currency", SOURCE_RATING_WEIGHTS.currency, "Publication, review, expiry and supersession state"],
    [
      "Australian applicability",
      SOURCE_RATING_WEIGHTS.australianApplicability,
      "WA, national, state or international applicability",
    ],
    ["Traceability", SOURCE_RATING_WEIGHTS.traceability, "Identity, version, dates, location and registered usage"],
  ] as const;
  const statusDefinitions = [
    [
      "Currentness",
      [
        ["Current", "The structured status says the source is within its current review period."],
        ["Review due", "An explicit upstream status says the source is due for structured review."],
        ["Outdated", "The source is past its structured expiry date or is explicitly marked outdated."],
        ["Unknown currentness", "A malformed expiry does not establish currentness, so currentness remains unknown."],
      ],
    ],
    [
      "Validation",
      [
        ["Approved", "The source carries an explicit approved clinical validation status."],
        ["Locally reviewed", "The source has a recorded local review but is not marked approved."],
        ["Unverified", "The source is explicitly marked as not yet verified."],
        ["Unknown validation", "No structured clinical validation status was supplied."],
      ],
    ],
    [
      "Lifecycle",
      [
        ["Active", "The source remains available for current catalogue use."],
        ["Inactive", "The source is retained for traceability but is not currently active."],
        ["Excluded", "A lifecycle or governance rule removes the source from normal catalogue use."],
      ],
    ],
    [
      "Content mode",
      [
        ["Indexed content", "The source content can be searched inside the application."],
        ["Link only", "The catalogue stores a governed outbound location, not searchable source content."],
        ["Metadata only", "Only structured identity and review metadata are available to the catalogue."],
      ],
    ],
  ] as const;
  return (
    <InformationPageShell testId="sources-method-main" width="narrow">
      <PageName>Method</PageName>
      <section className="grid gap-3" aria-labelledby="method-weights">
        <h2 id="method-weights" className="text-xl font-semibold">
          Rating dimensions
        </h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {weights.map(([label, points, description]) => (
            <div key={label} className="rounded-xl border border-[color:var(--border)] p-3">
              <dt className="font-semibold">
                {label} <span className="text-sm font-medium text-[color:var(--text-muted)]">{points} points</span>
              </dt>
              <dd className="mt-1 text-sm text-[color:var(--text-muted)]">{description}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="grid gap-3" aria-labelledby="method-bands">
        <h2 id="method-bands" className="text-xl font-semibold">
          Quality bands
        </h2>
        <ul className="grid gap-2 text-sm leading-6">
          <li>A · Preferred · 85–100</li>
          <li>B · Strong · 70–84</li>
          <li>C · Supplementary · 50–69</li>
          <li>D · Review required · below 50, incomplete metadata, or material identity or verification uncertainty</li>
          <li>
            Excluded · applied before any score when lifecycle or governance rules reject the source, including an
            identified replacement
          </li>
        </ul>
        {/* A reader who has just learned what "D · Review required" means is
            usually asking which sources are in it. The definitions stay prose;
            the route to the sources is a separate row rather than a link
            wrapped around a definition. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-[color:var(--text-muted)]">Browse a band:</span>
          {(["A", "B", "C", "D", "excluded"] as const).map((band) => (
            <Link
              key={band}
              href={`/sources/search?band=${band}`}
              className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-semibold text-[color:var(--primary)] hover:border-[color:var(--border-strong)] sm:min-h-compact-meta"
            >
              {bandLabels[band]}
            </Link>
          ))}
        </div>
      </section>
      <section className="grid gap-3 text-sm leading-6" aria-labelledby="method-limits">
        <h2 id="method-limits" className="text-xl font-semibold">
          Boundaries and missing data
        </h2>
        <p>
          Australian applicability is bounded within 15 points. Weak Australian material cannot bypass identity,
          validation, lifecycle or evidence-quality controls.
        </p>
        <p>
          Missing fields remain unknown. The catalogue does not infer publisher, jurisdiction, evidence type, version,
          approval or currentness from titles or prose.
        </p>
        <p>
          Missing publisher, version, dates, jurisdiction, evidence type or validation forces D · Review required. A
          past expiry receives no current currency credit; a source with an identified replacement is excluded.
        </p>
        <p>
          This organisational rating is not RAG relevance or patient-specific guidance, specialist sign-off, clinical
          endorsement, or a measurement of factual truth.
        </p>
      </section>
      <section className="grid gap-4" aria-labelledby="method-status-definitions">
        <h2 id="method-status-definitions" className="text-xl font-semibold">
          Catalogue status definitions
        </h2>
        <div className="grid gap-5">
          {statusDefinitions.map(([group, definitions]) => (
            <div key={group} className="grid gap-2">
              <h3 className="font-semibold">{group}</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {definitions.map(([label, definition]) => (
                  <div key={label} className="rounded-xl border border-[color:var(--border)] p-3">
                    <dt className="font-semibold">{label}</dt>
                    <dd className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
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
          <Chip appearance={{ kind: "status", tone: bandTone[entry.rating.band] }} dot>
            {bandLabels[entry.rating.band]}
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
