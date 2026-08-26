import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Therapy } from "@/components/therapy-compass/data/types";
import { THERAPY_MAX_COMPARE } from "@/lib/therapy-compass-navigation";

const tc = vi.hoisted(() => ({
  compareSlugs: [] as string[],
  addCompare: vi.fn(),
  removeCompare: vi.fn(),
  goCompare: vi.fn(),
  open: vi.fn(),
  openSheet: vi.fn(),
}));

vi.mock("@/components/therapy-compass/bindings", () => ({
  useTcBindings: () => ({
    search: { query: "CBT", tags: [] },
    compareSlugs: tc.compareSlugs,
    isInCompare: (slug: string) => tc.compareSlugs.includes(slug),
    addCompare: tc.addCompare,
    removeCompare: tc.removeCompare,
    goCompare: tc.goCompare,
    open: tc.open,
    openSheet: tc.openSheet,
  }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated: false, isSaved: () => false, setFavourite: vi.fn() }),
}));

import { TherapyCompareAction } from "@/components/therapy-compass/record/compare-action";
import { ResultCard } from "@/components/therapy-compass/therapy-card";

const therapy = {
  slug: "cognitive-behavioural-therapy",
  name: "Cognitive behavioural therapy",
  aliases: ["CBT"],
  tags: ["CBT"],
  category: "Behavioural",
  reviewStatus: "needs_review",
  briefInterventionAvailable: true,
  patientSheetAvailable: true,
} as Therapy;

beforeEach(() => {
  tc.compareSlugs = [];
});

afterEach(() => {
  tc.addCompare.mockReset();
  tc.removeCompare.mockReset();
  tc.goCompare.mockReset();
});

describe("Adding a therapy to the comparison", () => {
  describe("from a search-result card", () => {
    it("adds in place and does not navigate to the comparison", async () => {
      const user = userEvent.setup();
      render(<ResultCard therapy={therapy} />);

      await user.click(screen.getByRole("button", { name: "Add to compare" }));

      expect(tc.addCompare).toHaveBeenCalledWith(therapy.slug);
      expect(tc.goCompare).not.toHaveBeenCalled();
    });

    it("says the therapy is in the tray, and removes it on a second tap", async () => {
      tc.compareSlugs = [therapy.slug];
      const user = userEvent.setup();
      render(<ResultCard therapy={therapy} />);

      const control = screen.getByRole("button", { name: "In compare tray" });
      expect(control).toHaveAttribute("aria-pressed", "true");
      await user.click(control);

      expect(tc.removeCompare).toHaveBeenCalledWith(therapy.slug);
    });

    it("states why a full tray cannot take another, and keeps the control reachable", async () => {
      tc.compareSlugs = ["a", "b", "c", "d"].slice(0, THERAPY_MAX_COMPARE);
      const user = userEvent.setup();
      render(<ResultCard therapy={therapy} />);

      const control = screen.getByRole("button", { name: "Compare tray full" });
      // `aria-disabled`, never native `disabled`: the reason has to stay reachable.
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).not.toBeDisabled();
      expect(control).toHaveAttribute("title", expect.stringContaining("remove one first"));

      await user.click(control);
      expect(tc.addCompare).not.toHaveBeenCalled();
    });
  });

  describe("from a therapy record", () => {
    it("announces the add, because no tray is on screen to show it", async () => {
      const user = userEvent.setup();
      render(<TherapyCompareAction therapy={therapy} />);

      await user.click(screen.getByRole("button", { name: "Add to compare" }));

      expect(tc.addCompare).toHaveBeenCalledWith(therapy.slug);
      expect(screen.getByRole("status")).toHaveTextContent(
        `Added to compare — 1 of ${THERAPY_MAX_COMPARE} selected to compare.`,
      );
    });

    it("announces a removal too", async () => {
      tc.compareSlugs = [therapy.slug, "other"];
      const user = userEvent.setup();
      render(<TherapyCompareAction therapy={therapy} />);

      await user.click(screen.getByRole("button", { name: "In compare tray" }));

      expect(tc.removeCompare).toHaveBeenCalledWith(therapy.slug);
      expect(screen.getByRole("status")).toHaveTextContent(
        `Removed from compare — 1 of ${THERAPY_MAX_COMPARE} selected to compare.`,
      );
    });

    it("offers the comparison only once there is something to compare", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TherapyCompareAction therapy={therapy} />);
      expect(screen.queryByRole("button", { name: /^Compare \d/ })).toBeNull();

      tc.compareSlugs = [therapy.slug, "other"];
      rerender(<TherapyCompareAction therapy={therapy} />);
      await user.click(screen.getByRole("button", { name: "Compare 2" }));

      expect(tc.goCompare).toHaveBeenCalledTimes(1);
    });
  });
});
