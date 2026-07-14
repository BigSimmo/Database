"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function DetailScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Detail" style={s(`max-width:1240px;margin:0 auto;`)}>
      <button
        type="button"
        className="tc-btn"
        onClick={b.goSearch}
        style={s(
          `display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:6px 4px;border:none;background:transparent;color:var(--clinical-accent);font-size:14px;font-weight:600;`,
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        Back to results
      </button>
      <div style={s(`display:grid;grid-template-columns:1fr 344px;gap:22px;align-items:start;`)}>
        <div style={s(`display:flex;flex-direction:column;gap:16px;`)}>
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--clinical-accent);border-radius:16px;box-shadow:var(--shadow-soft);padding:24px 26px;`,
            )}
          >
            <div style={s(`display:flex;gap:10px;margin-bottom:14px;`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;padding:5px 11px;border-radius:8px;background:var(--warning-bg);color:var(--warning-text);border:1px solid var(--warning-border);`,
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                Needs source review
              </span>
              <span
                style={s(
                  `font-size:12px;font-weight:600;padding:5px 11px;border-radius:8px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                )}
              >
                Moderate complexity
              </span>
            </div>
            <h1
              style={s(
                `margin:0 0 4px;font-size:28px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`,
              )}
            >
              Acceptance &amp; Commitment Therapy (ACT)
            </h1>
            <div style={s(`font-size:13px;color:var(--text-soft);margin-bottom:12px;`)}>Also known as ACT</div>
            <p style={s(`margin:0 0 16px;font-size:15px;line-height:1.6;color:var(--text-muted);max-width:62ch;`)}>
              A structured behavioural therapy in the broader CBT family, focused on psychological flexibility rather
              than symptom control alone.
            </p>
            <div style={s(`display:flex;flex-wrap:wrap;gap:8px;`)}>
              <span
                style={s(
                  `font-size:12px;font-weight:600;padding:4px 11px;border-radius:8px;background:#f4f0ff;color:#6d3fc4;border:1px solid #e4d9fb;`,
                )}
              >
                CBT
              </span>
              <span
                style={s(
                  `font-size:12px;font-weight:600;padding:4px 11px;border-radius:8px;background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-border);`,
                )}
              >
                Crisis / risk
              </span>
              <span
                style={s(
                  `font-size:12px;font-weight:600;padding:4px 11px;border-radius:8px;background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);`,
                )}
              >
                5-minute
              </span>
              <span
                style={s(
                  `font-size:12px;font-weight:600;padding:4px 11px;border-radius:8px;background:var(--success-bg);color:var(--success-text);border:1px solid var(--success-border);`,
                )}
              >
                Handout
              </span>
              <span
                style={s(
                  `font-size:12px;font-weight:600;padding:4px 11px;border-radius:8px;background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);border:1px solid var(--clinical-accent-border);`,
                )}
              >
                Brief
              </span>
            </div>
          </div>
          <div style={s(`display:grid;grid-template-columns:1fr 1fr;gap:14px;`)}>
            <div
              style={s(
                `background:var(--surface);border:1px solid var(--clinical-accent-border);border-radius:14px;padding:16px 17px;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--clinical-accent);`)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                </svg>
                <span style={s(`font-size:11px;font-weight:700;letter-spacing:0.05em;`)}>USE WHEN</span>
              </div>
              <p style={s(`margin:0;font-size:13px;line-height:1.5;color:var(--text-muted);`)}>
                Depression, anxiety-spectrum distress and broader transdiagnostic emotional disorders.
              </p>
            </div>
            <div
              style={s(
                `background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:14px;padding:16px 17px;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--warning-text);`)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                <span style={s(`font-size:11px;font-weight:700;letter-spacing:0.05em;`)}>AVOID / MODIFY</span>
              </div>
              <p style={s(`margin:0;font-size:13px;line-height:1.5;color:var(--warning-text);`)}>
                Clarify the core problem is not better matched to a more specific first-line therapy.
              </p>
            </div>
            <div
              style={s(
                `background:var(--info-bg);border:1px solid var(--info-border);border-radius:14px;padding:16px 17px;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--info-text);`)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span style={s(`font-size:11px;font-weight:700;letter-spacing:0.05em;`)}>FAST DELIVERY</span>
              </div>
              <p style={s(`margin:0;font-size:13px;line-height:1.5;color:var(--info-text);`)}>
                Available as a brief session or a full-session protocol.
              </p>
            </div>
            <div
              style={s(
                `background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 17px;`,
              )}
            >
              <div style={s(`display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--text-soft);`)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v.01M11 12h1v4h1" />
                </svg>
                <span style={s(`font-size:11px;font-weight:700;letter-spacing:0.05em;`)}>EVIDENCE / SOURCE</span>
              </div>
              <p style={s(`margin:0;font-size:13px;line-height:1.5;color:var(--text-muted);`)}>
                Moderate confidence · needs review.
              </p>
            </div>
          </div>
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:6px 24px;`,
            )}
          >
            <div style={s(`display:flex;gap:14px;padding:20px 0;border-bottom:1px solid var(--border);`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
                </svg>
              </span>
              <div>
                <div style={s(`font-size:14.5px;font-weight:650;color:var(--text-heading);margin-bottom:5px;`)}>
                  Clinical snapshot
                </div>
                <p style={s(`margin:0;font-size:13.5px;line-height:1.6;color:var(--text-muted);`)}>
                  Acceptance &amp; Commitment Therapy (ACT) is a structured behavioural therapy in the broader CBT
                  family — commonly described as a “third-wave” approach — focused on psychological flexibility rather
                  than symptom control alone.
                </p>
              </div>
            </div>
            <div style={s(`display:flex;gap:14px;padding:20px 0;border-bottom:1px solid var(--border);`)}>
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:var(--surface-inset);color:var(--text-muted);flex:none;`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="8" r="3.4" />
                  <path d="M5 20a7 7 0 0 1 14 0" />
                </svg>
              </span>
              <div>
                <div style={s(`font-size:14.5px;font-weight:650;color:var(--text-heading);margin-bottom:5px;`)}>
                  When to use
                </div>
                <p style={s(`margin:0;font-size:13.5px;line-height:1.6;color:var(--text-muted);`)}>
                  Best-supported for depression, anxiety-spectrum distress and transdiagnostic emotional distress when
                  avoidance and fusion are prominent. Also carries a formal NICE recommendation for chronic primary
                  pain. In Australian psychiatry it is best understood as an accepted structured psychotherapy, though
                  with a narrower first-line guideline footprint than standard CBT.
                </p>
              </div>
            </div>
            <div style={s(`display:flex;gap:14px;padding:20px 0;border-bottom:1px solid var(--border);`)}>
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
              <div>
                <div style={s(`font-size:14.5px;font-weight:650;color:var(--text-heading);margin-bottom:5px;`)}>
                  How to deliver it
                </div>
                <p style={s(`margin:0;font-size:13.5px;line-height:1.6;color:var(--text-muted);`)}>
                  Build a shared formulation of how struggling with thoughts and feelings is narrowing life. Teach
                  defusion and acceptance so thoughts are noticed rather than automatically obeyed, strengthen
                  present-moment attention, clarify values, and translate them into small committed actions. Review what
                  re-entered avoidance and consolidate a more flexible, values-guided pattern.
                </p>
              </div>
            </div>
            <div
              style={s(
                `display:flex;gap:14px;padding:20px 4px;background:var(--warning-bg);margin:0 -18px;border-radius:12px;`,
              )}
            >
              <span
                style={s(
                  `display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:#fff;color:var(--warning-text);flex:none;margin-left:14px;`,
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              </span>
              <div style={s(`padding-right:14px;`)}>
                <div style={s(`font-size:14.5px;font-weight:650;color:var(--warning-text);margin-bottom:5px;`)}>
                  Safety &amp; cautions
                </div>
                <p style={s(`margin:0;font-size:13.5px;line-height:1.6;color:var(--warning-text);`)}>
                  Confirm the core problem is not better matched to a more specific first-line therapy (ERP,
                  trauma-focused therapy, CBTp, or structured personality treatment). Check suicidality, psychosis,
                  mania, dissociation, cognitive ability, language and willingness to do experiential exercises. Not
                  sufficient where the case clearly needs a specific active treatment first; weak if delivered as vague
                  mindfulness without real behavioural change.
                </p>
              </div>
            </div>
          </div>
          <div style={s(`display:flex;flex-wrap:wrap;gap:10px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goBrief}
              style={s(
                `display:flex;align-items:center;gap:9px;height:46px;padding:0 20px;border:none;border-radius:12px;background:var(--command);color:var(--command-contrast);font-size:14px;font-weight:600;box-shadow:var(--shadow-tight);`,
              )}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 3h8l4 4v14H6Z" />
                <path d="M14 3v4h4" />
              </svg>
              Generate patient sheet
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goCompare}
              style={s(
                `display:flex;align-items:center;gap:9px;height:46px;padding:0 20px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-weight:600;`,
              )}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
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
                `display:flex;align-items:center;gap:9px;height:46px;padding:0 20px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-weight:600;`,
              )}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Brief intervention
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goReview}
              style={s(
                `display:flex;align-items:center;gap:9px;height:46px;padding:0 20px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:14px;font-weight:600;`,
              )}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 5h13M4 12h13M4 19h13M20 5l-1.5 1.5M20 12l-1.5 1.5M20 19l-1.5 1.5" />
              </svg>
              Review checklist
            </button>
          </div>
        </div>
        <div style={s(`display:flex;flex-direction:column;gap:16px;position:sticky;top:96px;`)}>
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:20px;`,
            )}
          >
            <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
              At a glance
            </div>
            <div style={s(`display:flex;flex-direction:column;gap:15px;`)}>
              <div style={s(`display:flex;gap:12px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
                  )}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
                  </svg>
                </span>
                <div>
                  <div style={s(`font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:2px;`)}>
                    Best used for
                  </div>
                  <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>
                    Depression, anxiety-spectrum distress and broader transdiagnostic emotional disorders.
                  </p>
                </div>
              </div>
              <div style={s(`display:flex;gap:12px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
                  )}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 8V4M8 4h8M12 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
                  </svg>
                </span>
                <div>
                  <div style={s(`font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:2px;`)}>
                    Target symptoms
                  </div>
                  <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>
                    Experiential avoidance, cognitive fusion, rigid self-stories and reduced psychological flexibility.
                  </p>
                </div>
              </div>
              <div style={s(`display:flex;gap:12px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
                  )}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
                <div>
                  <div style={s(`font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:2px;`)}>
                    Time &amp; setting
                  </div>
                  <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>
                    Individual, group, digital or blended. Usually structured and manual-informed.
                  </p>
                </div>
              </div>
              <div style={s(`display:flex;gap:12px;`)}>
                <span
                  style={s(
                    `display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
                  )}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v18" />
                    <path d="m5 7-3 5.5h6L5 7Z" />
                    <path d="m19 7-3 5.5h6L19 7Z" />
                  </svg>
                </span>
                <div>
                  <div style={s(`font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:2px;`)}>
                    Complexity / population
                  </div>
                  <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>
                    High — patients who can engage with a values-based, acceptance-focused model.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            style={s(
              `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:20px;`,
            )}
          >
            <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:12px;`)}>
              Related therapies
            </div>
            <div style={s(`display:flex;flex-direction:column;`)}>
              <button
                type="button"
                className="tc-btn tc-row"
                onClick={b.goDetail}
                style={s(
                  `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 0;border:none;border-bottom:1px solid var(--border);background:transparent;text-align:left;`,
                )}
              >
                <span>
                  <span style={s(`display:block;font-size:13px;font-weight:600;color:var(--text-heading);`)}>
                    Child CBT
                  </span>
                  <span style={s(`display:block;font-size:12px;color:var(--text-soft);margin-top:2px;`)}>
                    Child anxiety and selected depressive presentations.
                  </span>
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-soft)"
                  strokeWidth="1.8"
                  style={s(`flex:none;`)}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                className="tc-btn tc-row"
                onClick={b.goDetail}
                style={s(
                  `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 0;border:none;border-bottom:1px solid var(--border);background:transparent;text-align:left;`,
                )}
              >
                <span>
                  <span style={s(`display:block;font-size:13px;font-weight:600;color:var(--text-heading);`)}>
                    Supported digital CBT
                  </span>
                  <span style={s(`display:block;font-size:12px;color:var(--text-soft);margin-top:2px;`)}>
                    Initial stepped-care for mild-to-moderate disorders.
                  </span>
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-soft)"
                  strokeWidth="1.8"
                  style={s(`flex:none;`)}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                className="tc-btn tc-row"
                onClick={b.goCompare}
                style={s(
                  `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 0;border:none;background:transparent;text-align:left;`,
                )}
              >
                <span>
                  <span style={s(`display:block;font-size:13px;font-weight:600;color:var(--text-heading);`)}>
                    Applied Relaxation
                  </span>
                  <span style={s(`display:block;font-size:12px;color:var(--text-soft);margin-top:2px;`)}>
                    Guideline support for generalised anxiety disorder.
                  </span>
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-soft)"
                  strokeWidth="1.8"
                  style={s(`flex:none;`)}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
          <div
            style={s(
              `background:var(--surface-subtle);border:1px solid var(--border);border-radius:16px;padding:18px 20px;`,
            )}
          >
            <div
              style={s(
                `display:flex;align-items:center;gap:8px;font-size:13px;font-weight:650;color:var(--text-heading);margin-bottom:10px;`,
              )}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warning-text)"
                strokeWidth="1.8"
              >
                <path d="M4 6a8 3 0 1 0 16 0A8 3 0 1 0 4 6M4 6v12a8 3 0 0 0 16 0V6" />
              </svg>
              Source provenance
            </div>
            <div style={s(`font-size:12.5px;color:var(--text-muted);line-height:1.7;`)}>
              <div>
                Source: <strong style={s(`color:var(--text-heading);`)}>Single therapy record</strong>
              </div>
              <div>
                Review: <span style={s(`color:var(--warning-text);font-weight:600;`)}>Not yet provided</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
