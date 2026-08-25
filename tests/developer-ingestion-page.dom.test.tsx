/** @vitest-environment jsdom */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeveloperIngestionPage from "@/app/mockups/development/ingestion/page";

// PanelPageShell's back control is a ContextualBackLink, which calls
// next/navigation's useRouter for its history-aware click handler. Outside an
// app-router tree that throws "invariant expected app router to be mounted",
// so every render here needs the router mocked, same as every other panel
// page test (`developer-test-health-page.dom.test.tsx`,
// `developer-routes-page.dom.test.tsx`).
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/development/ingestion",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function readyPayload(overrides: Record<string, unknown> = {}) {
  return {
    jobs: [],
    activeJobCount: 0,
    hasActiveJobs: false,
    pollAfterMs: null,
    pagination: { limit: 100, offset: 0, total: 0, nextOffset: 0, hasMore: false },
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("developer ingestion page — shell and freshness (plan §8)", () => {
  it("renders inside the shared shell with its own freshness label, never a build-time date", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(readyPayload()));
    render(<DeveloperIngestionPage />);

    expect(screen.getByTestId("developer-ingestion")).toBeInTheDocument();
    expect(screen.getByTestId("developer-ingestion-back")).toHaveAttribute("href", "/mockups/development");

    // The shell's own stamp is rendered at server-render time, before the
    // client panel has fetched anything — so it must say "revision unknown",
    // not invent a build-time content date the way every Phase 1/2 panel does.
    // Falsifying edit: passing `resolveRepoFreshness(snapshot, now)` (or any
    // non-null contentAt) to PanelPageShell in page.tsx turns this red.
    const shellStamp = screen.getByTestId("developer-hub-freshness");
    expect(shellStamp).toHaveTextContent(/Ingestion jobs revision unknown/i);

    await screen.findByTestId("developer-ingestion-empty");
  });

  it("shows a loading state before the first response resolves", () => {
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    render(<DeveloperIngestionPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders its own live-updating checked-at line once data has been fetched, distinct from the shell stamp", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(readyPayload()));
    render(<DeveloperIngestionPage />);

    const checkedAt = await screen.findByTestId("developer-ingestion-checked-at");
    // Falsifying edit: deleting the `resolveFreshnessFrom(fetchedAt, ...)` call
    // (or the element it feeds) removes this node entirely, so the assertion
    // above already falsifies an omission; asserting real content here also
    // falsifies a component that renders the testid but leaves it empty.
    expect(checkedAt).toHaveTextContent(/checked/i);
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/revision unknown/i);
  });
});

describe("developer ingestion page — the four states (plan §4)", () => {
  it("demo mode: explains the database isn't connected, and never claims 'no jobs'", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(readyPayload({ demoMode: true })));
    render(<DeveloperIngestionPage />);

    const demo = await screen.findByTestId("developer-ingestion-demo");
    expect(demo).toHaveTextContent(/not connected to a database/i);
    // Falsifying edit: collapsing the demo branch into the empty-ready branch
    // (i.e. treating `demoMode: true` as just another zero-job response) makes
    // this fail, because the empty-state copy says "No ingestion jobs".
    expect(screen.queryByText(/No ingestion jobs/i)).not.toBeInTheDocument();
  });

  it("401: explains that live job state needs an administrator sign-in, with a link to sign in", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Authentication required." }, 401));
    render(<DeveloperIngestionPage />);

    const unauthorized = await screen.findByTestId("developer-ingestion-unauthorized");
    expect(unauthorized).toHaveTextContent(/administrator sign-in/i);
    // Falsifying edit: rendering the explanation without a real navigable link
    // (e.g. plain text mentioning "sign in") makes this query find nothing.
    expect(within(unauthorized).getByRole("link")).toBeInTheDocument();
  });

  it("403 (signed in without administrator rights) reads as the same explanation as 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden." }, 403));
    render(<DeveloperIngestionPage />);
    expect(await screen.findByTestId("developer-ingestion-unauthorized")).toHaveTextContent(/administrator sign-in/i);
  });

  it("genuinely zero rows: says 'No ingestion jobs' in words", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(readyPayload()));
    render(<DeveloperIngestionPage />);
    expect(await screen.findByTestId("developer-ingestion-empty")).toHaveTextContent(/No ingestion jobs/i);
  });

  it("network failure: says the check itself failed, not that there are no jobs", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<DeveloperIngestionPage />);

    const errorState = await screen.findByTestId("developer-ingestion-fetch-error");
    expect(errorState).toHaveTextContent(/could not reach/i);
    // Falsifying edit: a catch block that renders the empty-state branch
    // instead of its own would make this pass silently — assert the two are
    // textually distinct.
    expect(errorState).not.toHaveTextContent(/No ingestion jobs/i);
  });

  it("a 500 response falls into the same fetch-failed bucket as a network error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Request failed." }, 500));
    render(<DeveloperIngestionPage />);
    expect(await screen.findByTestId("developer-ingestion-fetch-error")).toHaveTextContent(/could not be reached/i);
  });

  it("an unexpected payload shape degrades to the fetch-failed state rather than inventing zero jobs", async () => {
    // Never a real server response, but proves the panel does not silently
    // treat a malformed body as "zero jobs" — degrading conservatively per
    // AGENTS.md rather than guessing.
    fetchMock.mockResolvedValueOnce(jsonResponse({ jobs: "not-an-array" }));
    render(<DeveloperIngestionPage />);
    const errorState = await screen.findByTestId("developer-ingestion-fetch-error");
    expect(errorState).toHaveTextContent(/unexpected shape/i);
    // The endpoint was reached; a shared "could not reach" wrapper would
    // collapse this into the network/500 copy this panel exists to keep
    // separate.
    expect(errorState).not.toHaveTextContent(/could not reach/i);
    expect(errorState).not.toHaveTextContent(/No ingestion jobs/i);
  });
});

