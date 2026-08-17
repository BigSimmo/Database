import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TcProvider, useTcBindings } from "@/components/therapy-compass/bindings";

const navState = vi.hoisted(() => ({
  pathname: "/therapy-compass/search",
  search: "q=CBT&run=1",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
  useRouter: () => ({ push: navState.push, replace: navState.replace, prefetch: () => {} }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  navState.push.mockReset();
  navState.replace.mockReset();
});

function CompareProbe() {
  const bindings = useTcBindings();
  return (
    <button type="button" onClick={() => bindings.toggleCompare("cognitive-behavioural-therapy-cbt")}>
      Compare exact therapy
    </button>
  );
}

describe("Therapy comparison URL identity", () => {
  it("serializes the exact selected therapy slug while preserving search context", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <TcProvider>
        <CompareProbe />
      </TcProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Compare exact therapy" }));

    expect(navState.push).toHaveBeenCalledTimes(1);
    const destination = new URL(String(navState.push.mock.calls[0]?.[0]), "http://localhost");
    expect(destination.pathname).toBe("/therapy-compass/compare");
    expect(destination.searchParams.get("q")).toBe("CBT");
    expect(destination.searchParams.get("run")).toBe("1");
    expect(destination.searchParams.get("ids")).toBe("cognitive-behavioural-therapy-cbt");
  });
});
