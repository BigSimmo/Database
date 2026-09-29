/** @vitest-environment jsdom */
// Uses the real mode kit (no test double), so the dial row's own number button and sheet are what is checked.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhereIsHomePanel } from "@/components/first-nations/where-is-home";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

resetAfterEach();
const { model } = bedsideFixture();

describe("WhereIsHomePanel with an interpreter number that cannot be dialled", () => {
  it("shows 'See website' as text with its source, never a tel: link or a dial sheet", () => {
    const interpreter = { ...model.interpreter!, number: "See website" };
    const { container } = render(
      <WhereIsHomePanel regions={model.regions} map={model.map} interpreter={interpreter} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Goldfields" }));

    const text = screen.getByText("See website");
    const row = text.closest("li");
    if (!row) throw new Error("the interpreter is not drawn as a list row");
    expect(text.closest("a, button")).toBeNull();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(row.querySelector("a[href^='tel:']")).toBeNull();
    expect(
      within(row)
        .getByRole("link", { name: /Test guide/ })
        .getAttribute("href"),
    ).toMatch(/^https:\/\//);

    fireEvent.click(text);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      [...container.querySelectorAll("a[href^='tel:']")].every((a) =>
        /^tel:\+?\d+$/.test(a.getAttribute("href") ?? ""),
      ),
    ).toBe(true);
  });
});
