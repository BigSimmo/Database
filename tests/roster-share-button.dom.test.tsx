/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const announceSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/live-announcer", () => ({ announce: announceSpy }));

import { RosterShareButton } from "@/components/roster/roster-share-button";
import { perthWallToIso } from "@/lib/roster/shifts/perth-time";

const now = new Date(perthWallToIso("2026-10-01", "08:00")!);
const shifts = [
  {
    startsAt: perthWallToIso("2026-10-01", "08:00")!,
    endsAt: perthWallToIso("2026-10-01", "16:00")!,
    title: "Ward",
    kind: "day" as const,
    location: "Example Hospital",
    workplace: null,
  },
];

function setNavigator(values: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(navigator, "share", { configurable: true, value: values.share });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: values.clipboard });
}

beforeEach(() => announceSpy.mockClear());
afterEach(() => {
  cleanup();
  setNavigator({});
});

function openSheet() {
  render(<RosterShareButton shifts={shifts} now={now} />);
  fireEvent.click(screen.getByRole("button", { name: "Share my shifts" }));
}

it("previews 7 days, then 14 days", () => {
  setNavigator({});
  openSheet();
  const preview = screen.getByLabelText("Preview") as HTMLTextAreaElement;
  expect(preview.value.split("\n")[0]).toBe("My shifts, Thu 1 Oct – Wed 7 Oct");
  expect(preview.value).toContain("Thu 1 Oct · Day 08:00–16:00 · Example Hospital");
  fireEvent.click(screen.getByRole("radio", { name: "Next 14 days" }));
  expect(preview.value.split("\n")[0]).toBe("My shifts, Thu 1 Oct – Wed 14 Oct");
});

it("copies the text and confirms it", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  setNavigator({ clipboard: { writeText } });
  openSheet();
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy" })));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("My shifts, Thu 1 Oct"));
  expect(announceSpy).toHaveBeenCalledWith("Copied");
});

it("says nothing when the share sheet is cancelled", async () => {
  const share = vi.fn().mockRejectedValue(Object.assign(new Error("cancelled"), { name: "AbortError" }));
  const writeText = vi.fn();
  setNavigator({ share, clipboard: { writeText } });
  openSheet();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share" })));
  expect(share).toHaveBeenCalledTimes(1);
  expect(writeText).not.toHaveBeenCalled();
  expect(announceSpy).not.toHaveBeenCalled();
  expect(screen.queryByText(/Couldn.t copy/)).toBeNull();
});

it("selects the text with a message when sharing and copying both fail", async () => {
  const share = vi.fn().mockRejectedValue(new Error("not allowed"));
  const writeText = vi.fn().mockRejectedValue(new Error("denied"));
  setNavigator({ share, clipboard: { writeText } });
  openSheet();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share" })));
  const preview = screen.getByLabelText("Preview") as HTMLTextAreaElement;
  expect(screen.getByText(/Couldn.t copy automatically/)).toBeInTheDocument();
  expect(document.activeElement).toBe(preview);
  expect(preview.selectionEnd - preview.selectionStart).toBe(preview.value.length);
});
