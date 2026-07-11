export function safeBufferFrom(input: unknown, encoding?: BufferEncoding): Buffer | null {
  if (Buffer.isBuffer(input)) return Buffer.from(input);
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof input !== "string") return null;

  if (encoding === "base64") {
    const normalized = input.replace(/\s+/g, "");
    if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null;
    const buffer = Buffer.from(normalized, "base64");
    const canonicalInput = normalized.replace(/=+$/, "");
    const canonicalOutput = buffer.toString("base64").replace(/=+$/, "");
    return canonicalOutput === canonicalInput ? buffer : null;
  }

  try {
    return Buffer.from(input, encoding);
  } catch {
    return null;
  }
}
