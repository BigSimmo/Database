export function isPublicLocalNoAuthMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
}

export function publicUploadsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED === "true";
}
