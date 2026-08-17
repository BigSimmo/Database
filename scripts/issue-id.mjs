import { createHash, randomBytes } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CROCKFORD_CHARS = "[0-9A-HJKMNP-TV-Z]";

export const ISSUE_ULID_PATTERN = new RegExp(`^[0-7]${CROCKFORD_CHARS}{25}$`);
export const LEGACY_ISSUE_ID_PATTERN = /^#\d{3,}$/;
export const DISPLAY_ISSUE_ID_PATTERN = new RegExp(`^#${CROCKFORD_CHARS}{6,16}$`);
const ISSUE_ID_CELL_PATTERN = new RegExp(
  `^(#(?:\\d{3,}|${CROCKFORD_CHARS}{6,16}))(?:\\s+<!--\\s*issue-ulid:([0-7]${CROCKFORD_CHARS}{25})\\s*-->)?$`,
);
const ISSUE_CITATION_PATTERN = new RegExp(`#(?:${CROCKFORD_CHARS}{6,16}|\\d{3,})`, "g");

function encodeBase32(value, length) {
  let remaining = BigInt(value);
  const output = Array.from({ length }, () => "0");
  for (let index = length - 1; index >= 0; index -= 1) {
    output[index] = CROCKFORD[Number(remaining & 31n)];
    remaining >>= 5n;
  }
  if (remaining !== 0n) throw new Error(`value does not fit in ${length} Crockford base32 characters`);
  return output.join("");
}

function entropyValue(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 10) {
    throw new Error("ULID entropy must be exactly 10 bytes");
  }
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

export function issueUlid(timestamp = Date.now(), entropy = randomBytes(10)) {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 0xffffffffffff) {
    throw new Error("ULID timestamp must be a non-negative 48-bit integer");
  }
  return `${encodeBase32(BigInt(timestamp), 10)}${encodeBase32(entropyValue(entropy), 16)}`;
}

/** Stable identity for legacy version-1 add requests during the schema transition. */
export function issueUlidFromRequest(createdOn, requestId) {
  const timestamp = Date.parse(`${createdOn}T00:00:00.000Z`);
  if (!Number.isSafeInteger(timestamp)) throw new Error(`cannot derive an issue ULID from createdOn=${createdOn}`);
  const entropy = createHash("sha256").update(String(requestId)).digest().subarray(0, 10);
  return issueUlid(timestamp, entropy);
}

export function isIssueUlid(value) {
  return ISSUE_ULID_PATTERN.test(String(value ?? ""));
}

export function canonicalLegacyIssueId(number) {
  return `#${String(number).padStart(3, "0")}`;
}

export function isIssueDisplayId(value) {
  const id = String(value ?? "");
  if (DISPLAY_ISSUE_ID_PATTERN.test(id)) return true;
  if (!LEGACY_ISSUE_ID_PATTERN.test(id)) return false;
  const number = Number(id.slice(1));
  return Number.isSafeInteger(number) && id === canonicalLegacyIssueId(number);
}

export function displayIdForUlid(ulid, length = 6) {
  if (!isIssueUlid(ulid)) throw new Error(`invalid issue ULID: ${ulid}`);
  if (!Number.isInteger(length) || length < 6 || length > 16) {
    throw new Error("issue display-id length must be between 6 and 16");
  }
  return `#${ulid.slice(10, 10 + length)}`;
}

export function allocateDisplayId(ulid, usedIds) {
  const allocated = usedIds instanceof Set ? usedIds : new Set(usedIds);
  for (let length = 6; length <= 16; length += 1) {
    const candidate = displayIdForUlid(ulid, length);
    if (!allocated.has(candidate)) return candidate;
  }
  throw new Error(`issue ULID ${ulid} duplicates an existing durable identity`);
}

export function issueIdCell(displayId, ulid) {
  if (!DISPLAY_ISSUE_ID_PATTERN.test(String(displayId ?? ""))) {
    throw new Error(`invalid collision-free issue display id: ${displayId}`);
  }
  if (!isIssueUlid(ulid)) throw new Error(`invalid issue ULID: ${ulid}`);
  const suffix = ulid.slice(10);
  if (!suffix.startsWith(displayId.slice(1))) {
    throw new Error(`issue display id ${displayId} is not derived from ULID ${ulid}`);
  }
  return `${displayId} <!-- issue-ulid:${ulid} -->`;
}

export function parseIssueIdCell(cell) {
  const raw = String(cell ?? "").trim();
  const match = raw.match(ISSUE_ID_CELL_PATTERN);
  if (!match) {
    const numeric = raw.match(/^#(\d+)$/);
    const number = numeric ? Number(numeric[1]) : null;
    return { id: raw, number: Number.isSafeInteger(number) ? number : null, ulid: null, valid: false };
  }
  const [, id, ulid = null] = match;
  if (ulid) {
    const valid = DISPLAY_ISSUE_ID_PATTERN.test(id) && ulid.slice(10).startsWith(id.slice(1));
    return { id, number: null, ulid, valid };
  }
  if (!LEGACY_ISSUE_ID_PATTERN.test(id)) return { id, number: null, ulid: null, valid: false };
  const number = Number(id.slice(1));
  return {
    id,
    number,
    ulid: null,
    valid: Number.isSafeInteger(number) && id === canonicalLegacyIssueId(number),
  };
}

export function issueIdCitations(value) {
  return [...String(value ?? "").matchAll(ISSUE_CITATION_PATTERN)].map((match) => match[0]);
}
