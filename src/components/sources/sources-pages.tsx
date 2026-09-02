import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  InformationPageBreadcrumbs,
  InformationPageHeader,
  InformationPageShell,
} from "@/components/information-page-shell";
import { SourcesCatalogueClient } from "@/components/sources/sources-catalogue-client";
import {
  SOURCE_RATING_WEIGHTS,
  type ClinicalSourceCatalogueEntry,
  type SourceGeographyScope,
} from "@/lib/sources/catalogue-types";
import { deriveSourceCatalogueFacets } from "@/lib/sources/catalogue-view";
import { loadSourceCatalogue } from "@/lib/sources/load-source-catalogue";

const bandLabels = {
  A: "A · Preferred",
  B: "B · Strong",
  C: "C · Supplementary",
  D: "D · Review required",
  excluded: "Excluded",
} as const;

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function valueOrUnknown(value: string | null) {
  return value?.trim() || "Unknown";
}

function dateOrUnknown(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function PageIntroduction({ title, description }: { title: string; description: string }) {
  return (
    <>
      <InformationPageBreadcrumbs
        home={{ label: "Sources", href: "/sources" }}
        current={title === "Sources" ? undefined : title}
      />
      <InformationPageHeader title={title} subtitle={description} />
    </>
  );
}

export async function SourcesCataloguePage(): Promise<ReactNode> {
  const catalogue = await loadSourceCatalogue();
  return (
    <InformationPageShell testId="sources-catalogue-main">
      <SourcesCatalogueClient entries={catalogue.entries} hostedDocuments={catalogue.hostedDocuments} />
    </InformationPageShell>
  );
}

export async function SourcesTopicsPage(): Promise<ReactNode> {
  const { entries, hostedDocuments } = await loadSourceCatalogue();
  const topics = deriveSourceCatalogueFacets(entries).topics;
  return (
    <InformationPageShell testId="sources-topics-main">
      <PageIntroduction title="Topics" description="Browse clinical topics derived from registered source metadata." />
      {hostedDocuments === "unavailable" ? (
        <p
          role="note"
          className="rounded-xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]"
        >
          Hosted document topics are temporarily unavailable; repository topic counts remain visible.
        </p>
      ) : null}
      {topics.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <li
              key={topic.value}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
            >
              <Link
                className="flex min-h-12 items-center justify-between gap-4 font-semibold text-[color:var(--primary)]"
                href={`/sources?topic=${encodeURIComponent(topic.value)}`}
              >
                <span>{titleCase(topic.value)}</span>
                <span className="text-sm text-[color:var(--text-muted)]">{topic.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-[color:var(--border)] p-6 text-sm">
          No structured source topics are available.
        </p>
      )}
    </InformationPageShell>
  );
}

export async function SourcesPublishersPage(): Promise<ReactNode> {
  const { entries, hostedDocuments } = await loadSourceCatalogue();
  const publisherScopes: readonly { scope: SourceGeographyScope; label: string }[] = [
    { scope: "wa", label: "Western Australia" },
    { scope: "australian_national", label: "Australian national" },
    { scope: "australian_state", label: "Another Australian state" },
    { scope: "international", label: "International" },
    { scope: "unknown", label: "Unknown jurisdiction" },
  ];
  const publisherGroups = publisherScopes
    .map((group) => ({
      ...group,
      publishers: deriveSourceCatalogueFacets(
        entries.filter((entry) => entry.publisher && entry.geography.scope === group.scope),
      ).publishers,
    }))
    .filter((group) => group.publishers.length > 0);
  return (
    <InformationPageShell testId="sources-publishers-main">
      <PageIntroduction
        title="Publishers"
        description="Review publisher coverage and the jurisdictions represented in the catalogue."
      />
      {hostedDocuments === "unavailable" ? (
        <p
          role="note"
          className="rounded-xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]"
        >
          Hosted document publishers are temporarily unavailable; repository publisher counts remain visible.
        </p>
      ) : null}
      {publisherGroups.length ? (
        <div className="grid gap-6">
          {publisherGroups.map((group) => (
            <section key={group.scope} className="grid gap-3" aria-labelledby={`publisher-scope-${group.scope}`}>
              <h2 id={`publisher-scope-${group.scope}`} className="text-xl font-semibold">
                {group.label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.publishers.map((publisher) => {
                  const publisherEntries = entries.filter(
                    (entry) => entry.publisher === publisher.value && entry.geography.scope === group.scope,
                  );
                  const jurisdictions = [...new Set(publisherEntries.map((entry) => entry.geography.label))];
                  return (
                    <article
                      key={publisher.value}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
                    >
                      <h3 className="text-lg font-semibold">{publisher.value}</h3>
                      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                        {publisher.count} {publisher.count === 1 ? "source" : "sources"} ·{" "}
                        {jurisdictions.join(", ") || "Jurisdiction unknown"}
                      </p>
                      <Link
                        className="mt-3 inline-flex min-h-12 items-center font-semibold text-[color:var(--primary)] underline-offset-4 hover:underline"
                        href={`/sources?publisher=${encodeURIComponent(publisher.value)}&jurisdiction=${group.scope}`}
                      >
                        View {publisher.value} sources
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[color:var(--border)] p-6 text-sm">
          No structured publishers are available.
        </p>
      )}
    </InformationPageShell>
  );
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
      <PageIntroduction title="Method" description="How the catalogue organises source review and traceability." />
      <section className="grid gap-3" aria-labelledby="method-weights">
        <h2 id="method-weights" className="text-xl font-semibold">
          Rating dimensions
        </h2>
        <dl className="grid gap-3">
          {weights.map(([label, points, description]) => (
            <div key={label} className="rounded-xl border border-[color:var(--border)] p-4">
              <dt className="font-semibold">{label}</dt>
              <dd className="mt-1 text-sm text-[color:var(--text-muted)]">
                <span className="font-medium text-[color:var(--text)]">{points} points</span> · {description}
              </dd>
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
              <dl className="grid gap-3">
                {definitions.map(([label, definition]) => (
                  <div key={label} className="rounded-xl border border-[color:var(--border)] p-4">
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

  const identityRows = [
    ["Publisher", valueOrUnknown(entry.publisher)],
    ["Publisher code", valueOrUnknown(entry.publisherCode)],
    ["Version", valueOrUnknown(entry.version)],
    ["Source type", titleCase(entry.sourceType)],
    ["Validation", titleCase(entry.validationStatus)],
    ["Currentness", titleCase(entry.documentStatus)],
    ["Lifecycle", titleCase(entry.lifecycleStatus)],
    ["Content mode", titleCase(entry.contentMode)],
    ["Published", dateOrUnknown(entry.publicationDate)],
    ["Review date", dateOrUnknown(entry.reviewDate)],
    ["Expiry date", dateOrUnknown(entry.expiryDate)],
  ] as const;

  return (
    <InformationPageShell testId="source-detail-main">
      <InformationPageBreadcrumbs home={{ label: "Sources", href: "/sources" }} current={entry.title} />
      <InformationPageHeader
        eyebrow={bandLabels[entry.rating.band]}
        title={entry.title}
        subtitle={`Organisational score ${entry.rating.score}/100. This rating supports catalogue review; it is not a clinical endorsement.`}
      />

      <section className="grid gap-3" aria-labelledby="source-locations-heading">
        <h2 id="source-locations-heading" className="text-xl font-semibold">
          Source locations
        </h2>
        <dl className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <dt className="font-semibold">Canonical location</dt>
            <dd className="mt-2 break-words text-sm">
              <CanonicalLocation entry={entry} />
            </dd>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <dt className="font-semibold">Geographic location</dt>
            <dd className="mt-2 text-sm">{entry.geography.label}</dd>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <dt className="font-semibold">Application location</dt>
            <dd className="mt-2 text-sm">
              {entry.usedBy.length} registered {entry.usedBy.length === 1 ? "usage" : "usages"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3" aria-labelledby="source-identity-heading">
        <h2 id="source-identity-heading" className="text-xl font-semibold">
          Identity and status
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {identityRows.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-[color:var(--surface)] p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">{label}</dt>
              <dd className="mt-1 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">
          <strong>Topics:</strong> {entry.topics.length ? entry.topics.map(titleCase).join(", ") : "Unknown"}
        </p>
        <p className="text-sm">
          <strong>Aliases:</strong> {entry.aliases.length ? entry.aliases.join(", ") : "None registered"}
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="source-rating-heading">
        <h2 id="source-rating-heading" className="text-xl font-semibold">
          Rating breakdown
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {entry.rating.reasons.map((reason) => (
            <li key={reason} className="rounded-xl border border-[color:var(--border)] p-3 text-sm">
              {reason}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" aria-labelledby="source-versions-heading">
        <h2 id="source-versions-heading" className="text-xl font-semibold">
          Versions and warnings
        </h2>
        <p className="text-sm">
          <strong>Supersedes:</strong> {entry.supersedes.join(", ") || "None registered"}
        </p>
        <p className="text-sm">
          <strong>Superseded by:</strong> {entry.supersededBy.join(", ") || "None registered"}
        </p>
        <p className="text-sm">
          <strong>Warnings:</strong>{" "}
          {entry.warnings.length ? entry.warnings.map(titleCase).join(", ") : "No catalogue warnings"}
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="source-usages-heading">
        <h2 id="source-usages-heading" className="text-xl font-semibold">
          Application usages
        </h2>
        <ul className="grid gap-2">
          {entry.usedBy.map((usage) => (
            <li
              key={`${usage.modeId}:${usage.recordId}:${usage.field}`}
              className="rounded-xl border border-[color:var(--border)] p-3 text-sm"
            >
              <strong>{usage.recordLabel}</strong> · {titleCase(usage.modeId)} · {titleCase(usage.field)}
            </li>
          ))}
        </ul>
      </section>
    </InformationPageShell>
  );
}
