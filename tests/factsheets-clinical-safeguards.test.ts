import { describe, expect, it } from "vitest";

import {
  factsheets,
  findFactsheet,
  printBlocks,
  relatedFactsheets,
  type Factsheet,
} from "@/components/factsheets/factsheets-data";

/**
 * Record-level clinical safeguards for the patient factsheet library.
 *
 * These assertions come from the 2026-09-14 source-checked claim review
 * (`PsychSift_Factsheets_*` handover, claim ids quoted per test). Each one
 * pins a specific way the patient-facing copy can mislead: a held claim that
 * escaped into shipped text, a clinician-only dose concept projected into
 * patient instructions, a product-specific rule replaced by a generic one, or
 * a duration description that reads as a waiting period before urgent help.
 *
 * The review status of the underlying claims is
 * `source_text_checked_pending_clinical_review`. These tests therefore protect
 * *safety framing*, not clinical approval — nothing here asserts that a sheet
 * is fit for publication.
 */

/** Every string a reader can see on screen or in the printed take-away. */
function readableText(sheet: Factsheet): string {
  const printed = printBlocks(sheet)
    .flatMap((block) => {
      switch (block.kind) {
        case "prose":
          return [block.heading, block.body];
        case "list":
          return [block.heading, ...block.items];
        case "facts":
          return [block.heading, ...block.items.flatMap((item) => [item.k, item.v])];
        case "sources":
          return [block.heading, ...block.items.map((item) => `${item.title} ${item.org}`)];
      }
    })
    .join(" ");
  return `${sheet.title} ${sheet.brand ?? ""} ${sheet.summary} ${sheet.audience} ${printed}`;
}

/** Both reading levels, because `printBlocks` swaps the easy/standard prose. */
function allReadableText(sheet: Factsheet): string {
  return `${readableText(sheet)} ${printBlocks(sheet, "easy")
    .map((block) => (block.kind === "prose" ? block.body : ""))
    .join(" ")}`;
}

function sheetOrFail(slug: string): Factsheet {
  const sheet = findFactsheet(slug);
  expect(sheet, `factsheet ${slug} must exist`).toBeDefined();
  return sheet!;
}

describe("held claims never reach patient-facing copy", () => {
  it("omits the bipolar prevalence figure held for want of a dated source", () => {
    // ps-clm-factsheets-bipolar-prevalence-held: "2 in 100" carries no
    // population, diagnostic scope, timeframe or dated source, and the core
    // patient explanation does not need it.
    const text = allReadableText(sheetOrFail("bipolar"));
    expect(text).not.toMatch(/\b2\s*in\s*100\b/i);
    expect(text).not.toMatch(/\b(?:around|about)\s+2%\s+of\s+(?:people|the population)/i);
  });

  it("omits the SSRI utilisation superlative held for want of a class denominator", () => {
    // ps-clm-factsheets-ssri-utilisation-held: an antidepressant share of all
    // mental-health prescriptions does not establish the SSRI share of
    // antidepressants. The superlative stays out until a dated Australian
    // dataset with the correct drug-class denominator is checked.
    const text = allReadableText(sheetOrFail("ssri"));
    expect(text).not.toMatch(/most (?:commonly |widely )?prescribed (?:class|type)/i);
    expect(text).not.toMatch(/most common antidepressant class/i);
  });

  it("states no Better Access or MyMedicare funding rule on the GAD sheet", () => {
    // ps-clm-factsheets-gad-funding-held: referral and rebate requirements,
    // including their exceptions, need the current dated government factsheet.
    // A care-pathway sentence ("your GP can build a mental health care plan")
    // is fine; a promise about rebates, session counts or referral rules is not.
    const text = allReadableText(sheetOrFail("gad"));
    expect(text).not.toMatch(/better access|mymedicare|medicare rebate|bulk ?bill/i);
    expect(text).not.toMatch(/\b(?:rebate|subsidis\w+)\b/i);
    expect(text).not.toMatch(/\b(?:ten|10|six|6)\s+(?:subsidised\s+)?sessions?\b/i);
  });

  it("links CCI without reproducing it or claiming reuse rights", () => {
    // ps-clm-factsheets-cbt-cci-rights: the copyright notice grants no
    // republication of worksheets and no permission to send full texts for
    // indexing. The sheet may point at CCI; it may not carry their content.
    const sheet = sheetOrFail("cbt");
    const cci = sheet.sources.filter((source) => /cci|clinical interventions/i.test(`${source.title} ${source.org}`));
    expect(cci.length, "the CBT sheet should still point at the WA resource").toBeGreaterThan(0);
    for (const source of cci) {
      expect(source.url, "the CCI citation must be a link to CCI itself").toMatch(
        /^https:\/\/www\.cci\.health\.wa\.gov\.au\//,
      );
    }
    const text = allReadableText(sheet);
    expect(text).not.toMatch(/thought (?:record|diary) (?:sheet|worksheet)/i);
    expect(text).not.toMatch(/module \d/i);
    expect(text).not.toMatch(/worksheet/i);
  });

  it("keeps the held Lexapro indication discrepancy out of escitalopram copy", () => {
    // ps-clm-factsheets-escitalopram-indications-held: the hosted Lexapro PI
    // lists depression and social anxiety in 4.1 but carries GAD/OCD dosing
    // text elsewhere. Neither reading may be asserted from that discrepancy.
    const text = allReadableText(sheetOrFail("escitalopram"));
    expect(text).not.toMatch(/\b(?:OCD|obsessive[- ]compulsive)\b/i);
    expect(text).not.toMatch(/generalised anxiety disorder/i);
  });
});

