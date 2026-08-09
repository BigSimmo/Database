import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reading-mode key bindings for the PDF viewer.
 *
 * Contract in `docs/wiring-conventions.md` § "Keyboard wiring: the PDF reader".
 * Every binding is a second route to a control that also exists in the
 * DocumentFrame toolbar, so these tests assert the callbacks the toolbar uses
 * are the ones the keyboard reaches — not that the viewer grew private state.
 */

const PAGE_COUNT = 12;

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: PAGE_COUNT,
      getPage: () =>
        Promise.resolve({
          getViewport: ({ scale = 1 }: { scale?: number }) => ({ width: 595 * scale, height: 842 * scale }),
          render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
          cleanup: () => {},
        }),
    }),
    destroy: () => Promise.resolve(),
  }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ setTransform: () => {}, imageSmoothingEnabled: false }) as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("requestIdleCallback", () => 1);
  vi.stubGlobal("cancelIdleCallback", () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderReader(overrides: Record<string, unknown> = {}) {
  const { PdfCanvasViewer } = await import("@/components/document-viewer/pdf-canvas-viewer");
  const handlers = {
    onPageChange: vi.fn(),
    onFitWidthChange: vi.fn(),
    onZoomChange: vi.fn(),
    onRotate: vi.fn(),
  };

  await act(async () => {
    render(
      <PdfCanvasViewer
        url="https://storage.test/source.pdf?token=abc"
        title="Synthetic monitoring protocol"
        initialPage={5}
        fitWidth={false}
        zoom={1}
        rotation={0}
        {...handlers}
        {...overrides}
      />,
    );
  });

  const holder = await screen.findByTestId("pdf-canvas-scroll");
  await waitFor(() => expect(screen.getAllByTestId("pdf-page-slot").length).toBe(PAGE_COUNT));
  return { holder, handlers };
}

describe("PDF reader keyboard bindings", () => {
  it("changes pages with both the arrow keys and Page Up / Page Down", async () => {
    const { holder, handlers } = await renderReader();

    fireEvent.keyDown(holder, { key: "PageDown" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(6);

    fireEvent.keyDown(holder, { key: "PageUp" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(5);

    fireEvent.keyDown(holder, { key: "ArrowRight" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(6);

    fireEvent.keyDown(holder, { key: "ArrowLeft" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(5);
  });

  it("jumps to the first and last page with Home and End", async () => {
    const { holder, handlers } = await renderReader();

    fireEvent.keyDown(holder, { key: "Home" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(1);

    fireEvent.keyDown(holder, { key: "End" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(PAGE_COUNT);
  });

  it("never runs past either end of the document", async () => {
    const { holder, handlers } = await renderReader({ initialPage: 1 });

    fireEvent.keyDown(holder, { key: "PageUp" });
    fireEvent.keyDown(holder, { key: "ArrowLeft" });
    expect(handlers.onPageChange).not.toHaveBeenCalled();

    fireEvent.keyDown(holder, { key: "End" });
    fireEvent.keyDown(holder, { key: "PageDown" });
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(PAGE_COUNT);
  });

  it("fits the width from both 0 and F", async () => {
    const { holder, handlers } = await renderReader();

    fireEvent.keyDown(holder, { key: "0" });
    expect(handlers.onFitWidthChange).toHaveBeenLastCalledWith(true);

    handlers.onFitWidthChange.mockClear();
    fireEvent.keyDown(holder, { key: "f" });
    expect(handlers.onFitWidthChange).toHaveBeenLastCalledWith(true);

    handlers.onFitWidthChange.mockClear();
    fireEvent.keyDown(holder, { key: "F" });
    expect(handlers.onFitWidthChange).toHaveBeenLastCalledWith(true);
  });

  it("rotates through the frame's own callback rather than private viewer state", async () => {
    const { holder, handlers } = await renderReader();

    fireEvent.keyDown(holder, { key: "r" });
    fireEvent.keyDown(holder, { key: "R" });

    // Rotation stays owned by DocumentFrame — one toolbar, one source of truth.
    expect(handlers.onRotate).toHaveBeenCalledTimes(2);
  });

  it("leaves R inert, not swallowed, when no rotate handler was supplied", async () => {
    const { holder } = await renderReader({ onRotate: undefined });

    const event = new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true });
    holder.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("zooms with plus and minus", async () => {
    const { holder, handlers } = await renderReader();

    fireEvent.keyDown(holder, { key: "=" });
    const zoomedIn = handlers.onZoomChange.mock.calls.at(-1)?.[0] as number;
    expect(zoomedIn).toBeGreaterThan(1);

    fireEvent.keyDown(holder, { key: "-" });
    const zoomedOut = handlers.onZoomChange.mock.calls.at(-1)?.[0] as number;
    expect(zoomedOut).toBeLessThan(zoomedIn);
  });

  it("never intercepts a modified keystroke", async () => {
    const { holder, handlers } = await renderReader();

    // Ctrl/Cmd+0 is the browser's own zoom reset and Cmd+Left is history back on
    // macOS. A reader that lost either to the viewer is worse off than one with
    // no bindings at all.
    fireEvent.keyDown(holder, { key: "0", ctrlKey: true });
    fireEvent.keyDown(holder, { key: "0", metaKey: true });
    fireEvent.keyDown(holder, { key: "ArrowLeft", metaKey: true });
    fireEvent.keyDown(holder, { key: "r", ctrlKey: true });

    expect(handlers.onFitWidthChange).not.toHaveBeenCalled();
    expect(handlers.onPageChange).not.toHaveBeenCalled();
    expect(handlers.onRotate).not.toHaveBeenCalled();
  });

  it("ignores keystrokes aimed at a control inside the holder", async () => {
    const { holder, handlers } = await renderReader();

    // Typing in a child (the retry button, a source link) must not be hijacked.
    const child = holder.querySelector("[data-testid='pdf-page-slot']");
    expect(child).toBeTruthy();
    fireEvent.keyDown(child!, { key: "PageDown", bubbles: true });

    expect(handlers.onPageChange).not.toHaveBeenCalled();
  });

  it("names its bindings in the holder's accessible label", async () => {
    const { holder } = await renderReader();

    const label = holder.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/Page Up and Page Down/);
    expect(label).toMatch(/Home and End/);
    expect(label).toMatch(/F fits the width/);
    expect(label).toMatch(/R rotates/);
  });
});
