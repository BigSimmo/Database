import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuideDialog } from "@/components/clinical-dashboard/guide-dialog";
import { guideTopics } from "@/components/clinical-dashboard/guide-content";
import { guideProgressStorageKey } from "@/components/clinical-dashboard/guide-progress";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 60));
  });
});

function renderGuide() {
  const onClose = vi.fn();
  render(<GuideDialog open onClose={onClose} />);
  return { dialog: screen.getByRole("dialog", { name: "Clinical KB guide" }), onClose };
}

describe("Clinical KB Guide Centre", () => {
  /**
   * The guide carries NO composer. The bottom dock is the guided-tour action and
   * nothing else, so a text input reappearing anywhere in this dialog means the
   * "search the guide" chat surface has come back.
   */
  it("ships no search composer anywhere in the dialog", () => {
    const { dialog } = renderGuide();

    expect(dialog.querySelector("[data-guide-universal-search]")).toBeNull();
    expect(dialog.querySelector("input")).toBeNull();
    expect(dialog.querySelector(".answer-footer-search-pill")).toBeNull();
    expect(within(dialog).queryByPlaceholderText("Search the guide")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("search")).not.toBeInTheDocument();
  });

  /**
   * "Guided tour" used to be three simultaneous controls: the tab, the in-content
   * TourPreview card and the docked action. Only the tab and the docked action
   * remain, and the SINGULAR query below is what keeps the card from returning —
   * `getByRole` throws on a second match.
   */
  it("offers exactly one guided-tour action outside the tab bar", () => {
    const { dialog } = renderGuide();

    expect(within(dialog).getByRole("button", { name: "Start guided tour" })).toBeVisible();
    expect(within(dialog).queryByRole("heading", { name: "3-minute guided tour" })).not.toBeInTheDocument();
  });

  it("compacts the phone header while hiding only the bottom dock on downward scroll", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const { dialog } = renderGuide();
    expect(within(dialog).getByText("Check each claim, not just the summary")).toBeVisible();
    expect(within(dialog).getByLabelText("Neutral illustrative answer")).toHaveTextContent(
      "place its citation beside the words it supports",
    );
    // Mount schedules an rAF-deferred hide-state reset (use-hide-on-scroll's
    // resetKey effect); flush it before the first scroll so it cannot fire
    // after and revert the scroll-triggered hide mid-assertion.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    const scrollBody = dialog.querySelector<HTMLElement>(".polished-scroll");
    const footer = dialog.querySelector<HTMLElement>("[data-guide-mobile-footer]");
    const footerLayer = footer?.parentElement;
    const header = dialog.querySelector<HTMLElement>(".guide-centre-header");
    const content = dialog.querySelector<HTMLElement>("[data-guide-content]");
    expect(scrollBody).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(header).not.toBeNull();
    expect(content).not.toBeNull();
    expect(footer?.querySelector("[data-guide-tour-action-row]")).not.toBeNull();
    expect(header).toHaveClass("pt-[max(1rem,var(--safe-area-top))]");
    expect(header).not.toHaveClass("guide-centre-header--compact");

    Object.defineProperty(scrollBody, "scrollHeight", { configurable: true, value: 1_600 });
    Object.defineProperty(scrollBody, "clientHeight", { configurable: true, value: 600 });
    Object.defineProperty(scrollBody, "scrollTop", { configurable: true, value: 140 });
    fireEvent.scroll(scrollBody!);
    await waitFor(() => expect(footerLayer).toHaveClass("translate-y-full"));
    /**
     * The header stays pinned and only its branded row compacts. It used to
     * collapse with the dock, which took "Close guide" and the view tabs out
     * of reach and consumed the dock reporter's available runway.
     */
    expect(header).not.toHaveClass("max-h-0");
    expect(header).toHaveClass("guide-centre-header--compact");
    expect(header).toHaveClass("max-sm:pt-[max(0.5rem,var(--safe-area-top))]");
    expect(header).toHaveAttribute("aria-hidden", "false");
    expect(header).not.toHaveAttribute("inert");
    expect(within(header!).getByRole("button", { name: "Close guide" })).toBeVisible();
    expect(within(header!).getByRole("button", { name: "Guide home" })).toBeVisible();
    expect(footer).toHaveAttribute("aria-hidden", "true");
    expect(footer).toHaveAttribute("inert", "");
    expect(within(footer!).queryByRole("button", { name: "Start guided tour" })).not.toBeInTheDocument();
    expect(content).toHaveClass("pb-0");
    expect(content).not.toHaveClass("pb-[calc(5rem+var(--safe-area-bottom))]");

    Object.defineProperty(scrollBody, "scrollTop", { configurable: true, value: 0 });
    fireEvent.scroll(scrollBody!);
    await waitFor(() => expect(footerLayer).not.toHaveClass("translate-y-full"));
    expect(header).toHaveAttribute("aria-hidden", "false");
    expect(header).not.toHaveAttribute("inert");
    expect(header).not.toHaveClass("guide-centre-header--compact");
    expect(footer).toHaveAttribute("aria-hidden", "false");
    expect(footer).not.toHaveAttribute("inert");
    expect(content).toHaveClass("pb-[calc(5rem+var(--safe-area-bottom))]");
  });

  it("keeps the guide footer available while the desktop body scrolls", () => {
    const { dialog } = renderGuide();
    const scrollBody = dialog.querySelector<HTMLElement>(".polished-scroll");
    const footer = dialog.querySelector<HTMLElement>("[data-guide-mobile-footer]");
    const footerLayer = footer?.parentElement;
    const content = dialog.querySelector<HTMLElement>("[data-guide-content]");

    Object.defineProperty(scrollBody, "scrollTop", { configurable: true, value: 80 });
    fireEvent.scroll(scrollBody!);

    expect(footerLayer).not.toHaveClass("translate-y-full");
    expect(footer).toHaveAttribute("aria-hidden", "false");
    expect(footer).not.toHaveAttribute("inert");
    expect(content).toHaveClass("pb-[calc(5rem+var(--safe-area-bottom))]");
  });

  it("wires every quick task to its complete guide topic", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();
    const tasks = [
      ["Ask a better question", "Ask better questions"],
      ["Choose document scope", "Choose the right document scope"],
      ["Verify an answer", "Understand and verify an answer"],
      ["Use content safely", "Privacy and safe use"],
    ] as const;

    for (const [task, heading] of tasks) {
      await user.click(within(dialog).getAllByRole("button", { name: "Guide home" })[0]);
      await user.click(within(dialog).getByRole("button", { name: task }));
      expect(within(dialog).getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  it("navigates all topics and the sources walkthrough without leaving the dialog", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();
    await user.click(within(dialog).getByRole("button", { name: "All topics" }));
    expect(within(dialog).getByRole("heading", { name: "All guide topics" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: /Sources & citations/ }));
    expect(within(dialog).getByRole("heading", { name: "Work with sources and citations" })).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Clinical KB guide" })).toBeVisible();
  });

  it("opens every item in the guide contents", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();

    for (const topic of guideTopics) {
      await user.click(within(dialog).getAllByRole("button", { name: topic.navLabel })[0]);
      expect(within(dialog).getByRole("heading", { name: topic.title })).toBeVisible();
    }
  });

  it("wires the docked tour controls, including Previous on phones", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();
    const actionRow = () => within(dialog.querySelector<HTMLElement>("[data-guide-tour-action-row]")!);

    await user.click(actionRow().getByRole("button", { name: "Start guided tour" }));
    // Previous is present but inert on the first step; it is no longer `sm:`-only,
    // because removing the composer freed the room a phone step-back needs.
    expect(actionRow().getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(actionRow().getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("heading", { level: 2, name: "Ask for one decision at a time" })).toBeVisible();
    await user.click(actionRow().getByRole("button", { name: "Previous" }));
    expect(within(dialog).getByRole("heading", { level: 2, name: "The evidence-first workflow" })).toBeVisible();
    await user.click(actionRow().getByRole("button", { name: "Exit tour" }));
    expect(within(dialog).getByRole("heading", { name: "How to verify an answer" })).toBeVisible();

    // The tab bar navigates; the dock no longer duplicates it.
    expect(within(dialog).queryByRole("button", { name: "Browse all topics" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Ask a question" })).not.toBeInTheDocument();
  });

  it("persists tour progress locally across sessions", async () => {
    const user = userEvent.setup();
    const firstRender = renderGuide();
    await user.click(within(firstRender.dialog).getByRole("button", { name: "Start guided tour" }));
    expect(
      within(firstRender.dialog).getByRole("heading", { level: 2, name: "The evidence-first workflow" }),
    ).toBeVisible();
    await user.click(within(firstRender.dialog).getByRole("button", { name: "Continue" }));

    const stored = JSON.parse(window.localStorage.getItem(guideProgressStorageKey) ?? "null") as {
      completedStepIds: string[];
    };
    expect(stored.completedStepIds).toEqual(["start"]);

    cleanup();
    const secondRender = renderGuide();
    expect(within(secondRender.dialog).getAllByText("Guide progress · 1 of 5").length).toBeGreaterThan(0);
    await user.click(within(secondRender.dialog).getByRole("button", { name: "Resume guided tour" }));
    expect(
      within(secondRender.dialog).getByRole("heading", { level: 2, name: "Ask for one decision at a time" }),
    ).toBeVisible();
  });

  it("moves through every tour step and records completion", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();
    await user.click(within(dialog).getByRole("button", { name: "Start guided tour" }));

    for (const heading of [
      "Ask for one decision at a time",
      "Start broad unless the task is source-specific",
      "Verify in three steps",
      "Copy with context",
    ]) {
      await user.click(within(dialog).getByRole("button", { name: "Continue" }));
      expect(within(dialog).getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    await user.click(within(dialog).getByRole("button", { name: "Complete tour" }));
    expect(within(dialog).getByRole("heading", { name: "Guided tour complete" })).toBeVisible();
    const stored = JSON.parse(window.localStorage.getItem(guideProgressStorageKey) ?? "null") as {
      completedStepIds: string[];
    };
    expect(stored.completedStepIds).toEqual(["start", "ask", "scope", "verify", "safe-use"]);
  });

  it("supports tour review, restart, and dialog dismissal", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      guideProgressStorageKey,
      JSON.stringify({
        version: 1,
        completedStepIds: ["start", "ask", "scope", "verify", "safe-use"],
        lastStepId: "safe-use",
      }),
    );
    const { dialog, onClose } = renderGuide();
    await user.click(within(dialog).getByRole("button", { name: "Review guided tour" }));
    expect(within(dialog).getByRole("heading", { name: "Guided tour complete" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Return to Guide home" }));
    expect(within(dialog).getByRole("heading", { name: "How to verify an answer" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Review guided tour" }));
    await user.click(within(dialog).getByRole("button", { name: "Review tour" }));
    expect(within(dialog).getByRole("heading", { level: 2, name: "The evidence-first workflow" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Guided tour" }));
    expect(within(dialog).getByRole("heading", { name: "Guided tour complete" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Restart guided tour" }));
    expect(window.localStorage.getItem(guideProgressStorageKey)).toBeNull();
    expect(within(dialog).getByRole("heading", { level: 2, name: "The evidence-first workflow" })).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close guide" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
