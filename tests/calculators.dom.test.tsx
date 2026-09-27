/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

import { CalculatorsSearchPage } from "@/components/calculators/search-page";

beforeEach(() => {
  navigation.push.mockReset();
  navigation.searchParams = new URLSearchParams();
  Element.prototype.scrollTo = vi.fn();
});

describe("CalculatorsSearchPage search params preservation", () => {
  it("preserves q and other search query parameters when opening a calculator", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams("q=depression&filter=all&domain=mood");

    render(<CalculatorsSearchPage initialQuery="depression" />);

    const openButton = screen.getByRole("button", { name: /Open PHQ-9/i });
    await user.click(openButton);

    expect(navigation.push).toHaveBeenCalledTimes(1);
    const pushedUrl = navigation.push.mock.lastCall?.[0];
    expect(pushedUrl).toContain("/calculators/search?");

    const params = new URLSearchParams(pushedUrl.replace("/calculators/search?", ""));
    expect(params.get("q")).toBe("depression");
    expect(params.get("filter")).toBe("all");
    expect(params.get("domain")).toBe("mood");
    expect(params.get("calculator")).toBe("phq9");
  });

  it("deletes 'calculator' but preserves 'q' and other query parameters when closing", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams("q=depression&filter=all&calculator=phq9");

    render(<CalculatorsSearchPage initialQuery="depression" initialCalculatorId="phq9" />);

    const dialog = screen.getByRole("dialog", { name: "PHQ-9 calculator" });
    const closeButton = within(dialog).getByRole("button", { name: /^Close$/ });
    await user.click(closeButton);

    expect(navigation.push).toHaveBeenCalledTimes(1);
    const pushedUrl = navigation.push.mock.lastCall?.[0];
    const params = new URLSearchParams(pushedUrl.replace("/calculators/search?", ""));
    expect(params.get("calculator")).toBeNull();
    expect(params.get("q")).toBe("depression");
    expect(params.get("filter")).toBe("all");
  });

  it("deletes 'calculator' and preserves parameters on Escape dismissal", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams("q=anxiety&custom=123&calculator=gad7");

    render(<CalculatorsSearchPage initialQuery="anxiety" initialCalculatorId="gad7" />);

    expect(screen.getByRole("dialog", { name: "GAD-7 calculator" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(navigation.push).toHaveBeenCalledTimes(1);
    const pushedUrl = navigation.push.mock.lastCall?.[0];
    const params = new URLSearchParams(pushedUrl.replace("/calculators/search?", ""));
    expect(params.get("calculator")).toBeNull();
    expect(params.get("q")).toBe("anxiety");
    expect(params.get("custom")).toBe("123");
  });
});
