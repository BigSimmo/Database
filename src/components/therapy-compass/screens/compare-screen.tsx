"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function CompareScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Compare" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:6px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <div style={s(`display:flex;align-items:baseline;gap:12px;`)}>
            <h1 style={s(`margin:0;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}>
              Therapy Comparison
            </h1>
            <span
              style={s(
                `font-size:13px;font-weight:600;color:var(--clinical-accent-hover);background:var(--clinical-accent-soft);padding:3px 10px;border-radius:8px;`,
              )}
            >
              3 of 4 selected
            </span>
          </div>
          <p style={s(`margin:6px 0 0;font-size:14.5px;color:var(--text-muted);`)}>
            Compare fit, cautions, delivery and evidence without losing source context.
          </p>
        </div>
        <div style={s(`display:flex;align-items:center;gap:10px;`)}>
          <div style={s(`display:flex;gap:2px;padding:3px;background:var(--surface-inset);border-radius:11px;`)}>
            <button type="button" className="tc-btn" onClick={b.setComfortable} style={b.segComfortable}>
              Comfortable
            </button>
            <button type="button" className="tc-btn" onClick={b.setDense} style={b.segDense}>
              Dense
            </button>
          </div>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:7px;height:42px;padding:0 15px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M5 4h11l3 3v13H5Z" />
              <path d="M8 4v5h6V4M8 20v-6h8v6" />
            </svg>
            Save set
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `height:42px;padding:0 15px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
            )}
          >
            Clear
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `height:42px;padding:0 18px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:13.5px;font-weight:600;box-shadow:var(--shadow-tight);`,
            )}
          >
            Keep first
          </button>
        </div>
      </div>
      <div style={s(`display:flex;gap:12px;margin:18px 0;flex-wrap:wrap;`)}>
        <div style={s(`flex:1;min-width:260px;position:relative;display:flex;align-items:center;`)}>
          <svg
            style={s(`position:absolute;left:14px;color:var(--text-soft);`)}
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label="Search recent, favourite, or library"
            placeholder="Search recent, favourite, or library…"
            style={s(
              `width:100%;height:46px;padding:0 14px 0 40px;border:1px dashed var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none;`,
            )}
          />
        </div>
        <div
          style={s(
            `display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow-tight);`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
            <path d="M6 3h8l4 4v14H6Z" />
          </svg>
          <span style={s(`font-size:13px;font-weight:600;color:var(--text-heading);`)}>ACT</span>
          <svg
            className="tc-btn"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-soft)"
            strokeWidth="1.9"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </div>
        <div
          style={s(
            `display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow-tight);`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
          <span style={s(`font-size:13px;font-weight:600;color:var(--text-heading);`)}>Applied Relaxation</span>
          <svg
            className="tc-btn"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-soft)"
            strokeWidth="1.9"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </div>
        <div
          style={s(
            `display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow-tight);`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span style={s(`font-size:13px;font-weight:600;color:var(--text-heading);`)}>Brief low-intensity CBT</span>
          <svg
            className="tc-btn"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-soft)"
            strokeWidth="1.9"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </div>
      </div>
      <div
        style={s(
          `display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;margin-bottom:20px;`,
        )}
      >
        <div style={s(`padding:20px 22px;`)}>
          <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);`)}>Decision summary</div>
        </div>
        <div
          style={s(
            `padding:20px 22px;border-left:1px solid var(--border);box-shadow:inset 3px 0 0 var(--clinical-accent);`,
          )}
        >
          <div
            style={s(
              `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:6px;`,
            )}
          >
            CLINICAL PRIORITY
          </div>
          <div style={s(`font-size:14px;font-weight:600;color:var(--text-heading);`)}>Check cautions before fit</div>
        </div>
        <div style={s(`padding:20px 22px;border-left:1px solid var(--border);`)}>
          <div
            style={s(
              `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:6px;`,
            )}
          >
            SHORTEST DELIVERY
          </div>
          <div style={s(`font-size:14px;font-weight:600;color:var(--text-heading);`)}>Brief low-intensity CBT</div>
        </div>
        <div
          style={s(
            `padding:20px 22px;border-left:1px solid var(--border);box-shadow:inset 3px 0 0 var(--warning-text);`,
          )}
        >
          <div
            style={s(
              `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:6px;`,
            )}
          >
            SOURCE STATUS
          </div>
          <div style={s(`font-size:14px;font-weight:600;color:var(--warning-text);`)}>2 records need review</div>
        </div>
      </div>
      <div style={s(`display:flex;gap:26px;border-bottom:1px solid var(--border);margin-bottom:2px;`)}>
        <button type="button" className="tc-btn" onClick={b.setTabPriorities} style={b.tabPriorities}>
          Priorities
        </button>
        <button type="button" className="tc-btn" onClick={b.setTabDifferences} style={b.tabDifferences}>
          Differences
        </button>
        <button type="button" className="tc-btn" onClick={b.setTabAll} style={b.tabAll}>
          All fields
        </button>
      </div>
      <div
        style={s(
          `background:var(--surface);border:1px solid var(--border);border-top:none;border-radius:0 0 16px 16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
        )}
      >
        <div
          style={s(
            `display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;background:var(--surface-subtle);border-bottom:1px solid var(--border);`,
          )}
        >
          <div style={s(`padding:16px 20px;font-size:13px;font-weight:650;color:var(--text-soft);`)}>Field</div>
          <div style={s(`padding:14px 20px;border-left:1px solid var(--border);`)}>
            <div style={s(`display:flex;align-items:center;gap:7px;`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
              </svg>
              <span style={s(`font-size:13px;font-weight:650;color:var(--text-heading);`)}>ACT</span>
            </div>
            <div style={s(`font-size:11.5px;color:var(--warning-text);font-weight:600;margin-top:3px;`)}>
              Needs review
            </div>
          </div>
          <div style={s(`padding:14px 20px;border-left:1px solid var(--border);`)}>
            <div style={s(`display:flex;align-items:center;gap:7px;`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
              <span style={s(`font-size:13px;font-weight:650;color:var(--text-heading);`)}>Applied Relaxation</span>
            </div>
            <div style={s(`font-size:11.5px;color:var(--warning-text);font-weight:600;margin-top:3px;`)}>
              Source review required
            </div>
          </div>
          <div style={s(`padding:14px 20px;border-left:1px solid var(--border);`)}>
            <div style={s(`display:flex;align-items:center;gap:7px;`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span style={s(`font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                Brief low-intensity CBT
              </span>
            </div>
            <div style={s(`font-size:11.5px;color:var(--warning-text);font-weight:600;margin-top:3px;`)}>
              Clinician review required
            </div>
          </div>
        </div>
        <div
          style={s(
            `display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-bottom:1px solid var(--border);background:var(--warning-bg);`,
          )}
        >
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--warning-text);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            When not to use
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--warning-text);`,
            )}
          >
            Check for a more specific first-line therapy.
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--warning-text);`,
            )}
          >
            Confirm anxiety-arousal regulation is the main problem.
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--warning-text);`,
            )}
          >
            Check acuity, risk and suitability for a brief format.
          </div>
        </div>
        <div style={s(`display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-bottom:1px solid var(--border);`)}>
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);`,
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--clinical-accent)"
              strokeWidth="1.7"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            Best fit
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-muted);`,
            )}
          >
            Depression, anxiety-spectrum distress, broader transdiagnostic presentations.
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-muted);`,
            )}
          >
            Anxiety-arousal regulation.
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-muted);`,
            )}
          >
            Brief structured skills and psychoeducation.
          </div>
        </div>
        <div
          style={s(
            `display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-bottom:1px solid var(--border);background:var(--surface-subtle);`,
          )}
        >
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
              <circle cx="12" cy="12" r="9" />
              <path d="m10 8 6 4-6 4Z" />
            </svg>
            What to do first
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-muted);`,
            )}
          >
            Define values and committed action.
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-muted);`,
            )}
          >
            Teach and practise core relaxation.
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-muted);`,
            )}
          >
            Engage and set a brief agenda.
          </div>
        </div>
        <div style={s(`display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-bottom:1px solid var(--border);`)}>
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            Time required
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            Brief / full session
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            5-minute or structured session
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            5–15 minutes
          </div>
        </div>
        <div
          style={s(
            `display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-bottom:1px solid var(--border);background:var(--surface-subtle);`,
          )}
        >
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 10h.01M15 10h.01M8.5 15a4 4 0 0 0 7 0" />
            </svg>
            Patient acceptability
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            Generally good
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--success-text);font-weight:600;`,
            )}
          >
            High
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            Generally good
          </div>
        </div>
        <div style={s(`display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-bottom:1px solid var(--border);`)}>
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
              <path d="M12 3 2 8l10 5 10-5Z" />
              <path d="M6 10.5V16l6 3 6-3v-5.5" />
            </svg>
            Clinician skill
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            Moderate
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--success-text);font-weight:600;`,
            )}
          >
            Low
          </div>
          <div
            style={s(`padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--text-muted);`)}
          >
            Low–moderate
          </div>
        </div>
        <div style={s(`display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;background:var(--warning-bg);`)}>
          <div
            style={s(
              `padding:15px 20px;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="1.7">
              <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
            </svg>
            Evidence level
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--warning-text);font-weight:600;`,
            )}
          >
            Moderate · needs review
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--warning-text);font-weight:600;`,
            )}
          >
            Source review required
          </div>
          <div
            style={s(
              `padding:15px 20px;border-left:1px solid var(--border);font-size:13px;color:var(--warning-text);font-weight:600;`,
            )}
          >
            Clinician review required
          </div>
        </div>
      </div>
      <div
        style={s(`display:flex;align-items:center;gap:8px;margin-top:16px;font-size:12.5px;color:var(--text-soft);`)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v.01M11 12h1v4h1" />
        </svg>
        Comparisons are source-grounded. Review status reflects the latest source checks.
      </div>
    </section>
  );
}
