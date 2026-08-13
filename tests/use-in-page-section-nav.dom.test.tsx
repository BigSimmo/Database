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

describe("useInPageSectionNav", () => {
  it("keeps an explicit jump selected until the reader starts scrolling", () => {
    const { result } = renderHook(() => useInPageSectionNav(sections));

    act(() => result.current.selectSection("course-onset"));

    expect(result.current.activeId).toBe("course-onset");
    expect(window.location.hash).toBe("#course-onset");
    expect(navigationMocks.markActive).toHaveBeenLastCalledWith("course-onset");
    expect(navigationMocks.jumpToDocumentSection).toHaveBeenLastCalledWith("course-onset");

    act(() => window.dispatchEvent(new Event("scroll")));
    expect(result.current.activeId).toBe("course-onset");

    act(() => window.dispatchEvent(new Event("wheel")));
    expect(result.current.activeId).toBe("episode-features");
  });

  it("replaces an explicit selection when browser history changes the fragment", () => {
    const { result } = renderHook(() => useInPageSectionNav(sections));

    act(() => result.current.selectSection("course-onset"));
    expect(result.current.activeId).toBe("course-onset");

    act(() => {
      window.history.replaceState(window.history.state, "", "#episode-features");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });

    expect(result.current.activeId).toBe("episode-features");
    expect(navigationMocks.markActive).toHaveBeenLastCalledWith("episode-features");
    expect(navigationMocks.jumpToDocumentSection).toHaveBeenLastCalledWith("episode-features");
  });
});
