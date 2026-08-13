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

describe("useInPageSectionNav explicit ordering", () => {
  it("does not let an incidental spy result overwrite a deliberate jump", () => {
    const { result, rerender } = renderHook(() => useInPageSectionNav(sections));

    act(() => result.current.selectSection("course-onset"));
    expect(result.current.activeId).toBe("course-onset");

    rerender();

    expect(result.current.activeId).toBe("course-onset");
    expect(navigationMocks.markActive).toHaveBeenCalledTimes(1);
  });

  it("does not treat navigation keys inside an input as scroll intent", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const { result } = renderHook(() => useInPageSectionNav(sections));

    act(() => result.current.selectSection("course-onset"));
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));

    expect(result.current.activeId).toBe("course-onset");
    input.remove();
  });
});
