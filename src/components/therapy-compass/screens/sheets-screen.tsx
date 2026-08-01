"use client";

import { useMemo, useState, type ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { parseSteps, searchTherapies } from "../data/select";
import { ChevronDownIcon, PrinterIcon, ScaleIcon, SearchIcon } from "../icons";
import { LoadingState } from "../ui";
import { therapyBtn } from "../controls";

export function SheetsScreen() {
  const b = useTcBindings();
  const t = b.selectedTherapy;
  if (b.loading || !t) return <LoadingState label="Loading patient sheet builder…" />;

  const steps = parseSteps(t.deliverySteps, 5);
  const template = t.patientSheetTemplates[0];
  const about = t.patientExplanation || template?.body || t.clinicalSummary || "";
  const toneWord =
    b.sheetTone === "warm"
      ? "gentle, encouraging"
      : b.sheetTone === "clinical"
        ? "precise, clinical"
        : "plain, everyday";
  const sheetTitle = t.name.replace(/\s*\([^)]*\)\s*$/, "");

  return (
    <section data-screen-label="Patient sheet" className="max-w-[1240px] my-0 mx-auto">
      <div data-therapy-no-print className="flex items-start justify-between gap-5 mb-5 flex-wrap">
        <div>
          <h1 className="mt-0 mx-0 mb-1.5 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">Patient Sheet Builder</h1>
          <p className="m-0 text-sm text-[color:var(--text-muted)]">
            Design, personalise and print a plain-language handout from a source-grounded record.
          </p>
        </div>
        <div className="max-sm:flex-wrap flex gap-2.5">
          <button type="button" className={`${therapyBtn} inline-flex items-center gap-2 h-tap py-0 px-[18px] border-0 rounded-lg bg-[color:var(--command)] text-[color:var(--command-contrast)] text-sm-minus font-semibold shadow-[var(--shadow-tight)] cursor-pointer`} onClick={b.printSheet}>
            <PrinterIcon size={16} />
            Print / PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[340px_minmax(0,_1fr)] gap-5 items-start">
        {/* BUILDER */}
        <div className="max-sm:static max-sm:top-auto flex flex-col gap-4 sticky top-[84px]">
          <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-[18px] px-5">
            <div className="text-sm-minus font-semibold text-[color:var(--text-heading)] mb-3">Therapy</div>
            <TherapyPicker />
            <div className="text-sm-minus font-semibold text-[color:var(--text-heading)] mt-[18px] mx-0 mb-2.5">Reading level &amp; tone</div>
            <div className="flex gap-0.5 p-[3px] bg-[color:var(--surface-inset)] rounded-lg">
              <button
                type="button"
                className={`${therapyBtn} ${b.tonePlain}`}
                onClick={b.setTonePlain}
                aria-pressed={b.sheetTone === "plain"}
              >
                Plain
              </button>
              <button
                type="button"
                className={`${therapyBtn} ${b.toneWarm}`}
                onClick={b.setToneWarm}
                aria-pressed={b.sheetTone === "warm"}
              >
                Warm
              </button>
              <button
                type="button"
                className={`${therapyBtn} ${b.toneClinical}`}
                onClick={b.setToneClinical}
                aria-pressed={b.sheetTone === "clinical"}
              >
                Clinical
              </button>
            </div>
          </div>

          <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-[18px] px-5">
            <div className="text-sm-minus font-semibold text-[color:var(--text-heading)] mb-1.5">Sections</div>
            <p className="mt-0 mx-0 mb-3.5 text-xs text-[color:var(--text-soft)]">Toggle what appears on the sheet.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${therapyBtn} ${b.chipAbout}`}
                onClick={b.toggleAbout}
                aria-pressed={b.secAbout}
              >
                About this therapy
              </button>
              <button
                type="button"
                className={`${therapyBtn} ${b.chipSteps}`}
                onClick={b.toggleSteps}
                aria-pressed={b.secSteps}
              >
                Your plan
              </button>
              <button
                type="button"
                className={`${therapyBtn} ${b.chipPractice}`}
                onClick={b.togglePractice}
                aria-pressed={b.secPractice}
              >
                Practice at home
              </button>
              <button
                type="button"
                className={`${therapyBtn} ${b.chipCoping}`}
                onClick={b.toggleCoping}
                aria-pressed={b.secCoping}
              >
                If things get hard
              </button>
              <button
                type="button"
                className={`${therapyBtn} ${b.chipContacts}`}
                onClick={b.toggleContacts}
                aria-pressed={b.secContacts}
              >
                Support contacts
              </button>
            </div>
          </div>

          <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] py-[18px] px-5">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm-minus font-semibold text-[color:var(--text-heading)]">Clinician footer</span>
                <span className="block text-xs text-[color:var(--text-soft)] mt-0.5">Name, service and review date.</span>
              </span>
              <button
                type="button"
                role="switch"
                onClick={b.toggleClinician}
                aria-checked={b.sheetClinician}
                aria-label="Show clinician footer"
                data-therapy-clinician-track
                data-active={b.sheetClinician ? "true" : "false"}
                className={therapyBtn}
              >
                <span data-therapy-clinician-knob />
              </button>
            </div>
            <p className="mt-3.5 mx-0 mb-0 text-2xs leading-normal text-[color:var(--text-soft)] border-t border-[color:var(--border)] pt-3">
              Tip: every heading and paragraph on the sheet is editable — click to rewrite it before printing. Wording
              follows the {toneWord} tone.
            </p>
          </div>
        </div>

        {/* PAPER */}
        <div className="flex justify-center py-2 px-0">
          <div
            data-therapy-paper
            className="w-full max-w-[720px] bg-[color:var(--tc-paper-background)] border border-[color:var(--tc-paper-border)] rounded-sm shadow-[var(--tc-paper-shadow)] py-[52px] px-14 text-[color:var(--tc-paper-ink)]"
          >
            <div className="max-sm:flex-wrap flex items-center justify-between border-b-[2px_solid_var(--tc-paper-accent-strong)] pb-4 mb-6">
              <div className="flex items-center gap-[11px]">
                <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-md bg-[color:var(--tc-paper-accent-background)] text-[color:var(--tc-paper-accent)]">
                  <ScaleIcon size={20} strokeWidth={1.6} />
                </span>
                <span className="text-sm-minus font-semibold text-[color:var(--tc-paper-muted)] tracking-[0.02em]">Therapy · Patient information</span>
              </div>
              <span className="text-2xs text-[color:var(--tc-paper-muted)]">Prepared for you</span>
            </div>

            <h1 contentEditable suppressContentEditableWarning className="mt-0 mx-0 mb-1.5 text-3xl-minus font-bold text-[color:var(--tc-paper-ink)] tracking-tight">
              {sheetTitle}
            </h1>
            <p contentEditable suppressContentEditableWarning className="mt-0 mx-0 mb-[26px] text-sm text-[color:var(--tc-paper-muted)]">
              {t.bestUsedFor && t.bestUsedFor.length < 70 && !/^(most|the|a |an )/i.test(t.bestUsedFor)
                ? `A step-by-step plan to help with ${t.bestUsedFor.toLowerCase()}.`
                : `A plain-language plan to help you get the most from ${sheetTitle.toLowerCase()}.`}
            </p>

            {b.secAbout && about ? <PaperSection title="About this therapy">{about}</PaperSection> : null}

            {b.secSteps && steps.length ? (
              <div className="mb-[22px]">
                <h2 contentEditable suppressContentEditableWarning className="mt-0 mx-0 mb-2.5 text-base font-semibold text-[color:var(--tc-paper-accent)]">
                  Your plan
                </h2>
                <div className="flex flex-col gap-2.5">
                  {steps.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded-full bg-[color:var(--tc-paper-accent-background)] text-[color:var(--tc-paper-accent)] text-xs font-bold flex-none">{i + 1}</span>
                      <p contentEditable suppressContentEditableWarning className="m-0 text-sm-minus leading-normal text-[color:var(--tc-paper-body)] flex-1">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {b.secPractice ? (
              <div className="mb-[22px] bg-[color:var(--tc-paper-accent-background)] border border-[color:var(--tc-paper-accent-border)] rounded-md py-4 px-[18px]">
                <h2 contentEditable suppressContentEditableWarning className="mt-0 mx-0 mb-2 text-base-minus font-semibold text-[color:var(--tc-paper-accent)]">
                  Practice at home
                </h2>
                <p contentEditable suppressContentEditableWarning className="m-0 text-sm-minus leading-normal text-[color:var(--tc-paper-body)]">
                  {t.homework ||
                    "Try the steps above between sessions. Note what you did and how it felt, and bring this to your next appointment."}
                </p>
              </div>
            ) : null}

            {b.secCoping ? (
              <PaperSection title="If things get hard">
                Some days will feel harder than others — that&rsquo;s normal. Make the step smaller rather than skipping
                it. If your distress rises sharply or you have thoughts of harming yourself, use the contacts below
                straight away.
              </PaperSection>
            ) : null}

            {b.secContacts ? (
              <div className="mb-2 bg-[color:var(--tc-paper-warning-background)] border border-[color:var(--tc-paper-warning-border)] rounded-md py-4 px-[18px]">
                <h2 contentEditable suppressContentEditableWarning className="mt-0 mx-0 mb-2 text-base-minus font-semibold text-[color:var(--tc-paper-warning)]">
                  Support contacts
                </h2>
                <div contentEditable suppressContentEditableWarning className="text-sm-minus leading-normal text-[color:var(--tc-paper-body)]">
                  Your clinician: ______________________ · Phone: ______________
                  <br />
                  In a crisis, call your local emergency number or a 24/7 crisis line.
                </div>
              </div>
            ) : null}

            {b.sheetClinician ? (
              <div className="flex justify-between gap-4 mt-[26px] pt-4 border-t border-[color:var(--tc-paper-border-subtle)] text-2xs text-[color:var(--tc-paper-muted)] flex-wrap">
                <span contentEditable suppressContentEditableWarning>
                  Clinician: ____________________
                </span>
                <span contentEditable suppressContentEditableWarning>
                  Service: ____________________
                </span>
                <span contentEditable suppressContentEditableWarning>
                  Reviewed: __ / __ / ____
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PaperSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-[22px]">
      <h2 contentEditable suppressContentEditableWarning className="mt-0 mx-0 mb-2 text-base font-semibold text-[color:var(--tc-paper-accent)]">
        {title}
      </h2>
      <p contentEditable suppressContentEditableWarning className="m-0 text-sm-minus leading-normal text-[color:var(--tc-paper-body)]">
        {children}
      </p>
    </div>
  );
}

function TherapyPicker() {
  const b = useTcBindings();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const base = q.trim()
      ? searchTherapies(b.therapies, { query: q, tags: [], briefOnly: false, sheetOnly: false, reviewedOnly: false })
      : b.therapies;
    // Only offer therapies that actually ship a patient sheet — selecting one now
    // navigates to its /sheet subroute, which 404s for records without a sheet.
    return base.filter((x) => x.patientSheetAvailable).slice(0, 8);
  }, [q, b.therapies]);

  return (
    <div className="relative">
      <button
        type="button"
        className={`${therapyBtn} flex items-center justify-between w-full h-[46px] py-0 px-3.5 border border-[color:var(--border-strong)] rounded-lg bg-[color:var(--surface)] text-[color:var(--text)] text-sm-minus font-semibold cursor-pointer`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-[9px] min-w-0">
          <ScaleIcon size={16} className="text-[color:var(--clinical-accent)] flex-none" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{b.selectedTherapy?.name ?? "Choose a therapy"}</span>
        </span>
        <ChevronDownIcon size={15} strokeWidth={1.8} className="text-[color:var(--text-soft)] flex-none" />
      </button>
      {open ? (
        <div className="absolute z-[30] top-[52px] left-0 right-0 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow-[var(--shadow-hover)] overflow-hidden">
          <label className="relative flex items-center p-2 border-b border-[color:var(--border)]">
            <SearchIcon size={15} strokeWidth={1.8} className="absolute left-[18px] text-[color:var(--text-soft)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search therapies…"
              aria-label="Search therapies for the patient sheet"
              autoFocus
              className="w-full h-tap pt-0 pr-3 pb-0 pl-[34px] border border-[color:var(--border)] rounded-md bg-[color:var(--surface)] text-[color:var(--text)] text-sm-minus"
            />
          </label>
          <div className="max-h-[260px] overflow-auto">
            {matches.map((t) => (
              <button
                key={t.slug}
                type="button"
                className={`${therapyBtn} transition-colors duration-100 hover:bg-[color:var(--surface-subtle)] block w-full py-2.5 px-3.5 border-0 border-b border-[color:var(--border)] bg-transparent text-left cursor-pointer text-sm-minus font-semibold text-[color:var(--text-heading)]`}
                onClick={() => {
                  b.select(t.slug);
                  setOpen(false);
                  setQ("");
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
