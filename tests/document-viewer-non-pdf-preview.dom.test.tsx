import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NonPdfSourcePreview } from "@/components/document-viewer/non-pdf-source-preview";
import { LiveAnnouncer, resetAnnouncerForTests } from "@/components/ui/live-announcer";

describe("DocumentViewer non-PDF image preview", () => {
  beforeEach(() => resetAnnouncerForTests());

  afterEach(() => {
    resetAnnouncerForTests();
    vi.useRealTimers();
  });

  it("observably announces sub-second fail-retry-fail transitions while same-state rerenders stay silent", () => {
    vi.useFakeTimers();
    const props = {
      fileType: "image/png",
      title: "Clinical chart",
      signedUrl: "https://example.test/chart.png",
      downloadSignedUrl: "https://example.test/chart-download.png",
    };
    const tree = (
      <>
        <LiveAnnouncer />
        <NonPdfSourcePreview {...props} />
      </>
    );
    const { rerender } = render(tree);
    const assertiveRegion = screen.getByTestId("live-announcer-assertive");

    fireEvent.error(screen.getByRole("img", { name: "Clinical chart" }));
    expect(assertiveRegion).toHaveTextContent("Image preview could not load");
    expect(screen.getByRole("alert")).toHaveTextContent("Image preview could not load");

    // A rerender of the same failed transition is not a new event and must not
    // queue a clear/set cycle.
    rerender(tree);
    act(() => vi.advanceTimersByTime(149));
    expect(assertiveRegion).toHaveTextContent("Image preview could not load");

    fireEvent.click(screen.getByRole("button", { name: "Retry image preview" }));
    const retriedImage = screen.getByRole("img", { name: "Clinical chart" });
    expect(retriedImage).toBeInTheDocument();

    fireEvent.error(retriedImage);

    // The first event's 150 ms queue gap elapses. A distinct second failure
    // must now clear the identical text before restoring it so aria-live sees a
    // real DOM mutation even though the spoken wording is unchanged.
    act(() => vi.advanceTimersByTime(1));
    expect(assertiveRegion).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(50));
    expect(assertiveRegion).toHaveTextContent("Image preview could not load");
  });
});
