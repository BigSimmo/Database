/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ status: "authenticated", authEpoch: 1 }));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => auth }));

import { TeachingCpdReview } from "@/components/teaching/teaching-cpd-review";
import { TeachingFeedback } from "@/components/teaching/teaching-feedback";
import { TeachingImport } from "@/components/teaching/teaching-import";
import { TeachingSupervision } from "@/components/teaching/teaching-supervision";
import { TeachingTeach } from "@/components/teaching/teaching-teach";
import { useDelayedPost } from "@/components/teaching/use-delayed-post";
import { demoFeedbackOpen, demoSupervision, demoTeach } from "@/lib/teaching/depth-demo";
import { IMPORT_TEMPLATE_HEADERS } from "@/lib/teaching/depth-model";
import { entry, pairingView, NOTE } from "./helpers/teaching-depth-fixtures";

const id = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const row = { occurrenceId: id, serviceName: "Demo service", title: "Demo grand round", startsAt: "2026-09-20T04:00:00Z", endsAt: "2026-09-20T05:00:00Z", hours: 1 };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const posts = () => vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "POST");

beforeEach(() => { auth.authEpoch = 1; auth.status = "authenticated"; vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Teaching depth journeys", () => {
  it("cancels queued organiser writes when the account changes or the page unmounts", async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useDelayedPost());
    const job = { label: "Synthetic change", url: "/api/teaching/services/synthetic", body: {}, onPosted: vi.fn(), onFailed: vi.fn() };
    act(() => hook.result.current.schedule(job));
    auth.authEpoch++;
    hook.rerender();
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(posts()).toHaveLength(0);
    act(() => hook.result.current.schedule(job));
    auth.status = "loading";
    hook.rerender();
    expect(hook.result.current.pending).toBeNull();
    auth.status = "authenticated";
    hook.rerender();
    act(() => hook.result.current.schedule(job));
    hook.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(posts()).toHaveLength(0);
  });
  it("shows the proposed correction before the supervisor confirms it", async () => {
    const pairing = pairingView({ access: "supervisor", entries: [entry({ notes: [{ noteId: NOTE, reason: "wrong_length", correctedValue: { minutes: 120 }, confirmedAt: null, createdAt: "2026-09-27T00:00:00Z" }] })] });
    vi.mocked(fetch).mockImplementation(async () => reply({ pairings: [pairing] }));
    render(<TeachingSupervision demoMode={false} />);
    expect(await screen.findByText("Proposed correction: Minutes: 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm correction" })).toBeEnabled();
    expect(posts()).toHaveLength(0);
  });

  it("serializes confirmations across pairings so a refresh cannot cancel another queued change", async () => {
    const pairings = [pairingView({ access: "supervisor", entries: [entry({ date: "2026-09-25" })] }), pairingView({ pairingId: id, access: "supervisor", entries: [entry({ entryId: id, date: "2026-09-26" })] })];
    vi.mocked(fetch).mockImplementation(async (_url, options) => reply(options?.method === "POST" ? {} : { pairings }));
    render(<TeachingSupervision demoMode={false} />);
    const first = await screen.findByRole("button", { name: "Confirm 2026-09-25" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(first);
    expect(screen.getByRole("button", { name: "Confirm 2026-09-26" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(posts()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Confirm 2026-09-26" })).toBeEnabled();
  });
  it("requires explicit CPD selection and retains idempotency keys after an uncertain save", async () => {
    let writes = 0;
    vi.mocked(fetch).mockImplementation(async (_url, options) => options?.method === "POST" ? ++writes === 1 ? Promise.reject(new TypeError("network")) : reply({ results: [{ occurrenceId: id, entryId: id, code: null, message: null }] }) : reply({ rows: [row] }));
    render(<TeachingCpdReview demoMode={false} />);
    const choose = await screen.findByRole("checkbox");
    expect(choose).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Log selected sessions to my CPD" })).toBeDisabled();
    expect(posts()).toHaveLength(0);
    fireEvent.click(choose);
    fireEvent.click(screen.getByRole("button", { name: "Log selected sessions to my CPD" }));
    await screen.findByText(/Some entries may have saved/);
    const first = JSON.parse(String(posts()[0][1]?.body));
    fireEvent.click(screen.getByRole("button", { name: "Log selected sessions to my CPD" }));
    await screen.findByText("Saved to your private CPD log.");
    expect(JSON.parse(String(posts()[1][1]?.body))).toEqual(first);
    expect(first.rows[0]).toMatchObject({ occurrenceId: id, hours: 1 });
  });

  it("clears personal CPD choices when the account changes", async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ rows: [row] }));
    const view = render(<TeachingCpdReview demoMode={false} />);
    fireEvent.click(await screen.findByRole("checkbox"));
    auth.authEpoch++;
    vi.mocked(fetch).mockImplementation(async () => reply({ rows: [] }));
    view.rerender(<TeachingCpdReview demoMode={false} />);
    await screen.findByText("No attended sessions waiting to be logged.");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it("offers tap-only feedback, preserves answers after failure, and sends no identity field", async () => {
    const session = demoFeedbackOpen("2026-09-27")[0];
    let writes = 0;
    vi.mocked(fetch).mockImplementation(async (_url, options) => options?.method === "POST" ? reply(++writes === 1 ? { error: "Unavailable" } : {}, writes === 1 ? 503 : 200) : reply({ sessions: [session] }));
    render(<TeachingFeedback demoMode={false} />);
    fireEvent.click(await screen.findByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByRole("radio", { name: "About right" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByText("Thanks. Your answer was sent.");
    expect(JSON.parse(String(posts()[1][1]?.body))).toEqual({ action: "feedback.submit", occurrenceId: session.occurrenceId, useful: 4, pace: "right" });
  });

  it("cancels supervision confirmation during the ten-second undo period", async () => {
    const pairing = demoSupervision("2026-09-27")[1];
    vi.mocked(fetch).mockImplementation(async () => reply({ pairings: [pairing] }));
    render(<TeachingSupervision demoMode={false} />);
    const confirm = await screen.findByRole("button", { name: "Confirm 2026-09-26" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(confirm);
    await act(async () => vi.advanceTimersByTime(9999));
    expect(posts()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => vi.advanceTimersByTime(10001));
    expect(posts()).toHaveLength(0);
    expect(screen.getByText("Cancelled before sending.")).toBeInTheDocument();
  });

  it("does not mark presenter readiness saved when the request fails", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, options) => options?.method === "POST" ? reply({}, 503) : reply(demoTeach("2026-09-27")));
    render(<TeachingTeach demoMode={false} />);
    const aims = await screen.findByRole("checkbox", { name: "Aims written" });
    fireEvent.click(aims);
    await screen.findByRole("alert");
    expect(aims).not.toBeChecked();
  });

  it("previews rows before importing and prevents a blind repeat after an uncertain commit", async () => {
    const series = { title: "Demo session" };
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (options?.method !== "POST") return reply({ teams: [{ id: serviceId, name: "Demo service", role: "organiser" }] });
      const body = JSON.parse(String(options.body));
      return body.action === "import.preview" ? reply({ rows: [{ line: 2, title: "Demo session", errors: [] }], ready: [series] }) : reply({}, 503);
    });
    render(<TeachingImport demoMode={false} />);
    const input = await screen.findByLabelText(/Choose CSV/);
    const file = new File([], "timetable.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => IMPORT_TEMPLATE_HEADERS.join(",") + "\nDemo session,lecture,once,2026-09-28,,12:30,60,Demo room,," });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText("Preview — nothing imported yet");
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(String(posts()[0][1]?.body)).action).toBe("import.preview");
    fireEvent.click(screen.getByRole("button", { name: "Import these sessions" }));
    await screen.findByText(/Check Organise before importing again/);
    expect(screen.queryByRole("button", { name: "Import these sessions" })).not.toBeInTheDocument();
  });

  it("keeps the synthetic depth demo away from all API writes", async () => {
    render(<TeachingFeedback demoMode />);
    fireEvent.click(await screen.findByRole("radio", { name: "5" }));
    fireEvent.click(screen.getByRole("radio", { name: "About right" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(screen.getByText("Demo answer recorded on this page.")).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });
});
