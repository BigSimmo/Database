import { act, render, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "@/components/ui/sheet";
import {
  SHEET_INERT_MARKER,
  SHEET_INERT_SKIP_ATTRIBUTE,
  SHEET_PORTAL_ATTRIBUTE,
  shouldReclaimFocus,
} from "@/components/ui/sheet-focus";

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
  }
});

function TwoSheets({ shown }: { shown: "a" | "b" | "both" | "none" }) {
  return (
    <>
      <Sheet open={shown === "a" || shown === "both"} onClose={() => {}} title="Sheet A" portal>
        <p>A body</p>
      </Sheet>
      <Sheet open={shown === "b" || shown === "both"} onClose={() => {}} title="Sheet B" portal>
        <p>B body</p>
      </Sheet>
    </>
  );
}

/** Mounts an autofocus input one tick after the sheet body first paints. */
function DeferredAutofocusChild() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 20);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <input data-sheet-autofocus="true" data-testid="deferred-input" aria-label="Deferred" /> : null;
}

function panelOf(title: string) {
  const heading = Array.from(document.body.querySelectorAll("h2")).find((node) => node.textContent === title);
  expect(heading, `no open sheet titled "${title}"`).toBeTruthy();
  return heading?.closest('[role="dialog"]') as HTMLElement;
}

describe("shouldReclaimFocus", () => {
  it("reclaims from nothing at all", () => {
    expect(shouldReclaimFocus(null, null)).toBe(true);
    expect(shouldReclaimFocus(null, document.body)).toBe(true);
  });

  it("leaves focus alone inside the panel", () => {
    const panel = document.createElement("div");
    const control = document.createElement("button");
    panel.append(control);
    document.body.append(panel);

    expect(shouldReclaimFocus(panel, control)).toBe(false);
    panel.remove();
  });

  it("leaves focus alone in a surface portaled out of the sheet", () => {
    const panel = document.createElement("div");
    const portalHost = document.createElement("div");
    portalHost.setAttribute(SHEET_PORTAL_ATTRIBUTE, "true");
    const control = document.createElement("button");
    portalHost.append(control);
    document.body.append(panel, portalHost);

    expect(shouldReclaimFocus(panel, control)).toBe(false);
    panel.remove();
    portalHost.remove();
  });

  it("reclaims only from background this module deactivated", () => {
    const panel = document.createElement("div");
    const deactivated = document.createElement("div");
    deactivated.setAttribute(SHEET_INERT_MARKER, "true");
    const backgroundControl = document.createElement("button");
    deactivated.append(backgroundControl);
    const untouched = document.createElement("button");
    document.body.append(panel, deactivated, untouched);

    expect(shouldReclaimFocus(panel, backgroundControl)).toBe(true);
    expect(shouldReclaimFocus(panel, untouched)).toBe(false);

    panel.remove();
    deactivated.remove();
    untouched.remove();
  });
});

