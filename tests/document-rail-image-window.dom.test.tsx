import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each row mounts a SignedImage, which reads the auth session. Stable references
// on purpose: useSignedImageUrl lists them in its effect deps, so a fresh object
// per render would re-run the fetch effect on every window growth.
vi.mock("@/lib/supabase/client", () => {
  const authorizationHeader = {};
  const markSessionExpired = vi.fn();
  const registerAuthRequest = vi.fn(() => ({ epoch: 1, release: vi.fn() }));
  const isAuthEpochCurrent = vi.fn(() => true);
  return {
    useAuthSession: () => ({
      authorizationHeader,
      markSessionExpired,
      session: null,
      registerAuthRequest,
      isAuthEpochCurrent,
    }),
  };
});

import { DocumentImageList, RAIL_IMAGE_WINDOW } from "@/components/document-viewer/source-panels";
import type { ImageRow } from "@/components/document-viewer/types";

/**
 * Windowing for the document rail's figure cards.
 *
 * A `DocumentImage` is an expensive row — table-markdown parsing, structured
 * table feasibility, quality warnings, evidence tags, and a `SignedImage` frame
 * — and a long guideline mounted every one of them on hydration.
 *
 * ## What this test can and cannot establish about signed-URL fetches
 *
 * The Phase 3 brief says collapsed audit rows "still mint signed URLs". That is
 * a claim about a real browser, and it cannot be settled here: `SignedImage`
 * defers its fetch behind an `IntersectionObserver`, a closed `<details>` is
 * `display: none`, and jsdom performs no layout, so nothing in this environment
 * decides whether such an element ever intersects. What IS decidable, and is
 * asserted below, is the row-mounting cost — which is real whether the section
 * is open or shut, and is what the window removes.
 */

const image = (index: number): ImageRow =>
  ({
    id: `image-${index}`,
    page_number: index + 1,
    caption: `Figure ${index + 1}`,
    image_type: "table",
    labels: [],
  }) as unknown as ImageRow;

const images = (count: number, start = 0) => Array.from({ length: count }, (_, index) => image(start + index));

type SentinelObserver = { callback: IntersectionObserverCallback; targets: Element[] };
let sentinelObservers: SentinelObserver[] = [];

beforeEach(() => {
  sentinelObservers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private readonly record: SentinelObserver;

      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, targets: [] };
        sentinelObservers.push(this.record);
      }
      observe(target: Element) {
        this.record.targets.push(target);
      }
      unobserve(target: Element) {
        this.record.targets = this.record.targets.filter((element) => element !== target);
      }
      // Disconnected observers must actually stop firing, or a stale sentinel
      // from the previous window would grow the list a second time per scroll.
      disconnect() {
        sentinelObservers = sentinelObservers.filter((record) => record !== this.record);
      }
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Fire every live sentinel observer as though it had scrolled into view. */
function reachSentinel() {
  for (const record of [...sentinelObservers]) {
    if (record.targets.length === 0) continue;
    const entries = record.targets.map((target) => ({
      target,
      isIntersecting: true,
    })) as unknown as IntersectionObserverEntry[];
    record.callback(entries, {} as IntersectionObserver);
  }
}

const renderedRows = () => screen.queryAllByTestId("document-image").length;

/**
 * A list long enough that the window always applies, expressed against the
 * window rather than as a literal.
 *
 * Every count below is derived from `RAIL_IMAGE_WINDOW`. Tuning the window from
 * 6 to 8 is a product judgement about how much of a figure rail is worth
 * mounting up front — it is not a regression, and it should not turn five
 * assertions red.
 */
const LONG_LIST = RAIL_IMAGE_WINDOW * 6 + 4;

describe("document rail figure windowing", () => {
  it("mounts only the first window of rows for a long figure list", () => {
    render(<DocumentImageList images={images(LONG_LIST)} revealLabel="Tables and diagrams" />);

    expect(renderedRows()).toBe(RAIL_IMAGE_WINDOW);
    expect(screen.getByTestId("document-image-reveal")).toBeTruthy();
  });

  it("mounts a short list whole, with no sentinel and no reveal control", () => {
    // The overwhelming majority of indexed documents are this case, so the
    // window must not add chrome to them.
    const shortList = RAIL_IMAGE_WINDOW - 2;
    render(<DocumentImageList images={images(shortList)} revealLabel="Tables and diagrams" />);

    expect(renderedRows()).toBe(shortList);
    expect(screen.queryByTestId("document-image-reveal")).toBeNull();
  });

  it("grows by one window each time the sentinel is reached", () => {
    render(<DocumentImageList images={images(LONG_LIST)} revealLabel="Tables and diagrams" />);

    act(() => reachSentinel());
    expect(renderedRows()).toBe(RAIL_IMAGE_WINDOW * 2);

    act(() => reachSentinel());
    expect(renderedRows()).toBe(RAIL_IMAGE_WINDOW * 3);
  });

  it("reveals the whole list from its control, for readers who never scroll it", () => {
    // Scroll-driven growth is unreachable by keyboard and by a screen reader
    // walking the rail, so the control is the real affordance rather than a
    // no-IntersectionObserver fallback.
    render(<DocumentImageList images={images(LONG_LIST)} revealLabel="Tables and diagrams" />);

    const reveal = screen.getByRole("button", { name: /show the remaining \d+/i });
    fireEvent.click(reveal);

    expect(renderedRows()).toBe(LONG_LIST);
    expect(screen.queryByTestId("document-image-reveal")).toBeNull();
  });

  it("clamps the window when the list shrinks underneath an expanded reader", () => {
    // Navigating to another document, or a reindex, can replace the array while
    // the reader has already expanded past the new length.
    const { rerender } = render(<DocumentImageList images={images(LONG_LIST)} revealLabel="Tables and diagrams" />);
    fireEvent.click(screen.getByRole("button", { name: /show the remaining \d+/i }));
    expect(renderedRows()).toBe(LONG_LIST);

    const shrunk = RAIL_IMAGE_WINDOW - 3;
    rerender(<DocumentImageList images={images(shrunk)} revealLabel="Tables and diagrams" />);

    expect(renderedRows()).toBe(shrunk);
    expect(screen.queryByTestId("document-image-reveal")).toBeNull();
  });

  it("renders nothing at all for an empty list", () => {
    render(<DocumentImageList images={[]} revealLabel="Tables and diagrams" />);

    expect(renderedRows()).toBe(0);
    expect(screen.queryByTestId("document-image-reveal")).toBeNull();
  });

  it("resets the window when remounted for another document's long list", () => {
    const { rerender } = render(
      <DocumentImageList key="doc-a:clinical" images={images(LONG_LIST)} revealLabel="Tables and diagrams" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show the remaining \d+/i }));
    expect(renderedRows()).toBe(LONG_LIST);

    rerender(
      <DocumentImageList key="doc-b:clinical" images={images(LONG_LIST, 100)} revealLabel="Tables and diagrams" />,
    );

    expect(renderedRows()).toBe(RAIL_IMAGE_WINDOW);
    expect(screen.getByTestId("document-image-reveal")).toBeTruthy();
  });
});
