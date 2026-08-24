import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";
import type { Therapy } from "@/components/therapy-compass/data/types";
import { TherapyKeyFacts } from "@/components/therapy-compass/record/key-facts";
import { OverlayRoot } from "@/components/ui/overlay-root";

const catalogue = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/therapy-compass-data", THERAPY_CATALOGUE_ASSETS.full), "utf8"),
) as Therapy[];

function bySlug(slug: string): Therapy {
  const record = catalogue.find((therapy) => therapy.slug === slug);
  if (!record) throw new Error(`Expected the catalogue to carry ${slug}`);
  return record;
}

afterEach(cleanup);

function renderFacts(therapy: Therapy) {
  return render(
    <>
      <OverlayRoot />
      <TherapyKeyFacts therapy={therapy} />
    </>,
  );
}

describe("TherapyKeyFacts", () => {
  it("renders four tappable glance cards and opens the full Suits and Format fields", async () => {
    const user = userEvent.setup();
    const therapy = bySlug("cognitive-behavioural-therapy-for-insomnia");
    renderFacts(therapy);

    const facts = screen.getByLabelText("Key facts");
    expect(within(facts).queryByText("Evidence")).not.toBeInTheDocument();
    expect(within(facts).getByText("Cautions")).toBeInTheDocument();
    expect(within(facts).getByText("Format")).toBeInTheDocument();
    expect(within(facts).getByText("Setting")).toBeInTheDocument();
    expect(within(facts).getByText("Suits")).toBeInTheDocument();
    expect(within(facts).getByText("Emergency/acute +2")).toBeInTheDocument();
    expect(within(facts).getByText("Group programme")).toBeInTheDocument();
    expect(within(facts).getAllByText("Tap for detail")).toHaveLength(4);
    expect(within(facts).queryByText(therapy.patientPopulation!)).not.toBeInTheDocument();

    await user.click(within(facts).getByRole("button", { name: /Suits:.*Open detail/i }));
    const suitsSheet = await screen.findByTestId("therapy-key-fact-sheet");
    expect(suitsSheet).toHaveTextContent(/sleep diaries/i);
    expect(suitsSheet).toHaveTextContent(/sleep restriction or stimulus control/i);

    await user.click(within(suitsSheet).getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("therapy-key-fact-sheet")).not.toBeInTheDocument();

    await user.click(within(facts).getByRole("button", { name: /Format:.*Open detail/i }));
    const formatSheet = await screen.findByTestId("therapy-key-fact-sheet");
    expect(formatSheet).toHaveTextContent(/4–8 sessions/);
    expect(formatSheet).toHaveTextContent(/between-session behavioural practice/);
  });

  it("leaves a card inert when the face is the whole field", () => {
    renderFacts({
      ...bySlug("cognitive-behavioural-therapy-for-insomnia"),
      contraindicationsOrCautions: "Avoid in acute mania.",
      limitations: null,
      sessionLength: "Single session",
      timeRequired: "Single session",
      setting: "Outpatient",
      patientPopulation: "Adults.",
    });

    const facts = screen.getByLabelText("Key facts");
    expect(within(facts).queryByRole("button", { name: /Open detail/i })).not.toBeInTheDocument();
    expect(within(facts).queryByText("Tap for detail")).not.toBeInTheDocument();
    expect(within(facts).getByText("Avoid in acute mania.")).toBeInTheDocument();
    expect(within(facts).getByText("Outpatient")).toBeInTheDocument();
  });
});
