"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function BriefScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Brief" style={s(`max-width:1240px;margin:0 auto;`)}>
      <div
        style={s(
          `display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px;flex-wrap:wrap;`,
        )}
      >
        <div>
          <h1
            style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}
          >
            Brief Intervention
          </h1>
          <p style={s(`margin:0;font-size:14.5px;color:var(--text-muted);`)}>
            Fast scripts and steps from uploaded delivery fields.
          </p>
        </div>
        <div style={s(`display:flex;gap:10px;`)}>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M6 4h12v16l-6-4-6 4Z" />
            </svg>
            Saved briefs
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:8px;height:44px;padding:0 18px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:13.5px;font-weight:600;box-shadow:var(--shadow-tight);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M6 3h8l4 4v14H6Z" />
              <path d="M14 3v4h4" />
            </svg>
            Create handout
          </button>
        </div>
      </div>
      <div style={s(`position:relative;display:flex;align-items:center;margin-bottom:16px;`)}>
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
          aria-label="Filter brief interventions"
          placeholder="Filter brief interventions…"
          style={s(
            `width:100%;height:46px;padding:0 15px 0 42px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none;box-shadow:var(--shadow-tight);`,
          )}
        />
      </div>
      <div style={s(`display:flex;gap:24px;border-bottom:1px solid var(--border);margin-bottom:20px;flex-wrap:wrap;`)}>
        <button type="button" className="tc-btn" onClick={b.set5} style={b.brief5}>
          5 minutes
        </button>
        <button type="button" className="tc-btn" onClick={b.set15} style={b.brief15}>
          15 minutes
        </button>
        <button type="button" className="tc-btn" onClick={b.setGround} style={b.briefGround}>
          Grounding now
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `padding:10px 4px;border:none;background:transparent;color:var(--text-muted);font-size:14px;font-weight:500;border-bottom:2px solid transparent;`,
          )}
        >
          Patient explanation
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `padding:10px 4px;border:none;background:transparent;color:var(--text-muted);font-size:14px;font-weight:500;border-bottom:2px solid transparent;`,
          )}
        >
          Behavioural task
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `padding:10px 4px;border:none;background:transparent;color:var(--text-muted);font-size:14px;font-weight:500;border-bottom:2px solid transparent;`,
          )}
        >
          Script
        </button>
      </div>
      <div style={s(`display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start;`)}>
        <div
          style={s(
            `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:16px;`,
          )}
        >
          <div style={s(`font-size:13px;font-weight:650;color:var(--text-heading);margin-bottom:12px;`)}>
            Available records
          </div>
          <div style={s(`display:flex;flex-direction:column;gap:8px;`)}>
            <button
              type="button"
              className="tc-btn"
              style={s(
                `display:flex;gap:12px;padding:13px;border:1px solid var(--clinical-accent-border);border-left:3px solid var(--clinical-accent);border-radius:11px;background:var(--clinical-accent-soft);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:#fff;color:var(--clinical-accent);flex:none;`,
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M13 4a1.5 1.5 0 1 0 0-.01M8 21l2-6 3 2 1 4M13 11l3-1 3 2M9 11 6 9" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                  Behavioural Activation
                </span>
                <span style={s(`display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;`)}>
                  Depression and low motivation
                </span>
              </span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warning-text)"
                strokeWidth="1.8"
                style={s(`flex:none;`)}
              >
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </button>
            <button
              type="button"
              className="tc-btn tc-row"
              style={s(
                `display:flex;gap:12px;padding:13px;border:1px solid var(--border);border-radius:11px;background:var(--surface);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 2 4 7v10l8 5 8-5V7Z" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                  Acceptance &amp; Commitment (ACT)
                </span>
                <span style={s(`display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;`)}>
                  Psychological flexibility
                </span>
              </span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warning-text)"
                strokeWidth="1.8"
                style={s(`flex:none;`)}
              >
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </button>
            <button
              type="button"
              className="tc-btn tc-row"
              style={s(
                `display:flex;gap:12px;padding:13px;border:1px solid var(--border);border-radius:11px;background:var(--surface);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 22c4-2 7-5 7-10a7 7 0 0 0-14 0c0 5 3 8 7 10Z" />
                  <path d="M12 12c0-3 1.5-5 4-6M12 12c0-3-1.5-5-4-6" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                  Applied Relaxation
                </span>
                <span style={s(`display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;`)}>
                  Anxiety-arousal regulation
                </span>
              </span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--success-text)"
                strokeWidth="1.9"
                style={s(`flex:none;`)}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
              </svg>
            </button>
            <button
              type="button"
              className="tc-btn tc-row"
              style={s(
                `display:flex;gap:12px;padding:13px;border:1px solid var(--border);border-radius:11px;background:var(--surface);text-align:left;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="8" cy="8" r="2.3" />
                  <circle cx="16" cy="8" r="2.3" />
                  <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
                </svg>
              </span>
              <span style={s(`flex:1;`)}>
                <span style={s(`display:block;font-size:13px;font-weight:650;color:var(--text-heading);`)}>
                  Problem Management Plus
                </span>
                <span style={s(`display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;`)}>
                  Brief transdiagnostic support
                </span>
              </span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warning-text)"
                strokeWidth="1.8"
                style={s(`flex:none;`)}
              >
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </button>
          </div>
          <div style={s(`text-align:center;font-size:11.5px;color:var(--text-soft);margin-top:14px;`)}>
            Showing 4 of 4 records
          </div>
        </div>
        <div style={s(`display:flex;flex-direction:column;gap:16px;`)}>
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;`,
            )}
          >
            <div
              style={s(
                `display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:12px;flex-wrap:wrap;`)}>
                <h2 style={s(`margin:0;font-size:19px;font-weight:680;color:var(--text-heading);`)}>
                  Behavioural Activation
                </h2>
                <span
                  style={s(
                    `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);border:1px solid var(--clinical-accent-border);`,
                  )}
                >
                  5-minute mode
                </span>
                <span
                  style={s(
                    `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-border);`,
                  )}
                >
                  Source-derived
                </span>
                <span
                  style={s(
                    `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--warning-bg);color:var(--warning-text);border:1px solid var(--warning-border);`,
                  )}
                >
                  Clinician review required
                </span>
              </div>
              <button
                type="button"
                className="tc-btn"
                onClick={b.goDetail}
                style={s(
                  `display:flex;align-items:center;gap:7px;height:36px;padding:0 13px;border:1px solid var(--border-strong);border-radius:9px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;`,
                )}
              >
                Open full record{" "}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M14 4h6v6M20 4l-8 8" />
                  <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
                </svg>
              </button>
            </div>
            <div
              style={s(
                `display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
              )}
            >
              <div style={s(`padding:14px 15px;background:var(--surface);`)}>
                <div
                  style={s(
                    `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:7px;`,
                  )}
                >
                  GOAL
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Depression and low motivation in outpatient care.
                </p>
              </div>
              <div style={s(`padding:14px 15px;background:var(--surface);`)}>
                <div
                  style={s(
                    `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:7px;`,
                  )}
                >
                  SCRIPT / STEPS
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Choose one small activity.
                </p>
              </div>
              <div style={s(`padding:14px 15px;background:var(--warning-bg);`)}>
                <div
                  style={s(
                    `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--warning-text);margin-bottom:7px;`,
                  )}
                >
                  CAUTIONS
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--warning-text);`)}>
                  Review source cautions, acuity and patient factors before use.
                </p>
              </div>
              <div style={s(`padding:14px 15px;background:var(--surface);`)}>
                <div
                  style={s(
                    `font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:7px;`,
                  )}
                >
                  SOURCE STATUS
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Uploaded delivery fields ·{" "}
                  <span style={s(`color:var(--warning-text);font-weight:600;`)}>review required.</span>
                </p>
              </div>
            </div>
          </div>
          <div style={s(`display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start;`)}>
            <div
              style={s(
                `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:20px 22px;`,
              )}
            >
              <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:16px;`)}>
                5-minute delivery
              </div>
              <div style={s(`display:flex;flex-direction:column;gap:14px;`)}>
                <div style={s(`display:flex;gap:14px;`)}>
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--clinical-accent-soft);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                    )}
                  >
                    1
                  </span>
                  <div style={s(`flex:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;`)}>
                    <div>
                      <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>Orient</div>
                      <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                        Confirm the immediate goal and available time.
                      </div>
                    </div>
                    <div style={s(`display:flex;align-items:center;gap:8px;flex:none;`)}>
                      <span style={s(`font-size:11px;color:var(--text-soft);`)}>Uploaded delivery fields</span>
                      <button
                        type="button"
                        className="tc-btn"
                        title="Copy"
                        style={s(
                          `display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-soft);`,
                        )}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <rect x="8" y="8" width="12" height="12" rx="2" />
                          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div style={s(`display:flex;gap:14px;`)}>
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--clinical-accent-soft);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                    )}
                  >
                    2
                  </span>
                  <div style={s(`flex:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;`)}>
                    <div>
                      <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                        Choose one small activity
                      </div>
                      <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                        Use the source-derived brief step.
                      </div>
                    </div>
                    <div style={s(`display:flex;align-items:center;gap:8px;flex:none;`)}>
                      <span style={s(`font-size:11px;color:var(--text-soft);`)}>Uploaded delivery fields</span>
                      <button
                        type="button"
                        className="tc-btn"
                        title="Copy"
                        style={s(
                          `display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-soft);`,
                        )}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <rect x="8" y="8" width="12" height="12" rx="2" />
                          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div style={s(`display:flex;gap:14px;`)}>
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--clinical-accent-soft);color:var(--clinical-accent);font-size:12px;font-weight:700;flex:none;`,
                    )}
                  >
                    3
                  </span>
                  <div style={s(`flex:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;`)}>
                    <div>
                      <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
                        Plan the next action
                      </div>
                      <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                        Record what will happen, when and where.
                      </div>
                    </div>
                    <div style={s(`display:flex;align-items:center;gap:8px;flex:none;`)}>
                      <span style={s(`font-size:11px;color:var(--text-soft);`)}>Uploaded delivery fields</span>
                      <button
                        type="button"
                        className="tc-btn"
                        title="Copy"
                        style={s(
                          `display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-soft);`,
                        )}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <rect x="8" y="8" width="12" height="12" rx="2" />
                          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div style={s(`display:flex;gap:14px;`)}>
                  <span
                    style={s(
                      `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--clinical-accent);color:#fff;font-size:12px;font-weight:700;flex:none;`,
                    )}
                  >
                    4
                  </span>
                  <div style={s(`flex:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;`)}>
                    <div>
                      <div style={s(`font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>Review</div>
                      <div style={s(`font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
                        Check understanding, cautions and follow-up.
                      </div>
                    </div>
                    <div style={s(`display:flex;align-items:center;gap:8px;flex:none;`)}>
                      <span style={s(`font-size:11px;color:var(--text-soft);`)}>Uploaded delivery fields</span>
                      <button
                        type="button"
                        className="tc-btn"
                        title="Copy"
                        style={s(
                          `display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-soft);`,
                        )}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <rect x="8" y="8" width="12" height="12" rx="2" />
                          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              style={s(
                `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:20px 22px;`,
              )}
            >
              <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
                Before use
              </div>
              <div style={s(`display:flex;flex-direction:column;gap:13px;margin-bottom:16px;`)}>
                <div
                  style={s(`display:flex;align-items:center;gap:11px;font-size:13px;color:var(--text);cursor:pointer;`)}
                >
                  <span
                    style={s(
                      `width:19px;height:19px;border:1.5px solid var(--border-strong);border-radius:5px;flex:none;`,
                    )}
                  ></span>
                  Confirm the primary problem
                </div>
                <div
                  style={s(`display:flex;align-items:center;gap:11px;font-size:13px;color:var(--text);cursor:pointer;`)}
                >
                  <span
                    style={s(
                      `width:19px;height:19px;border:1.5px solid var(--border-strong);border-radius:5px;flex:none;`,
                    )}
                  ></span>
                  Check risk and acuity
                </div>
                <div
                  style={s(`display:flex;align-items:center;gap:11px;font-size:13px;color:var(--text);cursor:pointer;`)}
                >
                  <span
                    style={s(
                      `width:19px;height:19px;border:1.5px solid var(--border-strong);border-radius:5px;flex:none;`,
                    )}
                  ></span>
                  Review contraindications
                </div>
                <div
                  style={s(`display:flex;align-items:center;gap:11px;font-size:13px;color:var(--text);cursor:pointer;`)}
                >
                  <span
                    style={s(
                      `width:19px;height:19px;border:1.5px solid var(--border-strong);border-radius:5px;flex:none;`,
                    )}
                  ></span>
                  Confirm patient-facing language
                </div>
              </div>
              <div
                style={s(
                  `display:flex;align-items:flex-start;gap:9px;padding:13px 14px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:11px;`,
                )}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--warning-text)"
                  strokeWidth="1.8"
                  style={s(`flex:none;margin-top:1px;`)}
                >
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                <span style={s(`font-size:12.5px;font-weight:600;line-height:1.45;color:var(--warning-text);`)}>
                  Clinical review is required before saving or sharing.
                </span>
              </div>
            </div>
          </div>
          <div style={s(`display:flex;gap:10px;flex-wrap:wrap;`)}>
            <button
              type="button"
              className="tc-btn"
              style={s(
                `display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M4 16V6a2 2 0 0 1 2-2h10" />
              </svg>
              Copy intervention
            </button>
            <button
              type="button"
              className="tc-btn"
              style={s(
                `display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 4h12v16l-6-4-6 4Z" />
              </svg>
              Save brief
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goBrief}
              style={s(
                `display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
                <path d="M14 3v4h4" />
              </svg>
              Open patient sheet
            </button>
            <button
              type="button"
              className="tc-btn"
              style={s(
                `display:flex;align-items:center;gap:8px;height:46px;padding:0 22px;margin-left:auto;border:none;border-radius:12px;background:var(--command);color:var(--command-contrast);font-size:13.5px;font-weight:600;box-shadow:var(--shadow-tight);`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
                <path d="M14 3v4h4" />
              </svg>
              Create handout
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
