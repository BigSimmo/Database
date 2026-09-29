"use client";
// Public service information only; patient-context tools keep their own transient state.
import { useChosenHospital } from "@/components/first-nations/hospital-choice";
import { BeforeYouGoIn } from "@/components/first-nations/before-you-go-in";
import { CrisisStrip } from "@/components/first-nations/crisis";
import { FirstNationsSearch } from "@/components/first-nations/first-nations-search";
import { LiaisonHero } from "@/components/first-nations/liaison-hero";
import { FnModule } from "@/components/first-nations/module-header";
import { OfflineState } from "@/components/first-nations/offline-state";
import { FirstNationsHomeMenu } from "@/components/first-nations/page-menu";
import { SituationModule, SituationProvider, SituationSidePanel } from "@/components/first-nations/situation-module";
import { StateModule } from "@/components/first-nations/state-module";
import { AcknowledgementText } from "@/components/first-nations/voice";
import { WhereIsHomeTile } from "@/components/first-nations/where-is-home";
import { cn } from "@/components/ui-primitives";
import type { BedsideModel, SourceView } from "@/lib/first-nations/view-model";

export const EXAMPLE_LINE = "Example only · wording awaiting approval";

export type Training = { label: string; href: string } | null;

export function ExampleLine({ className }: { className?: string }) {
  return (
    <p
      data-fn-part="example"
      className={cn("px-1 text-2xs text-[color:var(--text-muted)] [text-wrap:balance]", className)}
    >
      {EXAMPLE_LINE}
    </p>
  );
}

/**
 * DOM order is the phone order from spec §3 on every width, so reading and focus order
 * never jump: tablet places the Situation module in a second column beside the rest,
 * desktop adds the 360 px plan panel on the right.
 *
 * While the service layer is off there is no hospital, so the hero is the "not set up"
 * state module and only the statewide numbers show.
 */
export function BedsideHomeView({
  model,
  training = null,
  mapSource = null,
}: {
  model: BedsideModel;
  training?: Training;
  mapSource?: SourceView | null;
}) {
  const [hospital, chooseHospital] = useChosenHospital(model.hospitals);
  return (
    <SituationProvider situations={model.situations} liaison={hospital?.liaison ?? null}>
      <FirstNationsHomeMenu
        pageTitle="Bedside"
        href="/first-nations"
        reportHref={model.missingNumberHref}
        training={training}
      />
      <div className="mx-auto grid w-full max-w-[80rem] lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="grid min-w-0 content-start gap-3 px-3 pb-6 pt-3 lg:px-5">
          {model.showExampleLine ? <ExampleLine /> : null}
          <OfflineState />
          {model.hospitals.length > 1 ? (
            <label className="grid gap-1 text-sm-minus text-[color:var(--text-muted)]">
              Your workplace hospital
              <select
                value={hospital?.id ?? ""}
                onChange={(event) => chooseHospital(event.target.value)}
                className="min-h-12 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-[color:var(--text-heading)]"
              >
                {model.hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[1.1fr_1fr] md:items-start">
            <div className="grid min-w-0 gap-3 md:col-start-1 md:row-start-1">
              {hospital ? (
                <LiaisonHero hospital={hospital} />
              ) : (
                <StateModule kind="not-set-up" href={model.missingNumberHref ?? undefined} />
              )}
              <CrisisStrip />
              <FirstNationsSearch entries={model.search} />
            </div>
            <div className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
              <SituationModule />
            </div>
            <div data-fn-part="tools" className="grid grid-cols-2 gap-2 md:col-start-1 md:row-start-2">
              <BeforeYouGoIn steps={model.beforeYouGoIn} />
              <WhereIsHomeTile
                regions={model.regions}
                map={model.map}
                interpreter={model.interpreter}
                mapSource={mapSource}
              />
            </div>
          </div>
          {model.topMistakes.length ? (
            <FnModule id="fn-top-mistakes" icon="shield" title="Common mistakes" className="hidden lg:grid">
              <ul className="grid">
                {model.topMistakes.map((m) => (
                  <li
                    key={m.id}
                    className="grid grid-cols-2 gap-3 border-t border-[color:var(--border)] px-3 py-2.5 first:border-t-0"
                  >
                    <span className="text-sm-minus text-[color:var(--text-muted)]">
                      <span className="sr-only">Avoid: </span>
                      {m.avoid}
                    </span>
                    <span className="text-sm-minus text-[color:var(--text-heading)]">
                      <span className="sr-only">Instead: </span>
                      {m.instead}
                    </span>
                  </li>
                ))}
              </ul>
            </FnModule>
          ) : null}
          {model.acknowledgement ? <AcknowledgementText>{model.acknowledgement}</AcknowledgementText> : null}
        </div>
        <SituationSidePanel />
      </div>
    </SituationProvider>
  );
}
