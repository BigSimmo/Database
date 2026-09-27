/** @vitest-environment jsdom */

import { existsSync, readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: nav.redirect,
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/on-call",
  useSearchParams: () => new URLSearchParams(),
}));
const store = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  loadError: null,
  retry: () => {},
  cachedAt: null,
  signedOut: false,
  demoMode: false,
}));
vi.mock("@/lib/on-call/entry-store", () => ({ useOnCallEntries: () => store, cacheOnCallEntries: vi.fn() }));

import OnCallEducationRoute from "@/app/(search-app)/on-call/education/page";
import { OnCallCalendarPage } from "@/components/on-call/on-call-calendar-page";
import { OnCallSearchBox } from "@/components/on-call/on-call-search-box";
import { selectCardEntries } from "@/lib/on-call/card-selection";
import { proxy } from "@/proxy";

function entry(overrides: Partial<OnCallEntry> & Pick<OnCallEntry, "id" | "section">): OnCallEntry {
  return {
    slug: overrides.id,
    title: `Entry ${overrides.id}`,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 0,
    lastVerifiedAt: new Date().toISOString(),
    ...overrides,
  };
}

const TEACHING = entry({
  id: "ward-teaching",
  section: "education",
  title: "Ward teaching",
  details: { nextOccurrence: "12:30", nextOccurrenceDate: "2026-09-02", recurrenceRule: { frequency: "weekly" } },
});
const LICENCE = entry({
  id: "licence",
  section: "logistics",
  title: "Driver's licence",
  includeOnCard: false,
  details: { kind: "compliance", expiresOn: "2026-09-30" },
});
const WARD = entry({
  id: "ward",
  section: "contacts",
  title: "Ward teaching room",
  details: { role: "Ward clerk", phone: "08 9000 0003" },
});

afterEach(() => {
  cleanup();
  store.entries = [];
  nav.redirect.mockReset();
});

describe("teaching leaves On Call", () => {
  it("sends /on-call/education to Teaching's Week in the proxy, and the page itself as a backstop", async () => {
    const response = await proxy(new NextRequest(new URL("http://localhost/on-call/education")));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/teaching/week");
    OnCallEducationRoute();
    expect(nav.redirect).toHaveBeenCalledWith("/teaching/week");
  });

  it("keeps teaching off the pocket card even when the entry asks for it", () => {
    expect(selectCardEntries([TEACHING, WARD], new Date()).map((e) => e.id)).toEqual(["ward"]);
  });

  it("keeps teaching out of On Call's search box, and still finds everything else", () => {
    render(<OnCallSearchBox entries={[TEACHING, WARD]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /search on call/i }), { target: { value: "teaching" } });
    expect(screen.queryByTestId("on-call-search-group-education")).not.toBeInTheDocument();
    expect(screen.getByTestId("on-call-search-row-ward")).toBeInTheDocument();
  });

  it("shows only recorded expiry dates on On Call's calendar, and says so", () => {
    store.entries = [TEACHING, LICENCE];
    render(<OnCallCalendarPage now={new Date(2026, 8, 30, 9, 0)} />);
    const day = screen.getByTestId("on-call-calendar-view-day");
    expect(day).toHaveTextContent("Driver's licence expires");
    expect(day).not.toHaveTextContent("Ward teaching");
    expect(screen.getByText("The expiry dates you recorded on Compliance.")).toBeInTheDocument();
  });

  it("removes the home strip's usage, and My Work's tile no longer mentions teaching", () => {
    const home = readFileSync("src/components/on-call/on-call-home.tsx", "utf8");
    expect(home).not.toMatch(/on-call-home-upcoming|OnCallTeachingStrip|selectUpcomingTeachingSessions/);
    // R13: the component and its test are never deleted without Josh's typed
    // sentence, so `OnCallTeachingStrip` stays on disk — just unused by the home
    // above, which is the actual behaviour change (spec §8).
    expect(existsSync("src/components/on-call/on-call-teaching-strip.tsx")).toBe(true);
    const myWork = readFileSync("src/components/my-work/my-work-home.tsx", "utf8");
    expect(myWork).toContain('description="Recorded expiry dates by month"');
    expect(myWork).not.toMatch(/Teaching and recorded expiry/);
  });
});
