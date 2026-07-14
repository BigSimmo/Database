"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function SearchScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Search" style={s(`max-width:1180px;margin:0 auto;`)}>
      <h1 style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}>
        Therapy Search
      </h1>
      <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
        Find source-grounded therapy records by problem, symptom, skill or population.
      </p>
      <div style={s(`display:flex;gap:12px;align-items:center;margin-bottom:16px;`)}>
        <div style={s(`flex:1;position:relative;display:flex;align-items:center;`)}>
          <svg
            style={s(`position:absolute;left:16px;color:var(--text-soft);`)}
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label="Search"
            defaultValue="anxiety in outpatient care"
            style={s(
              `width:100%;height:52px;padding:0 16px 0 46px;border:1px solid var(--border-strong);border-radius:13px;background:var(--surface);color:var(--text);font-size:16px;font-family:inherit;outline:none;box-shadow:var(--shadow-tight);`,
            )}
          />
        </div>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:52px;padding:0 18px;border:1px solid var(--border-strong);border-radius:13px;background:var(--surface);color:var(--text);font-size:14.5px;font-weight:600;`,
          )}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:9px;height:52px;padding:0 26px;border:none;border-radius:13px;background:var(--command);color:var(--command-contrast);font-size:14.5px;font-weight:600;box-shadow:var(--shadow-tight);`,
          )}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Search
        </button>
      </div>
      <div style={s(`display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;`)}>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text-muted);font-size:13.5px;font-weight:500;`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
            <path d="M4 5.5V20.5" />
          </svg>
          Common
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px solid var(--clinical-accent-border);border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);font-size:13.5px;font-weight:600;`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
          Outpatient
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text-muted);font-size:13.5px;font-weight:500;`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          15 minutes
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text-muted);font-size:13.5px;font-weight:500;`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M6 3h8l4 4v14H6Z" />
            <path d="M14 3v4h4" />
          </svg>
          Handout
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text-muted);font-size:13.5px;font-weight:500;`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m12 3 2.6 5.6L20 9.3l-4 3.9 1 5.8-5-2.7-5 2.7 1-5.8-4-3.9 5.4-.7Z" />
          </svg>
          Skills
        </button>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px dashed var(--border-strong);border-radius:11px;background:transparent;color:var(--text-soft);font-size:13.5px;font-weight:500;`,
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
          Clear
        </button>
      </div>
      <div style={s(`display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;`)}>
        <div style={s(`display:flex;align-items:baseline;gap:10px;`)}>
          <span style={s(`font-size:15px;font-weight:650;color:var(--text-heading);`)}>Top results</span>
          <span style={s(`font-size:13px;color:var(--text-soft);`)}>8 of 24 records</span>
        </div>
        <button
          type="button"
          className="tc-btn"
          style={s(
            `display:flex;align-items:center;gap:6px;padding:6px 10px;border:none;background:transparent;color:var(--text-muted);font-size:13px;font-weight:500;`,
          )}
        >
          Sort: Relevance{" "}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <div style={s(`display:flex;flex-direction:column;gap:14px;`)}>
        <article
          style={s(
            `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
          )}
        >
          <div
            style={s(
              `display:grid;grid-template-columns:minmax(300px,1fr) minmax(430px,1.35fr) auto;gap:24px;padding:20px 22px;align-items:start;`,
            )}
          >
            <div style={s(`display:flex;gap:15px;`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:var(--clinical-accent);color:#fff;flex:none;`,
                )}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3v18" />
                  <path d="m5 7-3 5.5h6L5 7Z" />
                  <path d="m19 7-3 5.5h6L19 7Z" />
                  <path d="M4 21h16" />
                  <path d="M8 7h8" />
                </svg>
              </span>
              <div style={s(`min-width:0;`)}>
                <h3
                  style={s(
                    `margin:0 0 5px;font-size:16.5px;font-weight:650;color:var(--text-heading);letter-spacing:-0.01em;`,
                  )}
                >
                  Acceptance &amp; Commitment Therapy (ACT)
                </h3>
                <p style={s(`margin:0 0 11px;font-size:13.5px;line-height:1.5;color:var(--text-muted);`)}>
                  A structured behavioural therapy focused on psychological flexibility rather than symptom control
                  alone.
                </p>
                <div style={s(`display:flex;flex-wrap:wrap;gap:7px;`)}>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:#f4f0ff;color:#6d3fc4;border:1px solid #e4d9fb;`,
                    )}
                  >
                    CBT
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-border);`,
                    )}
                  >
                    Crisis / risk
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                    )}
                  >
                    5-minute
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--success-bg);color:var(--success-text);border:1px solid var(--success-border);`,
                    )}
                  >
                    Handout
                  </span>
                </div>
              </div>
            </div>
            <div
              style={s(
                `display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
              )}
            >
              <div style={s(`padding:12px 13px;background:var(--surface);`)}>
                <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--text-soft);`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>WHY MATCHED</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Reviewed, complete and recently useful records first.
                </p>
              </div>
              <div style={s(`padding:12px 13px;background:var(--warning-bg);`)}>
                <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--warning-text);`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>AVOID / MODIFY</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--warning-text);`)}>
                  Clarify the core problem is not better matched to a more specific first-line therapy.
                </p>
              </div>
              <div style={s(`padding:12px 13px;background:var(--surface);`)}>
                <div
                  style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--clinical-accent);`)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                    <path d="m9.5 12 1.7 1.7 3.3-3.4" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>BEST FIT</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Depression, anxiety-spectrum distress and broader transdiagnostic presentations.
                </p>
              </div>
            </div>
            <div style={s(`display:flex;flex-direction:column;gap:8px;align-items:flex-end;`)}>
              <div style={s(`display:flex;gap:4px;`)}>
                <button
                  type="button"
                  className="tc-btn"
                  title="Favourite"
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);`,
                  )}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 20s-7-4.4-9.3-9A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 21.3 11C19 15.6 12 20 12 20Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="tc-btn"
                  title="More"
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);`,
                  )}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="5" cy="12" r="1.4" />
                    <circle cx="12" cy="12" r="1.4" />
                    <circle cx="19" cy="12" r="1.4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div style={s(`display:flex;gap:10px;padding:0 22px 20px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goDetail}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:44px;border:none;border-radius:11px;background:var(--clinical-accent);color:#fff;font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 4h6v6M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
              </svg>
              Open record
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goCompare}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;height:44px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3v18" />
                <path d="m5 7-3 5.5h6L5 7Z" />
                <path d="m19 7-3 5.5h6L19 7Z" />
              </svg>
              Compare
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goBrief}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;height:44px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
                <path d="M14 3v4h4" />
              </svg>
              Patient sheet
            </button>
          </div>
        </article>
        <article
          style={s(
            `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
          )}
        >
          <div
            style={s(
              `display:grid;grid-template-columns:minmax(300px,1fr) minmax(430px,1.35fr) auto;gap:24px;padding:20px 22px;align-items:start;`,
            )}
          >
            <div style={s(`display:flex;gap:15px;`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:var(--clinical-accent);color:#fff;flex:none;`,
                )}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="6.5" r="2.5" />
                  <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  <path d="M9 13.5 12 11l3 2.5" />
                </svg>
              </span>
              <div style={s(`min-width:0;`)}>
                <h3
                  style={s(
                    `margin:0 0 5px;font-size:16.5px;font-weight:650;color:var(--text-heading);letter-spacing:-0.01em;`,
                  )}
                >
                  Applied Relaxation / Relaxation-Based Therapy
                </h3>
                <p style={s(`margin:0 0 11px;font-size:13.5px;line-height:1.5;color:var(--text-muted);`)}>
                  Structured relaxation-based therapy for anxiety-arousal regulation, not generic advice.
                </p>
                <div style={s(`display:flex;flex-wrap:wrap;gap:7px;`)}>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:#f4f0ff;color:#6d3fc4;border:1px solid #e4d9fb;`,
                    )}
                  >
                    CBT
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-border);`,
                    )}
                  >
                    Trauma
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                    )}
                  >
                    5-minute
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--success-bg);color:var(--success-text);border:1px solid var(--success-border);`,
                    )}
                  >
                    Handout
                  </span>
                </div>
              </div>
            </div>
            <div
              style={s(
                `display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
              )}
            >
              <div style={s(`padding:12px 13px;background:var(--surface);`)}>
                <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--text-soft);`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>WHY MATCHED</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Reviewed, complete and recently useful records first.
                </p>
              </div>
              <div style={s(`padding:12px 13px;background:var(--warning-bg);`)}>
                <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--warning-text);`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>AVOID / MODIFY</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--warning-text);`)}>
                  Confirm the main problem is genuinely anxiety-arousal rather than compulsions needing ERP.
                </p>
              </div>
              <div style={s(`padding:12px 13px;background:var(--surface);`)}>
                <div
                  style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--clinical-accent);`)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                    <path d="m9.5 12 1.7 1.7 3.3-3.4" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>BEST FIT</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Generalised anxiety and physiological arousal in routine outpatient settings.
                </p>
              </div>
            </div>
            <div style={s(`display:flex;gap:4px;`)}>
              <button
                type="button"
                className="tc-btn"
                title="Favourite"
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 20s-7-4.4-9.3-9A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 21.3 11C19 15.6 12 20 12 20Z" />
                </svg>
              </button>
              <button
                type="button"
                className="tc-btn"
                title="More"
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="5" cy="12" r="1.4" />
                  <circle cx="12" cy="12" r="1.4" />
                  <circle cx="19" cy="12" r="1.4" />
                </svg>
              </button>
            </div>
          </div>
          <div style={s(`display:flex;gap:10px;padding:0 22px 20px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goDetail}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:44px;border:none;border-radius:11px;background:var(--clinical-accent);color:#fff;font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 4h6v6M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
              </svg>
              Open record
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goCompare}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;height:44px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3v18" />
                <path d="m5 7-3 5.5h6L5 7Z" />
                <path d="m19 7-3 5.5h6L19 7Z" />
              </svg>
              Compare
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goBrief}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;height:44px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
                <path d="M14 3v4h4" />
              </svg>
              Patient sheet
            </button>
          </div>
        </article>
        <article
          style={s(
            `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
          )}
        >
          <div
            style={s(
              `display:grid;grid-template-columns:minmax(300px,1fr) minmax(430px,1.35fr) auto;gap:24px;padding:20px 22px;align-items:start;`,
            )}
          >
            <div style={s(`display:flex;gap:15px;`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:var(--clinical-accent);color:#fff;flex:none;`,
                )}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="8" cy="8" r="2.3" />
                  <circle cx="16" cy="8" r="2.3" />
                  <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
                </svg>
              </span>
              <div style={s(`min-width:0;`)}>
                <h3
                  style={s(
                    `margin:0 0 5px;font-size:16.5px;font-weight:650;color:var(--text-heading);letter-spacing:-0.01em;`,
                  )}
                >
                  Problem Management Plus / PM+
                </h3>
                <p style={s(`margin:0 0 11px;font-size:13.5px;line-height:1.5;color:var(--text-muted);`)}>
                  A brief, transdiagnostic intervention for adults experiencing distress in adversity settings.
                </p>
                <div style={s(`display:flex;flex-wrap:wrap;gap:7px;`)}>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-border);`,
                    )}
                  >
                    Crisis / risk
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                    )}
                  >
                    Multi-session
                  </span>
                  <span
                    style={s(
                      `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;background:var(--success-bg);color:var(--success-text);border:1px solid var(--success-border);`,
                    )}
                  >
                    Handout
                  </span>
                </div>
              </div>
            </div>
            <div
              style={s(
                `display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
              )}
            >
              <div style={s(`padding:12px 13px;background:var(--surface);`)}>
                <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--text-soft);`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>WHY MATCHED</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Reviewed, complete and recently useful records first.
                </p>
              </div>
              <div style={s(`padding:12px 13px;background:var(--warning-bg);`)}>
                <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--warning-text);`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>AVOID / MODIFY</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--warning-text);`)}>
                  Source and review status must be checked before clinical use.
                </p>
              </div>
              <div style={s(`padding:12px 13px;background:var(--surface);`)}>
                <div
                  style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--clinical-accent);`)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                    <path d="m9.5 12 1.7 1.7 3.3-3.4" />
                  </svg>
                  <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;`)}>BEST FIT</span>
                </div>
                <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:var(--text-muted);`)}>
                  Brief, practical support in outpatient and primary care settings.
                </p>
              </div>
            </div>
            <div style={s(`display:flex;gap:4px;`)}>
              <button
                type="button"
                className="tc-btn"
                title="Favourite"
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 20s-7-4.4-9.3-9A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 21.3 11C19 15.6 12 20 12 20Z" />
                </svg>
              </button>
              <button
                type="button"
                className="tc-btn"
                title="More"
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="5" cy="12" r="1.4" />
                  <circle cx="12" cy="12" r="1.4" />
                  <circle cx="19" cy="12" r="1.4" />
                </svg>
              </button>
            </div>
          </div>
          <div style={s(`display:flex;gap:10px;padding:0 22px 20px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goDetail}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:44px;border:none;border-radius:11px;background:var(--clinical-accent);color:#fff;font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 4h6v6M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
              </svg>
              Open record
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goCompare}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;height:44px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3v18" />
                <path d="m5 7-3 5.5h6L5 7Z" />
                <path d="m19 7-3 5.5h6L19 7Z" />
              </svg>
              Compare
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goBrief}
              style={s(
                `display:flex;align-items:center;justify-content:center;gap:8px;padding:0 22px;height:44px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
                <path d="M14 3v4h4" />
              </svg>
              Patient sheet
            </button>
          </div>
        </article>
      </div>
      <div
        style={s(
          `margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:16px;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--clinical-accent);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;`,
        )}
      >
        <div>
          <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
            Clinical workbench
          </div>
          <div style={s(`display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;`)}>
            <span style={s(`font-size:11.5px;font-weight:650;letter-spacing:0.05em;color:var(--text-soft);`)}>
              SAVED SEARCHES
            </span>
            <button
              type="button"
              onClick={b.goSearch}
              style={s(
                `border:none;background:transparent;padding:0;font-family:inherit;color:var(--clinical-accent);font-size:12.5px;font-weight:600;cursor:pointer;`,
              )}
            >
              View all
            </button>
          </div>
          <button
            type="button"
            className="tc-btn tc-row"
            onClick={b.goSearch}
            style={s(
              `display:flex;align-items:center;justify-content:space-between;width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-subtle);color:var(--text);font-size:13px;font-weight:500;`,
            )}
          >
            <span style={s(`display:flex;align-items:center;gap:9px;`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              anxiety outpatient handout
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.8">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <div>
          <div style={s(`font-size:14px;font-weight:650;color:transparent;margin-bottom:14px;`)}>.</div>
          <div style={s(`display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;`)}>
            <span style={s(`font-size:11.5px;font-weight:650;letter-spacing:0.05em;color:var(--text-soft);`)}>
              FAVOURITES
            </span>
            <button
              type="button"
              onClick={b.goSearch}
              style={s(
                `border:none;background:transparent;padding:0;font-family:inherit;color:var(--clinical-accent);font-size:12.5px;font-weight:600;cursor:pointer;`,
              )}
            >
              View all
            </button>
          </div>
          <button
            type="button"
            className="tc-btn tc-row"
            onClick={b.goDetail}
            style={s(
              `display:flex;align-items:center;justify-content:space-between;width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-subtle);color:var(--text);font-size:13px;font-weight:500;`,
            )}
          >
            <span style={s(`display:flex;align-items:center;gap:9px;`)}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--clinical-accent)"
                strokeWidth="1.8"
              >
                <path d="M12 20s-7-4.4-9.3-9A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 21.3 11C19 15.6 12 20 12 20Z" />
              </svg>
              Acceptance &amp; Commitment Therapy (ACT)
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.8">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
