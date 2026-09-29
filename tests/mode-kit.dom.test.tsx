/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Siren } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModeActionButton } from "@/components/mode-kit/action-button";
import { formatModeDate, formatModeTime, modeAgo, spokenModeNumber } from "@/components/mode-kit/dates";
import { ModeDialRow } from "@/components/mode-kit/dial-row";
import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeFeaturedModule } from "@/components/mode-kit/featured-module";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeHeroLink } from "@/components/mode-kit/hero-link";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { ModeUpdatedLine } from "@/components/mode-kit/updated-line";

afterEach(() => cleanup());

const NOW = new Date("2026-09-26T02:00:00.000Z");
const SWITCHBOARD = { display: "(08) 9000 0000", tel: "tel:0890000000" };

function classesOf(element: Element): string[] {
  return element.className.split(/\s+/);
}

describe("mode dates and spoken numbers", () => {
  it("writes the date first, Perth 24-hour time, and the age in words", () => {
    expect(formatModeDate("2026-09-20T04:00:00.000Z")).toBe("20 Sep 2026");
    expect(formatModeDate("not a date")).toBe("");
    expect(formatModeTime("2026-09-25T18:14:00.000Z")).toBe("02:14");
    expect(modeAgo("2026-09-26T01:00:00.000Z", NOW)).toBe("today");
    expect(modeAgo("2026-09-20T04:00:00.000Z", NOW)).toBe("6 days ago");
    expect(modeAgo("2026-03-12T04:00:00.000Z", NOW)).toBe("6 months ago");
  });

  it("reads each digit and pauses between groups", () => {
    expect(spokenModeNumber("(08) 9000 0000")).toBe("0 8, 9 0 0 0, 0 0 0 0");
    expect(spokenModeNumber("ext 4412")).toBe("ext 4 4 1 2");
  });
});

