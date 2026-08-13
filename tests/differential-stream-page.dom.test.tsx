import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DifferentialStreamPage } from "@/components/differentials/differential-stream-page";
import { buildDifferentialStreamModel } from "@/lib/differential-stream";
import { differentialDiagnosesCards, differentialPresentationsCards } from "@/lib/differentials";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/differentials/presentations",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("DifferentialStreamPage", () => {
  it("renders the presentations catalogue as a compact symptom-led pathway workspace", () => {
    render(<DifferentialStreamPage stream="presentations" />);

    expect(screen.getByRole("heading", { level: 1, name: "Presentations" })).toBeInTheDocument();
    expect(
      screen.getByText("Start with what is happening now, then open a pathway to compare likely causes."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("search-query-ribbon")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "All" })).toBeInTheDocument();
    expect(screen.getByText("Symptom-led pathways with priority and safety cues")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Presentation pathways" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Presentation priority" })).toBeInTheDocument();
    expect(screen.getByText("High-priority presentation pathways")).toBeInTheDocument();
    expect(screen.queryByText("Differentials: Presentations")).not.toBeInTheDocument();

    const firstCard = differentialPresentationsCards[0];
    expect(firstCard).toBeTruthy();
    expect(screen.getByRole("button", { name: firstCard!.title })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open pathway/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/differential candidates?/).length).toBeGreaterThan(0);
  });

  it("carries the submitted query into a presentation pathway", () => {
    const firstCard = differentialPresentationsCards[0];
    expect(firstCard).toBeTruthy();

    render(<DifferentialStreamPage stream="presentations" query="acute confusion" />);

    const slug = firstCard!.href.split("/").at(-1) ?? "";
    expect(slug).toBeTruthy();
    const card = screen.getByTestId(`differential-stream-card-${slug}`);
    expect(within(card).getByRole("link", { name: "Open pathway" })).toHaveAttribute(
      "href",
      `${firstCard!.href}?q=acute+confusion`,
    );
  });

  it("reveals a filtered safety-shelf target before scrolling to it", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
    const model = buildDifferentialStreamModel("presentations", "");
    const safetyItem = model.safetyShelfIds
      .map((id) => model.items.find((item) => item.id === id))
      .find((item) => item?.status === "emergent");
    expect(safetyItem).toBeTruthy();

    render(<DifferentialStreamPage stream="presentations" />);

    const priorityGroup = screen.getByRole("group", { name: "Presentation priority" });
    await user.click(within(priorityGroup).getByRole("button", { name: "Urgent" }));
    expect(screen.queryByTestId(`differential-stream-card-${safetyItem!.slug}`)).not.toBeInTheDocument();

    scrollIntoView.mockClear();
    await user.click(
      within(screen.getByTestId("differentials-stream-safety-shelf")).getByRole("button", {
        name: safetyItem!.title,
      }),
    );

    await waitFor(() => expect(screen.getByTestId(`differential-stream-card-${safetyItem!.slug}`)).toBeInTheDocument());
    expect(within(priorityGroup).getByRole("button", { name: "All priorities" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
  });

  it("filters presentations by priority and shared-candidate pathways", async () => {
    const user = userEvent.setup();
    render(<DifferentialStreamPage stream="presentations" query="agitation" />);

    const initialCards = screen.getAllByTestId(/^differential-stream-card-/).length;
    const priorityGroup = screen.getByRole("group", { name: "Presentation priority" });
    await user.click(within(priorityGroup).getByRole("button", { name: "Emergent" }));
    const emergentCards = screen.getAllByTestId(/^differential-stream-card-/);
    expect(emergentCards.length).toBeLessThan(initialCards);
    expect(emergentCards.every((card) => card.dataset.status === "emergent")).toBe(true);
    expect(screen.getByRole("button", { name: "Remove Emergent priority filter" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Emergent priority filter" }));
    const pathwayGroup = screen.getByRole("group", { name: "Related pathway filter" });
    await user.click(within(pathwayGroup).getByRole("button", { name: "Related pathways" }));
    expect(screen.getAllByTestId(/^differential-stream-card-/).length).toBeLessThan(initialCards);
    expect(screen.getByRole("button", { name: /Remove .+ related pathways filter/ })).toBeInTheDocument();
  });

  it("replaces match navigation with a removable focused-family filter", async () => {
    const user = userEvent.setup();
    render(<DifferentialStreamPage stream="diagnoses" query="pain" />);

    expect(screen.getByRole("heading", { level: 1, name: "Diagnoses" })).toBeInTheDocument();
    expect(screen.getByText("Compare likely causes and exclusion clues.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "pain" })).toBeInTheDocument();
    expect(screen.queryByTestId("differentials-stream-match-controls")).not.toBeInTheDocument();
    expect(screen.queryByTestId("differentials-stream-match-rail")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prev match" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next match" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Related cluster lit for/)).not.toBeInTheDocument();

    const initialCards = screen.getAllByTestId(/^differential-stream-card-/).length;
    await user.click(screen.getByRole("button", { name: "Focused family" }));

    const removeFamily = screen.getByRole("button", { name: /Remove .+ family filter/ });
    expect(removeFamily).toBeInTheDocument();
    expect(screen.getAllByTestId(/^differential-stream-card-/).length).toBeLessThan(initialCards);

    await user.click(removeFamily);
    expect(screen.getAllByTestId(/^differential-stream-card-/)).toHaveLength(initialCards);
  });

  it("keeps diagnosis browse grouping in the top controls", async () => {
    const user = userEvent.setup();
    render(<DifferentialStreamPage stream="diagnoses" />);

    const byUrgency = screen.getByRole("button", { name: "By urgency" });
    const byPresentation = screen.getByRole("button", { name: "By presentation" });
    expect(byUrgency).toHaveAttribute("aria-pressed", "true");
    expect(byPresentation).toHaveAttribute("aria-pressed", "false");

    await user.click(byPresentation);
    expect(byUrgency).toHaveAttribute("aria-pressed", "false");
    expect(byPresentation).toHaveAttribute("aria-pressed", "true");
  });

  it("scrolls only for an explicit focus parameter", async () => {
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
    const initialRender = render(<DifferentialStreamPage stream="diagnoses" query="pain" />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    initialRender.unmount();
    scrollIntoView.mockClear();

    const focused = differentialDiagnosesCards[0];
    expect(focused).toBeTruthy();
    const focusedSlug = focused!.href.split("/").at(-1);
    expect(focusedSlug).toBeTruthy();
    render(<DifferentialStreamPage stream="diagnoses" query="pain" focus={focusedSlug} />);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
  });
});
