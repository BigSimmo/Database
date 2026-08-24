import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerChatPerfectedMockupsPage } from "@/components/answer-chat-perfected-mockups";

function openAnswerSource() {
  const frame = screen.getByText("Phone · tap any number").closest("figure");
  if (frame === null) throw new Error("The interactive phone answer frame was not rendered.");
  const opener = within(frame).getByRole("button", { name: /Source 1, Physical health protocol/i });
  fireEvent.click(opener);
  return { frame, opener };
}

describe("answer-chat perfected mockup drawer", () => {
  it("does not steal page focus for a comparison drawer shown at load", () => {
    const sentinel = document.createElement("button");
    document.body.append(sentinel);
    sentinel.focus();

    render(<AnswerChatPerfectedMockupsPage />);

    expect(sentinel).toHaveFocus();
    sentinel.remove();
  });

  it("moves focus into the drawer, traps it, and restores the opening mark", async () => {
    render(<AnswerChatPerfectedMockupsPage />);
    const { frame, opener } = openAnswerSource();
    const drawer = within(frame).getByRole("dialog", { name: /Source 1 of 3/i });

    expect(drawer).toContainElement(document.activeElement as HTMLElement);

    const controls = within(drawer).getAllByRole("button");
    const first = controls[0];
    const last = controls[controls.length - 1];
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("keeps hover-revealed message actions visible when keyboard focus enters", () => {
    render(<AnswerChatPerfectedMockupsPage />);
    const action = screen
      .getAllByRole("button", { name: "Copy" })
      .find((button) => button.parentElement?.className.includes("group-hover:opacity-100"));

    expect(action?.parentElement).toHaveClass("group-focus-within:opacity-100");
  });
});
