/** @vitest-environment jsdom */
// The one cross-island rule (spec §6, Review Focus 10), so it is its own unit.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BeforeYouGoIn } from "@/components/first-nations/before-you-go-in";
import { FirstNationsSearch } from "@/components/first-nations/first-nations-search";
import { SituationModule, SituationProvider } from "@/components/first-nations/situation-module";
import { WhereIsHomePanel } from "@/components/first-nations/where-is-home";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

vi.mock("@/components/first-nations/kit", async () => await import("./fixtures/first-nations-kit-double"));
resetAfterEach();
const { model, hospital } = bedsideFixture();

describe("nothing patient-describing leaves the screen", () => {
  it("keeps situations, ticks, the region and the search text off storage, the URL and the network", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const pushState = vi.spyOn(history, "pushState");
    const replaceState = vi.spyOn(history, "replaceState");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    const href = window.location.href;
    render(
      <SituationProvider situations={model.situations} liaison={hospital.liaison}>
        <SituationModule />
        <BeforeYouGoIn steps={model.beforeYouGoIn} />
        <WhereIsHomePanel regions={model.regions} map={model.map} interpreter={model.interpreter} />
        <FirstNationsSearch entries={model.search} />
      </SituationProvider>,
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Situation" })).getByRole("button", { name: "Sorry Business" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Before you go in/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("checkbox")[0]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Goldfields" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to letter" }));
    const box = screen.getByRole("searchbox", { name: "Search First Nations" });
    fireEvent.change(box, { target: { value: "family" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(window.location.href).toBe(href);
    for (const spy of [setItem, pushState, replaceState, fetchSpy, sendBeacon]) expect(spy).not.toHaveBeenCalled();
  });
});
