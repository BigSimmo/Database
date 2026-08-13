import { act, cleanup, renderHook } from "@testing-library/react";
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

const TestIcon = (() => null) as PageSection["icon"];
const sections: readonly PageSection[] = [
  { id: "episode-features", label: "Episode features", icon: TestIcon },
  { id: "course-onset", label: "Course and onset", icon: TestIcon },
];

afterEach(() => {
  cleanup();
  navigationMocks.jumpToDocumentSection.mockReset();
  navigationMocks.markActive.mockReset();
  vi.restoreAllMocks();
  window.history.replaceState(window.history.state, "", window.location.pathname);
});

describe("useInPageSectionNav", () => {
  it("does not restore a stale explicit selection after popstate changes the fragment", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    window.history.replaceState(window.history.state, "", "#episode-features");

    const { result } = renderHook(() => useInPageSectionNav(sections));

    act(() => result.current.selectSection("course-onset"));
    expect(window.location.hash).toBe("#course-onset");
    expect(navigationMocks.markActive).toHaveBeenCalledTimes(1);
    expect(navigationMocks.markActive).toHaveBeenLastCalledWith("course-onset");
    expect(frames).toHaveLength(1);

    act(() => {
      window.history.replaceState(window.history.state, "", "#episode-features");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
      frames.shift()?.(0);
    });

    expect(navigationMocks.jumpToDocumentSection).toHaveBeenLastCalledWith("episode-features");
    expect(navigationMocks.markActive).toHaveBeenCalledTimes(1);
  });
});
