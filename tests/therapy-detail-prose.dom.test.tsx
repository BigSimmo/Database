import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";
import { parseSteps, splitIndications } from "@/components/therapy-compass/data/select";
import type { Therapy } from "@/components/therapy-compass/data/types";
import {
  extractCitations,
  ProseBlock,
  splitParagraphs,
  splitSourceCitations,
} from "@/components/therapy-compass/prose";

const catalogue = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/therapy-compass-data", THERAPY_CATALOGUE_ASSETS.full), "utf8"),
) as Therapy[];

function bySlug(slug: string): Therapy {
  const record = catalogue.find((therapy) => therapy.slug === slug);
  if (!record) throw new Error(`Expected the catalogue to carry ${slug}`);
  return record;
}

afterEach(cleanup);

describe("therapy record prose", () => {
  it("drops the parts of `indications` the page already shows", () => {
    // Every record concatenates bestUsedFor + targetSymptoms + goals into
    // `indications`, which is why the old "When to use" block repeated two
    // sections verbatim and ran to fifteen phone lines.
    const therapy = bySlug("behavioural-activation-ba");
    const goals = splitIndications(therapy);

    expect(therapy.indications).toContain(therapy.bestUsedFor!);
    expect(therapy.indications).toContain(therapy.targetSymptoms!);
    expect(goals).toBeTruthy();
    expect(goals).not.toContain(therapy.bestUsedFor!);
    expect(goals).not.toContain(therapy.targetSymptoms!);
    expect(goals!.length).toBeLessThan(therapy.indications!.length);
  });

  it("returns the field unchanged when it does not follow the concatenated shape", () => {
    const therapy = { ...bySlug("behavioural-activation-ba"), bestUsedFor: null, targetSymptoms: null };
    expect(splitIndications(therapy)).toBe(therapy.indications!.trim());
  });

  it("lifts recognised source markers out of the reading line without losing them", () => {
    const { text, citations } = extractCitations(
      "Guidance matters because trauma work is harder to do safely. (PubMed) NICE also comments. (NICE)",
    );
    expect(text).toBe("Guidance matters because trauma work is harder to do safely. NICE also comments.");
    expect(citations).toEqual(["PubMed", "NICE"]);
  });

  it("leaves an unrecognised parenthetical exactly where the author put it", () => {
    // Mid-sentence, so it is prose or an abbreviation gloss, not a citation.
    for (const source of [
      "Confirm the formulation first (see below).",
      "Deliver cognitive behavioural therapy (CBT) with fidelity.",
      // A whole bracketed sentence after a full stop: bracketed, positioned
      // like a marker, but carrying sentence punctuation, so it stays put.
      "Confirm the formulation. (Check the risk assessment first.)",
    ]) {
      expect(extractCitations(source), source).toEqual({ text: source, citations: [] });
    }
  });

  it("recognises a publisher it has never seen before", () => {
    // The rule is positional, so a newly imported authority works on the day it
    // lands rather than the day someone remembers to add it to a list.
    const { text, citations } = extractCitations("Guideline context for PTSD. (Phoenix Australia)");
    expect(text).toBe("Guideline context for PTSD.");
    expect(citations).toEqual(["Phoenix Australia"]);
  });

  it("breaks a long single-block field into paragraphs", () => {
    const therapy = bySlug("behavioural-activation-ba");
    const paragraphs = splitParagraphs(therapy.contraindicationsOrCautions!);
    expect(paragraphs.length).toBeGreaterThan(1);
  });

  it("clamps a long block behind a labelled Show more control", async () => {
    const user = userEvent.setup();
    const long = bySlug("behavioural-activation-ba").contraindicationsOrCautions!;
    render(<ProseBlock text={long} label="Safety and cautions" />);

    const toggle = screen.getByRole("button", { name: /Show more of Safety and cautions/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // The clamped copy is clipped, never unmounted, so nothing is hidden from
    // find-in-page or assistive technology while collapsed.
    expect(screen.getByText(/Confirm that the dominant mechanism/)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole("button", { name: /Show less of Safety and cautions/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("offers no toggle for a block short enough to read whole", () => {
    render(<ProseBlock text="A short note about this therapy." label="Note" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps a trailing marker attached to its own sentence, not orphaned", () => {
    // The marker follows a full stop, so it belongs to the sentence before it.
    // If citations are parsed on the grouped paragraph, a marker can drift to
    // the following sentence and look like an orphan.
    const paragraphs = splitParagraphs(
      "Evidence is heterogeneous. (PubMed) PTSD symptoms respond best to trauma-focused work. (NICE)",
    );
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].citations).toEqual(["PubMed", "NICE"]);
    expect(paragraphs[0].sentences).toHaveLength(2);
    expect(paragraphs[0].sentences[0].citations).toEqual(["PubMed"]);
    expect(paragraphs[0].sentences[1].citations).toEqual(["NICE"]);
    expect(paragraphs[0].sentences[0].text).toBe("Evidence is heterogeneous.");
    expect(paragraphs[0].sentences[1].text).toBe("PTSD symptoms respond best to trauma-focused work.");
    expect(paragraphs[0].text).toBe("Evidence is heterogeneous. PTSD symptoms respond best to trauma-focused work.");
  });

  it("keeps every citation marker present in the rendered output", () => {
    const therapy = bySlug("supported-digital-trauma-focused-cbt");
    const { container } = render(<ProseBlock text={therapy.bestUsedFor!} label="Use when" />);
    const markers = therapy.bestUsedFor!.match(/\(PubMed\)/g) ?? [];
    if (markers.length) expect(container.textContent).toContain("PubMed");
  });
});

describe("therapy source provenance parsing", () => {
  it("splits the reference blob into one row per citation", () => {
    const therapy = bySlug("supported-digital-trauma-focused-cbt");
    const blob = therapy.sources[0]?.reference ?? therapy.sourceNotes ?? "";
    const { citations } = splitSourceCitations(blob);

    expect(citations.length).toBeGreaterThan(1);
    for (const citation of citations) expect(citation.text).not.toContain("(PubMed)");
  });

  it("demotes the import artefact to a record note instead of citing or deleting it", () => {
    const { citations, notes } = splitSourceCitations(
      "Systematic review of internet-delivered CBT for PTSD. (PubMed) Your attached prior chat for sequence and locked format continuity.",
    );
    expect(citations).toEqual([{ text: "Systematic review of internet-delivered CBT for PTSD.", authority: "PubMed" }]);
    expect(notes).toEqual(["Your attached prior chat for sequence and locked format continuity."]);
  });

  it("keeps an unattributed blob as a citation rather than demoting a real source", () => {
    const { citations, notes } = splitSourceCitations("Imported from an uploaded clinical export.");
    expect(citations).toEqual([{ text: "Imported from an uploaded clinical export.", authority: "" }]);
    expect(notes).toEqual([]);
  });
});

describe("therapy delivery steps", () => {
  it("splits arrow-separated delivery into steps", () => {
    // 52 of the 205 records write delivery as one arrow-separated sentence.
    // Rendered whole it is a wall of text with a "1." in front of it.
    const steps = parseSteps("Build engagement → set goals → review progress");
    expect(steps).toEqual(["Build engagement", "set goals", "review progress"]);
  });

  it("splits on arrows when the prose merely mentions a number", () => {
    const steps = parseSteps("Run 2 sessions of psychoeducation → review at 4 weeks");
    expect(steps).toEqual(["Run 2 sessions of psychoeducation", "review at 4 weeks"]);
  });

  it("keeps a causal chain intact inside a numbered step", () => {
    // Three real records number their steps and use an arrow inside one to
    // write a formulation. Splitting on arrows first turns that clinical chain
    // into fragments — worse than the wall of text arrow-splitting fixes.
    const therapy = bySlug("behaviour-therapy");
    const steps = parseSteps(therapy.deliverySteps);
    const chain = steps.find((step) => step.includes("→"));

    expect(chain, "the causal chain was split into fragments").toBeDefined();
    expect(chain).toContain("cue → behaviour");
    expect(steps[0]).toBe("Identify the specific behaviour pattern keeping the problem going.");
  });

  it("still splits the numbered and newline forms the catalogue also uses", () => {
    expect(parseSteps("1. Map the cycle. 2. Identify lost activities.")).toEqual([
      "Map the cycle.",
      "Identify lost activities.",
    ]);
    expect(parseSteps("Orient the patient\n2. Practise the skill")).toEqual([
      "Orient the patient",
      "Practise the skill",
    ]);
  });

  it("renders every arrow step for a real record", () => {
    const therapy = bySlug("supported-digital-trauma-focused-cbt");
    expect(parseSteps(therapy.deliverySteps).length).toBeGreaterThan(3);
  });
});
