import { act, cleanup, renderHook } from "@testing-library/react";
import { Circle } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";

const navigationMocks = vi.hoisted(() => ({
  jumpToDocumentSection: vi.fn(),
  markActive: vi.fn(),
}));

vi.mock("@/components/document-viewer/section-nav", () => ({
  jumpToDocumentSection: navigationMocks.jumpToDocumentSection,
}));

vi.mock("@/components/document-viewer/use-section-spy", () => ({
  useDocumentSectionSpy: () => ({
    activeId: "episode-features",
    selectSection: navigationMocks.markActive,
  }),
}));

vi.mock("@/components/in-page-nav/use-resolved-page-sections", () => ({
  useResolvedPageSections: (declared: readonly PageSection[]) => [...declared],
}));

const sections: readonly PageSection[] = [
  { id: "episode-features", label: "Episode features", icon: Circle },
  { id: "course-onset", label: "Course and onset", icon: Circle },
];

afterEach(() => {
  cleanup();
  navigationMocks.jumpToDocumentSection.mockReset();
  navigationMocks.markActive.mockReset();
  vi.restoreAllMocks();
  window.history.replaceState(window.history.state, "", window.location.pathname);
});

describe("useInPageSectionNav frame ordering", () => {
  it("reasserts an explicit selection after the jump-triggered spy frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const { result } = renderHook(() => useInPageSectionNav(sections));

    act(() => result.current.selectSection("course-onset"));
    expect(navigationMocks.markActive).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);

    act(() => frames.shift()?.(0));
    expect(frames).toHaveLength(1);

    navigationMocks.markActive("episode-features");
    act(() => frames.shift()?.(16));

    expect(navigationMocks.markActive).toHaveBeenCalledTimes(3);
    expect(navigationMocks.markActive).toHaveBeenNthCalledWith(2, "episode-features");
    expect(navigationMocks.markActive).toHaveBeenLastCalledWith("course-onset");
  });
});
