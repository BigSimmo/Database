const normalize = (file) => file.replaceAll("\\", "/").replace(/^\.\//, "");

const phoneChromeContractTests = [
  "tests/installed-lock-parity.test.ts",
  "tests/final-merge-audit.test.ts",
  "tests/verify-phone-chrome.test.ts",
  "tests/verify-pr-local.test.ts",
  "tests/header-scroll-hide-contract.test.ts",
  "tests/mobile-composer-reserve.test.ts",
  "tests/ui-overlay-css-contract.test.ts",
  "tests/clinical-dashboard-merge-artifacts.test.ts",
  "tests/use-hide-on-scroll.test.ts",
];

const phoneChromeBrowserSpecPattern =
  /^tests\/ui-(?:phone-scroll|smoke|tools|chrome-scroll|therapy-nav-scroll)\.spec\.ts$/;

const patterns = {
  docs: [/^docs\//, /^AGENTS\.md$/],
  infrastructure: [
    /^package(?:-lock)?\.json$/,
    /^scripts\/(?:check-installed-lock-parity|phone-chrome-plan|playwright-browser-preflight|run-playwright|verify-phone-chrome)\.mjs$/,
    /^tests\/(?:installed-lock-parity|playwright-browser-preflight|verify-phone-chrome)\.test\.ts$/,
  ],
  playwrightHelper: [/^tests\/playwright-(?:scroll|settlement)\.ts$/],
  dashboard: [
    /^src\/components\/ClinicalDashboard\.tsx$/,
    /^src\/components\/clinical-dashboard\/use-dashboard-chrome-coordinator\.ts$/,
    /^tests\/ui-smoke\.spec\.ts$/,
  ],
  shell: [
    /^src\/components\/clinical-dashboard\/(?:global-search-shell|master-search-header)\.tsx$/,
    /^tests\/ui-tools\.spec\.ts$/,
  ],
  documents: [
    /^src\/components\/DocumentViewer\.tsx$/,
    /^src\/components\/clinical-dashboard\/use-document-viewer-chrome-scroll\.ts$/,
  ],
  calculators: [/^src\/components\/calculators\//],
  differentials: [/^src\/components\/differentials\//],
  sharedFoundation: [
    /^src\/app\/globals\.css$/,
    /^src\/styles\//,
    /^src\/components\/ClinicalDashboard\.tsx$/,
    /^src\/components\/clinical-dashboard\/(?:global-search-shell|master-search-header|mobile-composer-reserve|phone-footer-layer-portal|scroll-surface|use-active-scroll-owner|use-dashboard-chrome-coordinator|use-hide-on-scroll|use-phone-overlay-chrome-reserve)\.(?:ts|tsx)$/,
    /^package-lock\.json$/,
  ],
  phoneContract: [
    /^docs\/(?:search-chrome-behaviour|phone-chrome-physical-acceptance)\.md$/,
    /^tests\/(?:header-scroll-hide-contract|mobile-composer-reserve|ui-overlay-css-contract|clinical-dashboard-merge-artifacts|use-hide-on-scroll)\.test\.ts$/,
    /^tests\/ui-(?:phone-scroll|chrome-scroll|therapy-nav-scroll)\.spec\.ts$/,
  ],
};

function matchesAny(file, matchers) {
  return matchers.some((pattern) => pattern.test(file));
}

function nodeStage(id, label, args) {
  return { id, label, command: { executable: "node", args } };
}

function npmStage(id, label, script) {
  return { id, label, command: { executable: "npm", args: ["run", script] } };
}

export function renderPhoneChromeCommand(command) {
  return [
    command.executable,
    ...command.args.map((argument) => (/\s|\|/.test(argument) ? JSON.stringify(argument) : argument)),
  ].join(" ");
}

export function phoneChromePlan(rawFiles, { fullMode = "auto" } = {}) {
  if (!new Set(["auto", "always", "never"]).has(fullMode)) {
    throw new Error(`Unsupported full-suite mode: ${fullMode}`);
  }

  const files = [...new Set(rawFiles.map(normalize).filter(Boolean))].sort();
  const flags = Object.fromEntries(
    Object.entries(patterns).map(([name, matchers]) => [name, files.some((file) => matchesAny(file, matchers))]),
  );
  const docsOnly = files.length > 0 && files.every((file) => matchesAny(file, patterns.docs));
  const uiSourceChanged = files.some((file) => /^src\/(?:app|components|styles)\//.test(file));
  const phoneRelevant =
    flags.infrastructure ||
    flags.playwrightHelper ||
    flags.dashboard ||
    flags.shell ||
    flags.documents ||
    flags.calculators ||
    flags.differentials ||
    flags.sharedFoundation ||
    flags.phoneContract;
  const unknownUi = uiSourceChanged && !phoneRelevant;
  const runOwnership =
    !docsOnly &&
    (flags.playwrightHelper ||
      flags.dashboard ||
      flags.shell ||
      flags.documents ||
      flags.calculators ||
      flags.differentials ||
      flags.sharedFoundation ||
      flags.phoneContract);
  const runDashboardJourneys =
    !docsOnly && (flags.playwrightHelper || flags.dashboard || flags.documents || flags.sharedFoundation);
  const runShellJourneys = !docsOnly && (flags.playwrightHelper || flags.shell || flags.sharedFoundation);
  const autoFull = Boolean(!docsOnly && (flags.sharedFoundation || unknownUi));
  const runFull = fullMode === "always" || (fullMode === "auto" && autoFull);

  const stages = [];

  if (docsOnly) {
    stages.push(npmStage("docs-index", "documentation remains indexed", "docs:check-index"));
    stages.push(npmStage("docs-links", "documentation links remain valid", "docs:check-links"));
  } else {
    stages.push(
      npmStage("lock-parity", "critical installed packages match package-lock.json", "check:installed-lock-parity"),
    );
  }

  if (!docsOnly && (phoneRelevant || unknownUi)) {
    stages.push(npmStage("runtime", "Node and npm runtime match the repository contract", "check:runtime"));
    stages.push(
      nodeStage("contracts", "phone chrome static and unit contracts", [
        "scripts/run-vitest.mjs",
        "run",
        ...phoneChromeContractTests,
        "--reporter=dot",
      ]),
    );
  }

  const changedBrowserFiles = files.filter((file) => phoneChromeBrowserSpecPattern.test(file));
  const changedBrowserFileSet = new Set(changedBrowserFiles);
  if (changedBrowserFiles.length > 0) {
    stages.push(
      nodeStage("changed-browser", "complete changed phone-chrome browser specs", [
        "scripts/run-playwright.mjs",
        ...changedBrowserFiles,
        "--project=chromium",
      ]),
    );
  }

  const focusedBrowserJourneys = [];
  if (runOwnership && !changedBrowserFileSet.has("tests/ui-phone-scroll.spec.ts")) {
    focusedBrowserJourneys.push({
      file: "tests/ui-phone-scroll.spec.ts",
      pattern:
        "phone browser results use document scrolling|document detail header overlay and footer follow|compiled standalone PWA rules bind full-height footer chrome|standalone .* is frame-owned",
    });
  }
  if (runDashboardJourneys && !changedBrowserFileSet.has("tests/ui-smoke.spec.ts")) {
    focusedBrowserJourneys.push({
      file: "tests/ui-smoke.spec.ts",
      pattern:
        "phone long answer stays scrollable|phone answer result keeps the edge dock|answer glass header overlays main|document viewer bottom composer hides",
    });
  }
  if (runShellJourneys && !changedBrowserFileSet.has("tests/ui-tools.spec.ts")) {
    focusedBrowserJourneys.push({
      file: "tests/ui-tools.spec.ts",
      pattern: "phone bottom search dock stays edge-to-edge|phone bottom search dock hides while scrolling down",
    });
  }
  if (focusedBrowserJourneys.length > 0) {
    stages.push(
      nodeStage("focused-browser", "browser/PWA ownership matrix and affected phone journeys", [
        "scripts/run-playwright.mjs",
        ...focusedBrowserJourneys.map(({ file }) => file),
        "--project=chromium",
        "--grep",
        focusedBrowserJourneys.map(({ pattern }) => pattern).join("|"),
      ]),
    );
  }
  if (runFull) stages.push(npmStage("full-ui", "full Chromium UI suite after focused phone proof", "verify:ui"));

  return {
    files,
    stages,
    phoneRelevant: Boolean(phoneRelevant || unknownUi),
    fullMode,
    fullRecommended: autoFull,
    fullSelected: runFull,
    notes: [
      !phoneRelevant && !unknownUi
        ? "No phone-chrome-affecting file was detected; only prerequisite checks were selected."
        : null,
      fullMode === "never" && autoFull
        ? "The full UI suite is recommended for these shared-foundation changes but was explicitly disabled."
        : null,
      fullMode === "auto" && !autoFull && !docsOnly
        ? "Focused ownership and journey coverage is sufficient for this page-local or test-infrastructure scope."
        : null,
    ].filter(Boolean),
  };
}

export const phoneChromePlanInternals = { patterns };
