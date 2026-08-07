import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentFrame, type DocumentFrameControls } from "@/components/ui/document-frame";

const readyControls = (overrides: Partial<DocumentFrameControls> = {}): DocumentFrameControls => ({
  fitWidth: true,
  onFitWidth: vi.fn(),
  zoom: 1,
  onZoomChange: vi.fn(),
  viewingAid: false,
  onViewingAidChange: vi.fn(),
  ...overrides,
});

describe("DocumentFrame", () => {
  it("renders a stable, labelled loading frame without mounting ready content", () => {
    render(
      <DocumentFrame
        alt="Lithium monitoring source preview"
        src={{ kind: "document" }}
        state="loading"
        loadingLabel="Preparing source preview"
        statusDetail={<p>Loading source metadata</p>}
        statusActions={<a href="https://example.test/source.pdf">Open source</a>}
      >
        <p>Ready-only source content</p>
      </DocumentFrame>,
    );

    const frame = screen.getByRole("group", { name: "Lithium monitoring source preview" });
    expect(frame).toHaveAttribute("aria-busy", "true");
    expect(frame).toHaveAttribute("data-state", "loading");
    expect(screen.getByRole("status")).toHaveTextContent("Preparing source preview");
    expect(screen.getByRole("status")).toHaveTextContent("Loading source metadata");
    expect(screen.getByRole("link", { name: "Open source" })).toBeVisible();
    expect(screen.getByTestId("document-frame-surround")).toHaveClass("min-h-64", "sm:min-h-72");
    expect(screen.queryByText("Ready-only source content")).toBeNull();
  });

  it("owns the complete error structure and an accessible retry action", () => {
    const onRetry = vi.fn();
    render(
      <DocumentFrame
        alt="Medication chart"
        src={{ kind: "image" }}
        state="error"
        errorMessage="The signed preview link expired."
        onRetry={onRetry}
        statusActions={<a href="https://example.test/chart.png">Open original</a>}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Preview unavailable");
    expect(alert).toHaveTextContent("The signed preview link expired.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry preview" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(within(alert).getByRole("link", { name: "Open original" })).toBeVisible();
  });

  it("renders controlled fit, zoom, and viewing-aid actions in one print-hidden toolbar", () => {
    const onFitWidth = vi.fn();
    const onZoomChange = vi.fn();
    const onViewingAidChange = vi.fn();
    render(
      <DocumentFrame
        alt="Clinical guideline page"
        src={{ kind: "pdf-page", url: "https://example.test/guideline.pdf", page: 2, pageCount: 7 }}
        state="ready"
        controls={readyControls({ onFitWidth, onZoomChange, onViewingAidChange })}
      >
        <canvas aria-label="Clinical guideline page 2" />
      </DocumentFrame>,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Document viewing controls" });
    expect(toolbar).toHaveAttribute("data-print-hide");
    expect(screen.getByText("Page 2 of 7")).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit document to width" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Zoom out" })).toHaveClass("min-h-tap", "min-w-tap");
    expect(screen.getByRole("button", { name: "Zoom in" })).toHaveClass("min-h-tap", "min-w-tap");
    expect(screen.getByLabelText("Document zoom")).toHaveTextContent("100%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit document to width" }));
    fireEvent.click(screen.getByRole("button", { name: "Reduce document surround glare" }));

    expect(onZoomChange).toHaveBeenNthCalledWith(1, 0.85);
    expect(onZoomChange).toHaveBeenNthCalledWith(2, 1.15);
    expect(onFitWidth).toHaveBeenCalledOnce();
    expect(onViewingAidChange).toHaveBeenCalledWith(true);
  });

  it("suppresses the viewing aid while zoomed and never decorates source pixels", () => {
    render(
      <DocumentFrame
        alt="Clinical figure"
        src={{ kind: "image", url: "https://example.test/figure.png" }}
        state="ready"
        controls={readyControls({ fitWidth: false, zoom: 1.5, viewingAid: true })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- A plain image is the document-content fixture under test. */}
        <img src="https://example.test/figure.png" alt="Clinical figure" />
      </DocumentFrame>,
    );

    const frame = screen.getByTestId("document-frame");
    const content = screen.getByTestId("document-frame-content");
    const viewingAid = screen.getByRole("button", { name: "Viewing aid unavailable while zoomed" });
    expect(frame).toHaveAttribute("data-viewing-aid", "off");
    expect(viewingAid).toBeDisabled();
    expect(viewingAid).toHaveAttribute("aria-pressed", "false");
    expect(content).toHaveClass("w-full", "min-w-0", "max-w-full", "break-inside-avoid", "print:break-inside-avoid");
    expect(content.getAttribute("style") ?? "").toBe("");
    expect(content.className).not.toMatch(/(?:invert|filter|color-scheme)/);
  });
});
