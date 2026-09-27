/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrisisBlock, CrisisStrip } from "@/components/first-nations/crisis";
import { FirstNationsLoading } from "@/components/first-nations/first-nations-loading";

describe("First Nations crisis numbers", () => {
  it("draws 000 and 13YARN as direct tel links, 000 the only red", () => {
    render(<CrisisStrip />);
    const emergency = screen.getByRole("link", { name: /000/ });
    const yarn = screen.getByRole("link", { name: /13 92 76/ });
    expect(emergency.getAttribute("href")).toBe("tel:000");
    expect(yarn.getAttribute("href")).toBe("tel:139276");
    expect(emergency.className).toMatch(/danger/);
    expect(yarn.className).not.toMatch(/danger/);
  });
  it("lists 000, 13YARN, MHERL and Lifeline on inner pages", () => {
    render(<CrisisBlock />);
    for (const n of ["000", "13 92 76", "1300 555 788", "13 11 14"]) expect(screen.getByText(n)).toBeTruthy();
  });
  it("keeps the real strip in the loading skeleton, with no animation", () => {
    const { container } = render(<FirstNationsLoading />);
    expect(screen.getByRole("link", { name: /13 92 76/ })).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/animate-|shimmer/);
  });
});