describe("clinician-only dose concepts stay out of patient instructions", () => {
  it("does not state an unqualified universal sertraline maximum", () => {
    // ps-clm-factsheets-sertraline-dose-range: the 200 mg/day ceiling applies
    // to several adult indications but is not universal — PMDD uses different
    // schedules and maxima. A bare ceiling in patient copy generalises it.
    const sheet = sheetOrFail("sertraline");
    const text = allReadableText(sheet);
    const mentionsCeiling = /200\s*mg/i.test(text);
    if (mentionsCeiling) {
      expect(
        /not (?:the same|universal)|depends on|differ|varies|your prescription|prescribed for you/i.test(text),
        "a 200 mg figure in patient copy must carry its indication-dependence",
      ).toBe(true);
    }
    expect(text).not.toMatch(/(?:usually |generally )?not above 200\s*mg a day\.?$/im);
  });

  it("uses the Zoloft missed-dose rule rather than a borrowed generic one", () => {
    // ps-clm-factsheets-sertraline-missed-dose: the Australian Zoloft CMI
    // directs a person who misses the usual dose to resume the normal dose the
    // next day without doubling — not the "take it when you remember unless it
    // is nearly time for the next one" rule used by other products.
    const text = allReadableText(sheetOrFail("sertraline"));
    expect(text).toMatch(/next day/i);
    expect(text).not.toMatch(/take it when you remember/i);
    expect(text).toMatch(/(?:never|do not) (?:take two doses|double)/i);
  });

  it("keeps the escitalopram missed-dose rule brand-specific and separate from Zoloft's", () => {
    // ps-clm-factsheets-escitalopram-missed-dose: the Lexapro CMI uses time
    // remaining before the next dose, including a 12-hour distinction.
    const text = allReadableText(sheetOrFail("escitalopram"));
    expect(text).toMatch(/12 hours/i);
    expect(text).toMatch(/(?:never|do not) (?:take two doses|double)/i);
  });
});

describe("withdrawal, dependence and bipolar safeguards", () => {
  it("separates SSRI withdrawal from addiction instead of implying neither occurs", () => {
    // ps-clm-factsheets-ssri-withdrawal: "not addictive" must not be allowed to
    // read as "no withdrawal". Reduction is individualised, not a fixed taper.
    const text = allReadableText(sheetOrFail("ssri"));
    expect(text).toMatch(/withdrawal/i);
    expect(text).toMatch(/not addictive|not a drug of dependence|do not cause dependence/i);
  });

  it("carries a bipolar/mania caution on the SSRI class sheet", () => {
    // ps-clm-factsheets-ssri-bipolar-caution: a generic SSRI sheet must not
    // read as endorsing antidepressant monotherapy for bipolar depression.
    const text = allReadableText(sheetOrFail("ssri"));
    expect(text).toMatch(/bipolar|mania|hypomania/i);
  });

  it("does not let the bipolar sheet imply an antidepressant endorsement", () => {
    // ps-clm-factsheets-bipolar-crosslink: the bipolar sheet links to the SSRI
    // sheet via `relatedMap`, so it must not recommend an antidepressant, and
    // the sheet it links to must itself carry the bipolar caution.
    const text = allReadableText(sheetOrFail("bipolar"));
    expect(text).not.toMatch(/antidepressants? (?:are|can) (?:recommended|effective|used) for bipolar/i);
    expect(text).not.toMatch(/(?:start|try|take) an antidepressant/i);
    expect(text).not.toMatch(/\bSSRIs? (?:help|treat|are used)/i);
    expect(text).toMatch(/episode-specific|different treatment decisions|depend on the episode/i);
    expect(relatedFactsheets("bipolar").map((sheet) => sheet.slug)).toContain("ssri");
    expect(allReadableText(sheetOrFail("ssri"))).toMatch(/bipolar/i);
  });

  it("does not define bipolar I as requiring a depressive episode", () => {
    // ps-clm-factsheets-bipolar-bipolar-i: a manic episode establishes bipolar
    // I. Depression commonly occurs but is not required.
    const text = allReadableText(sheetOrFail("bipolar"));
    expect(text).toMatch(/bipolar (?:i|1)\b.{0,80}manic episode/i);
    expect(text).toMatch(/not required|does not require|need not/i);
    expect(text).toMatch(/hypomanic|hypomania/i);
    // The old wording defined the condition as periods of depression AND mania.
    expect(text).not.toMatch(/involves periods of depression and periods of/i);
  });
});

