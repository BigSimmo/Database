/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fixedClock, type Clock } from "@/lib/caring-contacts/clock";
import { LiaisonHero } from "@/components/first-nations/liaison-hero";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

vi.mock("@/components/first-nations/kit", async () => await import("./fixtures/first-nations-kit-double"));
resetAfterEach();
const { hospital } = bedsideFixture();

const status = (text: string) => screen.getByText(text).closest("[data-state]");

function movingClock(iso: string): { clock: Clock; set: (next: string) => void } {
  let now = new Date(iso);
  return { clock: { now: () => now }, set: (next) => (now = new Date(next)) };
}

function reduceMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("LiaisonHero", () => {
  it("server-renders 'Hours not confirmed' before the clock runs", () => {
    expect(renderToString(<LiaisonHero hospital={hospital} clock={fixedClock("2026-09-22T06:20:00Z")} />)).toContain(
      "Hours not confirmed",
    );
  });

  it("shows 'until 16:30' in green and calls liaison while open", () => {
    render(<LiaisonHero hospital={hospital} clock={fixedClock("2026-09-22T06:20:00Z")} />);
    expect(status("Open now")?.getAttribute("data-state")).toBe("live");
    expect(screen.getByTestId("fn-hero-figure").textContent).toBe("until 16:30");
    expect(screen.getByRole("link", { name: "Call Aboriginal liaison team" }).getAttribute("href")).toBe(
      "tel:90000001",
    );
  });

  it("switches to the switchboard at exactly 16:30 (Review Focus 6)", () => {
    render(<LiaisonHero hospital={hospital} clock={fixedClock("2026-09-22T08:30:00Z")} />);
    expect(screen.queryByText("Open now")).toBeNull();
    expect(status("Closed · opens tomorrow 08:00")?.getAttribute("data-state")).toBe("muted");
    expect(screen.getByTestId("fn-hero-figure").className).toContain("fn-display-36");
    expect(screen.getByTestId("fn-hero-figure").textContent).toContain("9000 0000");
    expect(screen.getByText("Ask who covers liaison tonight")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Call Switchboard" }).getAttribute("href")).toBe("tel:90000000");
  });

  it("never says open when the recheck is overdue, and keeps the liaison number visible (Review Focus 2)", () => {
    // 101 days after the 26 Sep check, at 10:00 on a Tuesday: inside the liaison's hours.
    render(<LiaisonHero hospital={hospital} clock={fixedClock("2027-01-05T02:00:00Z")} />);
    expect(screen.queryByText("Open now")).toBeNull();
    expect(status("Due for a check")?.getAttribute("data-state")).toBe("warning");
    expect(screen.getByTestId("fn-hero-figure").textContent).toContain("9000 0000");
    expect(screen.getByRole("link", { name: "Call Switchboard" })).toBeTruthy();
    expect(screen.getByText("9000 0001")).toBeTruthy();
  });

  describe("the green dot's one pulse (Review Focus 11)", () => {
    it("is green but does not pulse when the page first computes 'Open now'", () => {
      reduceMotion(false);
      render(<LiaisonHero hospital={hospital} clock={fixedClock("2026-09-22T06:20:00Z")} />);
      expect(status("Open now")?.getAttribute("data-state")).toBe("live");
      expect(document.querySelector("[data-pulse]")).toBeNull();
    });

    it("pulses once for 600 ms on a later change to open", () => {
      reduceMotion(false);
      vi.useFakeTimers();
      const { clock, set } = movingClock("2026-09-22T23:59:00Z"); // 07:59 Wednesday
      render(<LiaisonHero hospital={hospital} clock={clock} />);
      expect(screen.queryByText("Open now")).toBeNull();
      set("2026-09-23T00:00:00Z");
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(status("Open now")?.getAttribute("data-state")).toBe("live");
      expect(document.querySelector("[data-pulse]")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(document.querySelector("[data-pulse]")).toBeNull();
    });

    it("never pulses with reduced motion", () => {
      reduceMotion(true);
      vi.useFakeTimers();
      const { clock, set } = movingClock("2026-09-22T23:59:00Z");
      render(<LiaisonHero hospital={hospital} clock={clock} />);
      set("2026-09-23T00:00:00Z");
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(status("Open now")?.getAttribute("data-state")).toBe("live");
      expect(document.querySelector("[data-pulse]")).toBeNull();
    });
  });
});
