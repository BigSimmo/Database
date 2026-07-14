// Reusable inline-CSS strings for Therapy Compass controls, applied via s().
// Keeping them as strings (not React objects) lets callers append per-instance
// tweaks: s(primaryControl + "height:52px;").

export const accentControl =
  "display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 18px;border:none;border-radius:11px;background:var(--clinical-accent);color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;";

export const commandControl =
  "display:inline-flex;align-items:center;justify-content:center;gap:9px;height:44px;padding:0 20px;border:none;border-radius:11px;background:var(--command);color:var(--command-contrast);font-size:14px;font-weight:600;box-shadow:var(--shadow-tight);cursor:pointer;font-family:inherit;";

export const outlineControl =
  "display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 16px;border:1px solid var(--border-strong);border-radius:11px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;";

export const softControl =
  "display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 16px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--text-muted);font-size:13.5px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .12s ease,border-color .12s ease,color .12s ease;";

export const iconControl =
  "display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);cursor:pointer;font-family:inherit;";

export const linkButton =
  "border:none;background:transparent;padding:0;font-family:inherit;color:var(--clinical-accent);font-size:13px;font-weight:600;cursor:pointer;";

export const card =
  "background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);";

export const heroCard =
  "background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--clinical-accent);border-radius:16px;box-shadow:var(--shadow-soft);";