describe("developer ingestion page — counts render as given", () => {
  it("shows the server's own activeJobCount rather than recomputing a length that could disagree", async () => {
    // Deliberately mismatched: only 2 rows in this page are active-status, but
    // the query-wide server count reports 7 because five active jobs are on
    // later pages. Falsifying edit: replacing `state.activeJobCount` with
    // `active.length` in the component turns this red (it would show "2").
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        readyPayload({
          jobs: [
            { id: "job-1", status: "pending", document_id: "doc-1" },
            { id: "job-2", status: "processing", document_id: "doc-2" },
          ],
          activeJobCount: 7,
          hasActiveJobs: true,
          pollAfterMs: 5000,
          pagination: { limit: 100, offset: 0, total: 105, nextOffset: 100, hasMore: true },
        }),
      ),
    );
    render(<DeveloperIngestionPage />);

    const tile = await screen.findByTestId("developer-ingestion-count-active-value");
    expect(tile).toHaveTextContent("7");
  });
});

describe("developer ingestion page — unrecognised status bucket (plan §5, Ruling I2)", () => {
  it("buckets an unrecognised status under its own heading, verbatim, without dropping it from the total", async () => {
    const jobs = [
      { id: "job-pending", status: "pending", document_id: "doc-1" },
      { id: "job-completed", status: "completed", document_id: "doc-2" },
      { id: "job-failed", status: "failed", document_id: "doc-3", error_message: "OCR timed out" },
      { id: "job-weird", status: "queued_manual_review", document_id: "doc-4" },
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(readyPayload({ jobs, activeJobCount: 1, hasActiveJobs: false })));
    render(<DeveloperIngestionPage />);

    // Falsifying edit: `bucketJobs` dropping the `other` computation (or the
    // page rendering `null` unconditionally for the other section instead of
    // only when empty) makes the row below unreachable and this query throws.
    const other = await screen.findByTestId("developer-ingestion-other");
    // The exact free-text status must appear verbatim, not summarised away.
    expect(other).toHaveTextContent("queued_manual_review");
    expect(within(other).getAllByRole("listitem")).toHaveLength(1);

    // The recognised buckets still show their own rows — nothing was
    // reclassified into "other" that the panel does recognise.
    expect(screen.getByTestId("developer-ingestion-job-job-pending")).toBeInTheDocument();
    expect(screen.getByTestId("developer-ingestion-job-job-completed")).toBeInTheDocument();
    expect(screen.getByTestId("developer-ingestion-job-job-failed")).toHaveTextContent("OCR timed out");
  });

  it("omits the unrecognised-status section entirely when every job's status is recognised", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        readyPayload({
          jobs: [{ id: "job-1", status: "completed", document_id: "doc-1" }],
          activeJobCount: 0,
        }),
      ),
    );
    render(<DeveloperIngestionPage />);
    await screen.findByTestId("developer-ingestion-job-job-1");
    expect(screen.queryByTestId("developer-ingestion-other")).not.toBeInTheDocument();
  });
});

describe("developer ingestion page — poll cadence (plan §3, Ruling I1)", () => {
  it("polls again after the server-given cadence while jobs remain active, and stops once none are", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        readyPayload({
          jobs: [{ id: "job-1", status: "processing", document_id: "doc-1" }],
          activeJobCount: 1,
          hasActiveJobs: true,
          pollAfterMs: 5000,
        }),
      ),
    );
    render(<DeveloperIngestionPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(readyPayload({ jobs: [], activeJobCount: 0, hasActiveJobs: false, pollAfterMs: null })),
    );

    // Falsifying edit: hardcoding a poll interval instead of reading
    // `state.pollAfterMs` (Ruling I1 point 1 — "a value the server hands us
    // rather than a number this panel invents") would still fire at 5000ms
    // here, so this alone would not catch that regression; the next
    // assertion (no third call after the server says inactive) is what does.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    // Falsifying edit: an effect that reschedules unconditionally (ignoring
    // `hasActiveJobs`/`pollAfterMs === null`) would call fetch a third time
    // here.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never polls when the server reports no active jobs", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(jsonResponse(readyPayload()));
    render(<DeveloperIngestionPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
