import type { Metadata } from "next";

import {
  CountTile,
  META_CLASS,
  MONO_CLASS,
  PanelSection,
  ROW_CLASS,
} from "@/components/developer-area/hub/panel-primitives";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import {
  documentsBySection,
  loadRepoAwarenessSnapshot,
  resolveRepoFreshness,
} from "@/lib/developer-area/repo-awareness-snapshot";

export const metadata: Metadata = {
  title: "Documentation · Developer · PsychSift",
  description: "Every committed document, its area of the repository, and whether the docs index lists it.",
};

function DocumentRow({ path, catalogued }: { path: string; catalogued: boolean }) {
  return (
    <li data-testid={`developer-documentation-document-${path}`} className={ROW_CLASS}>
      <span className={MONO_CLASS}>{path}</span>
      {/* Stated on every row in words. A badge shown only on one of the two
       *  states reads as "no data" on the other. */}
      <span className={META_CLASS}>{catalogued ? "· in the index" : "· not in the index"}</span>
    </li>
  );
}

export default function DeveloperDocumentationPage() {
  const snapshot = loadRepoAwarenessSnapshot();
  const freshness = resolveRepoFreshness(snapshot, new Date());
  const { counts } = snapshot.documentation;
  const uncatalogued = snapshot.documentation.documents.filter((document) => !document.catalogued);
  // `documentsBySection` pre-seeds one bucket per section
  // `documentation.sections` names, then falls back to a bucket keyed by the
  // document's own `section` for any row that names one the summary never
  // listed — so iterating its return, rather than `documentation.sections`
  // directly, is what keeps an orphan-section document rendered instead of
  // silently dropped. That is the exact `#338` failure this feature exists
  // to prevent, and it is exercised by a fixture in this page's test file
  // because 0 of 279 live documents reach it today.
  const sections = documentsBySection(snapshot);

  return (
    <PanelPageShell
      testId="developer-documentation"
      title="Documentation"
      freshness={freshness}
      freshnessLabel="Repository"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile
          testId="developer-documentation-count-documents"
          value={counts.documents}
          label="committed documents"
        />
        <CountTile
          testId="developer-documentation-count-catalogued"
          value={counts.catalogued}
          label="listed in the index"
        />
        <CountTile
          testId="developer-documentation-count-uncatalogued"
          value={counts.uncatalogued}
          label="not in the index"
        />
        <CountTile
          testId="developer-documentation-count-sections"
          value={sections.length}
          label="areas of the docs tree"
        />
      </div>

      <p className={META_CLASS}>
        The index is <span className={MONO_CLASS}>docs/README.md</span>, which describes itself as a curated map rather
        than a complete listing — so a document missing from it is expected some of the time, not automatically a
        defect. Review records live on their own page and are not counted here. Whether links inside these documents
        still resolve is already guaranteed by a check that runs on every pull request, so it is not repeated here.
      </p>

      <PanelSection
        headingId="developer-documentation-uncatalogued-heading"
        heading={`Not in the index · ${counts.uncatalogued}`}
      >
        {uncatalogued.length > 0 ? (
          <ul data-testid="developer-documentation-uncatalogued" className="grid gap-2">
            {uncatalogued.map((document) => (
              <li
                key={document.path}
                data-testid={`developer-documentation-uncatalogued-${document.path}`}
                className={ROW_CLASS}
              >
                <span className={MONO_CLASS}>{document.path}</span>
                <span className={META_CLASS}>· {document.section}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="developer-documentation-uncatalogued" className={META_CLASS}>
            Every document on disk is named in the index.
          </p>
        )}
      </PanelSection>

      <PanelSection
        headingId="developer-documentation-sections-heading"
        heading={`Every document · ${counts.documents}`}
      >
        {/*
         * A wrapper rather than one `<ul>`: each area needs its own heading, and
         * a heading between `<li>` siblings is not valid list markup. Every
         * document still sits under this single test id.
         */}
        <div data-testid="developer-documentation-sections" className="grid gap-6">
          {sections.map((section) => {
            const headingId = `developer-documentation-section-${section.name}`;
            return (
              <PanelSection
                key={section.name}
                headingId={headingId}
                headingLevel="h3"
                className="grid gap-2"
                heading={`${section.name} · ${section.documents.length}`}
              >
                {section.documents.length > 0 ? (
                  <ul className="grid gap-2">
                    {section.documents.map((document) => (
                      <DocumentRow key={document.path} path={document.path} catalogued={document.catalogued} />
                    ))}
                  </ul>
                ) : (
                  <p className={META_CLASS}>No documents are recorded under this section.</p>
                )}
              </PanelSection>
            );
          })}
        </div>
      </PanelSection>
    </PanelPageShell>
  );
}
