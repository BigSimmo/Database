import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: () => {} }),
  usePathname: () => "/differentials/diagnoses/lithium-physiological-withdrawal-tremor",
}));

import { AccountDataProvider } from "@/components/account-data-provider";
import { DifferentialDetailPage } from "@/components/differentials/differential-detail-page";
import { curatedEntryFor } from "@/lib/differential-curated";
import type { DifferentialDetailContext } from "@/lib/differential-detail";
import type { DifferentialSnapshot } from "@/lib/differential-snapshot";
import { getDifferentialRecord } from "@/lib/differentials";
import { AuthProvider } from "@/lib/supabase/client";

const LITHIUM = "lithium-physiological-withdrawal-tremor";

/** The generated export on disk, before the catalogue loader withholds it. */
const rawSnapshot = JSON.parse(readFileSync("data/differentials-snapshot.json", "utf8")) as DifferentialSnapshot;

function buildContext(slug: string): DifferentialDetailContext {
  return {
    knownRelatedSlugs: [],
    relatedMapDetails: {},
    termLinks: {},
    overlapLinks: {},
    comparePresentation: null,
    curated: curatedEntryFor(slug),
    source: {
      version: "v10",
      exportedAt: "2026-07-11T00:00:00.000Z",
      reviewStatus: "Pending review",
      sourceTitle: "Differentials",
      sourceStatus: "review_due",
      validationStatus: "unverified",
    },
  };
}

function renderRecord(slug: string) {
  const record = getDifferentialRecord(slug);
  if (!record) throw new Error(`missing catalogue record: ${slug}`);
  render(
    <AuthProvider>
      <AccountDataProvider>
        <DifferentialDetailPage record={record} detailContext={buildContext(slug)} />
      </AccountDataProvider>
    </AuthProvider>,
  );
  return record;
}

/**
 * The lithium tremor record's generated export describes akathisia and
 * drug-induced parkinsonism. Until the owner ruling of 2026-09-16 the page
 * printed all of it under a warning asking the reader to distrust it. These
 * tests pin the stronger handling: the contaminated text is not rendered at
 * all, and its absence is explained rather than left as a blank panel.
 */
describe("a differential whose generated body is withheld", () => {
  it("renders none of the contaminated generated text", () => {
    const record = renderRecord(LITHIUM);

    // Proof the fixture is the contaminated record and not an already-clean one.
    // Read from the export on disk, because the catalogue loader now withholds
    // the body before the page ever sees it, and `record` is already clean.
    expect(record.clinicalHinge).toBe("");
    const exported = rawSnapshot.diagnoses.find((entry) => entry.slug === LITHIUM)!;
    expect(exported.clinicalHinge).toMatch(/inner restlessness/i);
    const contaminatedAction = exported.immediateActions.find((action) => /drug-induced parkinsonism/i.test(action));
    expect(contaminatedAction).toBeTruthy();

    expect(screen.queryByText(/inner restlessness/i)).toBeNull();
    // The whole contaminated sentence, not the phrase: "Drug-induced
    // parkinsonism" survives as a related-diagnosis label, which is a link to
    // another record rather than a claim about lithium tremor.
    expect(screen.queryByText(contaminatedAction!)).toBeNull();
    expect(screen.queryByTestId("differential-clinical-hinge")).toBeNull();
    expect(screen.queryByTestId("differential-expand-all")).toBeNull();
  });

  it("says the review is withheld instead of showing an empty panel", () => {
    renderRecord(LITHIUM);

    const withheld = screen.getByTestId("differential-body-withheld");
    expect(withheld).toHaveTextContent(/not shown/i);
    expect(withheld).toHaveTextContent(/describe a different diagnosis/i);
  });

  it("does not promise an original document the app cannot open", () => {
    // Copilot on PR #2838. The Source tab renders source status, review status
    // and a version line reading "Local content only" — there is no link to an
    // original anywhere on it. Telling the reader to open the source and read
    // the original sent them somewhere that cannot deliver it, which is the same
    // overclaim this change exists to stop, made by the fix itself.
    renderRecord(LITHIUM);

    const withheld = screen.getByTestId("differential-body-withheld");
    expect(withheld.textContent ?? "").not.toMatch(/read the original/i);
    expect(screen.getByTestId("differential-content-note").textContent ?? "").not.toMatch(/read the original/i);
    // What it points at instead must exist: the provenance and review state.
    expect(withheld).toHaveTextContent(/review status/i);
  });

  it("keeps the note explaining why, so the absence is never unexplained", () => {
    renderRecord(LITHIUM);

    expect(screen.getByTestId("differential-content-note")).toHaveTextContent(/withheld/i);
  });

  it("claims local authorship only for the steps that actually have it", () => {
    // Codex P2 on PR #2838. For this record only `doNow` comes from the curated
    // overlay; the safety snapshot and investigations are retained fields from
    // the same generated export the rest of the body was withheld from. Calling
    // all three locally authored lends the retained content a provenance it does
    // not have — the exact overclaim this whole change exists to stop.
    renderRecord(LITHIUM);

    const withheld = screen.getByTestId("differential-body-withheld");
    expect(withheld).toHaveTextContent(/assessment steps/i);
    expect(withheld).toHaveTextContent(/retained from the source export/i);
    expect(withheld.textContent ?? "").not.toMatch(
      /safety snapshot[^.]*locally authored|locally authored[^.]*safety snapshot/i,
    );
  });

  it("keeps the locally authored safety content that was never contaminated", () => {
    renderRecord(LITHIUM);

    // Listed in more than one place on the overview: the safety snapshot and
    // the rail both carry it, and neither came from the generated body.
    expect(screen.getAllByText(/Lithium toxicity/i).length).toBeGreaterThan(0);
  });

  it("leaves an ordinary record's generated sections fully rendered", () => {
    // The same page, same provider, on a record with no withhold: the clinical
    // hinge and the expandable review are both present, so the assertions above
    // are testing the withhold rather than a page that renders nothing.
    renderRecord("akathisia");

    expect(screen.getByTestId("differential-clinical-hinge")).toBeInTheDocument();
    expect(screen.queryByTestId("differential-body-withheld")).toBeNull();
  });
});
