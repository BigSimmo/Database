import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SignedImage backs both DocumentImage (document viewer) and SourceImage (answer
// gallery), so its failure/retry branch — untestable in the node/SSR suite because
// it lives in effects — is exercised here under jsdom. jsdom omits
// IntersectionObserver, so SignedImage loads immediately (its documented fallback),
// which lets us drive the fetch → failed → retry → recover flow directly.

// useSignedImageUrl lists authorizationHeader + markSessionExpired in its effect
// deps, so the mock must return STABLE references — a fresh object/fn per render
// would re-run the fetch effect on every state change and exhaust the one-shot
// fetch mocks below.
vi.mock("@/lib/supabase/client", () => {
  const authorizationHeader = {};
  const markSessionExpired = vi.fn();
  return { useAuthSession: () => ({ authorizationHeader, markSessionExpired }) };
});

import { SignedImage } from "@/components/clinical-dashboard/signed-image";
import { clearSignedUrlCache } from "@/lib/signed-url-cache";

const ENDPOINT = "/api/images/dom-test/signed-url";

beforeEach(() => {
  clearSignedUrlCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSignedUrlCache();
});

describe("SignedImage failure/retry (jsdom)", () => {
  it("shows a retryable failure state, then recovers when retry succeeds", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SignedImage endpoint={ENDPOINT} alt="Airway diagram" failureLabel="Image preview failed." retryLabel="Retry" />,
    );

    // The first fetch fails → failure state with a retry action.
    expect(await screen.findByText("Image preview failed.")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Retry: the next fetch resolves with a URL and the image recovers.
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: "/demo/airway.png" }) });
    await user.click(retry);

    const img = await screen.findByRole("img", { name: "Airway diagram" });
    // Private previews use unoptimized next/image, so src stays the direct URL
    // (jsdom may absolutize it) and must not be rewritten through `/_next/image`.
    const src = img.getAttribute("src") ?? "";
    expect(src.endsWith("/demo/airway.png")).toBe(true);
    expect(src).not.toContain("/_next/image");
    expect(screen.queryByText("Image preview failed.")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens the fullscreen lightbox when a loaded zoomable image is activated, and closes on Escape", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ url: "/demo/airway.png" }) }),
    );

    render(<SignedImage endpoint={ENDPOINT} alt="Airway diagram" caption="Airway" zoomable />);

    const img = await screen.findByRole("img", { name: "Airway diagram" });
    // jsdom never fires a real load event; simulate decode so `loaded` flips true.
    fireEvent.load(img);

    const expand = await screen.findByRole("button", { name: "Expand image: Airway" });
    await user.click(expand);

    expect(await screen.findByTestId("image-lightbox")).toBeInTheDocument();
    expect(screen.getByTestId("image-lightbox")).toHaveAttribute("role", "dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument());
  });

  it("uses a provided source aspect ratio instead of forcing every document crop into 4:3", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ url: "/demo/wide-table.png" }) }),
    );

    render(<SignedImage endpoint={ENDPOINT} alt="Wide table" aspectRatio={4.2} />);

    const img = await screen.findByRole("img", { name: "Wide table" });
    const frame = img.closest("div");
    expect(frame).toHaveStyle({ aspectRatio: "4.2" });
    expect(frame?.className).not.toContain("aspect-[4/3]");
  });

  it("applies the supplied aspect ratio when the signed-image request fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) }),
    );

    render(<SignedImage endpoint={ENDPOINT} alt="Wide table" aspectRatio={3.5} />);

    // Wait for the failure state to render.
    expect(await screen.findByText("Image preview could not load.")).toBeInTheDocument();

    // The error frame must use the supplied ratio, not force 4:3.
    // The outer div (with the style) contains the inner div with the text.
    const frame = screen.getByText("Image preview could not load.").closest("div")?.parentElement;
    expect(frame).toHaveStyle({ aspectRatio: "3.5" });
    expect(frame?.className).not.toContain("aspect-[4/3]");
  });
});
