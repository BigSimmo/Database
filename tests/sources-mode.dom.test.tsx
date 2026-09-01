/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DictionarySourcesRedirect from "@/app/(search-app)/dictionary/sources/page";
import { SourcesCatalogueClient } from "@/components/sources/sources-catalogue-client";
import {
  SourceDetailPage,
  SourcesMethodPage,
  SourcesPublishersPage,
  SourcesTopicsPage,
} from "@/components/sources/sources-pages";
import { SOURCE_RATING_WEIGHTS, type ClinicalSourceCatalogueEntry } from "@/lib/sources/catalogue-types";

const loadCatalogueMock = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
let currentSearchParams = new URLSearchParams();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sources/load-source-catalogue", () => ({ loadSourceCatalogue: loadCatalogueMock }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/sources",
  useRouter: () => ({ replace: routerReplace }),
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
  it("renders the client-safe catalogue, defaults and truthful degraded state", () => {
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="unavailable" />);

    expect(screen.getByRole("heading", { level: 1, name: "Sources" })).toBeVisible();
    expect(screen.getAllByText("A · Preferred")[0]).toBeVisible();
    expect(screen.getByLabelText("Filter by quality band")).toHaveValue("");
    expect(screen.getByLabelText("Sort sources")).toHaveValue("quality");
    expect(screen.getByRole("status")).toHaveTextContent("2 sources");
    expect(screen.getByText("Hosted document sources are temporarily unavailable")).toBeVisible();
    expect(screen.queryByText(/storage_path|owner_id|patient/i)).not.toBeInTheDocument();
  });

  it("reads application usage from the URL and updates filters through router.replace", () => {
    currentSearchParams = new URLSearchParams("usedBy=dictionary");
    const view = render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    expect(screen.getByLabelText("Filter by application usage")).toHaveValue("dictionary");
    expect(screen.getByRole("status")).toHaveTextContent("1 source");
    expect(screen.getAllByText("Zulu Australian guideline").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alpha review source")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by quality band"), { target: { value: "D" } });
    expect(routerReplace).toHaveBeenLastCalledWith("/sources?usedBy=dictionary&band=D", { scroll: false });

    view.unmount();
    currentSearchParams = new URLSearchParams("band=D&publisher=Legacy+Publisher");
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    expect(screen.getByRole("status")).toHaveTextContent("1 source");
    expect(screen.getAllByText("Alpha review source").length).toBeGreaterThan(0);
  });

  it("surfaces and removes every repeated filter value without discarding its siblings", () => {
    currentSearchParams = new URLSearchParams(
      "band=A&band=D&usedBy=dictionary&usedBy=factsheets&publisher=Legacy+Publisher",
    );
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    expect(screen.getByLabelText("Filter by quality band")).toHaveValue("");
    expect(screen.getByLabelText("Filter by application usage")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Remove quality band: A · Preferred" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove quality band: D · Review required" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove application usage: Dictionary" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove application usage: Factsheets" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove quality band: D · Review required" }));
    expect(routerReplace).toHaveBeenLastCalledWith(
      "/sources?band=A&usedBy=dictionary&usedBy=factsheets&publisher=Legacy+Publisher",
      { scroll: false },
    );
  });

  it("removes a visible comma-delimited filter value while preserving its siblings", () => {
    currentSearchParams = new URLSearchParams("band=A%2CD&usedBy=dictionary");
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);

    fireEvent.click(screen.getByRole("button", { name: "Remove quality band: D · Review required" }));

    expect(routerReplace).toHaveBeenLastCalledWith("/sources?band=A&usedBy=dictionary", { scroll: false });
  });

  it("sorts by quality or title and offers a wired reset for empty filters", () => {
    const quality = render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    const qualityRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(qualityRows[0]).getByRole("link")).toHaveTextContent("Zulu Australian guideline");

    quality.unmount();
    currentSearchParams = new URLSearchParams("sort=title");
    const title = render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    const titleRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(titleRows[0]).getByRole("link")).toHaveTextContent("Alpha review source");

    title.unmount();
    currentSearchParams = new URLSearchParams("band=A&publisher=Legacy+Publisher");
    render(<SourcesCatalogueClient entries={fixtureEntries} hostedDocuments="available" />);
    expect(screen.getByRole("status")).toHaveTextContent("0 sources");
    expect(screen.getByRole("heading", { name: "No sources match these filters" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(routerReplace).toHaveBeenCalledWith("/sources", { scroll: false });
  });
});

describe("Sources derived pages", () => {
  it("links topic and publisher groups back to filtered catalogue results", async () => {
    const topics = render(await SourcesTopicsPage());
    expect(screen.getByRole("heading", { level: 1, name: "Topics" })).toBeVisible();
    expect(screen.getByRole("link", { name: /governance/i })).toHaveAttribute("href", "/sources?topic=governance");

    topics.unmount();
    render(await SourcesPublishersPage());
    expect(screen.getByRole("heading", { level: 1, name: "Publishers" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Australian national" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "RANZCP" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "International" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "Legacy Publisher" })).toBeVisible();
    expect(screen.getByRole("link", { name: /view ranzcp sources/i })).toHaveAttribute(
      "href",
      "/sources?publisher=RANZCP&jurisdiction=australian_national",
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

    const links = screen.getAllByRole("link", { name: /view ranzcp sources/i });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/sources?publisher=RANZCP&jurisdiction=australian_national",
      "/sources?publisher=RANZCP&jurisdiction=international",
    ]);
    expect(links).toHaveLength(2);
  });

  it("publishes every weight, threshold and limitation on Method", () => {
    render(<SourcesMethodPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Method" })).toBeVisible();
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

  it("shows the three explicit location labels and full traceability on detail", async () => {
    render(await SourceDetailPage({ sourceId: "src_a" }));
    expect(screen.getByRole("heading", { level: 1, name: "Zulu Australian guideline" })).toBeVisible();
    expect(screen.getByText("Canonical location")).toBeVisible();
    expect(screen.getByText("Geographic location")).toBeVisible();
    expect(screen.getByText("Application location")).toBeVisible();
    expect(screen.getByRole("link", { name: /open canonical source/i })).toHaveAttribute(
      "href",
      "https://www.ranzcp.org/example",
    );
    expect(screen.getByText("Mental state examination")).toBeVisible();
    expect(screen.getByText("Accuracy assurance: 25/25")).toBeVisible();
  });
});

describe("Dictionary Sources compatibility redirect", () => {
  it("preserves incoming query values and forces dictionary application usage", async () => {
    await DictionarySourcesRedirect({
      searchParams: Promise.resolve({ q: "RANZCP", band: ["A", "D"], usedBy: "factsheets" }),
    });
    expect(redirectMock).toHaveBeenCalledWith("/sources?q=RANZCP&band=A&band=D&usedBy=dictionary");
  });
});
