"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { ModeHomeVerificationFooter } from "@/components/mode-home-template";

import { TcProvider } from "./bindings";
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

/**
 * Therapy Compass workspace chrome. Mounted once by the route-segment layout so
 * the therapy dataset (fetched inside {@link TcProvider}) and interaction state
 * are shared across every `/therapy-compass/*` route, while each route renders
 * its own screen into `{children}`. The design's bespoke left rail is dropped in
 * favour of the app's universal rail; its destinations live in the horizontal
 * in-content nav under the global header, and the content closes with the
 * universal clinical verification footer.
 */
export function TherapyCompassWorkspace({ children }: { children: ReactNode }) {
  return (
    <TcProvider>
      <TherapyCompassStyles />
      <div
        className="tc-root"
        style={s(`min-height:calc(100dvh - 4rem);background:var(--surface-chrome);color:var(--text);`)}
      >
        <TherapyCompassNav />
        <main className="tc-main" style={s(`min-width:0;padding:32px 40px 40px;`)}>
          {children}
          <TherapyCompassFooter />
        </main>
      </div>
    </TcProvider>
  );
}
