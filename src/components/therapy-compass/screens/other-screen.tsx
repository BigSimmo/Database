"use client";

import { useTcBindings } from "../bindings";
import { s } from "../style-utils";

export function OtherScreen() {
  const b = useTcBindings();
  return (
    <section style={s(`max-width:720px;margin:60px auto;text-align:center;`)}>
      <span
        style={s(
          `display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:20px;`,
        )}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
          <path d="m9.2 12 1.9 1.9 3.7-3.8" />
        </svg>
      </span>
      <h1 style={s(`margin:0 0 8px;font-size:24px;font-weight:680;color:var(--text-heading);`)}>{b.otherLabel}</h1>
      <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
        This surface uses the same Therapy Compass shell. Pick a tool from the sidebar to keep exploring the clinical
        workspace.
      </p>
      <div style={s(`display:flex;gap:10px;justify-content:center;flex-wrap:wrap;`)}>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goHome}
          style={s(
            `height:44px;padding:0 20px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:14px;font-weight:600;`,
          )}
        >
          Go to Home
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={b.goSearch}
          style={s(
            `height:44px;padding:0 20px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:14px;font-weight:600;`,
          )}
        >
          Search therapies
        </button>
      </div>
    </section>
  );
}
