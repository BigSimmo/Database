import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: () => {} }),
}));

import { DifferentialCompareQueuePage } from "@/components/differentials/differential-compare-queue-page";

describe("DifferentialCompareQueuePage", () => {
  it("describes the supported singleton queue", () => {
    render(<DifferentialCompareQueuePage items={[]} openComparisonHref="/differentials/compare/view" />);

    expect(screen.getByText(/tick diagnoses on Search and return here/i)).toBeVisible();
    expect(screen.queryByText(/two or more diagnoses/)).not.toBeInTheDocument();
  });

  it("keeps phone visual order aligned with DOM and focus order", () => {
    render(
      <DifferentialCompareQueuePage
        items={[{ slug: "delirium", title: "Delirium" }]}
        openComparisonHref="/differentials/compare/view?ids=delirium"
      />,
    );

    const selected = screen.getByRole("region", { name: "Selected diagnoses" });
    const actions = screen.getByRole("region", { name: "Comparison actions" });
    expect(selected.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(selected.className).not.toMatch(/(?:^|:)order-/);
    expect(actions.className).not.toMatch(/(?:^|:)order-/);

    const selectedLinks = within(selected).getAllByRole("link");
    const actionLinks = within(actions).getAllByRole("link");
    expect(
      selectedLinks.at(-1)!.compareDocumentPosition(actionLinks[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses the shared tap-height token for selected rows", () => {
    render(
      <DifferentialCompareQueuePage
        items={[{ slug: "delirium", title: "Delirium" }]}
        openComparisonHref="/differentials/compare/view?ids=delirium"
      />,
    );

    const row = screen.getByRole("link", { name: "Delirium" }).closest("li");
    expect(row).toHaveClass("min-h-tap");
    expect(row?.className).not.toMatch(/min-h-\[/);
  });
});
