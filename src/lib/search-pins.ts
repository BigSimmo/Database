export const searchPinDestinationIds = [
  "documents",
  "prescribing",
  "forms",
  "services",
  "differentials",
  "tools",
] as const;

export type SearchPinDestinationId = (typeof searchPinDestinationIds)[number];

export type SearchPin = {
  id: string;
  name: string;
  destinationIds: SearchPinDestinationId[];
};

export const defaultSearchPins: SearchPin[] = [
  {
    id: "ward-essentials",
    name: "Ward essentials",
    destinationIds: ["documents", "prescribing", "forms"],
  },
  {
    id: "quick-tools",
    name: "My quick tools",
    destinationIds: ["tools", "services", "differentials"],
  },
];

export const searchPinsStorageKey = "clinical-kb-search-pins-v1";
export const searchPinsChangeEvent = "clinical-kb-search-pins-change";

const destinationIdSet = new Set<string>(searchPinDestinationIds);
export const maximumSearchPins = 8;
const maximumDestinations = 6;
const maximumNameLength = 48;
let inMemorySearchPins: SearchPin[] | null = null;
let inMemorySearchPinsFallbackActive = false;

function normalizePin(value: unknown): SearchPin | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SearchPin>;
  const id = typeof candidate.id === "string" ? candidate.id.trim().slice(0, 80) : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, maximumNameLength) : "";
  const destinationIds = Array.isArray(candidate.destinationIds)
    ? ([...new Set(candidate.destinationIds)]
        .filter(
          (destination): destination is SearchPinDestinationId =>
            typeof destination === "string" && destinationIdSet.has(destination),
        )
        .slice(0, maximumDestinations) as SearchPinDestinationId[])
    : [];

  if (!id || !name || destinationIds.length === 0) return null;
  return { id, name, destinationIds };
}

function cloneSearchPins(pins: readonly SearchPin[]): SearchPin[] {
  return pins.map((pin) => ({
    id: pin.id,
    name: pin.name,
    destinationIds: [...pin.destinationIds],
  }));
}

function cloneDefaultSearchPins(): SearchPin[] {
  return cloneSearchPins(defaultSearchPins);
}

function cloneStoredOrDefaultSearchPins(): SearchPin[] {
  return inMemorySearchPinsFallbackActive && inMemorySearchPins
    ? cloneSearchPins(inMemorySearchPins)
    : cloneDefaultSearchPins();
}

export function normalizeSearchPins(value: unknown): SearchPin[] {
  if (!Array.isArray(value)) return cloneDefaultSearchPins();
  const seenIds = new Set<string>();
  return value
    .map(normalizePin)
    .filter((pin): pin is SearchPin => {
      if (!pin || seenIds.has(pin.id)) return false;
      seenIds.add(pin.id);
      return true;
    })
    .slice(0, maximumSearchPins);
}

export function readSearchPins(storage?: Pick<Storage, "getItem">): SearchPin[] {
  let raw: string | null;
  try {
    const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!target) return cloneStoredOrDefaultSearchPins();
    raw = target.getItem(searchPinsStorageKey);
  } catch {
    return cloneStoredOrDefaultSearchPins();
  }

  if (!raw) return cloneStoredOrDefaultSearchPins();
  try {
    const normalized = normalizeSearchPins(JSON.parse(raw));
    inMemorySearchPinsFallbackActive = false;
    return normalized;
  } catch {
    inMemorySearchPinsFallbackActive = false;
    return cloneDefaultSearchPins();
  }
}

export function writeSearchPins(pins: SearchPin[], storage?: Pick<Storage, "setItem">): SearchPin[] {
  const normalized = normalizeSearchPins(pins);
  try {
    const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!target) {
      inMemorySearchPins = cloneSearchPins(normalized);
      inMemorySearchPinsFallbackActive = true;
      return normalized;
    }
    target.setItem(searchPinsStorageKey, JSON.stringify(normalized));
    inMemorySearchPinsFallbackActive = false;
  } catch {
    // Pins are a progressive enhancement. Keep this session's normalized value
    // when browser storage is unavailable or full.
    inMemorySearchPins = cloneSearchPins(normalized);
    inMemorySearchPinsFallbackActive = true;
  }
  return cloneSearchPins(normalized);
}

/** Test-only: drop tab session memory so cases do not leak pin lists. */
export function resetSearchPinsSessionForTests() {
  inMemorySearchPins = null;
  inMemorySearchPinsFallbackActive = false;
}
