import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowErrorPanel } from "@/app/mockups/ward-flow/ward-flow-error-panel";
import MockupsErrorBoundary from "@/app/mockups/error";

/**
 * THE BOUNDARY OVER THE WARD SCREENS, AND THE TWO WAYS IT COULD BE MADE WORSE THAN NOTHING.
 *
 * Before `src/app/mockups/ward-flow/error.tsx` existed, any throw below it fell through to the
 * application shell's boundary and replaced the whole document. Ten deliberate guards live in
 * `src/components/ward-management`; one of them firing removed every patient from the screen to
 * announce that one record was wrong.
 *
 * Two properties are pinned here because NOTHING ELSE IN THE REPOSITORY CAN SEE THEM:
 *
 *   1. **The boundary must not swallow the error.** A panel reading "something went wrong" that
 *      logs nothing converts a loud failure into an invisible one — the exact inversion of the
 *      defect, and it would still look like a fix. Every gate stays green through that change.
 *   2. **An `error.tsx` must be a Client Component.** `tsc` compiles a file missing `"use client"`
 *      without complaint and every DOM test still passes; the failure appears only on a real
 *      request. That is the class of defect this repository has already shipped twice.
 *
 * The static half carries a positive AND a negative control, because a marker check that has
 * quietly stopped finding its marker reads exactly like a passing one.
 */

const BOUNDARY_FILES = [
  "src/app/mockups/ward-flow/error.tsx",
  "src/app/mockups/ward-flow/statistics/error.tsx",
  "src/app/mockups/error.tsx",
] as const;

/** A file known to carry the directive, and one known not to — so the reader is provably able to
 *  return both answers. Without these a broken read would report "use client" absent everywhere,
 *  or present everywhere, and one of those directions passes silently. */
const KNOWN_CLIENT_FILE = "src/app/caring-contacts/error.tsx";
const KNOWN_SERVER_FILE = "src/app/mockups/ward-flow/statistics/page.tsx";

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/** True only when the directive is the FIRST statement, which is where Next requires it. A file
 *  merely mentioning the string in a comment further down is not a Client Component. */
function declaresUseClient(source: string): boolean {
  return /^\s*["']use client["'];/.test(source);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the ward flow error boundaries are client components", () => {
  it("reads the directive correctly on a known client file and a known server file", () => {
    expect(declaresUseClient(read(KNOWN_CLIENT_FILE))).toBe(true);
    expect(declaresUseClient(read(KNOWN_SERVER_FILE))).toBe(false);
  });

  it.each(BOUNDARY_FILES)("%s opens with the use client directive", (file) => {
    const source = read(file);
    expect(source.length).toBeGreaterThan(200);
    expect(declaresUseClient(source)).toBe(true);
  });

  it.each(BOUNDARY_FILES)("%s takes Next 16's retry, not the older reset", (file) => {
    // `reset()` clears the error state and re-renders WITHOUT re-fetching, so a button reading
    // "Try again" wired to it advertises an action it does not perform. Same ruling as
    // `src/app/caring-contacts/error.tsx`.
    const source = read(file);
    expect(source).toContain("retry");
    expect(source).not.toContain("reset");
  });
});

