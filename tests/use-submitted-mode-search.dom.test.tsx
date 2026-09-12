import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSubmittedModeSearch } from "@/components/clinical-dashboard/use-submitted-mode-search";

describe("submitted mode search state", () => {
  it("retains the submitted query when initial composer props change and clears it explicitly", () => {
    const { result, rerender } = renderHook(
      ({ initialQuery }) =>
        useSubmittedModeSearch({ autoRunSearch: true, initialQuery, initialSearchMode: "documents" }),
      { initialProps: { initialQuery: "  original search  " } },
    );
    expect(result.current.submittedModeQuery).toBe("original search");
    rerender({ initialQuery: "an unsubmitted draft" });
    expect(result.current.submittedModeQuery).toBe("original search");
    act(() => result.current.setModeSearchSubmitted(true, "  next submission  "));
    expect(result.current.submittedModeQuery).toBe("next submission");
    expect(result.current.modeSearchSubmitted).toBe(true);
    act(() => result.current.setModeSearchSubmitted(false));
    expect(result.current.submittedModeQuery).toBeNull();
    expect(result.current.modeSearchSubmitted).toBe(false);
  });

  it("does not seed a submitted result for tools", () => {
    const { result } = renderHook(() =>
      useSubmittedModeSearch({ autoRunSearch: true, initialQuery: "query", initialSearchMode: "tools" }),
    );
    expect(result.current.modeSearchSubmitted).toBe(false);
    expect(result.current.submittedModeQuery).toBeNull();
  });
});
