/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { entriesState, items, personalContact, ready } from "./helpers/on-call-handbook-fixture";

import type { OnCallEntry } from "@/lib/on-call/entry-model";

const handbook = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof ready> }));
const entries = vi.hoisted(() => ({ list: [] as OnCallEntry[], signedOut: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/call",
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

import {
  onCallDidntConnectStorageKey,
  onCallHospitalPhoneStorageKey,
  withHospitalPhone,
} from "@/components/on-call/call/call-device-stores";
import { onCallCallGroups } from "@/components/on-call/call/call-groups";
import { OnCallCallPage } from "@/components/on-call/call/call-page";
import { clearOnCallDeviceState } from "@/lib/on-call/device-state-keys";
import { ISOBAR_SOURCE } from "@/lib/on-call/isobar-source";
import { resolveHandbookPhone } from "@/lib/on-call/number-resolver";

beforeEach(() => {
  window.localStorage.clear();
  handbook.state = ready(items([]));
  entries.list = [];
  entries.signedOut = false;
});
afterEach(cleanup);

describe("Call page", () => {
  it("groups the hospital's numbers by department, wards, outside lines and the reader's own, under the hospital's name", () => {
    handbook.state = ready(
      items([
        { id: "sw", title: "Switchboard", phone: "9000 0000" },
        { id: "w", title: "Ward: Synthetic ward 4B", phone: "4401" },
        { id: "i", title: "ICU: Registrar", phone: "4456" },
      ]),
    );
    entries.list = [personalContact("p1", "My consultant", "0400 000 111")];
    render(<OnCallCallPage />);
    expect(screen.getByTestId("on-call-hospital-line")).toHaveTextContent("Site A");
    for (const slug of ["hospital", "icu", "wards", "general", "external", "mine"]) {
      expect(document.getElementById(`on-call-group-${slug}`), slug).not.toBeNull();
    }
    expect(within(document.getElementById("on-call-group-wards")!).getByText("Synthetic ward 4B")).toBeInTheDocument();
    expect(within(document.getElementById("on-call-group-mine")!).getByText("My consultant")).toBeInTheDocument();
    expect(
      within(document.getElementById("on-call-group-mine")!).getByRole("link", { name: "Your own numbers" }),
    ).toHaveAttribute("href", "/on-call/contacts");
    expect(screen.queryByText(/being built/i)).toBeNull();
  });

  it("orders Emergency, then departments, then Wards, then General with Switchboard first", () => {
    const groups = onCallCallGroups(
      items([
        { id: "g", title: "Interpreter service", phone: "9000 0050" },
        { id: "sw", title: "Switchboard", phone: "9000 0000" },
        { id: "w", title: "Ward: Synthetic ward 4B", phone: "4401" },
        { id: "s", title: "Surgery: Registrar", phone: "9000 0015" },
        { id: "m", title: "Medicine: Registrar", phone: "9000 0012" },
        { id: "e", title: "Emergency: Synthetic emergency line", phone: "55" },
      ]),
    );
    expect(groups.map((group) => group.label)).toEqual(["Emergency", "Medicine", "Surgery", "Wards", "General"]);
    expect(groups.at(-1)?.items.map((item) => item.id)).toEqual(["sw", "g"]);
  });

  it("dials an 8-digit hospital number with 08 and shows a short one as desk-only", () => {
    handbook.state = ready(
      items([
        { id: "sw", title: "Switchboard", phone: "9000 0000" },
        { id: "i", title: "ICU: Registrar", phone: "4456" },
      ]),
    );
    render(<OnCallCallPage />);
    expect(screen.getByRole("link", { name: /^call switchboard, 9 0 0 0, 0 0 0 0$/i })).toHaveAttribute(
      "href",
      "tel:0890000000",
    );
    const icu = screen.getByTestId("on-call-call-row-i");
    expect(within(icu).getByText("From a hospital phone")).toBeInTheDocument();
    expect(within(icu).queryByRole("link", { name: /^call/i })).toBeNull();
  });

  it("pins the quiet red dot only on a site-named clinical emergency row", () => {
    handbook.state = ready(
      items([
        { id: "e1", title: "Emergency: Synthetic emergency line", phone: "55", kind: "clinical" },
        { id: "e2", title: "Emergency: Synthetic other line", phone: "56", kind: "operational" },
      ]),
    );
    render(<OnCallCallPage />);
    expect(screen.getByTestId("on-call-call-row-e1-emergency-dot")).toBeInTheDocument();
    expect(screen.queryByTestId("on-call-call-row-e2-emergency-dot")).toBeNull();
  });

  it("gives a short extension a call disc only while the hospital-phone switch is on", async () => {
    handbook.state = ready(items([{ id: "i", title: "ICU: Registrar", phone: "4456" }]));
    render(<OnCallCallPage />);
    const icu = () => screen.getByTestId("on-call-call-row-i");
    expect(within(icu()).queryByRole("link", { name: /^call/i })).toBeNull();
    const toggle = screen.getByRole("switch", { name: "I'm on a hospital phone" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await userEvent.click(toggle);
    expect(window.localStorage.getItem(onCallHospitalPhoneStorageKey)).toBe("1");
    expect(within(icu()).getByRole("link", { name: /^call registrar/i })).toHaveAttribute("href", "tel:4456");

    await userEvent.click(screen.getByRole("switch", { name: "I'm on a hospital phone" }));
    expect(within(icu()).queryByRole("link", { name: /^call/i })).toBeNull();
  });

  it("never gives a long number or a free-text number a different dial through the switch", () => {
    const direct = resolveHandbookPhone("9000 0012");
    const text = resolveHandbookPhone("ask switchboard");
    expect(withHospitalPhone(direct, true)).toBe(direct);
    expect(withHospitalPhone(text, true)).toBe(text);
    expect(withHospitalPhone(resolveHandbookPhone("4456"), false).tel).toBeNull();
  });

  it("shows every outside line in the outside form, with its area, source and date", () => {
    render(<OnCallCallPage />);
    const external = document.getElementById("on-call-group-external")!;
    const dates = within(external).getAllByTestId("on-call-updated-date");
    expect(dates.length).toBeGreaterThan(0);
    expect(dates[0].textContent).toMatch(/^Updated \d{1,2} [A-Z][a-z]{2} \d{4}/);
    expect(within(external).getAllByRole("link", { name: /Health Service|Hospital/ })[0]).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\//),
    );
    expect(external).toHaveTextContent("Perth metropolitan area and Peel");
    expect(external).toHaveTextContent("1300 555 788");
  });

  it("reports a handbook number with one of two fixed reasons, once, and never offers free text", async () => {
    handbook.state = ready(items([{ id: "i", title: "ICU: Registrar", phone: "4456" }]));
    render(<OnCallCallPage />);
    await userEvent.click(screen.getByTestId("on-call-didnt-connect-i"));
    const sheet = screen.getByRole("dialog", { name: "Didn't connect" });
    expect(within(sheet).queryByRole("textbox")).toBeNull();
    expect(
      within(sheet).getAllByRole("button", { name: /Number not in service|Reaches the wrong department/ }),
    ).toHaveLength(2);
    expect(within(sheet).queryByRole("button", { name: /no answer/i })).toBeNull();
    await userEvent.click(within(sheet).getByRole("button", { name: "Number not in service" }));
    expect(handbook.state.report).toHaveBeenCalledWith("i", "not-in-service");
    expect(within(sheet).getByText("Sent to your hospital's editors.")).toBeInTheDocument();
    expect(screen.getByText(/^Didn't connect at \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(window.localStorage.getItem(onCallDidntConnectStorageKey)).not.toMatch(/4456/);
  });

  it("reads Reported, disabled, for a reason this phone already sent", async () => {
    handbook.state = ready(items([{ id: "i", title: "ICU: Registrar", phone: "4456" }]), {
      hasReported: vi.fn((_id: string, reason: string) => reason === "not-in-service"),
    });
    render(<OnCallCallPage />);
    await userEvent.click(screen.getByTestId("on-call-didnt-connect-i"));
    const sheet = screen.getByRole("dialog", { name: "Didn't connect" });
    expect(within(sheet).getByRole("button", { name: "Reported" })).toBeDisabled();
    expect(within(sheet).getByRole("button", { name: "Reaches the wrong department" })).toBeEnabled();
  });

  it("offers switchboard as the fallback, and clears the mark", async () => {
    handbook.state = ready(
      items([
        { id: "sw", title: "Switchboard", phone: "9000 0000" },
        { id: "i", title: "ICU: Registrar", phone: "4456" },
      ]),
    );
    render(<OnCallCallPage />);
    await userEvent.click(screen.getByTestId("on-call-didnt-connect-i"));
    const sheet = screen.getByRole("dialog", { name: "Didn't connect" });
    expect(within(sheet).getByRole("link", { name: /^call switchboard/i })).toHaveAttribute("href", "tel:0890000000");
    await userEvent.click(within(sheet).getByRole("button", { name: "Clear mark" }));
    expect(screen.queryByText(/^Didn't connect at/)).toBeNull();
  });

  it("only marks an outside line or the reader's own number; there is no one to report it to", async () => {
    entries.list = [personalContact("p1", "My consultant", "0400 000 111")];
    render(<OnCallCallPage />);
    for (const id of ["wa-mherl", "p1"]) {
      await userEvent.click(screen.getByTestId(`on-call-didnt-connect-${id}`));
      const sheet = screen.getByRole("dialog", { name: "Didn't connect" });
      expect(
        within(sheet).queryByRole("button", { name: /Number not in service|Reaches the wrong department/ }),
      ).toBeNull();
      expect(within(sheet).getByRole("button", { name: "Clear mark" })).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
    }
    expect(handbook.state.report).not.toHaveBeenCalled();
  });

  it("filters every group with one device-only search field", async () => {
    handbook.state = ready(
      items([
        { id: "sw", title: "Switchboard", phone: "9000 0000" },
        { id: "i", title: "ICU: Registrar", phone: "4456" },
      ]),
    );
    render(<OnCallCallPage />);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search numbers, wards, roles");
    expect(screen.queryByRole("button", { name: /voice|microphone|dictat/i })).toBeNull();
    await userEvent.type(screen.getByRole("searchbox"), "icu");
    expect(screen.queryByText("Switchboard")).toBeNull();
    expect(screen.getByText("Registrar")).toBeInTheDocument();
    expect(document.getElementById("on-call-group-external")).toBeNull();
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("shows the crisis lines, and no hospital numbers, while signed out", () => {
    handbook.state = ready([], { status: "signed-out" });
    entries.signedOut = true;
    render(<OnCallCallPage />);
    expect(screen.getByTestId("on-call-handbook-state-signed-out")).toBeInTheDocument();
    const crisis = screen.getByTestId("on-call-crisis-lines");
    expect(within(crisis).getByRole("link", { name: /^call emergency services/i })).toHaveAttribute("href", "tel:000");
    expect(crisis).toHaveTextContent("Lifeline");
    expect(document.getElementById("on-call-group-hospital")).toBeNull();
    expect(screen.getByText("Sign in to keep your own numbers.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your own numbers" })).toHaveAttribute("href", "/on-call/contacts");
  });

  it("shows the crisis lines while loading and after a failed load", () => {
    for (const status of ["loading", "unavailable"] as const) {
      handbook.state = ready([], { status });
      render(<OnCallCallPage />);
      expect(screen.getByTestId("on-call-crisis-lines")).toHaveTextContent("13 11 14");
      cleanup();
    }
  });

  it("clears the lane's device stores at sign-out", () => {
    window.localStorage.setItem(onCallHospitalPhoneStorageKey, "1");
    window.localStorage.setItem(
      onCallDidntConnectStorageKey,
      JSON.stringify([{ entryId: "i", at: new Date().toISOString() }]),
    );
    clearOnCallDeviceState();
    expect(window.localStorage.getItem(onCallHospitalPhoneStorageKey)).toBeNull();
    expect(window.localStorage.getItem(onCallDidntConnectStorageKey)).toBeNull();
  });

  it("draws the consultant card only with a source", () => {
    render(<OnCallCallPage />);
    expect(screen.queryByTestId("on-call-call-isobar") === null).toBe(ISOBAR_SOURCE === null);
  });
});
