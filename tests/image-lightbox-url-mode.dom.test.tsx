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

/**
 * View controls and transform wiring.
 *
 * jsdom performs no layout, so `naturalWidth` and the stage rect are both zero
 * and the lightbox stays at its identity view. That is exactly the property
 * worth pinning here — the transform must degrade to today's behaviour rather
 * than emit NaN — while the numeric rotation/scale/clamp maths is proven against
 * real measurements in `tests/image-lightbox-geometry.test.ts`.
 */
describe("ImageLightbox view controls", () => {
  const openLightbox = () =>
    render(<ImageLightbox open onClose={vi.fn()} url={DIRECT_URL} alt="Wide table" caption="Table" />);

  it("puts the controls in the sheet footer rather than over the image", async () => {
    openLightbox();
    const stage = await screen.findByTestId("image-lightbox-stage");

    for (const label of ["Zoom out", "Zoom in", "Reset zoom", "Rotate image 90 degrees"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    // Floating over the stage was what occluded the bottom rows of a table and
    // forced the pointer-events/stopPropagation workaround.
    expect(stage.contains(screen.getByRole("button", { name: "Zoom in" }))).toBe(false);
  });

  it("never emits a NaN transform when nothing has been measured", async () => {
    openLightbox();
    const image = await screen.findByRole("img", { name: "Wide table" });
    fireEvent.load(image);

    const transform = image.style.transform;
    expect(transform).not.toContain("NaN");
    expect(transform).toBe("translate(0px, 0px) scale(1) rotate(0deg)");
  });

  it("rotates in quarter turns and reports zoom relative to the fitted image", async () => {
    openLightbox();
    const image = await screen.findByRole("img", { name: "Wide table" });
    fireEvent.load(image);

    fireEvent.click(screen.getByRole("button", { name: "Rotate image 90 degrees" }));
    expect(image.style.transform).toContain("rotate(90deg)");
    expect(image.style.transform).not.toContain("NaN");

    // 100% means "the whole image, fitted, in the current orientation" — the one
    // rule the readout, the reset button and the pan clamp all share.
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");
  });

  it("returns to the whole image from the percentage control", async () => {
    openLightbox();
    const image = await screen.findByRole("img", { name: "Wide table" });
    fireEvent.load(image);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).not.toHaveTextContent("100%");

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");
    expect(image.style.transform).toContain("translate(0px, 0px)");
  });

  it("never zooms out past the whole image", async () => {
    openLightbox();
    fireEvent.load(await screen.findByRole("img", { name: "Wide table" }));

    for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");
  });

  it("converts double-tap client coordinates into stage-local anchors", async () => {
    // performance.now drives the double-tap window (Event.timeStamp is read-only 0).
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    openLightbox();
    const stage = await screen.findByTestId("image-lightbox-stage");
    const image = await screen.findByRole("img", { name: "Wide table" });

    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1520 });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 720 });
    const stageRect = {
      x: 80,
      y: 160,
      left: 80,
      top: 160,
      width: 400,
      height: 700,
      right: 480,
      bottom: 860,
      toJSON() {
        return {};
      },
    } as DOMRect;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue(stageRect);

    fireEvent.load(image);
    // Opening scale for this wide crop is >1; reset to fit so double-tap zooms in.
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");

    const tap = (clientX: number, clientY: number, pointerId: number) => {
      fireEvent.pointerDown(stage, {
        pointerId,
        pointerType: "touch",
        isPrimary: true,
        clientX,
        clientY,
      });
      fireEvent.pointerUp(stage, {
        pointerId,
        pointerType: "touch",
        isPrimary: true,
        clientX,
        clientY,
      });
    };

    // Viewport point (280, 360) → stage-local (200, 200). If client coords were
    // passed through unchanged, zoomAboutPoint would treat (280,360) as stage
    // and the translate would differ.
    clock = 1000;
    tap(280, 360, 1);
    clock = 1150;
    tap(280, 360, 2);

    const { zoomAboutPoint, legibleOpenScale } =
      await import("@/components/clinical-dashboard/image-lightbox-geometry");
    const geometry = {
      stage: { width: 400, height: 700 },
      natural: { width: 1520, height: 720 },
    };
    const targetScale = Math.max(legibleOpenScale(geometry, 0), 2);
    const expected = zoomAboutPoint({
      geometry,
      rotation: 0,
      scale: 1,
      translate: { x: 0, y: 0 },
      nextScale: targetScale,
      point: { x: 200, y: 200 },
    });
    const wrong = zoomAboutPoint({
      geometry,
      rotation: 0,
      scale: 1,
      translate: { x: 0, y: 0 },
      nextScale: targetScale,
      point: { x: 280, y: 360 },
    });
    expect(expected.translate).not.toEqual(wrong.translate);

    const transform = image.style.transform;
    expect(transform).toContain(`translate(${expected.translate.x}px, ${expected.translate.y}px)`);
    expect(transform).not.toContain(`translate(${wrong.translate.x}px, ${wrong.translate.y}px)`);
  });
});
