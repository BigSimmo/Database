import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NonPdfSourcePreview } from "@/components/document-viewer/non-pdf-source-preview";
import { LiveAnnouncer, resetAnnouncerForTests } from "@/components/ui/live-announcer";

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "authenticated",
    session: { user: { id: "user-a" } },
    authorizationHeader: { Authorization: "Bearer user-a" },
    markSessionExpired: vi.fn(),
    registerAuthRequest: vi.fn(() => ({ epoch: 1, release: vi.fn() })),
    isAuthEpochCurrent: vi.fn(() => true),
  }),
}));

describe("DocumentViewer non-PDF image preview", () => {
  beforeEach(() => resetAnnouncerForTests());

  afterEach(() => {
    resetAnnouncerForTests();
    vi.useRealTimers();
  });

  it("opens the shared immersive lightbox from the primary expand control", async () => {
    render(
      <NonPdfSourcePreview
        fileType="image/png"
        title="Clinical chart"
        signedUrl="https://example.test/chart.png"
        downloadSignedUrl="https://example.test/chart-download.png"
      />,
    );

    expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("non-pdf-image-stage")).toHaveClass(
      "h-[clamp(16rem,60vh,36rem)]",
      "sm:h-[clamp(18rem,60vh,36rem)]",
    );
    expect(screen.getByRole("img", { name: "Clinical chart" })).toHaveClass("h-full", "w-full", "object-contain");
    fireEvent.click(screen.getByRole("button", { name: "Expand image: Clinical chart" }));
    expect(await screen.findByTestId("image-lightbox")).toBeInTheDocument();
    expect(screen.getByTestId("image-lightbox-stage")).toHaveAttribute("data-source-mode", "url");
    expect(screen.getAllByRole("img", { name: "Clinical chart" }).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "https://example.test/chart.png");
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "https://example.test/chart-download.png",
    );
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
    expect(document.querySelector('[data-preview-error="true"]')).toHaveTextContent("Image preview could not load");

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

  it("unmounts the lightbox when the parent blanks the signed URL", async () => {
    const { rerender } = render(
      <NonPdfSourcePreview
        fileType="image/png"
        title="Clinical chart"
        signedUrl="https://example.test/chart.png"
        downloadSignedUrl={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "View immersive" }));
    expect(await screen.findByTestId("image-lightbox")).toBeInTheDocument();

    rerender(
      <NonPdfSourcePreview fileType="image/png" title="Clinical chart" signedUrl={null} downloadSignedUrl={null} />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/signed URL is generated/i)).toBeInTheDocument();
  });
});
