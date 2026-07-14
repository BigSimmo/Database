"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function HomeScreen() {
  const b = useTcBindings();
  return (
    <section data-screen-label="Home" style={s(`max-width:1100px;margin:0 auto;`)}>
      <div style={s(`text-align:center;padding:28px 0 8px;`)}>
        <span
          style={s(
            `display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:15px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:16px;`,
          )}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <h1
          style={s(`margin:0 0 8px;font-size:30px;font-weight:700;color:var(--text-heading);letter-spacing:-0.025em;`)}
        >
          What therapy are you looking for?
        </h1>
        <p style={s(`margin:0 auto 24px;font-size:15px;color:var(--text-muted);max-width:52ch;`)}>
          Search source-grounded therapy records by problem, symptom, skill or population — or jump into a clinical
          pathway.
        </p>
      </div>
      <div style={s(`display:flex;align-items:center;max-width:760px;margin:0 auto 14px;position:relative;`)}>
        <svg
          style={s(`position:absolute;left:18px;color:var(--text-soft);`)}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          aria-label="Search problem, symptom, therapy, skill, population"
          onFocus={b.goSearch}
          placeholder="Search problem, symptom, therapy, skill, population…"
          style={s(
            `width:100%;height:58px;padding:0 120px 0 50px;border:1px solid var(--border-strong);border-radius:15px;background:var(--surface);color:var(--text);font-size:16px;font-family:inherit;outline:none;box-shadow:var(--shadow-soft);`,
          )}
        />
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `position:absolute;right:8px;display:flex;align-items:center;gap:8px;height:44px;padding:0 20px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:14px;font-weight:600;`,
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Search
        </button>
      </div>
      <div style={s(`display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:760px;margin:0 auto 36px;`)}>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `padding:8px 15px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
          )}
        >
          Anxiety in outpatient care
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `padding:8px 15px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
          )}
        >
          Low mood &amp; motivation
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `padding:8px 15px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
          )}
        >
          Trauma-focused
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `padding:8px 15px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-muted);font-size:13px;font-weight:500;`,
          )}
        >
          5-minute grounding
        </button>
      </div>
      <div style={s(`display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px;`)}>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goRecommend}
          style={s(
            `display:flex;gap:14px;padding:18px 20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
            )}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3Z" />
            </svg>
          </span>
          <span>
            <span style={s(`display:block;font-size:14.5px;font-weight:650;color:var(--text-heading);`)}>
              Recommend a therapy
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px;line-height:1.4;`)}>
              Match a clinical question to indexed options.
            </span>
          </span>
        </button>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goPathways}
          style={s(
            `display:flex;gap:14px;padding:18px 20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
            )}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <circle cx="6" cy="18" r="2.5" />
              <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M6 8.5v7" />
            </svg>
          </span>
          <span>
            <span style={s(`display:block;font-size:14.5px;font-weight:650;color:var(--text-heading);`)}>
              Open a pathway
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px;line-height:1.4;`)}>
              Problem-based, step-by-step workflows.
            </span>
          </span>
        </button>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goSheets}
          style={s(
            `display:flex;gap:14px;padding:18px 20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);flex:none;`,
            )}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 3h8l4 4v14H6Z" />
              <path d="M14 3v4h4" />
              <path d="M9 13h6M9 17h4" />
            </svg>
          </span>
          <span>
            <span style={s(`display:block;font-size:14.5px;font-weight:650;color:var(--text-heading);`)}>
              Create a patient sheet
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px;line-height:1.4;`)}>
              Design and print a plain-language handout.
            </span>
          </span>
        </button>
      </div>
      <div style={s(`display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;`)}>
        <h2 style={s(`margin:0;font-size:17px;font-weight:680;color:var(--text-heading);`)}>Key clinical pathways</h2>
        <button
          type="button"
          onClick={b.goPathways}
          style={s(
            `border:none;background:transparent;padding:0;font-family:inherit;color:var(--clinical-accent);font-size:13px;font-weight:600;cursor:pointer;`,
          )}
        >
          View all pathways
        </button>
      </div>
      <div style={s(`display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px;`)}>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goPathways}
          style={s(
            `text-align:left;padding:20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:14px;`,
            )}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 17a3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 2-5.2A3 3 0 0 0 15 3a3 3 0 0 0-6 0Z" />
              <path d="M12 4v14" />
            </svg>
          </span>
          <span style={s(`display:block;font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:4px;`)}>
            Mood &amp; anxiety
          </span>
          <span
            style={s(`display:block;font-size:12.5px;color:var(--text-muted);line-height:1.45;margin-bottom:12px;`)}
          >
            Anxiety and depressive presentations across outpatient settings.
          </span>
          <span style={s(`font-size:11.5px;font-weight:600;color:var(--text-soft);`)}>5 linked therapy steps</span>
        </button>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goPathways}
          style={s(
            `text-align:left;padding:20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:14px;`,
            )}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18Z" />
            </svg>
          </span>
          <span style={s(`display:block;font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:4px;`)}>
            Depression pathway
          </span>
          <span
            style={s(`display:block;font-size:12.5px;color:var(--text-muted);line-height:1.45;margin-bottom:12px;`)}
          >
            Behavioural activation and structured support for low mood.
          </span>
          <span style={s(`font-size:11.5px;font-weight:600;color:var(--text-soft);`)}>4 linked therapy steps</span>
        </button>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goPathways}
          style={s(
            `text-align:left;padding:20px;border:1px solid var(--border);border-radius:15px;background:var(--surface);box-shadow:var(--shadow-tight);`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:14px;`,
            )}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span style={s(`display:block;font-size:15px;font-weight:650;color:var(--text-heading);margin-bottom:4px;`)}>
            Brief support
          </span>
          <span
            style={s(`display:block;font-size:12.5px;color:var(--text-muted);line-height:1.45;margin-bottom:12px;`)}
          >
            Time-limited, 5–15 minute intervention planning.
          </span>
          <span style={s(`font-size:11.5px;font-weight:600;color:var(--text-soft);`)}>3 linked therapy steps</span>
        </button>
      </div>
      <div style={s(`display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;`)}>
        <h2 style={s(`margin:0;font-size:17px;font-weight:680;color:var(--text-heading);`)}>
          Frequently used therapies
        </h2>
        <button
          type="button"
          onClick={b.goSearch}
          style={s(
            `border:none;background:transparent;padding:0;font-family:inherit;color:var(--clinical-accent);font-size:13px;font-weight:600;cursor:pointer;`,
          )}
        >
          Browse library
        </button>
      </div>
      <div style={s(`display:grid;grid-template-columns:1fr 1fr;gap:12px;`)}>
        <button
          type="button"
          className="tc-btn tc-row"
          onClick={b.goDetail}
          style={s(
            `display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;background:var(--surface);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3v18" />
              <path d="m5 7-3 5.5h6L5 7Z" />
              <path d="m19 7-3 5.5h6L19 7Z" />
              <path d="M4 21h16" />
              <path d="M8 7h8" />
            </svg>
          </span>
          <span style={s(`flex:1;`)}>
            <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
              Acceptance &amp; Commitment (ACT)
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
              Psychological flexibility for distress and avoidance.
            </span>
          </span>
          <svg
            width="16"
            height="16"
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
            `display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;background:var(--surface);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M13 4a1.5 1.5 0 1 0 0-.01M8 21l2-6 3 2 1 4M13 11l3-1 3 2M9 11 6 9" />
            </svg>
          </span>
          <span style={s(`flex:1;`)}>
            <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
              Behavioural Activation
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
              Re-engage with meaningful, mood-lifting activity.
            </span>
          </span>
          <svg
            width="16"
            height="16"
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
            `display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;background:var(--surface);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 22c4-2 7-5 7-10a7 7 0 0 0-14 0c0 5 3 8 7 10Z" />
              <path d="M12 12c0-3 1.5-5 4-6M12 12c0-3-1.5-5-4-6" />
            </svg>
          </span>
          <span style={s(`flex:1;`)}>
            <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
              Applied Relaxation
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
              Rapid relaxation skills for anxiety and tension.
            </span>
          </span>
          <svg
            width="16"
            height="16"
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
            `display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;background:var(--surface);text-align:left;`,
          )}
        >
          <span
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--clinical-accent);color:#fff;flex:none;`,
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="8" cy="8" r="2.3" />
              <circle cx="16" cy="8" r="2.3" />
              <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
            </svg>
          </span>
          <span style={s(`flex:1;`)}>
            <span style={s(`display:block;font-size:14px;font-weight:650;color:var(--text-heading);`)}>
              Problem Management Plus
            </span>
            <span style={s(`display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;`)}>
              Brief, practical support for stress and adversity.
            </span>
          </span>
          <svg
            width="16"
            height="16"
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
    </section>
  );
}
