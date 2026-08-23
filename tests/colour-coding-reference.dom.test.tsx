import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ColourCodingReferencePage from "@/app/reference/colour-coding/page";
import { ColourCodingReferenceContent } from "@/components/reference/colour-coding-reference-content";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
});

describe("Colour coding reference", () => {
  it("renders six tone samples and no developer file paths on the standalone page", () => {
    render(<ColourCodingReferencePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Colour coding & badges" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tone key" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Quick mapping" })).toBeVisible();
    expect(screen.queryByText(/semantic-flags\.ts/)).not.toBeInTheDocument();
    expect(screen.queryByText(/clinical-badge-system-guide\.md/)).not.toBeInTheDocument();

    for (const label of [
      "Contraindicated",
      "Review due",
      "Monitor renal",
      "Source-backed",
      "333 mg tablet",
      "Processing",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("keeps domain catalogues expanded on the page variant", () => {
    const { container } = render(<ColourCodingReferenceContent variant="page" />);

    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByRole("heading", { name: "Medications" })).toBeVisible();
  });

  it("uses collapsible domain sections in the guide variant", () => {
    const { container } = render(<ColourCodingReferenceContent variant="guide" />);

    expect(container.querySelectorAll("details").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open full reference" })).toBeVisible();
  });
});
