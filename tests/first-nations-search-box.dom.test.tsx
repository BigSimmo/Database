/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstNationsSearch } from "@/components/first-nations/first-nations-search";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

vi.mock("@/components/first-nations/kit", async () => await import("./fixtures/first-nations-kit-double"));
resetAfterEach();
const { model } = bedsideFixture();

describe("FirstNationsSearch", () => {
  it("finds by words and by number, with no microphone", () => {
    render(<FirstNationsSearch entries={model.search} />);
    const box = screen.getByRole("searchbox", { name: "Search First Nations" });
    fireEvent.change(box, { target: { value: "interpreting" } });
    expect(screen.getAllByRole("link", { name: /Aboriginal Interpreting WA/ }).length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: "000 012" } });
    expect(screen.getAllByRole("link", { name: /Aboriginal Interpreting WA/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /voice|microphone|dictat/i })).toBeNull();
  });
});
