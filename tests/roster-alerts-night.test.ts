import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/roster/team/repository", () => ({ rosterRead: mocks.read }));

import { recipientsOnNightNow } from "@/lib/roster/alerts/night";

it("checks night coverage by instant when team timestamps have offsets", async () => {
  const person = "5e000000-0000-4000-8000-000000000001";
  const later = "5e000000-0000-4000-8000-000000000002";
  mocks.read.mockResolvedValue({
    assignments: [
      { userId: person, kind: "night", startsAt: "2026-10-31T08:30:00+09:00", endsAt: "2026-10-31T09:30:00+09:00" },
      { userId: later, kind: "night", startsAt: "2026-10-31T09:30:00+09:00", endsAt: "2026-10-31T17:00:00+09:00" },
    ],
  });
  const query = {
    select() {
      return this;
    },
    in() {
      return this;
    },
    eq() {
      return this;
    },
    lte() {
      return this;
    },
    gt() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve: (value: { data: never[]; error: null }) => void) {
      resolve({ data: [], error: null });
    },
  };
  const client = { from: () => query } as unknown as Parameters<typeof recipientsOnNightNow>[0];
  const quiet = await recipientsOnNightNow(
    client,
    person,
    "5e000000-0000-4000-8000-000000000003",
    [person, later],
    new Date("2026-10-31T00:00:00Z"),
  );
  expect([...quiet]).toEqual([person]);
});
