/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnCallDemoContentControl } from "@/components/on-call/on-call-demo-content-control";
import {
  ON_CALL_DEMO_ENTRY_COUNT,
  ON_CALL_DEMO_SLUGS,
  ON_CALL_DEMO_SLUGS_BY_SECTION,
} from "@/lib/on-call/demo-content-identity";
import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";

/**
 * The example-content loader is the only way a signed-in reader can see these
 * pages holding anything, so the control has to be right about three things:
 * who it offers itself to, which request it sends, and what it tells the
 * reader it is about to do.
 *
 * It cannot be exercised end to end here — writing needs a database and an
 * account, and this suite has neither — so the request is asserted at the
 * fetch boundary.
 */

const originalFetch = globalThis.fetch;

function mockFetch(response: Partial<Response> = { ok: true }) {
  const fetchMock = vi.fn().mockResolvedValue(response as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  // jsdom has no navigation; the control reloads on success and would throw.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("the example-content control", () => {
  it("offers nothing to a reader with no account", () => {
    // Adding needs an account. A button whose only outcome is 401 is worse
    // than no button.
    render(<OnCallDemoContentControl mode="load" signedOut demoMode={false} />);
    expect(screen.queryByTestId("on-call-demo-content-load")).toBeNull();
  });

  it("offers nothing in demo mode", () => {
    // Demo mode already IS this corpus, served from memory, and the route
    // refuses to write there. Both controls could only fail.
    render(<OnCallDemoContentControl mode="load" signedOut={false} demoMode />);
    expect(screen.queryByTestId("on-call-demo-content-load")).toBeNull();
    render(<OnCallDemoContentControl mode="remove" signedOut={false} demoMode />);
    expect(screen.queryByTestId("on-call-demo-content-remove")).toBeNull();
  });

  it("says that loading publishes, before it loads", () => {
    // The shared read selects `is_personal = false` across every account, so
    // most of these rows become readable by anyone who opens the site. That
    // consequence is the reason this sentence exists, and a silent button
    // would be the defect.
    render(<OnCallDemoContentControl mode="load" signedOut={false} demoMode={false} />);
    expect(screen.getByText(/anyone who opens this site can read them/i)).toBeVisible();
    expect(screen.getByText(/Removing them is one tap/i)).toBeVisible();
  });

  it("loads with a POST and removes with a DELETE", async () => {
    const fetchMock = mockFetch();

    const loaded = render(<OnCallDemoContentControl mode="load" signedOut={false} demoMode={false} />);
    fireEvent.click(screen.getByTestId("on-call-demo-content-load"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/on-call/demo-content");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    loaded.unmount();

    render(<OnCallDemoContentControl mode="remove" signedOut={false} demoMode={false} />);
    fireEvent.click(screen.getByTestId("on-call-demo-content-remove"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("says nothing was written when the request is refused", async () => {
    // A failed load must not leave a reader wondering whether half of it
    // landed: the route writes in one upsert, so "nothing was added" is true.
    mockFetch({ ok: false });
    render(<OnCallDemoContentControl mode="load" signedOut={false} demoMode={false} />);
    fireEvent.click(screen.getByTestId("on-call-demo-content-load"));
    expect(await screen.findByText(/Nothing was added/i)).toBeVisible();
  });
});

describe("what the loader claims to own", () => {
  it("covers the whole corpus and nothing else", () => {
    expect(ON_CALL_DEMO_ENTRY_COUNT).toBe(DEMO_ON_CALL_ENTRIES.length);

    // The load button spells the count in words, because the client cannot
    // import the corpus to read it — that would ship a kilobyte of fixture
    // identity to a page which renders none of it, and the bundle budget is
    // measured. A spelled number is therefore a copy of a fact, and a copy
    // drifts: grow the corpus by one entry and the sentence a reader is
    // deciding on becomes false, silently and on the live site.
    //
    // So the copy is pinned here rather than trusted. If this fails, the
    // corpus changed size and `on-call-demo-content-control.tsx` needs the
    // new number written out in the load sentence.
    expect(ON_CALL_DEMO_ENTRY_COUNT, "the load button says 'Ninety-four example entries' — update that copy too").toBe(
      94,
    );
    expect(new Set(ON_CALL_DEMO_SLUGS)).toEqual(new Set(DEMO_ON_CALL_ENTRIES.map((entry) => entry.slug)));
  });

  it("groups every slug under the section it actually belongs to", () => {
    // This is what stops the delete matching on half of the table's compound
    // key. A slug filed under the wrong section would either miss its own row
    // or reach one that is not the loader's to remove.
    const grouped = ON_CALL_DEMO_SLUGS_BY_SECTION.flatMap(([section, slugs]) =>
      slugs.map((slug) => `${section}/${slug}`),
    );
    const corpus = DEMO_ON_CALL_ENTRIES.map((entry) => `${entry.section}/${entry.slug}`);
    expect(grouped.sort()).toEqual(corpus.sort());
  });

  it("keeps every example slug recognisable as one", () => {
    // The home decides whether to offer "Remove" with a `demo-` prefix test
    // rather than by shipping ninety-four strings to the browser. That test is
    // only honest while the corpus actually uses the prefix.
    for (const slug of ON_CALL_DEMO_SLUGS) {
      expect(slug, `${slug} would not be recognised as example content`).toMatch(/^demo-/);
    }
  });
});
