import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerChatPerfectedMockupsPage } from "@/components/answer-chat-perfected-mockups";

function openAnswerSource() {
  const marks = screen.getAllByRole("button", { name: /Source 1, Physical health protocol/i });
  // The first four marks belong to the standalone specimen. This mark is in the
  // phone answer frame, which owns the drawer under test.
  const opener = marks[4];
  fireEvent.click(opener);
  return opener;
}

describe("answer-chat perfected mockup drawer", () => {
  it("moves focus into the drawer, traps it, and restores the opening mark", async () => {
    render(<AnswerChatPerfectedMockupsPage />);
    const opener = openAnswerSource();
    const drawer = screen.getAllByRole("dialog", { name: /Source 1 of 3/i })[0];

    expect(drawer).toContainElement(document.activeElement);

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
