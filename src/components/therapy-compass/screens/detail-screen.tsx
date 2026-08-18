"use client";

import type { ReactNode } from "react";
import {
  ChevronRight,
  Clock,
  Compass,
  Database,
  FileText,
  Heart,
  Info,
  ListChecks,
  Scale,
  Shield,
  Target,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";

import { InformationPageFooter, InformationPageShell } from "@/components/information-page-shell";
import { Button } from "@/components/ui/button";
import { cn, SourceDesignationBadge, SourceStatusBadge } from "@/components/ui-primitives";
import { therapyScreenHref } from "@/lib/therapy-compass-navigation";
import { therapySourceMetadata } from "@/lib/therapy-source-governance";

import { useTcBindings } from "../bindings";
import { card, controlPressed, favouritePressed, heroCard, therapyBtn } from "../controls";
import { complexityLabel, parseSteps, summarise } from "../data/select";
import type { Therapy } from "../data/types";
import { TherapyRecordNavHeader } from "../therapy-record-nav-header";
import { Eyebrow, LoadingState, StatusBadge, TagRow } from "../ui";
import { useTherapyFavourite } from "../use-therapy-favourite";

export function DetailScreen() {
  const b = useTcBindings();
  const t = b.selectedTherapy;
  const favourite = useTherapyFavourite(t?.slug ?? null);
  if (!t) return <LoadingState />;

  const steps = parseSteps(t.deliverySteps);
  const { notice, saved, toggleFavourite } = favourite;

  return (
    <>
      <TherapyRecordNavHeader
        title={t.name}
        backHref={b.workspaceHref(therapyScreenHref("search"))}
        backLabel="Therapy search"
        testIdPrefix="therapy-detail"
      />
      <InformationPageShell testId="therapy-detail-page" gap={false}>
        <section data-screen-label="Detail">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,_1fr)_344px] gap-[22px] items-start">
            <div className="flex flex-col gap-4 min-w-0">
              {/* HERO */}
              <div className={`${heroCard} p-6`}>
                <div className="flex gap-2.5 mb-3.5 flex-wrap items-center">
                  <StatusBadge status={t.reviewStatus} />
                  {t.complexity ? (
                    <span className="text-xs font-semibold py-[5px] px-[11px] rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] border border-[color:var(--border)]">
                      {complexityLabel(t.complexity)}
                    </span>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Heart}
                    className={cn("ml-auto", favouritePressed)}
                    aria-pressed={saved}
                    onClick={() => void toggleFavourite()}
                  >
                    {saved ? "Saved" : "Save"}
                  </Button>
                </div>
                <p
                  role="status"
                  aria-live="polite"
                  className={
                    notice
                      ? "mt-0 mb-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]"
                      : "sr-only"
                  }
                >
                  {notice}
                </p>
                <h1 className="mt-0 mx-0 mb-1 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">
                  {t.name}
                </h1>
                {t.aliases.length ? (
                  <div className="text-sm-minus text-[color:var(--text-muted)] mb-3">
                    Also known as {t.aliases.join(", ")}
                  </div>
                ) : (
                  <div className="text-sm-minus text-[color:var(--text-muted)] mb-3">{t.category}</div>
                )}
                {t.clinicalSummary ? (
                  <p className="mt-0 mx-0 mb-4 text-base-minus leading-normal text-[color:var(--text-muted)] max-w-[64ch]">
                    {t.clinicalSummary}
                  </p>
                ) : null}
                <TagRow tags={t.tags.length ? t.tags : [t.category]} max={8} />
              </div>

              {/* QUICK TILES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Tile
                  icon={Shield}
                  eyebrow="USE WHEN"
                  tone="accent"
                  text={summarise(t.bestUsedFor || t.indications, 1) || "See clinical record."}
                />
                <Tile
                  icon={TriangleAlert}
                  eyebrow="AVOID / MODIFY"
                  tone="warning"
                  text={summarise(t.contraindicationsOrCautions, 1) || "Confirm suitability against source before use."}
                />
                <Tile
                  icon={Clock}
                  eyebrow="DELIVERY"
                  tone="info"
                  text={
                    [t.timeRequired, t.sessionLength].filter(Boolean).join(" · ") ||
                    (t.briefInterventionAvailable ? "Brief version available." : "See delivery notes.")
                  }
                />
                <Tile
                  icon={Info}
                  eyebrow="EVIDENCE / SOURCE"
                  tone="muted"
                  text={
                    t.evidenceLevel || (t.reviewStatus === "reviewed" ? "Reviewed record." : "Source review required.")
                  }
                />
              </div>

              {/* BODY */}
              <div className={`${card} px-6 py-1.5`}>
                {t.mechanism ? <BodyRow icon={Target} title="How it works" body={t.mechanism} /> : null}
                <BodyRow icon={User} title="When to use" body={t.indications || t.bestUsedFor} />
                {steps.length ? (
                  <BodyRow
                    icon={FileText}
                    title="How to deliver it"
                    body={
                      <ol className="mt-1.5 mx-0 mb-0 pl-5">
                        {steps.map((step, i) => (
                          <li key={i} className="text-sm-minus leading-normal text-[color:var(--text-muted)] mb-1.5">
                            {step}
                          </li>
                        ))}
                      </ol>
                    }
                  />
                ) : (
                  <BodyRow icon={FileText} title="How to deliver it" body={t.deliverySteps} />
                )}
                <SafetyRow therapy={t} />
              </div>

              {/* ACTIONS */}
              <div className="flex flex-wrap gap-2.5">
                {t.patientSheetAvailable ? (
                  <Button variant="primary" size="lg" icon={FileText} onClick={() => b.openSheet(t.slug)}>
                    Generate patient sheet
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  icon={Scale}
                  className={controlPressed}
                  onClick={() => b.toggleCompare(t.slug)}
                  aria-pressed={b.isInCompare(t.slug)}
                >
                  {b.isInCompare(t.slug) ? "In compare" : "Compare"}
                </Button>
                {t.briefInterventionAvailable ? (
                  <Button variant="secondary" size="lg" icon={Clock} onClick={() => b.openBrief(t.slug)}>
                    Brief intervention
                  </Button>
                ) : null}
                <Button variant="secondary" size="lg" icon={ListChecks} onClick={b.goReview}>
                  Review checklist
                </Button>
              </div>
            </div>

            {/* RIGHT RAIL */}
            <div className="max-sm:static max-sm:top-auto flex flex-col gap-4 sticky top-[calc(var(--shell-header-h)+1rem)]">
              <div className={`${card} p-5`}>
                <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-3.5">At a glance</div>
                <div className="flex flex-col gap-[15px]">
                  <GlanceRow icon={Compass} title="Target symptoms" body={t.targetSymptoms || t.patientPopulation} />
                  <GlanceRow
                    icon={Clock}
                    title="Time & setting"
                    body={[t.timeRequired, t.setting].filter(Boolean).join(" · ")}
                  />
                  <GlanceRow
                    icon={Scale}
                    title="Complexity / population"
                    body={[t.complexity, t.patientPopulation].filter(Boolean).join(" — ")}
                  />
                </div>
              </div>

              {b.relatedForSelected.length ? (
                <div className={`${card} p-5`}>
                  <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-2">Related therapies</div>
                  <div className="flex flex-col">
                    {b.relatedForSelected.map((r, i, arr) => (
                      <button
                        key={r.slug}
                        type="button"
                        className={`${therapyBtn} transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex w-full items-center justify-between gap-2 border-0 bg-transparent px-0 py-[11px] text-left${i < arr.length - 1 ? " border-b border-[color:var(--border)]" : ""}`}
                        onClick={() => b.open(r.slug)}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm-minus font-semibold text-[color:var(--text-heading)]">
                            {r.name}
                          </span>
                          <span className="block text-xs text-[color:var(--text-muted)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                            {r.bestUsedFor ?? r.category}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          size={15}
                          strokeWidth={1.8}
                          className="text-[color:var(--decoration-soft)] flex-none"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bg-[color:var(--surface-subtle)] border border-[color:var(--border)] rounded-xl py-[18px] px-5">
                <div className="flex items-center gap-2 text-sm-minus font-semibold text-[color:var(--text-heading)] mb-2.5">
                  <Database aria-hidden="true" size={16} className="text-[color:var(--warning-text)]" />
                  Source provenance
                </div>
                <div className="text-xs text-[color:var(--text-muted)] leading-normal">
                  {t.sources.length ? (
                    t.sources.slice(0, 3).map((src, i) => (
                      <div key={`${src.title ?? src.reference ?? "source"}-${i}`} className="mb-3 last:mb-0">
                        <strong className="block text-[color:var(--text-heading)]">
                          {src.title ?? src.reference ?? src.sourceType ?? "Source title not provided"}
                        </strong>
                        {src.reference && src.reference !== src.title ? (
                          <span className="mt-0.5 block break-words">{src.reference}</span>
                        ) : null}
                        <span className="mt-2 flex flex-wrap gap-2">
                          <SourceDesignationBadge metadata={therapySourceMetadata(src, t.reviewStatus)} />
                          <SourceStatusBadge metadata={therapySourceMetadata(src, t.reviewStatus)} />
                        </span>
                      </div>
                    ))
                  ) : (
                    <div>
                      Source:{" "}
                      <strong className="text-[color:var(--text-heading)]">
                        {t.sourceNotes ? "Referenced record" : "Single therapy record"}
                      </strong>
                    </div>
                  )}
                  <div>
                    Review:{" "}
                    <span
                      className={
                        t.reviewStatus === "reviewed"
                          ? "font-semibold text-[color:var(--success-text)]"
                          : "font-semibold text-[color:var(--warning-text)]"
                      }
                    >
                      {t.reviewStatus === "reviewed" ? "Reviewed" : "Not yet provided"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <InformationPageFooter className="mt-6">
            Decision support — verify the record and linked source before clinical use.
          </InformationPageFooter>
        </section>
      </InformationPageShell>
    </>
  );
}

function Tile({
  icon: Icon,
  eyebrow,
  tone,
  text,
}: {
  icon: LucideIcon;
  eyebrow: string;
  tone: "accent" | "warning" | "info" | "muted";
  text: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-[17px] py-4 text-[color:var(--text-muted)] [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-normal [&_p]:text-inherit ${tone === "accent" ? "border-[color:var(--clinical-accent-border)]" : tone === "warning" ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]" : tone === "info" ? "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-text)]" : ""}`}
    >
      <div className="mb-2 flex items-center gap-[7px]">
        <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
        <Eyebrow tone={tone === "muted" ? "neutral" : tone}>{eyebrow}</Eyebrow>
      </div>
      <p>{text}</p>
    </div>
  );
}

function BodyRow({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: ReactNode }) {
  if (!body) return null;
  return (
    <div className="flex gap-3.5 py-5 px-0 border-b border-[color:var(--border)]">
      <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-md bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] flex-none">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[color:var(--text-heading)] mb-[5px]">{title}</div>
        {typeof body === "string" ? (
          <p className="m-0 text-sm-minus leading-normal text-[color:var(--text-muted)]">{body}</p>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

function SafetyRow({ therapy }: { therapy: Therapy }) {
  const contra = therapy.contraindicationsOrCautions?.trim() ?? "";
  const lim = therapy.limitations?.trim() ?? "";
  // `limitations` frequently repeats the tail of `contraindicationsOrCautions`;
  // only append it when it adds something new so the box doesn't echo itself.
  const text = lim && !contra.includes(lim) ? `${contra} ${lim}`.trim() : contra;
  if (!text) return null;
  return (
    <div className="flex gap-3.5 py-5 px-1 bg-[color:var(--warning-bg)] my-0 mx-[-18px] rounded-lg">
      <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-md bg-[color:var(--surface)] text-[color:var(--warning-text)] flex-none ml-3.5">
        <TriangleAlert aria-hidden="true" size={17} />
      </span>
      <div className="pr-3.5">
        <div className="text-sm font-semibold text-[color:var(--warning-text)] mb-[5px]">Safety &amp; cautions</div>
        <p className="m-0 text-sm-minus leading-normal text-[color:var(--warning-text)]">{text}</p>
      </div>
    </div>
  );
}

function GlanceRow({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div className="flex gap-3">
      <span className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] flex-none">
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[color:var(--text-heading)] mb-0.5">{title}</div>
        <p className="m-0 text-xs leading-normal text-[color:var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}
