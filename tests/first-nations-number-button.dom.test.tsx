/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberButton } from "@/components/first-nations/number-button";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

vi.mock("@/components/first-nations/kit", async () => await import("./fixtures/first-nations-kit-double"));
resetAfterEach();
const { model } = bedsideFixture();

describe("NumberButton", () => {
  it("is a plain tel: link until it opens the kit's dial sheet with source and checked date", () => {
    render(<NumberButton contact={model.interpreter!} />);
    const link = screen.getByText("1800 000 012");
    expect(link.closest("a")?.getAttribute("href")).toBe("tel:1800000012");
    fireEvent.click(link);
    const sheet = screen.getByRole("dialog", { name: "Aboriginal Interpreting WA" });
    expect(within(sheet).getByText("From Test guide · Checked 26 Sep 2026")).toBeTruthy();
    expect(sheet.getAttribute("data-tel")).toBe("tel:1800000012");
    expect(sheet.getAttribute("data-copy")).toBe("1800 000 012");
  });
});