describe("the ward flow error panel refuses to swallow the error", () => {
  function renderPanel(overrides: { message?: string; stack?: string } = {}) {
    const error = Object.assign(new Error(overrides.message ?? "a distinctive failure from a guard"), {
      digest: "digest-for-the-server-log",
    });
    error.stack = overrides.stack ?? "Error: a distinctive failure\n    at someGuard (some-module.ts:1:1)";
    const retry = vi.fn();
    render(
      <WardFlowErrorPanel
        error={error}
        retry={retry}
        title="A title"
        description="A description"
        logLabel="A log label:"
        testId="panel-under-test"
      />,
    );
    return { error, retry };
  }

  it("renders the thrown message itself, not a stand-in for it", () => {
    renderPanel({ message: "no stage position for admission state" });
    expect(screen.getByTestId("ward-flow-error-message").textContent).toBe("no stage position for admission state");
  });

  it("logs the error OBJECT, so the stack is reachable in the console in every environment", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { error } = renderPanel();

    const ourCalls = consoleError.mock.calls.filter((call) => call[0] === "A log label:");
    expect(ourCalls).toHaveLength(1);
    // Asserting identity, not a string: logging `error.message` would satisfy a looser check while
    // throwing the stack away, which is most of what the console entry is for.
    expect(ourCalls[0][1]).toBe(error);
  });

  it("puts the stack on screen outside production", () => {
    // Vitest runs with NODE_ENV "test", so the development disclosure applies.
    renderPanel({ stack: "Error: boom\n    at aNamedFrame (a-module.ts:12:3)" });
    expect(screen.getByTestId("ward-flow-error-stack").textContent).toContain("aNamedFrame");
  });

  it("shows the digest, which is the only handle on a server-side throw in production", () => {
    renderPanel();
    expect(screen.getByTestId("ward-flow-error-digest").textContent).toContain("digest-for-the-server-log");
  });

  it("says the message was absent rather than rendering an empty box", () => {
    renderPanel({ message: "" });
    expect(screen.getByTestId("ward-flow-error-message").textContent).toBe("The error carried no message.");
  });

  it("wires both recovery controls to real handlers", () => {
    const { retry } = renderPanel();
    const retryButton = screen.getByTestId("ward-flow-error-retry");
    retryButton.click();
    expect(retry).toHaveBeenCalledTimes(1);
    // The reload control exists as the only one that can change the outcome: WardFlowProvider sits
    // in the layout ABOVE every boundary here, so retry() re-renders against the same world.
    expect(screen.getByTestId("ward-flow-error-reload")).toBeTruthy();
  });

  it("keeps the synthetic notice on a failed screen, where a screenshot is most likely to be taken", () => {
    renderPanel();
    expect(screen.getByTestId("ward-flow-error-synthetic-notice").textContent).toContain("synthetic prototype");
  });
});

describe("the mockups boundary catches what the two nearer ward flow boundaries cannot", () => {
  /**
   * `src/app/mockups/error.tsx` exists specifically to catch a throw out of
   * `ward-flow/layout.tsx` — `DeveloperAreaGate`, `WardFlowProvider`, or its `useReducer`
   * initialiser — none of which either nearer boundary can reach, because an `error.tsx` never
   * wraps the `layout.tsx` sitting beside it in the same segment. This suite renders the mockups
   * boundary's own default export directly (not a shared panel: it deliberately does not import
   * `WardFlowErrorPanel`, because `tests/ward-flow-seam.test.ts` forbids anything outside Ward
   * Flow's own folders from importing its code) and proves it behaves as a real boundary rather
   * than existing only as a file on disk.
   */
  function renderBoundary(overrides: { message?: string; stack?: string } = {}) {
    const error = Object.assign(new Error(overrides.message ?? "a throw from ward-flow/layout.tsx"), {
      digest: "digest-for-the-layout-throw",
    });
    error.stack =
      overrides.stack ??
      "Error: a throw from ward-flow/layout.tsx\n    at WardFlowProvider (ward-flow-provider.tsx:1:1)";
    const retry = vi.fn();
    render(<MockupsErrorBoundary error={error} retry={retry} />);
    return { error, retry };
  }

  it("renders the thrown message itself, not a stand-in for it", () => {
    renderBoundary({ message: "seedWardFlowStateAt threw during layout render" });
    expect(screen.getByTestId("mockups-error-message").textContent).toBe(
      "seedWardFlowStateAt threw during layout render",
    );
  });

  it("logs the error OBJECT under its own label, so it is distinguishable from the nearer boundaries in the console", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { error } = renderBoundary();

    const ourCalls = consoleError.mock.calls.filter(
      (call) => call[0] === "Unhandled runtime error captured by the mockups boundary:",
    );
    expect(ourCalls).toHaveLength(1);
    expect(ourCalls[0][1]).toBe(error);
  });

  it("shows the digest, which is the only handle on a server-side throw in production", () => {
    renderBoundary();
    expect(screen.getByTestId("mockups-error-digest").textContent).toContain("digest-for-the-layout-throw");
  });

  it("wires both recovery controls to real handlers, distinct from the ward flow boundaries' testids", () => {
    const { retry } = renderBoundary();
    expect(() => screen.getByTestId("ward-flow-error-retry")).toThrow();

    const retryButton = screen.getByTestId("mockups-error-retry");
    retryButton.click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mockups-error-reload")).toBeTruthy();
  });

  it("says plainly that the preview could not be shown", () => {
    renderBoundary();
    expect(screen.getByTestId("mockups-error-boundary").textContent).toContain("could not be shown");
  });
});
