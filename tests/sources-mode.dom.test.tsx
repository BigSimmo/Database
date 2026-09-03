/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DictionarySourcesRedirect from "@/app/(search-app)/dictionary/sources/page";
import { SourcesHomeClient } from "@/app/(search-app)/sources/sources-home-client";
import { SourcesCatalogueClient } from "@/components/sources/sources-catalogue-client";
import {
  SourceDetailPage,
  SourcesMethodPage,
  SourcesPublishersPage,
  SourcesTopicsPage,
} from "@/components/sources/sources-pages";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { SOURCE_RATING_WEIGHTS, type ClinicalSourceCatalogueEntry } from "@/lib/sources/catalogue-types";

const loadCatalogueMock = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
let currentSearchParams = new URLSearchParams();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sources/load-source-catalogue", () => ({ loadSourceCatalogue: loadCatalogueMock }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/sources/search",
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
  useSearchParams: () => currentSearchParams,
  redirect: redirectMock,
  notFound: vi.fn(),
}));

function sourceEntry(
  overrides: Partial<ClinicalSourceCatalogueEntry> & Pick<ClinicalSourceCatalogueEntry, "id" | "title">,
): ClinicalSourceCatalogueEntry {
  const { id, title, ...rest } = overrides;
  return {
    id,
    sourceId: id,
    title,
    aliases: [],
    version: "1",
    publisher: "RANZCP",
    publisherCode: "RANZCP",
    sourceType: "guideline",
    canonicalLocation: { kind: "url", href: "https://www.ranzcp.org/example" },
    geography: { scope: "australian_national", label: "Australia" },
    topics: ["governance"],
    publicationDate: "2025-01-01",
    reviewDate: "2026-01-01",
    expiryDate: null,
    documentStatus: "current",
    validationStatus: "approved",
    contentMode: "link_only",
    lifecycleStatus: "active",
    supersedes: [],
    supersededBy: [],
    usedBy: [
      {
        modeId: "dictionary",
        recordId: "mental-state-examination",
        recordLabel: "Mental state examination",
        field: "definition",
      },
    ],
    rating: {
      score: 90,
      band: "A",
      weights: SOURCE_RATING_WEIGHTS,
      dimensions: {
        accuracyAssurance: 25,
        reliability: 20,
        evidenceQuality: 20,
        currency: 15,
        australianApplicability: 10,
        traceability: 0,
      },
      reasons: ["Accuracy assurance: 25/25"],
    },
    warnings: [],
    ...rest,
  };
}

const fixtureEntries: ClinicalSourceCatalogueEntry[] = [
  sourceEntry({ id: "src_a", title: "Zulu Australian guideline" }),
  sourceEntry({
    id: "src_d",
    title: "Alpha review source",
    publisher: "Legacy Publisher",
    publisherCode: null,
    sourceType: "professional_reference",
    canonicalLocation: { kind: "dataset", label: "Structured clinical catalogue" },
    geography: { scope: "international", label: "International" },
    topics: ["assessment"],
    documentStatus: "review_due",
    validationStatus: "unverified",
    usedBy: [{ modeId: "factsheets", recordId: "depression", recordLabel: "Depression", field: "sources" }],
    rating: {
      score: 45,
      band: "D",
      weights: SOURCE_RATING_WEIGHTS,
      dimensions: {
        accuracyAssurance: 5,
        reliability: 8,
        evidenceQuality: 12,
        currency: 8,
        australianApplicability: 6,
        traceability: 5,
      },
      reasons: ["Material identity or verification uncertainty requires review"],
    },
    warnings: ["verification_unknown"],
  }),
];

beforeEach(() => {
  currentSearchParams = new URLSearchParams();
  routerReplace.mockReset();
  redirectMock.mockReset();
  loadCatalogueMock.mockReset();
  loadCatalogueMock.mockResolvedValue({ entries: fixtureEntries, hostedDocuments: "unavailable" });
});

afterEach(cleanup);

