import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NonPdfSourcePreview } from "@/components/document-viewer/non-pdf-source-preview";

const announce = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/live-announcer", () => ({ announce }));

describe("DocumentViewer non-PDF image preview", () => {
  beforeEach(() => announce.mockClear());

  it("announces each new failure assertively once and keeps retry operable", async () => {
    const user = userEvent.setup();
    const props = {
      fileType: "image/png",
      title: "Clinical chart",
      signedUrl: "https://example.test/chart.png",
      downloadSignedUrl: "https://example.test/chart-download.png",
    };
    const { rerender } = render(<NonPdfSourcePreview {...props} />);

    fireEvent.error(screen.getByRole("img", { name: "Clinical chart" }));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Image preview could not load", { priority: "assertive" });

    rerender(<NonPdfSourcePreview {...props} />);
    expect(announce).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Retry image preview" }));
    const retriedImage = screen.getByRole("img", { name: "Clinical chart" });
    expect(retriedImage).toBeInTheDocument();

    fireEvent.error(retriedImage);
    expect(announce).toHaveBeenCalledTimes(2);
  });
});
