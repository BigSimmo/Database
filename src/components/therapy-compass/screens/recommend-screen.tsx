"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function RecommendScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Recommend" style={s(`max-width:1180px;margin:0 auto;`)}>
      <h1 style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}>
        Recommend Tool
      </h1>
      <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
        Refine a clinical question with setting, time and caution constraints.
      </p>
      <div
        style={s(
          `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;margin-bottom:22px;`,
        )}
      >
        <div style={s(`display:block;font-size:12.5px;font-weight:650;color:var(--text-heading);margin-bottom:9px;`)}>
          What do you need help choosing?
        </div>
        <textarea
          aria-label="Clinical question"
          style={s(
            `width:100%;min-height:74px;padding:13px 15px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface);color:var(--text);font-size:15px;font-family:inherit;line-height:1.5;outline:none;resize:vertical;`,
          )}
          defaultValue="What therapy for anxiety in outpatient care?"
        />
        <div
          style={s(`font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--text-soft);margin:20px 0 10px;`)}
        >
          QUICK CONSTRAINTS
        </div>
        <div style={s(`display:flex;flex-wrap:wrap;gap:9px;`)}>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:7px;padding:8px 15px;border:1px solid var(--clinical-accent-border);border-radius:10px;background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);font-size:13px;font-weight:600;`,
            )}
          >
            Outpatient{" "}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 12 5 5 9-11" />
            </svg>
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Inpatient
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            5 minutes
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            15 minutes
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Handout
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Grounding
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Skills
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Psychoeducation
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Trauma caution
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `padding:8px 15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
            )}
          >
            Avoid mania
          </button>
        </div>
        <button
          type="button"
          className="tc-btn tc-row"
          style={s(
            `display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:16px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface-subtle);color:var(--text);font-size:13.5px;`,
          )}
        >
          <span style={s(`font-weight:600;`)}>
            Case details <span style={s(`color:var(--text-soft);font-weight:400;`)}>· Optional</span>
          </span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.8">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        <div style={s(`display:flex;align-items:center;justify-content:space-between;margin-top:16px;`)}>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
            </svg>
            Save workflow
          </button>
          <button
            type="button"
            className="tc-btn"
            style={s(
              `display:flex;align-items:center;gap:9px;height:44px;padding:0 22px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:14px;font-weight:600;box-shadow:var(--shadow-tight);`,
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Find recommendations
          </button>
        </div>
      </div>
      <div
        style={s(
          `background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--clinical-accent);border-radius:16px;box-shadow:var(--shadow-soft);padding:22px 24px;margin-bottom:26px;`,
        )}
      >
        <div style={s(`display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;`)}>
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3Z" />
            </svg>
          </span>
          <div style={s(`flex:1;`)}>
            <div style={s(`display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:5px;`)}>
              <span style={s(`font-size:16px;font-weight:650;color:var(--text-heading);`)}>
                Problem Management Plus / PM+
              </span>
              <span
                style={s(
                  `font-size:11.5px;font-weight:600;color:var(--success-text);background:var(--success-bg);border:1px solid var(--success-border);padding:2px 9px;border-radius:7px;`,
                )}
              >
                Strong match
              </span>
              <span
                style={s(
                  `font-size:11.5px;font-weight:600;color:var(--info-text);background:var(--info-bg);border:1px solid var(--info-border);padding:2px 9px;border-radius:7px;`,
                )}
              >
                WHO-backed
              </span>
            </div>
            <p style={s(`margin:0;font-size:13.5px;line-height:1.55;color:var(--text-muted);`)}>
              A brief, transdiagnostic intervention for anxiety and low mood in adults. Well suited to{" "}
              <strong style={s(`color:var(--text-heading);`)}>outpatient care</strong> where a short, practical,
              skills-based approach is needed.
            </p>
          </div>
        </div>
        <div
          style={s(
            `display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
          )}
        >
          <div style={s(`padding:16px 17px;background:var(--surface);`)}>
            <div
              style={s(
                `display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--clinical-accent);margin-bottom:9px;`,
              )}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
              </svg>
              WHAT IT TREATS
            </div>
            <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>
              Anxiety, worry and low mood linked to stress and life adversity — including mixed, sub-threshold
              presentations.
            </p>
          </div>
          <div style={s(`padding:16px 17px;background:var(--surface);`)}>
            <div
              style={s(
                `display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--clinical-accent);margin-bottom:9px;`,
              )}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="12" cy="12" r="9" />
                <path d="m10 8 6 4-6 4Z" />
              </svg>
              HOW IT HELPS
            </div>
            <p style={s(`margin:0;font-size:12.5px;line-height:1.5;color:var(--text-muted);`)}>
              Teaches stress management, problem-solving, behavioural activation and social support in 4–5 structured
              sessions.
            </p>
          </div>
          <div style={s(`padding:16px 17px;background:var(--clinical-accent-soft);`)}>
            <div
              style={s(
                `display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:var(--clinical-accent-hover);margin-bottom:9px;`,
              )}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              WHERE TO START
            </div>
            <p style={s(`margin:0 0 12px;font-size:12.5px;line-height:1.5;color:var(--clinical-accent-hover);`)}>
              Open the record for full protocol, or generate a patient sheet to introduce the plan.
            </p>
            <div style={s(`display:flex;gap:8px;`)}>
              <button
                type="button"
                className="tc-btn"
                onClick={b.goDetail}
                style={s(
                  `flex:1;height:38px;border:none;border-radius:9px;background:var(--clinical-accent);color:#fff;font-size:13px;font-weight:600;`,
                )}
              >
                Open record
              </button>
              <button
                type="button"
                className="tc-btn"
                onClick={b.goSheets}
                style={s(
                  `flex:1;height:38px;border:1px solid var(--clinical-accent-border);border-radius:9px;background:var(--surface);color:var(--clinical-accent-hover);font-size:13px;font-weight:600;`,
                )}
              >
                Sheet
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:14px;`)}>
        Ranked clinical matches
      </div>
      <div style={s(`display:flex;flex-direction:column;gap:12px;`)}>
        <div
          style={s(
            `display:grid;grid-template-columns:auto minmax(240px,1.3fr) 1.1fr 1.1fr 1.1fr auto;gap:20px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-tight);padding:16px 20px;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--clinical-accent);color:#fff;font-size:13px;font-weight:700;`,
            )}
          >
            1
          </span>
          <div>
            <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:6px;`)}>
              Problem Management Plus / PM+
            </div>
            <div style={s(`display:flex;gap:6px;flex-wrap:wrap;`)}>
              <span
                style={s(
                  `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:#f4f0ff;color:#6d3fc4;`,
                )}
              >
                CBT-based
              </span>
              <span
                style={s(
                  `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--surface-inset);color:var(--text-muted);`,
                )}
              >
                4–5 sessions
              </span>
            </div>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`,
              )}
            >
              TREATS
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Anxiety and low mood in stress and adversity.
            </p>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`,
              )}
            >
              HOW IT WORKS
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Stress management, problem-solving, activation, support.
            </p>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--clinical-accent);margin-bottom:4px;`,
              )}
            >
              FIRST STEP
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Manage a stressful problem step by step.
            </p>
          </div>
          <div style={s(`display:flex;gap:6px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goDetail}
              style={s(
                `height:34px;padding:0 12px;border:none;border-radius:8px;background:var(--clinical-accent);color:#fff;font-size:12.5px;font-weight:600;`,
              )}
            >
              Open
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goSheets}
              style={s(
                `height:34px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;`,
              )}
            >
              Sheet
            </button>
          </div>
        </div>
        <div
          style={s(
            `display:grid;grid-template-columns:auto minmax(240px,1.3fr) 1.1fr 1.1fr 1.1fr auto;gap:20px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-tight);padding:16px 20px;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--surface-inset);color:var(--text-muted);font-size:13px;font-weight:700;`,
            )}
          >
            2
          </span>
          <div>
            <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:6px;`)}>
              Applied Relaxation
            </div>
            <div style={s(`display:flex;gap:6px;flex-wrap:wrap;`)}>
              <span
                style={s(
                  `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--info-bg);color:var(--info-text);`,
                )}
              >
                Behavioural
              </span>
              <span
                style={s(
                  `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--surface-inset);color:var(--text-muted);`,
                )}
              >
                8–12 sessions
              </span>
            </div>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`,
              )}
            >
              TREATS
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Generalised anxiety and physical tension.
            </p>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`,
              )}
            >
              HOW IT WORKS
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Trains rapid relaxation to apply in daily triggers.
            </p>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--clinical-accent);margin-bottom:4px;`,
              )}
            >
              FIRST STEP
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Practise progressive muscle relaxation.
            </p>
          </div>
          <div style={s(`display:flex;gap:6px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goDetail}
              style={s(
                `height:34px;padding:0 12px;border:none;border-radius:8px;background:var(--clinical-accent);color:#fff;font-size:12.5px;font-weight:600;`,
              )}
            >
              Open
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goSheets}
              style={s(
                `height:34px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;`,
              )}
            >
              Sheet
            </button>
          </div>
        </div>
        <div
          style={s(
            `display:grid;grid-template-columns:auto minmax(240px,1.3fr) 1.1fr 1.1fr 1.1fr auto;gap:20px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-tight);padding:16px 20px;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--surface-inset);color:var(--text-muted);font-size:13px;font-weight:700;`,
            )}
          >
            3
          </span>
          <div>
            <div style={s(`font-size:14px;font-weight:650;color:var(--text-heading);margin-bottom:6px;`)}>
              Brief low-intensity CBT
            </div>
            <div style={s(`display:flex;gap:6px;flex-wrap:wrap;`)}>
              <span
                style={s(
                  `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:#f4f0ff;color:#6d3fc4;`,
                )}
              >
                CBT
              </span>
              <span
                style={s(
                  `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--surface-inset);color:var(--text-muted);`,
                )}
              >
                Guided self-help
              </span>
            </div>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`,
              )}
            >
              TREATS
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Mild-to-moderate anxiety and depression.
            </p>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--text-soft);margin-bottom:4px;`,
              )}
            >
              HOW IT WORKS
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Structured skills and psychoeducation, clinician-guided.
            </p>
          </div>
          <div>
            <div
              style={s(
                `font-size:10px;font-weight:700;letter-spacing:0.04em;color:var(--clinical-accent);margin-bottom:4px;`,
              )}
            >
              FIRST STEP
            </div>
            <p style={s(`margin:0;font-size:12px;line-height:1.4;color:var(--text-muted);`)}>
              Map thoughts, feelings and behaviour.
            </p>
          </div>
          <div style={s(`display:flex;gap:6px;`)}>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goDetail}
              style={s(
                `height:34px;padding:0 12px;border:none;border-radius:8px;background:var(--clinical-accent);color:#fff;font-size:12.5px;font-weight:600;`,
              )}
            >
              Open
            </button>
            <button
              type="button"
              className="tc-btn"
              onClick={b.goSheets}
              style={s(
                `height:34px;padding:0 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;`,
              )}
            >
              Sheet
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
