/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => import("./helpers/teaching-auth"));

import { NeedsYou, presenterPrep } from "@/components/teaching/teaching-needs-you";
import type { TeachRead } from "@/lib/teaching/depth-model";

import { json, serveFetch, useTeachingTestClock } from "./helpers/teaching-fixtures";

// Shared fixture setup, not a component hook; see teaching-modules.dom.test.tsx.
// eslint-disable-next-line react-hooks/rules-of-hooks
useTeachingTestClock();

const SERVICE = "00000000-0000-4000-8000-000000000001";
const TALK = "00000000-0000-4000-8000-000000000301";

function teach(overrides: Partial<TeachRead["upcoming"][number]> = {}): TeachRead {
  return {
    upcoming: [
      {
        occurrenceId: TALK,
        serviceId: SERVICE,
        title: "Case discussion",
        startsAt: "2026-10-07T00:00:00.000Z",
        endsAt: "2026-10-07T00:45:00.000Z",
        venue: null,
        status: "scheduled",
        items: ["room", "slides_link"],
        deidConfirmedAt: null,
        ...overrides,
      },
    ],
    taught: [],
  };
}

describe("presenterPrep", () => {
  it("names the day, the readiness count and an unconfirmed de-identification", () => {
    expect(presenterPrep(teach(), "2026-10-01")).toEqual({
      title: "You present Wed 7 Oct",
      subtitle: "2\u00a0of 4 prep items done · de-identification not confirmed",
    });
  });

  it("asks nothing once every item is done and de-identification is confirmed", () => {
    const ready = teach({
      items: ["reading_list", "aims", "slides_link", "room"],
      deidConfirmedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(presenterPrep(ready, "2026-10-01")).toBeNull();
  });

  it("skips a cancelled talk and has nothing to say with no talks", () => {
    expect(presenterPrep(teach({ status: "cancelled" }), "2026-10-01")).toBeNull();
    expect(presenterPrep({ upcoming: [], taught: [] }, "2026-10-01")).toBeNull();
  });
});

describe("Needs you rows", () => {
  it("adds presenter prep, open feedback and catch-up rows from their reads", async () => {
    serveFetch((url) => {
      if (url === "/api/teaching?view=unlogged-count") return json(200, { count: 0 });
      if (url === "/api/teaching/depth?view=teach") return json(200, teach());
      if (url === "/api/teaching/depth?view=feedback-open")
        return json(200, {
          sessions: [
            {
              occurrenceId: TALK,
              serviceId: SERVICE,
              title: "Grand round",
              startsAt: "2026-09-28T04:30:00.000Z",
              endsAt: "2026-09-28T05:30:00.000Z",
            },
          ],
        });
      return null;
    });
    render(<NeedsYou live today="2026-10-01" catchUp={2} />);
    expect(await screen.findByRole("link", { name: /^You present Wed 7 Oct/ })).toHaveAttribute(
      "href",
      "/teaching/teach",
    );
    expect(await screen.findByRole("link", { name: /^Give feedback on 1\ssession/ })).toHaveAttribute(
      "href",
      "/teaching/feedback",
    );
    expect(screen.getByRole("link", { name: /^Catch up on 2\ssessions/ })).toHaveAttribute(
      "href",
      "/teaching/resources#catch-up",
    );
  });

  it("shows no row, and no false zero, when a read fails", async () => {
    const fetchMock = serveFetch((url) =>
      url === "/api/teaching?view=unlogged-count" ? json(200, { count: 0 }) : json(500, {}),
    );
    const { container } = render(<NeedsYou live today="2026-10-01" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the demo's made-up talk and feedback without fetching", () => {
    const fetchMock = serveFetch(() => null);
    render(<NeedsYou live={false} today="2026-10-01" />);
    expect(screen.getByRole("link", { name: /^You present/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Give feedback on 1\ssession/ })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
