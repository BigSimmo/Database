/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstNationsSearch } from "@/components/first-nations/first-nations-search";

vi.mock("@/components/first-nations/kit", async () => await import("./fixtures/first-nations-kit-double"));

describe("FirstNationsSearch", () => {
  it("finds by words and by number, with no microphone", () => {
    render(
      <FirstNationsSearch
        entries={[
          {
            id: "rurallink",
            title: "Rurallink support line",
            detail: "WA phone support",
            href: "/first-nations/contacts#support",
            number: "1800 552 002",
          },
        ]}
      />,
    );
    const box = screen.getByRole("searchbox", { name: "Search First Nations" });
    fireEvent.change(box, { target: { value: "Rurallink" } });
    expect(screen.getAllByRole("link", { name: /Rurallink support line/ }).length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: "1800 552 002" } });
    expect(screen.getAllByRole("link", { name: /Rurallink support line/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /voice|microphone|dictat/i })).toBeNull();
  });
});
