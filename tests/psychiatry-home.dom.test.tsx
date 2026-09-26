/** @vitest-environment jsdom */

// The Psychiatry mode home is a dashboard of links to the sections it gathers.
// Every section keeps its own address, so each card must point at that
// section's existing home, and the dashboard must list exactly the sections the
// menu's Psychiatry group lists.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PsychiatryHome } from "@/components/psychiatry/psychiatry-home";
import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { phoneModeGroups } from "@/lib/phone-mode-groups";

afterEach(cleanup);

describe("PsychiatryHome", () => {
  it("links every section in the menu's Psychiatry group to its existing home", () => {
    render(<PsychiatryHome />);

    expect(screen.getByRole("heading", { level: 1, name: "Psychiatry" })).toBeTruthy();

    const group = phoneModeGroups.find((candidate) => candidate.id === "psychiatry");
    const sections = (group?.modeIds ?? []).filter((modeId: AppModeId) => modeId !== "psychiatry");
    expect(sections).toEqual(["dsm", "differentials", "specifiers", "formulation", "therapy-compass", "forms"]);

    const list = screen.getByRole("list", { name: "Psychiatry sections" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(sections.length);
    sections.forEach((modeId, index) => {
      expect(links[index]).toHaveTextContent(appModeDefinition(modeId).label);
      expect(links[index]).toHaveAttribute("href", appModeHomeHref(modeId));
    });
  });
});
