/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnCallCopyNumber } from "@/components/on-call/on-call-copy-number";

afterEach(cleanup);

/**
 * The control exists for the half of the job a `tel:` link cannot do: getting the
 * number OUT of the app and into the medical record or a paging system. So the
 * two things these tests care about are what lands on the clipboard, and what the
 * reader is told when it does not land at all — a copy control that looks like it
 * worked while the clipboard is empty is worse than no control, because the
 * registrar pastes an old number into a note.
 */

type ClipboardStub = { writeText: ReturnType<typeof vi.fn> };

function stubClipboard(writeText: ReturnType<typeof vi.fn>): ClipboardStub {
  const clipboard = { writeText };
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true, writable: true });
  return clipboard;
}

function removeClipboard() {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
}

afterEach(() => {
  removeClipboard();
});

describe("OnCallCopyNumber", () => {
  it("is an icon-only control that still has a real accessible name", () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<OnCallCopyNumber value="(08) 9224 8888" label="Copy After hours number for Ward 4B" />);
    const button = screen.getByRole("button", { name: "Copy After hours number for Ward 4B" });
    expect(button.tagName).toBe("BUTTON");
    // Every lucide glyph in the control is decoration beside that name.
    for (const icon of Array.from(button.querySelectorAll("svg"))) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps a 48px tap target and never the banned 44px rung", () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<OnCallCopyNumber value="0412 345 678" label="Copy Direct number for ED registrar" />);
    const button = screen.getByRole("button", { name: /copy/i });
    expect(button.className).toMatch(/\bmin-h-tap\b|\bh-tap\b/);
    expect(button.className).not.toMatch(/\bmin-h-11\b/);
  });

  it("copies the number in the form a medical record will accept, not the punctuation a human typed", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<OnCallCopyNumber value="(08) 9224 8888" label="Copy Direct number for switchboard" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("0892248888"));
  });

  it("keeps a leading plus, which is part of an international number", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<OnCallCopyNumber value="+61 8 9224 8888" label="Copy Direct number for switchboard" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("+61892248888"));
  });

  it("confirms visibly on success and announces the same outcome politely", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<OnCallCopyNumber value="0412 345 678" label="Copy Direct number for ED registrar" testId="copy" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => expect(screen.getByTestId("copy-status")).toHaveTextContent(/copied/i));
    const announcement = screen.getByTestId("copy-announcement");
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(announcement.className).toMatch(/\bsr-only\b/);
    await waitFor(() => expect(announcement).toHaveTextContent(/copied/i));
  });

  it("returns to its resting state after the confirmation has been read", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(
      <OnCallCopyNumber value="0412 345 678" label="Copy Direct number for ED registrar" testId="copy" resetMs={20} />,
    );
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(screen.getByTestId("copy-status")).toHaveTextContent(/copied/i));
    await waitFor(() => expect(screen.queryByTestId("copy-status")).toBeNull());
  });

  it("says plainly that nothing was copied when the clipboard API is missing, rather than pretending", async () => {
    // Insecure context, a locked-down hospital browser: `navigator.clipboard`
    // simply is not there. The control must not throw and must not claim success.
    const user = userEvent.setup();
    // After `setup()`, because user-event installs a working clipboard stub of
    // its own and would otherwise mask the very situation under test.
    removeClipboard();
    render(<OnCallCopyNumber value="0412 345 678" label="Copy Direct number for ED registrar" testId="copy" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => expect(screen.getByTestId("copy-status")).toHaveTextContent(/not copied/i));
    expect(screen.getByTestId("copy-announcement")).toHaveTextContent(/0412345678/);
    expect(screen.getByTestId("copy-status")).not.toHaveTextContent(/copied to/i);
  });

  it("says the same when the clipboard write is refused", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error("permission denied")));
    render(<OnCallCopyNumber value="0412 345 678" label="Copy Direct number for ED registrar" testId="copy" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(screen.getByTestId("copy-status")).toHaveTextContent(/not copied/i));
  });

  it("signals its outcome with words and a different glyph, never colour alone", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { container } = render(
      <OnCallCopyNumber value="0412 345 678" label="Copy Direct number for ED registrar" testId="copy" />,
    );
    const restingGlyph = container.querySelector("svg")?.getAttribute("class");
    expect(restingGlyph).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(screen.getByTestId("copy-status")).toHaveTextContent(/copied/i));
    // A different glyph, plus the word — the outcome survives with no colour
    // perception at all, the same contract the freshness badge holds to.
    expect(container.querySelector("svg")?.getAttribute("class")).not.toEqual(restingGlyph);
  });

  it("renders nothing at all when there are no digits to copy", () => {
    const { container } = render(<OnCallCopyNumber value="via switchboard" label="Copy number" />);
    expect(container.firstChild).toBeNull();
  });
});
