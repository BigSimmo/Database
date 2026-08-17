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
  it("uses the normal search pill chrome and provides useful results, clearing, and no-results states", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();
    const search = within(dialog).getByPlaceholderText("Search the guide");
    expect(search.closest(".answer-footer-search-pill")).not.toBeNull();

    const submit = within(dialog).getByRole("button", { name: "Submit guide search" });
    expect(submit).toHaveClass("chat-send-button");

    await user.type(search, "privacy");
    expect(within(dialog).getByRole("heading", { name: "Search results" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: /Privacy and safe use/ })).toBeVisible();
    expect(within(dialog).getByText(/topics? found for “privacy”/)).toBeVisible();

    await user.click(submit);
    expect(within(dialog).getByRole("heading", { name: "Search results" })).toBeVisible();
    expect(search).toHaveValue("privacy");

    await user.clear(search);
    await user.type(search, "no matching phrase anywhere");
    expect(within(dialog).getByRole("heading", { name: "No matching guide topic" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Clear guide search" }));
    expect(within(dialog).getByRole("heading", { name: "How to verify an answer" })).toBeVisible();
  });

  it("shows a useful verification example and hides the shared header and bottom search chrome while scrolling down", async () => {
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
    expect(footer?.querySelector("[data-guide-universal-search]")).not.toBeNull();
    expect(footer?.querySelector("[data-guide-tour-action-row]")).not.toBeNull();
    expect(header).toHaveClass("pt-[max(1rem,var(--safe-area-top))]");

    Object.defineProperty(scrollBody, "scrollHeight", { configurable: true, value: 1_600 });
    Object.defineProperty(scrollBody, "clientHeight", { configurable: true, value: 600 });
    Object.defineProperty(scrollBody, "scrollTop", { configurable: true, value: 140 });
    fireEvent.scroll(scrollBody!);
    await waitFor(() => expect(footerLayer).toHaveClass("translate-y-full"));
    expect(header).toHaveClass("max-h-0");
    expect(header).not.toHaveClass("pt-[max(1rem,var(--safe-area-top))]");
    expect(header).toHaveAttribute("aria-hidden", "true");
    expect(header).toHaveAttribute("inert", "");
    expect(footer).toHaveAttribute("aria-hidden", "true");
    expect(footer).toHaveAttribute("inert", "");
    expect(within(footer!).queryByRole("button", { name: "Start guided tour" })).not.toBeInTheDocument();
    expect(content).toHaveClass("pb-0");
    expect(content).not.toHaveClass("pb-40");

    Object.defineProperty(scrollBody, "scrollTop", { configurable: true, value: 0 });
    fireEvent.scroll(scrollBody!);
    await waitFor(() => expect(footerLayer).not.toHaveClass("translate-y-full"));
    expect(header).not.toHaveClass("max-h-0");
    expect(header).toHaveClass("pt-[max(1rem,var(--safe-area-top))]");
    expect(header).toHaveAttribute("aria-hidden", "false");
    expect(header).not.toHaveAttribute("inert");
    expect(footer).toHaveAttribute("aria-hidden", "false");
    expect(footer).not.toHaveAttribute("inert");
    expect(content).toHaveClass("pb-40");
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
    expect(content).toHaveClass("pb-40");
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

  it("wires the contextual footer controls across home, topics, topic, and tour views", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();

    await user.click(within(dialog).getByRole("button", { name: "Browse all topics" }));
    expect(within(dialog).getByRole("heading", { name: "All guide topics" })).toBeVisible();
    await user.click(within(dialog).getAllByRole("button", { name: "Guide home" }).at(-1)!);

    await user.click(within(dialog).getByRole("button", { name: "Ask a question" }));
    expect(within(dialog).getByRole("heading", { name: "Ask better questions" })).toBeVisible();
    await user.click(within(dialog).getAllByRole("button", { name: "Guide home" }).at(-1)!);

    await user.click(within(dialog).getAllByRole("button", { name: "Start guided tour" }).at(-1)!);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("heading", { level: 2, name: "Ask for one decision at a time" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Previous" }));
    expect(within(dialog).getByRole("heading", { level: 2, name: "The evidence-first workflow" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Exit tour" }));
    expect(within(dialog).getByRole("heading", { name: "How to verify an answer" })).toBeVisible();
  });

  it("persists tour progress locally without persisting the guide search query", async () => {
    const user = userEvent.setup();
    const firstRender = renderGuide();
    const search = within(firstRender.dialog).getByPlaceholderText("Search the guide");
    await user.type(search, "citation");
    await user.click(within(firstRender.dialog).getByRole("button", { name: "Clear guide search" }));
    await user.click(within(firstRender.dialog).getAllByRole("button", { name: "Start guided tour" })[0]);
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
    expect(within(secondRender.dialog).getByPlaceholderText("Search the guide")).toHaveValue("");
    expect(within(secondRender.dialog).getAllByText("Guide progress · 1 of 5").length).toBeGreaterThan(0);
    await user.click(within(secondRender.dialog).getAllByRole("button", { name: "Resume guided tour" })[0]);
    expect(
      within(secondRender.dialog).getByRole("heading", { level: 2, name: "Ask for one decision at a time" }),
    ).toBeVisible();
  });

  it("moves through every tour step and records completion", async () => {
    const user = userEvent.setup();
    const { dialog } = renderGuide();
    await user.click(within(dialog).getAllByRole("button", { name: "Start guided tour" })[0]);

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
    await user.click(within(dialog).getAllByRole("button", { name: "Review guided tour" })[0]);
    expect(within(dialog).getByRole("heading", { name: "Guided tour complete" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Return to Guide home" }));
    expect(within(dialog).getByRole("heading", { name: "How to verify an answer" })).toBeVisible();
    await user.click(within(dialog).getAllByRole("button", { name: "Review guided tour" })[0]);
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
