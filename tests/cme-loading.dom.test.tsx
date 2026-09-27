import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "@/app/(search-app)/cme/loading";
import LogLoading from "@/app/(search-app)/cme/log/loading";

const CLEARANCE = "pb-[calc(max(1rem,env(safe-area-inset-bottom))+6rem)]";

describe("CPD loading state", () => {
  it("draws Today's shapes in Today's order: header, hero at the panel radius, card, two tiles, 52 px rows", () => {
    const { container } = render(<Loading />);
    const status = screen.getByRole("status", { name: "Loading your CPD record" });
    expect(status.className).toContain(CLEARANCE);
    expect(screen.getByTestId("cme-loading-header").className).toMatch(/\bh-12\b/);
    const hero = screen.getByTestId("cme-loading-hero");
    expect(hero.className).toMatch(/\brounded-xl\b/);
    expect(hero.className).toContain("bg-[color:var(--surface-summary)]");
    expect(screen.getAllByTestId("cme-loading-tile")).toHaveLength(2);
    const rows = container.querySelectorAll<HTMLElement>('[data-testid="cme-loading-rows"] [data-skeleton-row]');
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.className).toMatch(/\bmin-h-13\b/);
    const inOrder = ["cme-loading-header", "cme-loading-hero", "cme-loading-card", "cme-loading-rows"].map((id) =>
      screen.getByTestId(id),
    );
    for (let index = 1; index < inOrder.length; index += 1) {
      expect(
        inOrder[index - 1]!.compareDocumentPosition(inOrder[index]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("gives the Log its own list shapes, never Today's hero", () => {
    const { container } = render(<LogLoading />);
    expect(screen.getByRole("status", { name: "Loading your CPD log" }).className).toContain(CLEARANCE);
    expect(screen.queryByTestId("cme-loading-hero")).toBeNull();
    expect(container.querySelectorAll('[data-testid="cme-log-loading-rows"] [data-skeleton-row]')).toHaveLength(6);
  });

  it("is static: no shimmer, no animation, no transition", () => {
    for (const Page of [Loading, LogLoading]) {
      const { container, unmount } = render(<Page />);
      const moving = [...container.querySelectorAll<HTMLElement>("[class]")].filter((node) =>
        /animate-|shimmer|\btransition\b/.test(node.getAttribute("class") ?? ""),
      );
      expect(moving.map((node) => node.getAttribute("class"))).toEqual([]);
      unmount();
    }
  });

  it("no longer borrows the generic mode-home skeleton", () => {
    expect(readFileSync("src/app/(search-app)/cme/loading.tsx", "utf8")).not.toContain("ModeHomeRouteLoading");
  });
});
