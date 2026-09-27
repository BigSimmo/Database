/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { entriesState, items, personalReferral, ready } from "./helpers/on-call-handbook-fixture";

import type { OnCallEntry } from "@/lib/on-call/entry-model";

const handbook = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof ready> }));
const entries = vi.hoisted(() => ({ list: [] as OnCallEntry[], signedOut: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/refer",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => ({ status: "authenticated", authEpoch: 1 }) }));
vi.mock("@/components/on-call/use-hospital-handbook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/on-call/use-hospital-handbook")>()),
  useHospitalHandbook: () => handbook.state,
}));
vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => entriesState(entries.list, { signedOut: entries.signedOut }),
}));

import { OnCallReferPage } from "@/components/on-call/refer/refer-page";

beforeEach(() => {
  window.localStorage.clear();
  handbook.state = ready(items([]));
  entries.list = [];
  entries.signedOut = false;
});
afterEach(cleanup);

describe("Refer page", () => {
  it("filters referrals by team, opens detail in a sheet, and keeps the personal editor one tap away", async () => {
    handbook.state = ready(
      items([
        { id: "r1", title: "Psychiatry: Consult-liaison referral", section: "referrals" },
        { id: "r2", title: "Surgery: Acute surgical referral", section: "referrals" },
      ]),
    );
    entries.list = [personalReferral("p1", "My referral note")];
    render(<OnCallReferPage />);
    expect(within(screen.getByTestId("on-call-refer-team")).getByRole("button", { name: "All teams" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(screen.getByTestId("on-call-refer-team")).getByRole("button", { name: "Psychiatry" }));
    expect(screen.getByText("Consult-liaison referral")).toBeInTheDocument();
    expect(screen.queryByText("Acute surgical referral")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Consult-liaison referral/ }));
    const detail = screen.getByTestId("on-call-refer-detail");
    expect(within(detail).getByText("Synthetic example only")).toBeInTheDocument();
    expect(within(detail).getByTestId("on-call-updated-date")).toHaveTextContent(/^Updated 20 Sep 2026/);
    await userEvent.keyboard("{Escape}");
    expect(within(document.getElementById("on-call-group-mine")!).getByText("My referral note")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your own referrals" })).toHaveAttribute("href", "/on-call/referrals");
    expect(screen.queryByText(/being built/i)).toBeNull();
  });

  it("draws no team chips with fewer than two teams, and no search box", () => {
    handbook.state = ready(items([{ id: "r1", title: "Psychiatry: Consult-liaison referral", section: "referrals" }]));
    render(<OnCallReferPage />);
    expect(screen.queryByTestId("on-call-refer-team")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("dials a referral's number from its row", () => {
    handbook.state = ready(
      items([{ id: "r1", title: "Psychiatry: Consult-liaison referral", section: "referrals", phone: "9000 0021" }]),
    );
    render(<OnCallReferPage />);
    expect(screen.getByRole("link", { name: /^call consult-liaison referral, 9 0 0 0, 0 0 2 1$/i })).toHaveAttribute(
      "href",
      "tel:0890000021",
    );
  });

  it("shows the crisis lines and the sign-in line, and no hospital referrals, while signed out", () => {
    handbook.state = ready([], { status: "signed-out" });
    entries.signedOut = true;
    render(<OnCallReferPage />);
    expect(screen.getByTestId("on-call-handbook-state-signed-out")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-crisis-lines")).toBeInTheDocument();
    expect(document.getElementById("on-call-group-hospital")).toBeNull();
    expect(screen.getByText("Sign in to keep your own referrals.")).toBeInTheDocument();
  });
});
