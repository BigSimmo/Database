"use client";

import { useMemo, useState, type ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { parseSteps, searchTherapies } from "../data/select";
import { ChevronDownIcon, PrinterIcon, ScaleIcon, SearchIcon } from "../icons";
import { LoadingState } from "../ui";

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
    <section data-screen-label="Patient sheet" className="tc-screens-sheets-screen-001">
      <div className="tc-no-print tc-screens-sheets-screen-002">
        <div>
          <h1 className="tc-screens-sheets-screen-003">Patient Sheet Builder</h1>
          <p className="tc-screens-sheets-screen-004">
            Design, personalise and print a plain-language handout from a source-grounded record.
          </p>
        </div>
        <div className="tc-mobile-wrap tc-screens-sheets-screen-005">
          <button type="button" className="tc-btn tc-screens-sheets-screen-006" onClick={b.printSheet}>
            <PrinterIcon size={16} />
            Print / PDF
          </button>
        </div>
      </div>

      <div className="tc-stack-sm tc-screens-sheets-screen-007">
        {/* BUILDER */}
        <div className="tc-builder-panel tc-mobile-static tc-screens-sheets-screen-008">
          <div className="tc-screens-sheets-screen-009">
            <div className="tc-screens-sheets-screen-010">Therapy</div>
            <TherapyPicker />
            <div className="tc-screens-sheets-screen-011">Reading level &amp; tone</div>
            <div className="tc-screens-sheets-screen-012">
              <button
                type="button"
                className={`tc-btn ${b.tonePlain}`}
                onClick={b.setTonePlain}
                aria-pressed={b.sheetTone === "plain"}
              >
                Plain
              </button>
              <button
                type="button"
                className={`tc-btn ${b.toneWarm}`}
                onClick={b.setToneWarm}
                aria-pressed={b.sheetTone === "warm"}
              >
                Warm
              </button>
              <button
                type="button"
                className={`tc-btn ${b.toneClinical}`}
                onClick={b.setToneClinical}
                aria-pressed={b.sheetTone === "clinical"}
              >
                Clinical
              </button>
            </div>
          </div>

          <div className="tc-screens-sheets-screen-013">
            <div className="tc-screens-sheets-screen-014">Sections</div>
            <p className="tc-screens-sheets-screen-015">Toggle what appears on the sheet.</p>
            <div className="tc-screens-sheets-screen-016">
              <button
                type="button"
                className={`tc-btn ${b.chipAbout}`}
                onClick={b.toggleAbout}
                aria-pressed={b.secAbout}
              >
                About this therapy
              </button>
              <button
                type="button"
                className={`tc-btn ${b.chipSteps}`}
                onClick={b.toggleSteps}
                aria-pressed={b.secSteps}
              >
                Your plan
              </button>
              <button
                type="button"
                className={`tc-btn ${b.chipPractice}`}
                onClick={b.togglePractice}
                aria-pressed={b.secPractice}
              >
                Practice at home
              </button>
              <button
                type="button"
                className={`tc-btn ${b.chipCoping}`}
                onClick={b.toggleCoping}
                aria-pressed={b.secCoping}
              >
                If things get hard
              </button>
              <button
                type="button"
                className={`tc-btn ${b.chipContacts}`}
                onClick={b.toggleContacts}
                aria-pressed={b.secContacts}
              >
                Support contacts
              </button>
            </div>
          </div>

          <div className="tc-screens-sheets-screen-017">
            <div className="tc-screens-sheets-screen-018">
              <span>
                <span className="tc-screens-sheets-screen-019">Clinician footer</span>
                <span className="tc-screens-sheets-screen-020">Name, service and review date.</span>
              </span>
              <button
                type="button"
                role="switch"
                onClick={b.toggleClinician}
                aria-checked={b.sheetClinician}
                aria-label="Show clinician footer"
                className={`tc-btn ${b.clinicianTrack}`}
              >
                <span className={b.clinicianKnob} />
              </button>
            </div>
            <p className="tc-screens-sheets-screen-021">
              Tip: every heading and paragraph on the sheet is editable — click to rewrite it before printing. Wording
              follows the {toneWord} tone.
            </p>
          </div>
        </div>

        {/* PAPER */}
        <div className="tc-paper-wrap tc-screens-sheets-screen-022">
          <div className="tc-paper tc-screens-sheets-screen-023">
            <div className="tc-mobile-wrap tc-screens-sheets-screen-024">
              <div className="tc-screens-sheets-screen-025">
                <span className="tc-screens-sheets-screen-026">
                  <ScaleIcon size={20} strokeWidth={1.6} />
                </span>
                <span className="tc-screens-sheets-screen-027">Therapy · Patient information</span>
              </div>
              <span className="tc-screens-sheets-screen-028">Prepared for you</span>
            </div>

            <h1 contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-029">
              {sheetTitle}
            </h1>
            <p contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-030">
              {t.bestUsedFor && t.bestUsedFor.length < 70 && !/^(most|the|a |an )/i.test(t.bestUsedFor)
                ? `A step-by-step plan to help with ${t.bestUsedFor.toLowerCase()}.`
                : `A plain-language plan to help you get the most from ${sheetTitle.toLowerCase()}.`}
            </p>

            {b.secAbout && about ? <PaperSection title="About this therapy">{about}</PaperSection> : null}

            {b.secSteps && steps.length ? (
              <div className="tc-screens-sheets-screen-031">
                <h2 contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-032">
                  Your plan
                </h2>
                <div className="tc-screens-sheets-screen-033">
                  {steps.map((step, i) => (
                    <div key={i} className="tc-screens-sheets-screen-034">
                      <span className="tc-screens-sheets-screen-035">{i + 1}</span>
                      <p contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-036">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {b.secPractice ? (
              <div className="tc-screens-sheets-screen-037">
                <h2 contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-038">
                  Practice at home
                </h2>
                <p contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-039">
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
              <div className="tc-screens-sheets-screen-040">
                <h2 contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-041">
                  Support contacts
                </h2>
                <div contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-042">
                  Your clinician: ______________________ · Phone: ______________
                  <br />
                  In a crisis, call your local emergency number or a 24/7 crisis line.
                </div>
              </div>
            ) : null}

            {b.sheetClinician ? (
              <div className="tc-screens-sheets-screen-043">
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
    <div className="tc-screens-sheets-screen-047">
      <h2 contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-048">
        {title}
      </h2>
      <p contentEditable suppressContentEditableWarning className="tc-screens-sheets-screen-049">
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
    <div className="tc-screens-sheets-screen-050">
      <button
        type="button"
        className="tc-btn tc-screens-sheets-screen-051"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tc-screens-sheets-screen-052">
          <ScaleIcon size={16} className="tc-screens-sheets-screen-053" />
          <span className="tc-screens-sheets-screen-054">{b.selectedTherapy?.name ?? "Choose a therapy"}</span>
        </span>
        <ChevronDownIcon size={15} strokeWidth={1.8} className="tc-screens-sheets-screen-055" />
      </button>
      {open ? (
        <div className="tc-screens-sheets-screen-056">
          <label className="tc-screens-sheets-screen-057">
            <SearchIcon size={15} strokeWidth={1.8} className="tc-screens-sheets-screen-058" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search therapies…"
              aria-label="Search therapies for the patient sheet"
              autoFocus
              className="tc-screens-sheets-screen-059"
            />
          </label>
          <div className="tc-scroll tc-screens-sheets-screen-060">
            {matches.map((t) => (
              <button
                key={t.slug}
                type="button"
                className="tc-btn tc-row tc-screens-sheets-screen-061"
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
