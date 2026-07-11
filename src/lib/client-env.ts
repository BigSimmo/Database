/** Client-safe environment helpers. Keep this module limited to NEXT_PUBLIC_* values. */
export function isLocalNoAuthMode() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
}

export function publicUploadsEnabled() {
  return process.env.NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED === "true";
}
