const browserProfiles = Object.freeze({
  "mobile-lighthouse": Object.freeze({
    name: "mobile-lighthouse",
    width: 412,
    height: 823,
    dpr: 1.75,
    isMobile: true,
    hasTouch: true,
  }),
  "desktop-800": Object.freeze({
    name: "desktop-800",
    width: 800,
    height: 900,
    dpr: 1,
    isMobile: false,
    hasTouch: false,
  }),
  "desktop-1280": Object.freeze({
    name: "desktop-1280",
    width: 1280,
    height: 900,
    dpr: 1,
    isMobile: false,
    hasTouch: false,
  }),
  "desktop-1350": Object.freeze({
    name: "desktop-1350",
    width: 1350,
    height: 940,
    dpr: 1,
    isMobile: false,
    hasTouch: false,
  }),
  "desktop-1440": Object.freeze({
    name: "desktop-1440",
    width: 1440,
    height: 900,
    dpr: 1,
    isMobile: false,
    hasTouch: false,
  }),
});

export function parseBrowserProfiles(value) {
  const names = (value ?? "mobile-lighthouse")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) throw new Error("At least one CLS browser profile is required.");

  const selected = new Set();
  return names.map((name) => {
    if (selected.has(name)) throw new Error(`Duplicate CLS browser profile: ${name}`);
    selected.add(name);
    const profile = browserProfiles[name];
    if (!profile) {
      throw new Error(
        `Unknown CLS browser profile: ${name}. Choose one of: ${Object.keys(browserProfiles).join(", ")}.`,
      );
    }
    return { ...profile };
  });
}

export function browserProfileCellKey(profileName, route) {
  return `${profileName}::${route}`;
}

export function buildClsAttributionOutput(cells, { profilesExplicit, profiles }) {
  if (!profilesExplicit) {
    return Object.fromEntries(cells.map(({ route, result }) => [route, result]));
  }
  return {
    schemaVersion: 2,
    profiles,
    cells: Object.fromEntries(cells.map(({ cellKey, result }) => [cellKey, result])),
  };
}

const readinessFlags = ["clsObserverReady", "reserveObserverReady", "geometryObserverReady"];

export function missingReadinessFlags(instrumentation) {
  return readinessFlags.filter((flag) => instrumentation[flag] !== true);
}
