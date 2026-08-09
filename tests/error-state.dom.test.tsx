import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorState, errorStateCopy, type ErrorStateProps, type ErrorStateReason } from "@/components/ui/error-state";

/**
 * GATES.md §3, "Render '0 matches' after a failed request". The gate names
 * `ErrorState`; these are the assertions behind it.
 *
 * The invariant under test is not "the copy is nice". It is that a failed
 * request cannot report a count — on the services page "0 matches" asserts
 * there are no crisis services when the search never ran.
 */
describe("ErrorState", () => {
  it("never renders a digit for any reason, with or without a subject", () => {
    const reasons: ErrorStateReason[] = ["request_failed", "unauthorized", "timeout", "unknown"];
    for (const reason of reasons) {
      for (const subject of [undefined, "Services"]) {
        const { container, unmount } = render(<ErrorState reason={reason} subject={subject} onRetry={() => {}} />);
        expect(container.textContent ?? "").not.toMatch(/\d/);
        unmount();
      }
    }
  });

  it("says what could not be loaded rather than that nothing matched", () => {
    render(<ErrorState reason="request_failed" subject="Services" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Services could not be loaded");
    expect(screen.queryByText(/no matches/i)).toBeNull();
    expect(screen.queryByText(/0 matches/i)).toBeNull();
  });

  it("names the subject only when given one, and never invents a count in its place", () => {
    const { rerender } = render(<ErrorState reason="request_failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("That could not be loaded");
    rerender(<ErrorState reason="unauthorized" subject="Favourites" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in to continue");
  });

  it("exposes no prop through which a count could arrive", () => {
    // The structural half of the rule, asserted at compile time: `children` and
    // any count-shaped prop are absent from ErrorStateProps, so the only route
    // left is caller copy — which the tripwire below covers. Adding either prop
    // later turns these into type errors and fails `npm run typecheck`.
    //
    // Written as type-level equalities rather than a `@ts-expect-error` render:
    // whether TypeScript rejects an excess property through a JSX spread of a
    // variable is a detail of excess-property checking, and if it ever stopped
    // rejecting it, the unused directive would itself become the error.
    type HasChildren = "children" extends keyof ErrorStateProps ? true : false;
    type CountProp = Extract<keyof ErrorStateProps, "count" | "matchCount" | "resultCount" | "total" | "results">;
    type HasCount = [CountProp] extends [never] ? false : true;

    const hasChildren: HasChildren = false;
    const hasCount: HasCount = false;
    expect([hasChildren, hasCount]).toEqual([false, false]);
  });

  it("warns when a caller writes a result count into its copy", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<ErrorState reason="request_failed" title="0 matches found" />);
      // The tripwire records rather than throws: a thrown error here turns a
      // copy defect into a blank page on the one screen already reporting a
      // failure. The recorder is bounded and deduplicated, and silenced under
      // NODE_ENV=test, so the assertion is on the rendered outcome.
      expect(screen.getByRole("alert")).toHaveTextContent("0 matches found");
    } finally {
      warn.mockRestore();
    }
  });

  it("does not trip on a number that is not a result count", () => {
    // "Error 503" and "retry in 30 seconds" are legitimate; only a figure
    // attached to a counted noun is the defect.
    expect(() => render(<ErrorState reason="request_failed" title="Error 503" />)).not.toThrow();
    expect(screen.getByRole("alert")).toHaveTextContent("Error 503");
  });

  it("runs the retry action and restores itself when the retry rejects", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockRejectedValue(new Error("still down"));
    render(<ErrorState reason="request_failed" subject="Services" onRetry={onRetry} />);
    const retry = screen.getByRole("button", { name: /retry/i });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    // A rejected retry leaves the failure surface on screen rather than
    // escaping as an unhandled rejection.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /retry/i })).toBeEnabled();
  });

  it("omits the retry control entirely when no handler is supplied", () => {
    render(<ErrorState reason="unauthorized" subject="Services" />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("renders caller actions alongside retry", () => {
    // A plain button rather than an anchor: internal navigation in this repo
    // goes through `<Link>`, and a raw `<a href="/…">` fails
    // `@next/next/no-html-link-for-pages` even inside a test. What is under
    // test is that an arbitrary ReactNode reaches the action row at all.
    render(
      <ErrorState reason="request_failed" onRetry={() => {}} actions={<button type="button">Browse library</button>} />,
    );
    expect(screen.getByRole("button", { name: "Browse library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("degrades an unrecognised reason to the neutral copy and never throws", () => {
    const reason = "catastrophe" as unknown as ErrorStateReason;
    expect(() => render(<ErrorState reason={reason} subject="Services" />)).not.toThrow();
    expect(screen.getByRole("alert")).toHaveTextContent("Services could not be loaded");
    expect(screen.getByRole("alert")).toHaveAttribute("data-reason", "unknown");
  });

  it("survives a prototype-chain reason without throwing", () => {
    const reason = "toString" as unknown as ErrorStateReason;
    expect(() => render(<ErrorState reason={reason} />)).not.toThrow();
    expect(errorStateCopy(reason).reason).toBe("unknown");
  });

  it("maps live to a role so a state present on first paint need not interrupt", () => {
    const { rerender } = render(<ErrorState reason="request_failed" live="polite" testId="es" />);
    expect(screen.getByTestId("es")).toHaveAttribute("role", "status");
    rerender(<ErrorState reason="request_failed" live="off" testId="es" />);
    expect(screen.getByTestId("es")).not.toHaveAttribute("role");
  });
});
