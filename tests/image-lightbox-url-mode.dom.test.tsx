/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageLightbox } from "@/components/clinical-dashboard/image-lightbox";
import { clearSignedUrlCache, setCachedSignedUrl } from "@/lib/signed-url-cache";

const ENDPOINT = "/api/images/lightbox-url-mode/signed-url";
const PRIOR_USER_URL = "https://example.supabase.co/storage/v1/object/sign/prior-user.png?token=stale";
const DIRECT_URL = "https://example.test/whole-document.png";

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "authenticated",
    session: { user: { id: "user-b" } },
    authorizationHeader: { Authorization: "Bearer user-b" },
    markSessionExpired: vi.fn(),
    registerAuthRequest: vi.fn(() => ({ epoch: 1, release: vi.fn() })),
    isAuthEpochCurrent: vi.fn(() => true),
  }),
}));

describe("ImageLightbox URL mode", () => {
  beforeEach(() => {
    clearSignedUrlCache();
  });

  afterEach(() => {
    clearSignedUrlCache();
  });

  it("renders a parent-owned URL without reading the signed-URL LRU", async () => {
    setCachedSignedUrl(ENDPOINT, { url: PRIOR_USER_URL, expiresAt: new Date(Date.now() + 60_000).toISOString() });

    render(<ImageLightbox open onClose={vi.fn()} url={DIRECT_URL} alt="Whole document chart" caption="Chart" />);

    const stage = await screen.findByTestId("image-lightbox-stage");
    expect(stage).toHaveAttribute("data-source-mode", "url");
    const image = screen.getByRole("img", { name: "Whole document chart" });
    expect(image).toHaveAttribute("src", DIRECT_URL);
    expect(image).not.toHaveAttribute("src", PRIOR_USER_URL);
  });

  it("blanks the stage when the parent clears the direct URL while open", async () => {
    const { rerender } = render(<ImageLightbox open onClose={vi.fn()} url={DIRECT_URL} alt="Whole document chart" />);
    expect(screen.getByRole("img", { name: "Whole document chart" })).toBeInTheDocument();

    // Parent auth-clear: signed URL gone. URL mode must not revive PRIOR_USER_URL from LRU.
    setCachedSignedUrl(ENDPOINT, { url: PRIOR_USER_URL, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    rerender(<ImageLightbox open onClose={vi.fn()} url="" alt="Whole document chart" />);

    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "Whole document chart" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Loading image");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("announces load failure with role=alert and retries without endpoint fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ImageLightbox open onClose={vi.fn()} url={DIRECT_URL} alt="Broken chart" />);

    fireEvent.error(screen.getByRole("img", { name: "Broken chart" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Image could not load.");
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("img", { name: "Broken chart" })).toHaveAttribute("src", DIRECT_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
