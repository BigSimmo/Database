import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DsmSearchPage } from "@/components/dsm/dsm-search-page";
import type { DsmCategory } from "@/lib/dsm";

// `/dsm/search` rendered "No diagnosis matches" as an `<h2>` until it adopted
// `EmptyState`, whose title was a `<p>` — so heading navigation silently
// skipped the state and no test noticed (ledger #224). The heading is the
// contract now, not the markup that happens to produce it.
const categories: DsmCategory[] = [
  { key: "mood", label: "Mood disorders", css_class: "mood", color: "#123456", diagnosis_count: 12 },
];

describe("DsmSearchPage empty state", () => {
  it("keeps a heading on the no-matches state so heading navigation reaches it", () => {
    render(<DsmSearchPage query="zzzznotadiagnosis" categories={categories} results={[]} totalCount={0} />);

    expect(screen.getByRole("heading", { level: 2, name: "No diagnosis matches" })).toBeVisible();
  });

  it("drops the catalogue page header and owns the query as the page heading", () => {
    render(<DsmSearchPage query="Delirium" categories={categories} results={[]} totalCount={12} />);

    expect(screen.queryByRole("link", { name: /DSM-5 Diagnosis home/i })).toBeNull();
    expect(screen.queryByText(/Diagnosis catalogue/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Diagnosis search" })).toBeNull();
    expect(screen.queryByText(/Find diagnostic records by name/i)).toBeNull();

    expect(screen.getByTestId("search-query-ribbon")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Delirium" })).toBeVisible();
    expect(screen.getByTestId("dsm-category-filter")).toBeVisible();
    expect(screen.getByTestId("dsm-category-filter")).toHaveTextContent("12");
  });
});
