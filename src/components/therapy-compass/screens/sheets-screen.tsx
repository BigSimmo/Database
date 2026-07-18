"use client";

import { useMemo, useState, type ReactNode } from "react";

import { useTcBindings } from "../bindings";
import { parseSteps, searchTherapies } from "../data/select";
import { ChevronDownIcon, PrinterIcon, ScaleIcon, SearchIcon } from "../icons";
import { s } from "../style-utils";
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
    <section data-screen-label="Patient sheet" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        className="tc-no-print"
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <h1
            style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}
          >
            Patient Sheet Builder
          </h1>
          <p style={s(`margin:0;font-size:14.5px;color:var(--text-muted);`)}>
            Design, personalise and print a plain-language handout from a source-grounded record.
          </p>
        </div>
        <div className="tc-mobile-wrap" style={s(`display:flex;gap:10px;`)}>
          <button
            type="button"
            className="tc-btn"
            onClick={b.printSheet}
            style={s(
              `display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:13.5px;font-weight:600;box-shadow:var(--shadow-tight);cursor:pointer;font-family:inherit;`,
            )}
          >
            <PrinterIcon size={16} />
            Print / PDF
          </button>
        </div>
      </div>

      <div
        className="tc-stack-sm"
        style={s(`display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:start;`)}
      >
        {/* BUILDER */}
        <div
          className="tc-builder-panel tc-mobile-static"
          style={s(`display:flex;flex-direction:column;gap:16px;position:sticky;top:84px;`)}
        >
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:18px 20px;`,
            )}
          >
            <div style={s(`font-size:13px;font-weight:650;color:var(--text-heading);margin-bottom:12px;`)}>Therapy</div>
            <TherapyPicker />
            <div style={s(`font-size:13px;font-weight:650;color:var(--text-heading);margin:18px 0 10px;`)}>
              Reading level &amp; tone
            </div>
            <div style={s(`display:flex;gap:2px;padding:3px;background:var(--surface-inset);border-radius:11px;`)}>
              <button type="button" className="tc-btn" onClick={b.setTonePlain} style={b.tonePlain}>
                Plain
              </button>
              <button type="button" className="tc-btn" onClick={b.setToneWarm} style={b.toneWarm}>
                Warm
              </button>
              <button type="button" className="tc-btn" onClick={b.setToneClinical} style={b.toneClinical}>
                Clinical
              </button>
            </div>
          </div>

          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:18px 20px;`,
            )}
          >
            <div style={s(`font-size:13px;font-weight:650;color:var(--text-heading);margin-bottom:6px;`)}>Sections</div>
            <p style={s(`margin:0 0 14px;font-size:12px;color:var(--text-soft);`)}>Toggle what appears on the sheet.</p>
            <div style={s(`display:flex;flex-wrap:wrap;gap:8px;`)}>
              <button type="button" className="tc-btn" onClick={b.toggleAbout} style={b.chipAbout}>
                About this therapy
              </button>
              <button type="button" className="tc-btn" onClick={b.toggleSteps} style={b.chipSteps}>
                Your plan
              </button>
              <button type="button" className="tc-btn" onClick={b.togglePractice} style={b.chipPractice}>
                Practice at home
              </button>
              <button type="button" className="tc-btn" onClick={b.toggleCoping} style={b.chipCoping}>
                If things get hard
              </button>
              <button type="button" className="tc-btn" onClick={b.toggleContacts} style={b.chipContacts}>
                Support contacts
              </button>
            </div>
          </div>

          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:18px 20px;`,
            )}
          >
            <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:12px;`)}>
              <span>
                <span style={s(`display:block;font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                  Clinician footer
                </span>
                <span style={s(`display:block;font-size:12px;color:var(--text-soft);margin-top:2px;`)}>
                  Name, service and review date.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                onClick={b.toggleClinician}
                aria-checked={b.sheetClinician}
                aria-label="Show clinician footer"
                style={b.clinicianTrack}
              >
                <span style={b.clinicianKnob} />
              </button>
            </div>
            <p
              style={s(
                `margin:14px 0 0;font-size:11.5px;line-height:1.5;color:var(--text-soft);border-top:1px solid var(--border);padding-top:12px;`,
              )}
            >
              Tip: every heading and paragraph on the sheet is editable — click to rewrite it before printing. Wording
              follows the {toneWord} tone.
            </p>
          </div>
        </div>

        {/* PAPER */}
        <div className="tc-paper-wrap" style={s(`display:flex;justify-content:center;padding:8px 0;`)}>
          <div
            className="tc-paper"
            style={s(
              `width:100%;max-width:720px;background:#fff;border:1px solid var(--border);border-radius:6px;box-shadow:var(--shadow-hover);padding:52px 56px;color:#1a2230;`,
            )}
          >
            <div
              className="tc-mobile-wrap"
              style={s(
                // Fixed ink (light-mode --clinical-accent): the paper is pinned white in
                // both themes, so a theme-reactive accent would turn bright cyan in dark.
                `display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0b6f86;padding-bottom:16px;margin-bottom:24px;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:11px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);`,
                  )}
                >
                  <ScaleIcon size={20} strokeWidth={1.6} />
                </span>
                <span style={s(`font-size:13px;font-weight:600;color:var(--text-soft);letter-spacing:0.02em;`)}>
                  Therapy · Patient information
                </span>
              </div>
              <span style={s(`font-size:11.5px;color:#8a94a3;`)}>Prepared for you</span>
            </div>

            <h1
              contentEditable
              suppressContentEditableWarning
              style={s(
                `margin:0 0 6px;font-size:26px;font-weight:700;color:#0f1720;outline:none;letter-spacing:-0.01em;`,
              )}
            >
              {sheetTitle}
            </h1>
            <p
              contentEditable
              suppressContentEditableWarning
              style={s(`margin:0 0 26px;font-size:14px;color:#5b6472;outline:none;`)}
            >
              {t.bestUsedFor && t.bestUsedFor.length < 70 && !/^(most|the|a |an )/i.test(t.bestUsedFor)
                ? `A step-by-step plan to help with ${t.bestUsedFor.toLowerCase()}.`
                : `A plain-language plan to help you get the most from ${sheetTitle.toLowerCase()}.`}
            </p>

            {b.secAbout && about ? <PaperSection title="About this therapy">{about}</PaperSection> : null}

            {b.secSteps && steps.length ? (
              <div style={s(`margin-bottom:22px;`)}>
                <h2
                  contentEditable
                  suppressContentEditableWarning
                  style={s(`margin:0 0 10px;font-size:16px;font-weight:680;color:#095d70;outline:none;`)}
                >
                  Your plan
                </h2>
                <div style={s(`display:flex;flex-direction:column;gap:10px;`)}>
                  {steps.map((step, i) => (
                    <div key={i} style={s(`display:flex;gap:12px;`)}>
                      <span
                        style={s(
                          `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--clinical-accent-soft);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                        )}
                      >
                        {i + 1}
                      </span>
                      <p
                        contentEditable
                        suppressContentEditableWarning
                        style={s(`margin:0;font-size:13.5px;line-height:1.55;color:#2b3444;outline:none;flex:1;`)}
                      >
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {b.secPractice ? (
              <div
                style={s(
                  `margin-bottom:22px;background:#f4f8f9;border:1px solid #d9e9ec;border-radius:10px;padding:16px 18px;`,
                )}
              >
                <h2
                  contentEditable
                  suppressContentEditableWarning
                  style={s(`margin:0 0 8px;font-size:15px;font-weight:680;color:#095d70;outline:none;`)}
                >
                  Practice at home
                </h2>
                <p
                  contentEditable
                  suppressContentEditableWarning
                  style={s(`margin:0;font-size:13.5px;line-height:1.6;color:#2b3444;outline:none;`)}
                >
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
              <div
                style={s(
                  `margin-bottom:8px;background:#fbf6ee;border:1px solid #f0e2c8;border-radius:10px;padding:16px 18px;`,
                )}
              >
                <h2
                  contentEditable
                  suppressContentEditableWarning
                  style={s(`margin:0 0 8px;font-size:15px;font-weight:680;color:#8a5a12;outline:none;`)}
                >
                  Support contacts
                </h2>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  style={s(`font-size:13.5px;line-height:1.7;color:#2b3444;outline:none;`)}
                >
                  Your clinician: ______________________ · Phone: ______________
                  <br />
                  In a crisis, call your local emergency number or a 24/7 crisis line.
                </div>
              </div>
            ) : null}

            {b.sheetClinician ? (
              <div
                style={s(
                  `display:flex;justify-content:space-between;gap:16px;margin-top:26px;padding-top:16px;border-top:1px solid #e6e9ee;font-size:11.5px;color:#8a94a3;flex-wrap:wrap;`,
                )}
              >
                <span contentEditable suppressContentEditableWarning style={s(`outline:none;`)}>
                  Clinician: ____________________
                </span>
                <span contentEditable suppressContentEditableWarning style={s(`outline:none;`)}>
                  Service: ____________________
                </span>
                <span contentEditable suppressContentEditableWarning style={s(`outline:none;`)}>
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
    <div style={s(`margin-bottom:22px;`)}>
      <h2
        contentEditable
        suppressContentEditableWarning
        style={s(`margin:0 0 8px;font-size:16px;font-weight:680;color:#095d70;outline:none;`)}
      >
        {title}
      </h2>
      <p
        contentEditable
        suppressContentEditableWarning
        style={s(`margin:0;font-size:13.5px;line-height:1.65;color:#2b3444;outline:none;`)}
      >
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
    <div style={s(`position:relative;`)}>
      <button
        type="button"
        className="tc-btn"
        onClick={() => setOpen((v) => !v)}
        style={s(
          `display:flex;align-items:center;justify-content:space-between;width:100%;height:46px;padding:0 14px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;`,
        )}
      >
        <span style={s(`display:flex;align-items:center;gap:9px;min-width:0;`)}>
          <ScaleIcon size={16} style={s(`color:var(--clinical-accent);flex:none;`)} />
          <span style={s(`overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>
            {b.selectedTherapy?.name ?? "Choose a therapy"}
          </span>
        </span>
        <ChevronDownIcon size={15} strokeWidth={1.8} style={s(`color:var(--text-soft);flex:none;`)} />
      </button>
      {open ? (
        <div
          style={s(
            `position:absolute;z-index:30;top:52px;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-hover);overflow:hidden;`,
          )}
        >
          <label
            style={s(
              `position:relative;display:flex;align-items:center;padding:8px;border-bottom:1px solid var(--border);`,
            )}
          >
            <SearchIcon size={15} strokeWidth={1.8} style={s(`position:absolute;left:18px;color:var(--text-soft);`)} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search therapies…"
              aria-label="Search therapies for the patient sheet"
              autoFocus
              style={s(
                `width:100%;height:44px;padding:0 12px 0 34px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);font-size:13px;font-family:inherit;outline:none;`,
              )}
            />
          </label>
          <div className="tc-scroll" style={s(`max-height:260px;overflow:auto;`)}>
            {matches.map((t) => (
              <button
                key={t.slug}
                type="button"
                className="tc-btn tc-row"
                onClick={() => {
                  b.select(t.slug);
                  setOpen(false);
                  setQ("");
                }}
                style={s(
                  `display:block;width:100%;padding:10px 14px;border:none;border-bottom:1px solid var(--border);background:transparent;text-align:left;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--text-heading);`,
                )}
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
