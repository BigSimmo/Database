import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("request-rendered root start state", () => {
  it("gives the root route sole ownership of its statically imported dashboard", () => {
    const page = source("src/app/(search-app)/page.tsx");
    const homeClient = source("src/app/(search-app)/home-page-client.tsx");
    const shell = source("src/components/clinical-dashboard/global-search-shell.tsx");

    expect(page).toMatch(
      /<HomePageClient\s+initialMode=\{initialSearchMode\}\s+initialQuery=\{query \?\? ""\}\s+focusSearch=\{focus\}\s+autoRunSearch=\{submitted\}\s*\/>/,
    );

    expect(homeClient).toMatch(/^import \{ ClinicalDashboard \} from "@\/components\/ClinicalDashboard";/m);
    expect(homeClient).toMatch(
      /^import \{ SettingsStateProvider \} from "@\/components\/clinical-dashboard\/SettingsStateProvider";/m,
    );
    expect(homeClient).toMatch(
      /<SettingsStateProvider>[\s\S]*?<ClinicalDashboard[\s\S]*?initialSearchMode=\{initialMode\}[\s\S]*?initialQuery=\{initialQuery\}[\s\S]*?focusSearch=\{focusSearch\}[\s\S]*?autoRunSearch=\{autoRunSearch\}[\s\S]*?<\/SettingsStateProvider>/,
    );

    expect(shell).toMatch(
      /if \(rendersClinicalDashboard && pathname === "\/"\) \{\s*return <>{props\.children}<\/>;\s*\}/,
    );
    expect(shell.match(/dynamic\(\s*\(\) => import\("@\/components\/ClinicalDashboard"\)/g)).toHaveLength(1);
    expect(shell.match(/<ClinicalDashboard\b/g)).toHaveLength(1);
    expect(shell.match(/<SettingsStateProvider>/g)).toHaveLength(1);
    expect(shell.indexOf('if (rendersClinicalDashboard && pathname === "/")')).toBeLessThan(
      shell.indexOf("if (rendersClinicalDashboard)"),
    );
  });
});
