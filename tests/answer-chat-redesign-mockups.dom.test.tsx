import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AnswerChatRedesignMockups } from "@/components/answer-chat-redesign-mockups";

describe("answer chat redesign mockups — citation interaction", () => {
  it("opens a quote preview from an inline citation in the simple phone frame", async () => {
    const user = userEvent.setup();
    render(<AnswerChatRedesignMockups />);

    const simplePhone = document.querySelector('[data-direction="simple"][data-device="phone"]');
    expect(simplePhone).toBeInstanceOf(HTMLElement);

    const frame = within(simplePhone as HTMLElement);
    await user.click(frame.getAllByRole("button", { name: /Source 1,/ })[0]);

    expect(frame.getByRole("heading", { level: 3, name: "WA Clozapine Protocol 2024" })).toBeInTheDocument();
    expect(frame.getByText(/ANC remaining at or above 1\.5/)).toBeInTheDocument();
  });

  it("lights a claim from the sophisticated desktop rail", async () => {
    const user = userEvent.setup();
    render(<AnswerChatRedesignMockups />);

    const sophisticatedDesktop = document.querySelector('[data-direction="sophisticated"][data-device="desktop"]');
    expect(sophisticatedDesktop).toBeInstanceOf(HTMLElement);

    const frame = within(sophisticatedDesktop as HTMLElement);
    await user.click(frame.getByRole("button", { name: /Source 1 in rail, WA Clozapine Protocol 2024/ }));

    expect(frame.getByRole("button", { name: /Source 1 in rail, WA Clozapine Protocol 2024/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(frame.getByText(/After 18 weeks of weekly full blood counts with ANC remaining/)).toBeInTheDocument();
  });
});
