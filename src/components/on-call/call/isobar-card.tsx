import { OnCallFactTile, OnCallFactTiles } from "@/components/on-call/kit/fact-tile";
import { OnCallUpdatedLine } from "@/components/on-call/kit/updated-line";
import { eyebrowText } from "@/components/ui-primitives";
import { ISOBAR_HEADINGS, ISOBAR_SOURCE } from "@/lib/on-call/isobar-source";

/**
 * "Calling a consultant" (plan 3.3): the iSoBAR headings exactly as the WA
 * source prints them, then that source's link and the day it was read. No
 * inputs, no copy button and nothing stored. It renders nothing until the
 * source has been captured (`ISOBAR_SOURCE` is null until then), so no heading
 * is ever written from memory.
 */
export function OnCallIsobarCard() {
  const source = ISOBAR_SOURCE;
  if (!source || ISOBAR_HEADINGS.length === 0) return null;
  return (
    <section
      className="grid min-w-0 gap-2"
      aria-labelledby="on-call-call-isobar-heading"
      data-testid="on-call-call-isobar"
    >
      <h2 id="on-call-call-isobar-heading" className={`${eyebrowText} px-3`}>
        Calling a consultant
      </h2>
      <OnCallFactTiles>
        {ISOBAR_HEADINGS.map((row) => (
          <OnCallFactTile key={row.letter} label={row.letter} value={row.heading} />
        ))}
      </OnCallFactTiles>
      <div className="px-3">
        <OnCallUpdatedLine updatedAt={source.readOn} sources={[{ label: source.publisher, url: source.url }]} />
      </div>
    </section>
  );
}
