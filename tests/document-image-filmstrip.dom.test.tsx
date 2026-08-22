/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentImageFilmstrip } from "@/components/document-viewer/document-image-filmstrip";
import { DocumentImage } from "@/components/document-viewer/source-panels";
import type { ImageRow } from "@/components/document-viewer/types";

vi.mock("@/components/clinical-dashboard/signed-image", () => ({
  SignedImage: ({ alt }: { alt: string }) => <div data-testid="signed-image-stub">{alt}</div>,
}));

function image(overrides: Partial<ImageRow> & Pick<ImageRow, "id" | "page_number">): ImageRow {
  return {
    id: overrides.id,
    page_number: overrides.page_number,
    caption: overrides.caption ?? "",
    image_type: overrides.image_type ?? "table_crop",
    tableLabel: overrides.tableLabel ?? null,
    tableTitle: overrides.tableTitle ?? null,
    tableRole: overrides.tableRole ?? null,
    clinicalUseClass: overrides.clinicalUseClass ?? "clinical_evidence",
    clinicalUseReason: overrides.clinicalUseReason ?? null,
    labels: overrides.labels ?? [],
    width: overrides.width ?? 400,
    height: overrides.height ?? 300,
    source_kind: overrides.source_kind ?? "table_crop",
    accessibleTableMarkdown: overrides.accessibleTableMarkdown ?? null,
    tableTextSnippet: overrides.tableTextSnippet ?? null,
    tableRows: overrides.tableRows ?? null,
    tableColumns: overrides.tableColumns ?? null,
    rowsTruncated: overrides.rowsTruncated ?? null,
    rowCount: overrides.rowCount ?? null,
    cropCompleteness: overrides.cropCompleteness ?? null,
    structuredExtractionConfidence: overrides.structuredExtractionConfidence ?? null,
    ocrTextDensity: overrides.ocrTextDensity ?? null,
  };
}

describe("document image filmstrip page sync", () => {
  it("calls onSelectPage for filmstrip chips and highlights the active page", () => {
    const onSelectPage = vi.fn();
    const images = [
      image({ id: "img-1", page_number: 2, tableLabel: "ANC thresholds" }),
      image({ id: "img-2", page_number: 5, caption: "Titration chart" }),
    ];

    render(<DocumentImageFilmstrip images={images} activePage={5} onSelectPage={onSelectPage} />);

    const toolbar = screen.getByRole("toolbar", { name: "Jump PDF to figure page" });
    expect(toolbar).toHaveAttribute("data-testid", "document-image-filmstrip");

    const page5 = within(toolbar).getByRole("button", { name: /Show PDF page 5 for Titration chart/i });
    expect(page5).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(toolbar).getByRole("button", { name: /Show PDF page 2 for ANC thresholds/i }));
    expect(onSelectPage).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("keeps a page-unknown chip reachable and inert, never the native disabled attribute", () => {
    const onSelectPage = vi.fn();
    const images = [image({ id: "img-3", page_number: null, tableLabel: "Undated appendix table" })];

    render(<DocumentImageFilmstrip images={images} activePage={1} onSelectPage={onSelectPage} />);

    const chip = screen.getByRole("button", { name: /Undated appendix table — page unknown/i });

    // `aria-disabled`, never `disabled`: the native attribute removes the tab
    // stop, so the reason a keyboard/screen-reader user needs would never be
    // reached. See docs/wiring-conventions.md.
    expect(chip).toHaveAttribute("aria-disabled", "true");
    expect(chip).not.toBeDisabled();
    expect(chip).toHaveAccessibleDescription("This figure has no recorded page number, so it cannot be jumped to.");

    fireEvent.click(chip);
    expect(onSelectPage).not.toHaveBeenCalled();
  });

  it("lets DocumentImage page badges jump the PDF without requiring a second signed-URL fetch", () => {
    const onSelectPage = vi.fn();
    render(
      <DocumentImage
        image={image({ id: "img-9", page_number: 3, tableTitle: "Monitoring schedule" })}
        activePage={3}
        onSelectPage={onSelectPage}
      />,
    );

    const figure = screen.getByTestId("document-image");
    expect(figure).toHaveAttribute("data-page", "3");
    expect(figure).toHaveAttribute("data-active-page", "true");

    fireEvent.click(screen.getByRole("button", { name: "Show PDF page 3" }));
    expect(onSelectPage).toHaveBeenCalledExactlyOnceWith(3);
  });
});
