"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function PathwaysScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Pathways" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <h1
            style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}
          >
            Clinical Pathways
          </h1>
          <p style={s(`margin:0;font-size:14.5px;color:var(--text-muted);`)}>
            Problem-based workflows generated from imported records.
          </p>
        </div>
        <div style={s(`display:flex;gap:10px;`)}>
          <button
            type="button"
            className="tc-btn"
            onClick={b.goReview}
            style={s(
              `display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 5h13M4 12h13M4 19h13M20 5v2M20 12v2M20 19v2" />
            </svg>
            Review queue
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:8px;height:44px;padding:0 18px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:13.5px;font-weight:600;box-shadow:var(--shadow-tight);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Open pathway
          </button>
        </div>
      </div>
      <div style={s(`display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;`)}>
        <div style={s(`flex:1;min-width:280px;position:relative;display:flex;align-items:center;`)}>
          <svg
            style={s(`position:absolute;left:15px;color:var(--text-soft);`)}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label="Search pathways or clinical problems"
            placeholder="Search pathways or clinical problems…"
            style={s(
              `width:100%;height:46px;padding:0 15px 0 42px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none;box-shadow:var(--shadow-tight);`,
            )}
          />
        </div>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:9px;height:46px;padding:0 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:500;box-shadow:var(--shadow-tight);`,
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          All review states{" "}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.8">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:9px;height:46px;padding:0 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:500;box-shadow:var(--shadow-tight);`,
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.7">
            <path d="M4 6h9M4 12h6M4 18h4M17 4v14M17 18l3-3M17 18l-3-3" />
          </svg>
          Recently updated{" "}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.8">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <div
        style={s(
          `display:grid;grid-template-columns:320px 1fr;gap:16px;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
        )}
      >
        <div style={s(`border-right:1px solid var(--border);padding:18px;`)}>
          <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>Pathways</div>
          <div style={s(`display:flex;flex-direction:column;gap:10px;`)}>
            <button
              type="button"
              className="tc-btn"
              style={s(
                `display:flex;gap:12px;padding:14px;border:1px solid var(--clinical-accent-border);border-left:3px solid var(--clinical-accent);border-radius:12px;background:var(--clinical-accent-soft);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:#fff;color:var(--clinical-accent);flex:none;`,
                )}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 17a3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 2-5.2A3 3 0 0 0 15 3a3 3 0 0 0-6 0Z" />
                  <path d="M12 4v14" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
                  Mood and anxiety
                </span>
                <span style={s(`display:block;font-size:12px;color:var(--text-muted);margin:2px 0 8px;`)}>
                  Anxiety and depressive presentations
                </span>
                <span style={s(`display:flex;align-items:center;justify-content:space-between;`)}>
                  <span style={s(`font-size:11.5px;color:var(--text-soft);`)}>4 linked steps</span>
                  <span
                    style={s(
                      `font-size:11px;font-weight:600;color:var(--warning-text);background:var(--warning-bg);border:1px solid var(--warning-border);padding:2px 8px;border-radius:6px;`,
                    )}
                  >
                    Needs review
                  </span>
                </span>
              </span>
            </button>
            <button
              type="button"
              className="tc-btn tc-row"
              style={s(
                `display:flex;gap:12px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18Z" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
                  Depression pathway
                </span>
                <span style={s(`display:block;font-size:12px;color:var(--text-muted);margin:2px 0 8px;`)}>
                  Depression and low motivation
                </span>
                <span style={s(`display:flex;align-items:center;justify-content:space-between;`)}>
                  <span style={s(`font-size:11.5px;color:var(--text-soft);`)}>3 linked steps</span>
                  <span
                    style={s(
                      `font-size:11px;font-weight:600;color:var(--warning-text);background:var(--warning-bg);border:1px solid var(--warning-border);padding:2px 8px;border-radius:6px;`,
                    )}
                  >
                    Clinician review
                  </span>
                </span>
              </span>
            </button>
            <button
              type="button"
              className="tc-btn tc-row"
              style={s(
                `display:flex;gap:12px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
                  Brief support pathway
                </span>
                <span style={s(`display:block;font-size:12px;color:var(--text-muted);margin:2px 0 8px;`)}>
                  Time-limited intervention planning
                </span>
                <span style={s(`display:flex;align-items:center;justify-content:space-between;`)}>
                  <span style={s(`font-size:11.5px;color:var(--text-soft);`)}>3 linked steps</span>
                  <span
                    style={s(
                      `font-size:11px;font-weight:600;color:var(--text-muted);background:var(--surface-inset);padding:2px 8px;border-radius:6px;`,
                    )}
                  >
                    Incomplete
                  </span>
                </span>
              </span>
            </button>
          </div>
          <p style={s(`margin:16px 0 0;font-size:11.5px;color:var(--text-soft);font-style:italic;`)}>
            Pathways are generated from imported therapy records.
          </p>
        </div>
        <div style={s(`padding:22px 24px;`)}>
          <div style={s(`display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;`)}>
            <span
              style={s(
                `display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:12px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
              )}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 17a3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 2-5.2A3 3 0 0 0 15 3a3 3 0 0 0-6 0Z" />
                <path d="M12 4v14" />
              </svg>
            </span>
            <div style={s(`flex:1;`)}>
              <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:12px;`)}>
                <h2 style={s(`margin:0;font-size:20px;font-weight:680;color:var(--text-heading);`)}>
                  Mood and anxiety
                </h2>
                <span
                  style={s(
                    `display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--warning-text);background:var(--warning-bg);border:1px solid var(--warning-border);padding:5px 11px;border-radius:9px;`,
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  Needs review
                </span>
              </div>
              <p style={s(`margin:6px 0 8px;font-size:13.5px;line-height:1.5;color:var(--text-muted);`)}>
                A source-linked workflow for reviewing therapy options, delivery constraints and cautions before
                choosing a next step.
              </p>
              <div style={s(`display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-soft);`)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 15 15 9M8.5 12l-2 2a3 3 0 0 0 4 4l2-2M15.5 12l2-2a3 3 0 0 0-4-4l-2 2" />
                </svg>
                4 linked therapy steps
              </div>
            </div>
          </div>
          <div style={s(`position:relative;padding-left:6px;`)}>
            <div style={s(`display:flex;flex-direction:column;gap:10px;`)}>
              <div style={s(`display:flex;align-items:center;gap:16px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--clinical-accent);background:var(--surface);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                  )}
                >
                  1
                </span>
                <div
                  className="tc-row"
                  style={s(
                    `flex:1;display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);`,
                  )}
                >
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                    )}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2Z" />
                      <path d="M9 3h6v3H9zM9 11h6M9 15h4" />
                    </svg>
                  </span>
                  <div style={s(`flex:1;`)}>
                    <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                      Clarify the primary problem
                    </div>
                    <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                      Confirm target symptoms, setting, acuity and exclusions.
                    </div>
                  </div>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);`)}>
                    ASSESSMENT
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-soft)"
                    strokeWidth="1.8"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </div>
              </div>
              <div style={s(`display:flex;align-items:center;gap:16px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--clinical-accent);background:var(--surface);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                  )}
                >
                  2
                </span>
                <div
                  className="tc-row"
                  style={s(
                    `flex:1;display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);`,
                  )}
                >
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                    )}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M6 3h8l4 4v14H6Z" />
                      <path d="M14 3v4h4" />
                    </svg>
                  </span>
                  <div style={s(`flex:1;`)}>
                    <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                      Acceptance &amp; Commitment Therapy (ACT)
                    </div>
                    <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                      Review fit, contraindications and source status.
                    </div>
                  </div>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);`)}>
                    THERAPY RECORD
                  </span>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={b.goDetail}
                    style={s(
                      `height:32px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-weight:600;`,
                    )}
                  >
                    Open record
                  </button>
                </div>
              </div>
              <div style={s(`display:flex;align-items:center;gap:16px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--clinical-accent);background:var(--surface);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                  )}
                >
                  3
                </span>
                <div
                  className="tc-row"
                  style={s(
                    `flex:1;display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);`,
                  )}
                >
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                    )}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="12" cy="6.5" r="2.5" />
                      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                    </svg>
                  </span>
                  <div style={s(`flex:1;`)}>
                    <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                      Applied Relaxation
                    </div>
                    <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                      Consider when anxiety-arousal regulation is the main problem.
                    </div>
                  </div>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);`)}>
                    THERAPY RECORD
                  </span>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={b.goCompare}
                    style={s(
                      `height:32px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-weight:600;`,
                    )}
                  >
                    Compare
                  </button>
                </div>
              </div>
              <div style={s(`display:flex;align-items:center;gap:16px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--clinical-accent);background:var(--surface);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                  )}
                >
                  4
                </span>
                <div
                  className="tc-row"
                  style={s(
                    `flex:1;display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);`,
                  )}
                >
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                    )}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                  </span>
                  <div style={s(`flex:1;`)}>
                    <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                      Brief low-intensity CBT
                    </div>
                    <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                      Check suitability for a 5–15 minute structured format.
                    </div>
                  </div>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);`)}>
                    BRIEF OPTION
                  </span>
                  <button
                    type="button"
                    className="tc-btn"
                    onClick={b.goBrief}
                    style={s(
                      `height:32px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-weight:600;`,
                    )}
                  >
                    Open brief
                  </button>
                </div>
              </div>
              <div style={s(`display:flex;align-items:center;gap:16px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--clinical-accent);background:var(--clinical-accent);color:#fff;font-size:12px;font-weight:700;flex:none;`,
                  )}
                >
                  5
                </span>
                <div
                  className="tc-row"
                  style={s(
                    `flex:1;display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);`,
                  )}
                >
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
                    )}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                      <path d="m9.5 12 1.7 1.7 3.3-3.4" />
                    </svg>
                  </span>
                  <div style={s(`flex:1;`)}>
                    <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                      Review and next step
                    </div>
                    <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                      Document source checks, clinician judgement and follow-up.
                    </div>
                  </div>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);`)}>
                    REVIEW
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-soft)"
                    strokeWidth="1.8"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        style={s(
          `display:flex;align-items:center;gap:18px;margin-top:20px;padding:18px 22px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:16px;`,
        )}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--warning-text)"
          strokeWidth="1.8"
          style={s(`flex:none;`)}
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <div style={s(`flex:1;`)}>
          <div style={s(`font-size:13.5px;font-weight:650;color:var(--warning-text);`)}>
            Clinical caution — decision support generated from imported records.
          </div>
          <div style={s(`font-size:12.5px;color:var(--warning-text);margin-top:2px;`)}>
            Review source status, missing fields and patient-specific factors before clinical use.
          </div>
        </div>
        <div style={s(`display:flex;gap:9px;`)}>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border:1px solid var(--warning-border);border-radius:10px;background:#fff;color:var(--text);font-size:13px;font-weight:600;`,
            )}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M4 16V6a2 2 0 0 1 2-2h10" />
            </svg>
            Copy pathway
          </button>
          <button
            type="button"
            className="tc-btn"
            onClick={b.goReview}
            style={s(
              `height:40px;padding:0 18px;border:none;border-radius:10px;background:var(--command);color:var(--command-contrast);font-size:13px;font-weight:600;`,
            )}
          >
            Start review
          </button>
        </div>
      </div>
    </section>
  );
}
