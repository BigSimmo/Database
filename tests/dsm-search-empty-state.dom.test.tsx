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
});
