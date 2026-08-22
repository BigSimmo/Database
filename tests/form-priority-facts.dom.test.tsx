import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/forms/test-form",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { getFormRecord } from "@/lib/forms";

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

describe("Form 1A priority facts", () => {
  it("opens condensed fact detail and per-section Act detail sheets", async () => {
    const user = userEvent.setup();
    const form = getFormRecord("form-1a");
    if (!form) throw new Error("Expected Form 1A");

    render(<FormDetailPage form={form} />);

    const priorityFacts = screen.getByLabelText("Priority facts");
    expect(within(priorityFacts).getByText("Usually 72 hours from referral")).toBeInTheDocument();
    expect(within(priorityFacts).getByText(/Within assessment window/i)).toBeInTheDocument();
    expect(within(priorityFacts).getByText(/Psychiatrist examination only/i)).toBeInTheDocument();
    expect(within(priorityFacts).queryByText("Source status")).not.toBeInTheDocument();
    expect(within(priorityFacts).getByText("Act sections")).toBeInTheDocument();
    expect(within(priorityFacts).getByText(/Authority under the Act/i)).toBeInTheDocument();

    await user.click(within(priorityFacts).getByRole("button", { name: /Clock \/ review.*Open detail/i }));
    const factSheet = await screen.findByTestId("form-priority-fact-sheet");
    expect(factSheet).toHaveTextContent(/72 hours from referral/i);

    await user.click(within(factSheet).getByRole("button", { name: /close/i }));

    await user.click(within(priorityFacts).getByRole("button", { name: /Section 26:/i }));
    const sectionSheet = await screen.findByTestId("form-act-section-sheet");
    expect(sectionSheet).toHaveTextContent(/Referral for examination at authorised hospital or other place/i);
    expect(sectionSheet).toHaveTextContent(/reasonably suspect/i);
  });
});

describe("Priority facts on forms without curated copy", () => {
  it("drops the empty sub-line and only offers detail where there is more to show", async () => {
    const user = userEvent.setup();
    // Form 4C's catalogue row is boilerplate: no indexedClock, and its clock prose is
    // the generic sentence. It is the shape 34 of the 47 archived forms have.
    const form = getFormRecord("transfer-order");
    if (!form) throw new Error("Expected Form 4C");

    render(<FormDetailPage form={form} />);
    const priorityFacts = screen.getByLabelText("Priority facts");

    // "Not listed" read as a fact about the form rather than an absence of one.
    expect(within(priorityFacts).queryByText("Not listed")).not.toBeInTheDocument();

    // The clock card's title is its whole body, so it must not promise detail.
    expect(
      within(priorityFacts).queryByRole("button", { name: /Clock \/ review.*Open detail/i }),
    ).not.toBeInTheDocument();

    // The authority card composes maker + authorises + does-not-authorise, which is
    // strictly more than its title — so every form gets a working popup here.
    await user.click(within(priorityFacts).getByRole("button", { name: /Made by \/ authority.*Open detail/i }));
    const factSheet = await screen.findByTestId("form-priority-fact-sheet");
    expect(factSheet).toHaveTextContent(/Does not replace linked forms/i);
  });
});

describe("Act sections card with many citations", () => {
  function formWithSections(sections: { section: string; title: string; summary?: string }[]) {
    const base = getFormRecord("transfer-order");
    if (!base) throw new Error("Expected Form 4C");
    return {
      ...base,
      summaryCards: [
        ...(base.summaryCards ?? []).filter((card) => card.id !== "source"),
        {
          id: "act-sections",
          label: "Act sections",
          title: "Authority under the Act",
          detail:
            sections.length > 6 ? `${sections.length} sections cited` : sections.map((s) => s.section).join(" · "),
        },
      ],
      catalogPayload: { ...(base.catalogPayload as object), actSections: sections },
    };
  }

  const elevenSections = Array.from({ length: 11 }, (_, index) => ({
    section: String(120 + index),
    title: `Section ${120 + index} heading`,
    summary: `Summary of section ${120 + index}.`,
  }));

  it("caps the chips and opens the full list behind the overflow control", async () => {
    const user = userEvent.setup();
    // Form 5A cites 11 sections; rendering all of them as 48px targets inside one
    // quarter of the 2x2 grid destroys the layout.
    render(<FormDetailPage form={formWithSections(elevenSections)} />);
    const priorityFacts = screen.getByLabelText("Priority facts");

    expect(within(priorityFacts).getByRole("button", { name: /Section 120:/i })).toBeInTheDocument();
    expect(within(priorityFacts).getByRole("button", { name: /Section 125:/i })).toBeInTheDocument();
    expect(within(priorityFacts).queryByRole("button", { name: /Section 126:/i })).not.toBeInTheDocument();

    await user.click(within(priorityFacts).getByRole("button", { name: /Show all 11 Act sections/i }));
    const sheet = await screen.findByTestId("form-act-section-sheet");
    expect(sheet).toHaveTextContent(/Section 130 — Section 130 heading/);

    await user.click(within(sheet).getByRole("button", { name: /Section 130 — Section 130 heading/ }));
    expect(await screen.findByTestId("form-act-section-sheet")).toHaveTextContent(/Summary of section 130\./);
  });

  it("explains a section whose summary has not been written yet", async () => {
    const user = userEvent.setup();
    render(<FormDetailPage form={formWithSections([{ section: "66", title: "Transfer from general hospital" }])} />);
    const priorityFacts = screen.getByLabelText("Priority facts");

    await user.click(within(priorityFacts).getByRole("button", { name: /Section 66:/i }));
    const sheet = await screen.findByTestId("form-act-section-sheet");
    expect(sheet).toHaveTextContent(/has not been written yet/i);
    expect(within(sheet).getByRole("link", { name: /Mental Health Act 2014 \(WA\), version/i })).toBeInTheDocument();
  });
});