describe("duration wording never reads as a wait before urgent help", () => {
  it("frames the depression two-week mark as an assessment threshold", () => {
    // ps-clm-factsheets-depression-duration and -urgent-help: severe
    // impairment, psychosis or suicidal thinking need assessment immediately,
    // whatever the duration.
    const sheet = sheetOrFail("depression");
    const text = allReadableText(sheet);
    expect(text).toMatch(/straight away|immediately|right away|without waiting|urgent/i);
    expect(text).toMatch(/000|emergency/i);
  });

  it("keeps GAD duration as a diagnostic pattern, not a barrier to seeking help", () => {
    // ps-clm-factsheets-gad-duration: duration alone is not a diagnosis and
    // people can seek help earlier.
    const text = allReadableText(sheetOrFail("gad"));
    expect(text).toMatch(/six months|6 months/i);
    expect(text).toMatch(/earlier|sooner|do not (?:have to |need to )?wait|don't have to wait/i);
  });
});

describe("lithium monitoring keeps sample timing, steady state and toxicity distinct", () => {
  it("qualifies the 12-hour sample rather than presenting it as a pre-dose trough", () => {
    // ps-clm-factsheets-lithium-monitoring-sample-timing: a once-nightly dose
    // does not make the next morning's 12-hour sample a 24-hour trough.
    const text = allReadableText(sheetOrFail("lithium-monitoring"));
    expect(text).toMatch(/12 hours/i);
    expect(text).toMatch(/last dose/i);
    expect(text).toMatch(/record|tell (?:the|your) (?:team|lab)|note (?:the )?time/i);
  });

  it("names lithium toxicity symptoms and an urgent action for them", () => {
    // ps-clm-factsheets-lithium-monitoring-toxicity: do not wait for the full
    // symptom combination or for a scheduled blood test.
    const text = allReadableText(sheetOrFail("lithium-monitoring"));
    expect(text).toMatch(/vomiting/i);
    expect(text).toMatch(/tremor/i);
    expect(text).toMatch(/confusion|slurred speech|unsteady/i);
    expect(text).toMatch(/13\s*11\s*26/); // Poisons Information Centre
    expect(text).toMatch(/do not wait|don't wait|without waiting/i);
  });

  it("names the interacting medicine classes rather than anti-inflammatories alone", () => {
    // ps-clm-factsheets-lithium-monitoring-interactions: NSAIDs, ACE
    // inhibitors, ARBs and diuretics can all affect lithium concentrations.
    const text = allReadableText(sheetOrFail("lithium-monitoring"));
    expect(text).toMatch(/anti-inflammator|NSAID/i);
    expect(text).toMatch(/blood pressure|ACE inhibitor|diuretic|fluid tablet/i);
  });

  it("does not introduce a universal lithium target range or monitoring interval", () => {
    // ps-clm-factsheets-lithium-monitoring-no-universal-target: targets and
    // intervals depend on phase, response, age, renal function, formulation
    // and the controlling protocol.
    const text = allReadableText(sheetOrFail("lithium-monitoring"));
    expect(text).not.toMatch(/0\.\d\s*(?:–|-|to)\s*\d\.\d\s*mmol/i);
    expect(text).not.toMatch(/every (?:three|3|six|6) months\b/i);
  });
});

describe("mechanism claims stay within what the sources support", () => {
  it("does not present depression as a proven serotonin deficiency", () => {
    // ps-clm-factsheets-ssri-mechanism and -depression-causes: how
    // antidepressants improve symptoms is not fully understood.
    for (const slug of ["sertraline", "ssri", "depression", "escitalopram"]) {
      const text = allReadableText(sheetOrFail(slug));
      expect(text, `${slug} must not assert a serotonin deficit`).not.toMatch(
        /(?:low|lack of|shortage of|deficiency (?:in|of)|rebalanc\w*|corrects?|tops? up|restores?)\s+(?:\w+\s+){0,5}?serotonin|serotonin (?:deficiency|shortage|imbalance|level(?:s)? (?:are|is) low)/i,
      );
    }
  });

  it("qualifies the SSRI mechanism as not fully understood", () => {
    const text = allReadableText(sheetOrFail("ssri"));
    expect(text).toMatch(/not fully understood|is not certain|exactly how .{0,40}(?:is|are) not/i);
  });
});

describe("CBT does not promise a fixed course length", () => {
  it("presents session count as variable rather than a guarantee", () => {
    // ps-clm-factsheets-cbt-duration: frequency and total duration depend on
    // the problem, protocol, complexity and response.
    const text = allReadableText(sheetOrFail("cbt"));
    expect(text).not.toMatch(/\b(?:usually|typically|always)\s+\d+\s*(?:–|-|to)\s*\d+\s*sessions/i);
    expect(text).toMatch(/depend on the problem|complexity and (?:your )?(?:progress|response)/i);
    expect(text).toMatch(/not a guarantee|not a limit/i);
  });
});

describe("a sheet that raises an emergency-grade symptom must give a way to act", () => {
  // Written per-sheet rather than per-slug: a new sheet cannot ship a
  // suicidality or emergency mention without a route out of it.
  //
  // This is structural, not editorial. `printBlocks` appends the Australian
  // crisis line for `condition` sheets, `medRich` carries `urgentHelp` and
  // `procedure` carries it inside `safe` — but `medLite` returned timing,
  // sections and sources only, so an SSRI or escitalopram sheet could name
  // self-harm, seizure or serotonin toxicity with nowhere for the reader to go.
  const EMERGENCY_SYMPTOM =
    /self-harm|suicid|seizure|urgent assessment|serotonin toxicity|muscle stiffness|irregular heartbeat/i;
  const ROUTE = /\b000\b|13\s*11\s*14|1300\s*22\s*4636|13\s*11\s*26|emergency department/i;

  for (const sheet of factsheets) {
    it(`gives ${sheet.slug} a crisis route wherever it raises one`, () => {
      for (const level of ["standard", "easy"] as const) {
        const text = printBlocks(sheet, level)
          .map((block) => {
            switch (block.kind) {
              case "prose":
                return `${block.heading} ${block.body}`;
              case "list":
                return `${block.heading} ${block.items.join(" ")}`;
              case "facts":
                return `${block.heading} ${block.items.map((item) => `${item.k} ${item.v}`).join(" ")}`;
              case "sources":
                return block.heading;
            }
          })
          .join(" ");
        if (!EMERGENCY_SYMPTOM.test(text)) continue;
        expect(
          ROUTE.test(text),
          `${sheet.slug} (${level}) names an emergency-grade symptom with no crisis number or emergency route`,
        ).toBe(true);
      }
    });
  }
});

describe("act-now symptoms are scannable, not buried in prose", () => {
  it("prints the lithium warning signs as a list above the safety prose", () => {
    // The symptoms used to sit mid-paragraph inside a warning callout. A reader
    // scanning a monitoring handout for "should I worry about this symptom"
    // should not have to read a paragraph to find out.
    const sheet = sheetOrFail("lithium-monitoring");
    expect(sheet.kind).toBe("procedure");
    if (sheet.kind !== "procedure") return;
    expect(sheet.warningSigns, "the lithium sheet must carry an act-now list").toBeDefined();

    const blocks = printBlocks(sheet);
    const listIndex = blocks.findIndex(
      (block) => block.kind === "list" && block.heading === sheet.warningSigns!.heading,
    );
    const proseIndex = blocks.findIndex(
      (block) => block.kind === "prose" && block.heading === "Staying safe between tests",
    );
    expect(listIndex, "warning signs must be printed").toBeGreaterThanOrEqual(0);
    expect(listIndex).toBeLessThan(proseIndex);

    const list = blocks[listIndex];
    expect(list?.kind === "list" && list.items).toEqual(sheet.warningSigns!.items);
    // The prose must not repeat the symptoms it no longer owns.
    expect(sheet.safe).not.toMatch(/coarse|slurred speech/i);
  });
});

describe("every sheet keeps its demonstration status and cited sources", () => {
  it("ends every printed projection with a sources block", () => {
    for (const sheet of factsheets) {
      const blocks = printBlocks(sheet);
      const last = blocks.at(-1);
      expect(last?.kind, `${sheet.slug} must print its sources last`).toBe("sources");
      expect(sheet.sources.length, `${sheet.slug} must cite at least one source`).toBeGreaterThan(0);
    }
  });
});
