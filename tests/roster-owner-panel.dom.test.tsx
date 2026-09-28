/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

import { RosterTeamsPanel } from "@/components/developer-area/hub/roster-teams-panel";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const PERSON = "5e000000-0000-4000-8000-000000000002";
const teams = {
  teams: [
    {
      serviceId: SERVICE,
      name: "Example Health Service · General Medicine",
      createdAt: "2026-09-27",
      verifiedAt: null,
      isDemo: false,
      activeMembers: 1,
      managers: 0,
    },
  ],
};
const members = {
  members: [
    {
      userId: PERSON,
      displayName: "Dr Sam Example",
      rosterName: null,
      serviceRole: "member",
      rosterRole: "member",
      grade: "registrar",
      joinedAt: "2026-09-27",
    },
  ],
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ result: { ok: true } });
    if (input.includes("?member=")) return Response.json({ email: "sam@example.org" });
    if (input.endsWith(SERVICE)) return Response.json(members);
    return Response.json(teams);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Roster owner panel", () => {
  it("labels confirmation in words and sends only after the named confirmation sheet", async () => {
    render(<RosterTeamsPanel />);
    await screen.findByText(/Not confirmed/);
    fireEvent.click(screen.getByRole("button", { name: "Confirm team" }));
    expect(screen.getByText("Confirm General Medicine? Its members can then share a roster.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("dialog").querySelector("button")!);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body))).toEqual({
      action: "verify",
      verified: true,
      isDemo: false,
    });
  });

  it("offers manager changes only for a confirmed team and reveals email one person at a time", async () => {
    render(<RosterTeamsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "People" }));
    await screen.findByText("Dr Sam Example");
    expect(screen.queryByRole("button", { name: "Make roster manager" })).toBeNull();
    expect(screen.queryByText("sam@example.org")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show email" }));
    await screen.findByText("sam@example.org");
  });

  it("tells a signed-out visitor to sign in as an administrator", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 401 }));
    render(<RosterTeamsPanel />);
    expect(await screen.findByText("Sign in as an administrator to change teams.")).toBeInTheDocument();
  });
});
