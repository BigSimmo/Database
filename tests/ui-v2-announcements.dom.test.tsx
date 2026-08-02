import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveAnnouncer, RouteAnnouncer, announce, resetAnnouncerForTests } from "@/components/ui/live-announcer";

const pathname = vi.hoisted(() => ({ current: "/answer" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

beforeEach(() => {
  pathname.current = "/answer";
  resetAnnouncerForTests();
});

afterEach(() => {
  resetAnnouncerForTests();
  document.title = "";
});

describe("LiveAnnouncer", () => {
  it("renders two visually-hidden regions and no visible text", () => {
    render(<LiveAnnouncer />);

    const polite = screen.getByTestId("live-announcer-polite");
    const assertive = screen.getByTestId("live-announcer-assertive");
    expect(polite).toHaveAttribute("aria-live", "polite");
    expect(assertive).toHaveAttribute("aria-live", "assertive");
    expect(polite.className).toContain("sr-only");
    expect(assertive.className).toContain("sr-only");
  });

  it("routes a polite announcement to the polite region only", () => {
    render(<LiveAnnouncer />);
    act(() => announce("Answer ready, 4 sources"));

    expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("Answer ready, 4 sources");
    expect(screen.getByTestId("live-announcer-assertive")).toHaveTextContent("");
  });

  it("reserves the assertive region for loss-of-work risks", () => {
    render(<LiveAnnouncer />);
    act(() => announce("Your session expires in one minute", { priority: "assertive" }));

    expect(screen.getByTestId("live-announcer-assertive")).toHaveTextContent("Your session expires in one minute");
    expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("");
  });

  it("deduplicates the same message inside the repeat window", async () => {
    render(<LiveAnnouncer />);
    act(() => announce("12 results"));
    act(() => announce("12 results"));

    // The second call is the same event announced twice — a re-render, not news.
    await waitFor(() => expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("12 results"));
    act(() => announce("13 results"));
    await waitFor(() => expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("13 results"));
  });

  it("ignores an empty announcement", () => {
    render(<LiveAnnouncer />);
    act(() => announce("   "));
    expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("");
  });

  it("refuses a second instance in development", () => {
    render(<LiveAnnouncer />);
    // Two announcers means every message is read twice.
    expect(() => render(<LiveAnnouncer />)).toThrow(/singleton/i);
  });
});

describe("RouteAnnouncer", () => {
  function Page({ heading = "Answer" }: { heading?: string }) {
    return (
      <main>
        <h1>{heading}</h1>
      </main>
    );
  }

  it("stays silent on first render — arrival is not a navigation", () => {
    document.title = "Answer · Clinical KB";
    render(
      <>
        <LiveAnnouncer />
        <RouteAnnouncer />
        <Page />
      </>,
    );

    expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("");
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
  });

  it("moves focus to the new h1 and announces the page title on navigation", async () => {
    document.title = "Answer · Clinical KB";
    const { rerender } = render(
      <>
        <LiveAnnouncer />
        <RouteAnnouncer />
        <Page />
      </>,
    );

    document.title = "Documents · Clinical KB";
    pathname.current = "/documents";
    rerender(
      <>
        <LiveAnnouncer />
        <RouteAnnouncer />
        <Page heading="Documents" />
      </>,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).toHaveFocus();
    await waitFor(() =>
      expect(screen.getByTestId("live-announcer-polite")).toHaveTextContent("Documents · Clinical KB"),
    );
  });

  it("leaves focus alone when the navigation happened inside a dialog", () => {
    const tree = (
      <>
        <LiveAnnouncer />
        <RouteAnnouncer />
        <div role="dialog" aria-label="Upload">
          <button type="button" onClick={() => {}} data-testid="dialog-control">
            Choose file
          </button>
        </div>
        <Page />
      </>
    );
    const { rerender } = render(tree);

    const control = screen.getByTestId("dialog-control");
    control.focus();

    // A focus yank out of an open dialog breaks its trap and loses the user's place.
    pathname.current = "/documents";
    rerender(tree);

    expect(control).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
  });
});