describe("Sheet background inerting", () => {
  it("deactivates page background while open and restores it on close", () => {
    const background = document.createElement("div");
    background.append(document.createElement("button"));
    document.body.append(background);

    const { rerender } = render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    expect(background).toHaveAttribute("inert");
    expect(background).toHaveAttribute(SHEET_INERT_MARKER, "true");

    rerender(
      <Sheet open={false} onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    expect(background).not.toHaveAttribute("inert");
    expect(background).not.toHaveAttribute(SHEET_INERT_MARKER);
    background.remove();
  });

  it("honours the opt-out marker and never clobbers another owner's inert", () => {
    const optedOut = document.createElement("div");
    optedOut.setAttribute(SHEET_INERT_SKIP_ATTRIBUTE, "true");
    const alreadyInert = document.createElement("div");
    alreadyInert.setAttribute("inert", "");
    document.body.append(optedOut, alreadyInert);

    const { rerender } = render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    expect(optedOut).not.toHaveAttribute("inert");
    expect(alreadyInert).not.toHaveAttribute(SHEET_INERT_MARKER);

    rerender(
      <Sheet open={false} onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    // The pre-existing inert belongs to its own owner and must survive.
    expect(alreadyInert).toHaveAttribute("inert");
    optedOut.remove();
    alreadyInert.remove();
  });

  it("deactivates a lower sheet while one is stacked above it, then revives it", () => {
    const { rerender } = render(<TwoSheets shown="a" />);
    const lowerBackdrop = panelOf("Sheet A").parentElement as HTMLElement;
    expect(lowerBackdrop).not.toHaveAttribute("inert");

    rerender(<TwoSheets shown="both" />);
    expect(lowerBackdrop).toHaveAttribute("inert");

    rerender(<TwoSheets shown="a" />);
    expect(lowerBackdrop).not.toHaveAttribute("inert");
  });
});

describe("Sheet open focus", () => {
  it("does not restore focus to the opener when another sheet takes over", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { rerender } = render(<TwoSheets shown="a" />);
    // Swap sheets in one commit: A's restore and B's open focus race.
    rerender(<TwoSheets shown="b" />);

    await waitFor(() => {
      expect(panelOf("Sheet B").contains(document.activeElement)).toBe(true);
    });
    expect(document.activeElement).not.toBe(opener);
    opener.remove();
  });

  it("keeps focus in the panel across a close-then-reopen of the same sheet", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { rerender } = render(<TwoSheets shown="a" />);
    rerender(<TwoSheets shown="none" />);
    rerender(<TwoSheets shown="a" />);

    await waitFor(() => {
      expect(panelOf("Sheet A").contains(document.activeElement)).toBe(true);
    });
    opener.remove();
  });

  it("upgrades to a late-mounted autofocus child", async () => {
    render(
      <Sheet open onClose={() => {}} title="Deferred" portal>
        <DeferredAutofocusChild />
      </Sheet>,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-testid="deferred-input"]'));
    });
  });

  it("takes focus back when it lands on deactivated background", async () => {
    const background = document.createElement("div");
    const backgroundControl = document.createElement("button");
    background.append(backgroundControl);
    document.body.append(background);

    render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );
    await waitFor(() => {
      expect(panelOf("Solo").contains(document.activeElement)).toBe(true);
    });

    // jsdom does not enforce `inert`, so background focus is still reachable
    // here; the marker is what tells the sheet this focus is stale.
    act(() => {
      backgroundControl.focus();
    });

    await waitFor(() => {
      expect(panelOf("Solo").contains(document.activeElement)).toBe(true);
    });
    background.remove();
  });

  it("stops reclaiming focus once the user interacts", async () => {
    const background = document.createElement("div");
    const backgroundControl = document.createElement("button");
    background.append(backgroundControl);
    document.body.append(background);

    render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );
    await waitFor(() => {
      expect(panelOf("Solo").contains(document.activeElement)).toBe(true);
    });

    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      backgroundControl.focus();
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.activeElement).toBe(backgroundControl);
    background.remove();
  });
});

describe("Sheet Tab cycle", () => {
  it("skips visible controls explicitly removed from the tab order", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* () {
        yield {} as DOMRect;
      },
    } as DOMRectList);

    render(
      <Sheet open onClose={() => {}} title="Tab order" portal>
        <a href="#first">First</a>
        <input aria-label="Programmatic only" tabIndex={-1} />
        <button type="button">Last</button>
      </Sheet>,
    );

    const panel = panelOf("Tab order");
    const first = panel.querySelector<HTMLAnchorElement>('a[href="#first"]');
    const excluded = panel.querySelector<HTMLInputElement>('input[tabindex="-1"]');
    const last = Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Last",
    );
    expect(first).not.toBeNull();
    expect(excluded).not.toBeNull();
    expect(last).toBeDefined();

    act(() => {
      first?.focus();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });

    expect(document.activeElement).toBe(last);
    expect(document.activeElement).not.toBe(excluded);
  });
});
