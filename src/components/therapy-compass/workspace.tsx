"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { ModeHomeVerificationFooter } from "@/components/mode-home-template";

import { TcProvider, useTcBindings } from "./bindings";
import { TherapyCompassNav } from "./nav";
import { TherapyCompassStyles } from "./styles";
import { s } from "./style-utils";

// Universal clinical verification footer — the same component every mode home
// renders — placed at the bottom of the tool content, inside the app's chrome.
function TherapyCompassFooter() {
  return (
    <div
      className="tc-no-print"
      style={s(`max-width:1240px;margin:30px auto 0;padding-top:20px;border-top:1px solid var(--border);`)}
    >
      <ModeHomeVerificationFooter
        icon={ShieldCheck}
        label="Decision support"
        body="Source-grounded — review status before clinical use"
      />
    </div>
  );
}

// Conservative failure: if the therapy catalogue fails to load, show an error +
// Retry across every route instead of empty screens — no results are presented
// as a substitute for the real (source-grounded) library.
function TherapyCompassDataError() {
  const b = useTcBindings();
  return (
    <section
      role="alert"
      aria-live="assertive"
      aria-busy={b.loading}
      style={s(
        `max-width:42rem;margin:40px auto;padding:24px;border:1px solid var(--danger);border-radius:16px;background:var(--danger-soft);`,
      )}
    >
      <h1 style={s(`margin:0 0 8px;color:var(--text-heading);font-size:20px;`)}>Therapy Compass could not load</h1>
      <p style={s(`margin:0 0 16px;color:var(--text-muted);line-height:1.5;`)}>
        The therapy catalogue is unavailable. No results are being shown as a substitute.
      </p>
      <button
        type="button"
        className="tc-btn"
        onClick={b.retryData}
        disabled={b.loading}
        aria-disabled={b.loading}
        style={s(
          `padding:10px 14px;border:0;border-radius:8px;background:var(--clinical-accent);color:var(--clinical-accent-contrast);font-weight:650;opacity:${b.loading ? "0.7" : "1"};`,
        )}
      >
        {b.loading ? "Retrying…" : "Retry"}
      </button>
    </section>
  );
}

function TherapyCompassMain({
  children,
  showFooter,
  asMain,
}: {
  children: ReactNode;
  showFooter: boolean;
  /** Home renders ModeHomeMain; keep a non-main shell so landmarks are not nested. */
  asMain: boolean;
}) {
  const b = useTcBindings();
  const Tag = asMain ? "main" : "div";
  // Home padding comes from ModeHomeMain; non-home routes keep the workspace gutter.
  const style = asMain ? s(`min-width:0;padding:32px 40px 40px;`) : s(`min-width:0;`);
  return (
    <Tag className="tc-main" style={style}>
      {b.error ? <TherapyCompassDataError /> : children}
      {/* Home uses ModeHomeTemplate's verification footer; skip the workspace copy there. */}
      {showFooter ? <TherapyCompassFooter /> : null}
    </Tag>
  );
}

/**
 * Therapy Compass workspace chrome. Mounted once by the route-segment layout so
 * the therapy dataset (fetched inside {@link TcProvider}) and interaction state
 * are shared across every `/therapy-compass/*` route, while each route renders
 * its own screen into the workspace's main content. The design's bespoke left
 * rail is dropped in favour of the app's universal rail; its destinations live in
 * the horizontal in-content nav under the global header, and non-home routes close
 * with the universal clinical verification footer.
 */
export function TherapyCompassWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/therapy-compass";

  return (
    <TcProvider>
      <TherapyCompassStyles />
      <div
        className="tc-root"
        style={s(`min-height:calc(100dvh - 4rem);background:var(--surface-chrome);color:var(--text);`)}
      >
        {isHome ? null : <TherapyCompassNav />}
        <TherapyCompassMain showFooter={!isHome} asMain={!isHome}>
          {children}
        </TherapyCompassMain>
      </div>
    </TcProvider>
  );
}