describe("ModeDialRow", () => {
  it("puts the number in the right-hand column and dials from a named call disc", async () => {
    const onCall = vi.fn();
    render(
      <ul>
        <ModeDialRow label="Switchboard" number={SWITCHBOARD} onCall={onCall} testId="row" />
      </ul>,
    );
    const row = screen.getByTestId("row");
    const call = within(row).getByRole("link", { name: "Call Switchboard, 0 8, 9 0 0 0, 0 0 0 0" });
    expect(call.getAttribute("href")).toBe("tel:0890000000");
    expect(classesOf(call)).toContain("min-h-12");
    expect(classesOf(within(row).getByTestId("row-number"))).toContain("w-30");
    call.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(call);
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it("is exactly 48px or 52px: the row itself carries no vertical padding", () => {
    render(
      <ul>
        <ModeDialRow label="Switchboard" number={SWITCHBOARD} testId="single" />
        <ModeDialRow label="Registrar" subtitle="Psychiatry" number={SWITCHBOARD} testId="double" />
      </ul>,
    );
    const single = classesOf(screen.getByTestId("single"));
    const double = classesOf(screen.getByTestId("double"));
    expect(single).toContain("min-h-12");
    expect(double).toContain("min-h-13");
    for (const classes of [single, double]) {
      expect(classes.some((name) => /^(py|pt|pb|p)-/.test(name))).toBe(false);
    }
  });

  it("gives a desk-only number no call disc but keeps the column width", () => {
    render(
      <ul>
        <ModeDialRow label="Ward 4" number={{ display: "ext 4412", tel: null }} testId="row" />
      </ul>,
    );
    const row = screen.getByTestId("row");
    expect(within(row).queryByRole("link")).toBeNull();
    expect(row.querySelector(".w-12")).not.toBeNull();
  });

  it("says Not recorded when there is no number", () => {
    render(
      <ul>
        <ModeDialRow label="Pharmacy" number={null} testId="row" />
      </ul>,
    );
    expect(within(screen.getByTestId("row")).getByText("Not recorded")).toBeTruthy();
  });

  it("opens the dial sheet with routes, source and the checked date", async () => {
    render(
      <ul>
        <ModeDialRow
          label="Registrar"
          context="Synthetic Hospital"
          number={{ display: "ext 4412", tel: null, copy: "4412" }}
          routes={[
            { label: "From your mobile", number: SWITCHBOARD },
            { label: "From a pager", number: null },
          ]}
          source={{ label: "Hospital directory", url: "https://example.org/directory" }}
          checkedAt="2026-09-20T04:00:00.000Z"
          now={NOW}
          testId="row"
        />
      </ul>,
    );
    await userEvent.click(screen.getByTestId("row-number"));
    const body = await screen.findByTestId("row-sheet-body");
    expect(within(body).getByText("Synthetic Hospital")).toBeTruthy();
    expect(within(body).getByTestId("row-sheet-number").textContent).toBe("ext 4412");
    expect(
      within(body).getByRole("link", { name: "Call Registrar from your mobile, 0 8, 9 0 0 0, 0 0 0 0" }),
    ).toBeTruthy();
    expect(within(body).getByText("Not recorded")).toBeTruthy();
    expect(within(body).getByTestId("row-sheet-checked").textContent).toContain("Checked 20 Sep 2026 · 6 days ago");
    expect(within(body).getByRole("link", { name: "Hospital directory" }).getAttribute("rel")).toBe(
      "noreferrer noopener",
    );
  });

  it("marks an emergency number with a quiet red disc and dot only when asked", () => {
    render(
      <ul>
        <ModeDialRow label="Emergency" number={SWITCHBOARD} tone="emergency" testId="red" />
        <ModeDialRow label="Switchboard" number={SWITCHBOARD} testId="plain" />
      </ul>,
    );
    expect(screen.getByTestId("red-emergency-dot")).toBeTruthy();
    expect(screen.queryByTestId("plain-emergency-dot")).toBeNull();
  });
});

describe("list, tiles and small parts", () => {
  it("paints only the header icon tile in the mode colour", () => {
    render(
      <ModeGroupedList eyebrow="Hospital" headerIcon={Siren} mode="on-call" testId="group">
        <ModeRow title="Switchboard" testId="row" />
        <ModeRow title="Registrar" subtitle="Psychiatry" testId="two" />
      </ModeGroupedList>,
    );
    expect(screen.getByRole("heading", { name: "Hospital" })).toBeTruthy();
    expect(screen.getByTestId("group-icon").getAttribute("data-mode-identity")).toBe("on-call");
    expect(screen.getByTestId("group").getAttribute("data-mode-identity")).toBeNull();
    expect(classesOf(screen.getByTestId("row"))).toContain("min-h-12");
    expect(classesOf(screen.getByTestId("two"))).toContain("min-h-13");
  });

  it("keeps a trailing control beside a linked row, never inside the link", () => {
    render(
      <ModeGroupedList>
        <ModeRow
          title="Registrar"
          href="/on-call/whos-on"
          trailing={<ModeActionButton icon={Siren} label="Report" onClick={() => {}} />}
          testId="linked"
        />
      </ModeGroupedList>,
    );
    const link = screen.getByTestId("linked");
    const button = screen.getByRole("button", { name: "Report" });
    expect(link.contains(button)).toBe(false);
    expect(link.closest("li")?.contains(button)).toBe(true);
  });

  it("will not type-check a button that does nothing", () => {
    // @ts-expect-error: a button needs href, onClick or an explicit disabled state.
    const noop = <ModeActionButton icon={Siren} label="Nothing" />;
    expect(noop).toBeTruthy();
  });

  it("reserves rows at the same heights as the rows they stand in for", () => {
    render(<ModeModuleSkeleton rows={2} twoLine testId="skeleton" />);
    const rows = screen.getByTestId("skeleton").querySelectorAll("[data-skeleton-row]");
    expect(rows).toHaveLength(2);
    expect(classesOf(rows[0])).toContain("min-h-13");
  });

  it("draws state as words with a small dot, amber only for a warning", () => {
    render(
      <>
        <ModeStateLabel testId="muted">Not set up</ModeStateLabel>
        <ModeStateLabel tone="warning" testId="warning">
          Removed
        </ModeStateLabel>
      </>,
    );
    expect(screen.getByTestId("muted").querySelector("[data-state-dot]")?.className).toContain("--border-strong");
    expect(screen.getByTestId("warning").querySelector("[data-state-dot]")?.className).toContain("--warning");
  });

  it("drops a source that is not https", () => {
    render(
      <ModeUpdatedLine
        updatedAt="2026-09-20T04:00:00.000Z"
        sources={[
          { label: "Safe", url: "https://example.org" },
          { label: "Unsafe", url: "javascript:alert(1)" },
        ]}
        now={NOW}
        testId="line"
      />,
    );
    const line = screen.getByTestId("line");
    expect(line.textContent).toContain("Updated 20 Sep 2026 · 6 days ago");
    expect(within(line).queryByText("Unsafe")).toBeNull();
  });

  it("renders the notice, tiles, hero link and action button with their names", () => {
    render(
      <>
        <ModeNotice tone="warning">A number was removed</ModeNotice>
        <ModeFactTiles>
          <ModeFactTile label="Beds" value="12" />
        </ModeFactTiles>
        <ModeHeroLink href="/on-call" title="Who do I call now?" featured mode="on-call" testId="hero" />
        <ModeActionButton icon={Siren} label="Report" disabled testId="action" />
      </>,
    );
    expect(screen.getByRole("status").textContent).toBe("A number was removed");
    expect(screen.getByText("Beds")).toBeTruthy();
    expect(screen.getByTestId("hero").getAttribute("data-mode-identity")).toBe("on-call");
    expect(screen.getByRole("button", { name: "Report" })).toHaveProperty("disabled", true);
  });
});

describe("ModeFeaturedModule", () => {
  it("sets the mode identity itself and carries the featured surface, as any element", () => {
    render(
      <ModeFeaturedModule mode="my-work" as="section" className="gap-1" testId="featured">
        <p>Renew next</p>
      </ModeFeaturedModule>,
    );
    const featured = screen.getByTestId("featured");
    expect(featured.tagName).toBe("SECTION");
    expect(featured.getAttribute("data-mode-identity")).toBe("my-work");
    // A 2px identity edge (not the hero link's hairline border), because a
    // richer, taller module needs a stronger cue than a 1px line to still
    // read as tinted rather than merely bordered.
    expect(classesOf(featured)).toContain("border-2");
    expect(classesOf(featured)).toContain("bg-[color:var(--mode-identity-soft)]");
    expect(classesOf(featured)).toContain("border-[color:var(--mode-identity-border)]");
    expect(classesOf(featured)).toContain("gap-1");
    expect(within(featured).getByText("Renew next")).toBeInTheDocument();
  });

  it("defaults to a plain div when no element is named", () => {
    render(<ModeFeaturedModule mode="on-call">Content</ModeFeaturedModule>);
    expect(screen.getByText("Content").tagName).toBe("DIV");
  });
});

describe("the kit stays neutral and light", () => {
  const kitDir = join(process.cwd(), "src", "components", "mode-kit");
  const files = [
    "action-button.tsx",
    "dates.ts",
    "dial-row.tsx",
    "dial-sheet.tsx",
    "fact-tile.tsx",
    "featured-module.tsx",
    "grouped-list.tsx",
    "hero-link.tsx",
    "module-skeleton.tsx",
    "notice.tsx",
    "recipes.ts",
    "state-label.tsx",
    "type.ts",
    "updated-line.tsx",
  ];

  it("imports nothing from any one mode and never uses a weight over 600", () => {
    for (const file of files) {
      const source = readFileSync(join(kitDir, file), "utf8");
      expect(source, file).not.toMatch(/@\/(components|lib)\/(on-call|cme|admin|roster|teaching|first-nations)\//);
      expect(source, file).not.toMatch(/font-(bold|extrabold|black)\b/);
    }
  });

  it("declares the summary surface tokens for light, dark and forced colours", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    for (const token of [
      "--surface-summary",
      "--surface-summary-ink",
      "--surface-summary-muted",
      "--surface-summary-line",
    ]) {
      expect(css.match(new RegExp(`${token}:`, "g"))?.length ?? 0, token).toBeGreaterThanOrEqual(3);
    }
  });
});
