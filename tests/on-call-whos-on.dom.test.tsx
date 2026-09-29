/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HospitalHandbookState } from "@/components/on-call/use-hospital-handbook";
import { handbookItems, coverItems, readyHandbook } from "./helpers/on-call-handbook-fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/whos-on",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated: true, isSaved: () => false, setFavourite: vi.fn(async () => true) }),
}));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => ({ status: "authenticated", authEpoch: 1 }) }));
const handbook = vi.hoisted(() => ({ state: null as unknown as HospitalHandbookState }));
vi.mock("@/components/on-call/use-hospital-handbook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/on-call/use-hospital-handbook")>()),
  useHospitalHandbook: () => handbook.state,
}));

const { OnCallWhosOnPage } = await import("@/components/on-call/whos-on/whos-on-page");
const { readOnCallMyTeam } = await import("@/lib/on-call/my-team-storage");

beforeEach(() => {
  window.localStorage.clear();
  handbook.state = readyHandbook([]);
});
afterEach(cleanup);

function groupHeadings(): (string | null)[] {
  return Array.from(
    screen.getByTestId("on-call-whos-on-main").querySelectorAll("section h2"),
    (node) => node.textContent,
  );
}

describe("Who's on", () => {
  it("does not imply ordinary contacts are current cover", () => {
    handbook.state = readyHandbook(
      handbookItems([{ id: "contact", title: "Medicine: Registrar", phone: "5550 0042" }]),
    );
    render(<OnCallWhosOnPage />);
    expect(screen.getByText(/Cover is unknown/)).toBeInTheDocument();
    expect(screen.queryByTestId("on-call-whos-on-row-contact")).toBeNull();
  });
  it("lists roles by team with the reader's team first, under the hospital's name, and no names", async () => {
    handbook.state = readyHandbook(
      coverItems([
        { id: "i", title: "ICU: Registrar", phone: "4456" },
        { id: "m", title: "Medicine: Registrar on call", phone: "9000 0001" },
      ]),
    );
    render(<OnCallWhosOnPage />);
    expect(screen.getByTestId("on-call-hub-hospital")).toHaveTextContent("Synthetic Hospital");
    expect(groupHeadings().slice(0, 2)).toEqual(["Medicine", "ICU"]);
    await userEvent.selectOptions(screen.getByTestId("on-call-whos-on-my-team"), "ICU");
    expect(readOnCallMyTeam()).toBe("ICU");
    expect(groupHeadings().slice(0, 2)).toEqual(["ICU", "Medicine"]);
    const medicine = screen.getByTestId("on-call-whos-on-team-Medicine");
    expect(
      within(medicine)
        .getByRole("link", { name: /^call registrar/i })
        .getAttribute("href"),
    ).toMatch(/^tel:.*90000001$/);
  });

  it("groups a team no list names, and puts rows with no team under Other", () => {
    handbook.state = readyHandbook(
      coverItems([
        { id: "o", title: "Orthopaedics: Registrar", phone: "9000 0010" },
        { id: "i", title: "ICU: Registrar", phone: "4456" },
        { id: "sw", title: "Switchboard", phone: "9000 0000" },
      ]),
    );
    render(<OnCallWhosOnPage />);
    expect(groupHeadings()).toEqual(["ICU", "Orthopaedics", "Other"]);
    expect(screen.getByTestId("on-call-whos-on-other")).toHaveTextContent("Registrar");
  });

  it("says the reader's team is not set up rather than showing an empty list", async () => {
    handbook.state = readyHandbook(coverItems([{ id: "i", title: "ICU: Registrar", phone: "4456" }]));
    render(<OnCallWhosOnPage />);
    await userEvent.selectOptions(screen.getByTestId("on-call-whos-on-my-team"), "Obstetrics");
    expect(screen.getByTestId("on-call-whos-on-my-team-empty")).toHaveTextContent("Not set up for this hospital");
  });

  it("carries no explanatory text: the Being set up stub is gone", () => {
    handbook.state = readyHandbook(coverItems([{ id: "i", title: "ICU: Registrar", phone: "4456" }]));
    render(<OnCallWhosOnPage />);
    expect(screen.queryByTestId("on-call-whos-on-being-set-up")).toBeNull();
    expect(screen.queryByText(/being built|being set up/i)).toBeNull();
  });

  it("shows the handbook's own state and the public crisis lines until its numbers are ready", () => {
    handbook.state = readyHandbook([], { status: "signed-out" });
    render(<OnCallWhosOnPage />);
    expect(screen.getByTestId("on-call-handbook-state-signed-out")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-crisis-lines")).toBeInTheDocument();
    expect(screen.queryByTestId("on-call-whos-on-my-team")).toBeNull();
  });

  it("drops the crisis lines once the hospital's numbers are on screen", () => {
    handbook.state = readyHandbook([]);
    render(<OnCallWhosOnPage />);
    expect(screen.queryByTestId("on-call-crisis-lines")).toBeNull();
  });
});
