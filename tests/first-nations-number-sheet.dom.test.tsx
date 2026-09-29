/** @vitest-environment jsdom */
// Against the real mode kit, not the double: Review Focus 3 and 7 are about how the
// kit's dial sheet behaves on a phone with no Web Share and no clipboard.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactActions, NumberButton } from "@/components/first-nations/number-button";
import { ModeDialRow } from "@/components/mode-kit/dial-row";
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
  it("without Web Share, copies the labelled contact for sharing and still copies the number", async () => {
    phone({ share: false, clipboard: true });
    const sheet = openSheet();
    expect(within(sheet).queryByRole("button", { name: /^Share/ })).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy Aboriginal Interpreting WA to share" }));
    expect(await within(sheet).findByText("Contact copied to share")).toBeTruthy();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "Aboriginal Interpreting WA, Book 24 h ahead: 1800 000 012",
    );
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy number for Aboriginal Interpreting WA" }));
    expect(await within(sheet).findByText("Copied")).toBeTruthy();
  });

  it("offers the primary call and a public-only vCard", () => {
    phone({ share: false, clipboard: true });
    const sheet = openSheet();
    expect(within(sheet).getByRole("link", { name: "Call Aboriginal Interpreting WA" }).getAttribute("href")).toBe(
      "tel:1800000012",
    );
    const save = within(sheet).getByRole("link", { name: "Save to phone" });
    const vcard = decodeURIComponent(save.getAttribute("href")!.split(",")[1]);
    expect(vcard).toContain("FN:Aboriginal Interpreting WA");
    expect(vcard).toContain("TEL;TYPE=WORK:1800000012");
    expect(vcard).not.toMatch(/region|patient|situation|NOTE:|EMAIL:/i);
  });

  it("makes per-contact reports reachable from a list row", () => {
    const c = { ...contact, reportHref: "mailto:support@psychsift.com?subject=Wrong%20number" };
    render(
      <ul>
        <ModeDialRow
          label={c.name}
          number={{ display: c.number, tel: "tel:1800000012" }}
          testId="contact"
          sheetFooter={<ContactActions contact={c} />}
        />
      </ul>,
    );
    fireEvent.click(screen.getByTestId("contact-number"));
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Report a wrong number" }).getAttribute("href"),
    ).toBe(c.reportHref);
    expect(screen.getByText(/never patient or staff personal details/)).toBeTruthy();
  });

  it("does not copy when a native share is cancelled", async () => {
    phone({ share: true, clipboard: true });
    vi.mocked(navigator.share).mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: "Share Aboriginal Interpreting WA" }));
    await vi.waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("with no share and no clipboard at all, nothing throws and the number stays on screen (Review Focus 7)", async () => {
    phone({ share: false, clipboard: false });
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy number for Aboriginal Interpreting WA" }));
    expect(await within(sheet).findByText("Not copied. The number is 1800 000 012.")).toBeTruthy();
    expect(within(sheet).getAllByText("1800 000 012").length).toBeGreaterThan(0);
  });
});