describe("Sources catalogue", () => {
  it("leads with the sources themselves, each carrying its band and where it is used", () => {
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    // No page title block, no count tiles, no panel of selects before the results.
    expect(screen.getByRole("heading", { level: 1, name: "Source catalogue" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Visible sources|Inactive or excluded/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 sources");
    expect(screen.getAllByText("A · Preferred")[0]).toBeVisible();
    expect(screen.getByText("Used in Dictionary")).toBeVisible();
    expect(screen.getByText("Used in Factsheets")).toBeVisible();
    expect(screen.queryByText(/storage_path|owner_id|patient/i)).not.toBeInTheDocument();
  });

  it("keeps governance codes off the card and shows only states that change a decision", () => {
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    // `verification_unknown` is review bookkeeping; `review_due` is not.
    expect(screen.queryByText(/verification unknown/i)).not.toBeInTheDocument();
    expect(screen.getByText("Review due")).toBeVisible();
    expect(screen.queryByTestId("sources-partial-catalogue-note")).not.toBeInTheDocument();
  });

  it("says the list is incomplete when the hosted-document loader cannot be reached", () => {
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="unavailable" />);

    // The count is wrong in this state, so the reader has to be told before
    // reading it as the whole registry.
    expect(screen.getByTestId("sources-partial-catalogue-note")).toHaveTextContent(
      "Uploaded document sources cannot be reached, so this list and its count are incomplete.",
    );
  });

  it("reads application usage from the URL and narrows the visible sources", () => {
    currentSearchParams = new URLSearchParams("usedBy=dictionary");
    const view = render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    expect(screen.getByRole("status")).toHaveTextContent("1 source");
    expect(screen.getByText("Zulu Australian guideline")).toBeVisible();
    expect(screen.queryByText("Alpha review source")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Used in: Dictionary filter" })).toBeVisible();

    view.unmount();
    currentSearchParams = new URLSearchParams("band=D&publisher=Legacy+Publisher");
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    expect(screen.getByRole("status")).toHaveTextContent("1 source");
    expect(screen.getByText("Alpha review source")).toBeVisible();
  });

  it("surfaces every applied filter as its own chip, including one only a deep link can set", () => {
    currentSearchParams = new URLSearchParams(
      "band=A&band=D&usedBy=dictionary&usedBy=factsheets&publisher=Legacy+Publisher",
    );
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    for (const name of [
      "Remove Quality band: A · Preferred filter",
      "Remove Quality band: D · Review required filter",
      "Remove Used in: Dictionary filter",
      "Remove Used in: Factsheets filter",
      "Remove Publisher: Legacy Publisher filter",
    ]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }

    fireEvent.click(screen.getByRole("button", { name: "Remove Quality band: D · Review required filter" }));
    expect(routerReplace).toHaveBeenLastCalledWith(
      "/sources/search?usedBy=dictionary&usedBy=factsheets&publisher=Legacy+Publisher&band=A",
      { scroll: false },
    );
  });

  it("removes a comma-delimited filter value while preserving its siblings", () => {
    currentSearchParams = new URLSearchParams("band=A%2CD&usedBy=dictionary");
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Quality band: D · Review required filter" }));

    expect(routerReplace).toHaveBeenLastCalledWith("/sources/search?usedBy=dictionary&band=A", { scroll: false });
  });

  it("sorts by quality by default, honours an ordering deep link, and clears filters while keeping the query", () => {
    const quality = render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    const qualityTitles = screen.getAllByRole("link", { name: /view source details/i });
    expect(qualityTitles[0]).toHaveAccessibleName(/Zulu Australian guideline/);

    quality.unmount();
    currentSearchParams = new URLSearchParams("sort=title");
    const title = render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    expect(screen.getAllByRole("link", { name: /view source details/i })[0]).toHaveAccessibleName(
      /Alpha review source/,
    );

    title.unmount();
    currentSearchParams = new URLSearchParams("q=ranzcp&band=A&publisher=Legacy+Publisher");
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    expect(screen.getByRole("status")).toHaveTextContent("0 sources");
    fireEvent.click(screen.getAllByRole("button", { name: /clear all filters|clear filters/i })[0]);
    expect(routerReplace).toHaveBeenLastCalledWith("/sources/search?q=ranzcp", { scroll: false });
  });
});

describe("Sources derived pages", () => {
  it("links topic and publisher groups back to filtered catalogue results without a title block", async () => {
    const topics = render(await SourcesTopicsPage());
    // The page keeps its name for the outline, but paints no header or breadcrumb.
    expect(screen.getByRole("heading", { level: 1, name: "Topics" })).toHaveClass("sr-only");
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /governance/i })).toHaveAttribute(
      "href",
      "/sources/search?topic=governance",
    );

    topics.unmount();
    render(await SourcesPublishersPage());
    expect(screen.getByRole("heading", { level: 1, name: "Publishers" })).toHaveClass("sr-only");
    expect(screen.getByRole("heading", { level: 2, name: "Australian national" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "International" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View RANZCP sources" })).toHaveAttribute(
      "href",
      "/sources/search?publisher=RANZCP&jurisdiction=australian_national",
    );
  });

  it("keeps publisher jurisdiction-group counts aligned with their catalogue links", async () => {
    loadCatalogueMock.mockResolvedValueOnce({
      entries: [
        fixtureEntries[0],
        sourceEntry({
          id: "src_ranzcp_international",
          title: "RANZCP international source",
          geography: { scope: "international", label: "International" },
        }),
      ],
      hostedDocuments: "available",
    });

    render(await SourcesPublishersPage());

    const links = screen.getAllByRole("link", { name: "View RANZCP sources" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/sources/search?publisher=RANZCP&jurisdiction=australian_national",
      "/sources/search?publisher=RANZCP&jurisdiction=international",
    ]);
    expect(links).toHaveLength(2);
  });

  it("publishes every weight, threshold and limitation on Method", () => {
    render(<SourcesMethodPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Method" })).toHaveClass("sr-only");
    expect(screen.getByText("Accuracy assurance")).toBeVisible();
    expect(screen.getByText("25 points")).toBeVisible();
    expect(screen.getByText(/A · Preferred.*85–100/)).toBeVisible();
    expect(screen.getByText(/Excluded.*before.*score/i)).toBeVisible();
    expect(screen.getByText(/Australian applicability is bounded/i)).toBeVisible();
    expect(screen.getByText(/Missing fields remain unknown/i)).toBeVisible();
    expect(
      screen.getByText(
        /Missing publisher, version, dates, jurisdiction, evidence type or validation.*D · Review required/i,
      ),
    ).toBeVisible();
    expect(screen.getByText(/past expiry.*no current currency credit/i)).toBeVisible();
    expect(screen.getByText(/identified replacement.*excluded/i)).toBeVisible();
    expect(screen.getByText(/not RAG relevance or patient-specific guidance/i)).toBeVisible();
    const definitions = screen.getByRole("region", { name: "Catalogue status definitions" });
    for (const label of [
      "Current",
      "Review due",
      "Outdated",
      "Unknown currentness",
      "Approved",
      "Locally reviewed",
      "Unverified",
      "Unknown validation",
      "Active",
      "Inactive",
      "Excluded",
      "Indexed content",
      "Link only",
      "Metadata only",
    ]) {
      expect(within(definitions).getByText(label)).toBeVisible();
    }
    expect(
      within(definitions).getByText(/explicit upstream status says the source is due for structured review/i),
    ).toBeVisible();
    expect(within(definitions).getByText(/malformed expiry.*currentness remains unknown/i)).toBeVisible();
    expect(within(definitions).getByText(/content can be searched inside the application/i)).toBeVisible();
  });

  it("names every place the source is used, grouped by area and linked to the record", async () => {
    render(await SourceDetailPage({ sourceId: "src_a" }));

    expect(screen.getByRole("heading", { level: 1, name: "Zulu Australian guideline" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to sources" })).toHaveAttribute("href", "/sources/search");
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();

    const usage = screen.getByRole("region", { name: "Where this source is used" });
    expect(within(usage).getByText("1 record across 1 area")).toBeVisible();
    expect(within(usage).getByRole("heading", { level: 3, name: /Dictionary/ })).toBeVisible();
    expect(within(usage).getByRole("link", { name: /Mental state examination/ })).toHaveAttribute(
      "href",
      "/dictionary/mental-state-examination",
    );
    expect(within(usage).getByText("Supports the definition")).toBeVisible();
  });

  it("keeps the record compact: band and score stay, scoring workings and empty fields go", async () => {
    render(await SourceDetailPage({ sourceId: "src_a" }));

    expect(screen.getByText("A · Preferred")).toBeVisible();
    expect(screen.getByText("Review score 90/100")).toBeVisible();
    expect(screen.getByRole("link", { name: /open canonical source/i })).toHaveAttribute(
      "href",
      "https://www.ranzcp.org/example",
    );
    // Scoring workings and never-populated traceability lines are gone.
    expect(screen.queryByText("Accuracy assurance: 25/25")).not.toBeInTheDocument();
    expect(screen.queryByText(/Aliases/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Supersedes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Publisher code|Content mode|Validation/)).not.toBeInTheDocument();
    // A clean source says nothing about review.
    expect(screen.queryByRole("region", { name: /needs review/i })).not.toBeInTheDocument();
  });

  it("says what is wrong with a questionable source rather than leaving the band to imply it", async () => {
    render(await SourceDetailPage({ sourceId: "src_d" }));

    const review = screen.getByRole("region", { name: "Needs review before you rely on this" });
    expect(within(review).getByText("Whether this source has been verified is unknown")).toBeVisible();
    expect(within(review).getByText("Marked as not yet clinically verified")).toBeVisible();
    // The stored codes stay out of reader-facing text.
    expect(review.textContent).not.toMatch(/verification_unknown|ambiguous_identity/);
  });
});

describe("Dictionary Sources compatibility redirect", () => {
  it("preserves incoming query values and forces dictionary application usage", async () => {
    await DictionarySourcesRedirect({
      searchParams: Promise.resolve({ q: "RANZCP", band: ["A", "D"], usedBy: "factsheets" }),
    });
    expect(redirectMock).toHaveBeenCalledWith("/sources/search?q=RANZCP&band=A&band=D&usedBy=dictionary");
  });
});

/*
 * `/sources` was registered as a standalone mode home and given a hero composer
 * placement, but rendered the catalogue — which mounts no composer slot, so the
 * shell portalled its search field at a host that did not exist. These cases pin
 * the home that closes that gap: the slot has to be present, and the four
 * catalogue surfaces have to stay reachable from it now that the bare path no
 * longer lists them itself.
 */
describe("Sources home", () => {
  it("renders the shared mode-home hero copy for Sources", () => {
    render(<SourcesHomeClient />);

    const home = screen.getByTestId("sources-home");
    expect(within(home).getByRole("heading", { name: "Sources" })).toBeTruthy();
    expect(within(home).getByText("Clinical source catalogue.")).toBeTruthy();
  });

  it("mounts the hero composer slot the shell portals into", () => {
    const { container } = render(<SourcesHomeClient />);

    expect(container.querySelector(`#${modeHomeDesktopComposerSlotId}`)).not.toBeNull();
  });

  it("links every catalogue surface, with the filterable catalogue on its own route", () => {
    render(<SourcesHomeClient />);

    const hrefs = ["catalogue", "topics", "publishers", "method"].map((item) =>
      screen.getByTestId(`sources-home-${item}`).getAttribute("href"),
    );
    expect(hrefs).toEqual(["/sources/search", "/sources/topics", "/sources/publishers", "/sources/method"]);
  });

  it("runs a suggested search against the catalogue rather than the home", () => {
    render(<SourcesHomeClient />);

    fireEvent.click(screen.getByRole("button", { name: "RANZCP" }));
    expect(routerPush).toHaveBeenCalledWith("/sources/search?q=RANZCP&run=1");
  });
});
