/** @vitest-environment jsdom */
// Against the real mode kit, not the double: Review Focus 3 and 7 are about how the
// kit's dial sheet behaves on a phone with no Web Share and no clipboard.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberButton } from "@/components/first-nations/number-button";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

resetAfterEach();
const { model } = bedsideFixture();
const contact = model.interpreter!;

function phone({ share, clipboard }: { share: boolean; clipboard: boolean }) {
  Object.defineProperty(navigator, "share", {
    value: share ? vi.fn().mockResolvedValue(undefined) : undefined,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard ? { writeText: vi.fn().mockResolvedValue(undefined) } : undefined,
    configurable: true,
  });
  document.execCommand = vi.fn().mockReturnValue(false);
}

const openSheet = () => {
  render(<NumberButton contact={contact} />);
  fireEvent.click(screen.getByText("1800 000 012"));
  return screen.getByRole("dialog", { name: "Aboriginal Interpreting WA" });
};

describe("the number sheet on a limited phone", () => {
  it("without Web Share, hides Share and still copies, saying Copied (Review Focus 3)", async () => {
    phone({ share: false, clipboard: true });
    const sheet = openSheet();
    expect(within(sheet).queryByRole("button", { name: /^Share/ })).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy number for Aboriginal Interpreting WA" }));
    expect(await within(sheet).findByText("Copied")).toBeTruthy();
  });

  it("with no share and no clipboard at all, nothing throws and the number stays on screen (Review Focus 7)", async () => {
    phone({ share: false, clipboard: false });
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy number for Aboriginal Interpreting WA" }));
    expect(await within(sheet).findByText("Not copied. The number is 1800 000 012.")).toBeTruthy();
    expect(within(sheet).getAllByText("1800 000 012").length).toBeGreaterThan(0);
  });
});
