import type { MetadataRoute } from "next";
import { buildPrivateAppRobotsTxt } from "@/lib/crawler-policy";

// Undeclared Docker build ARGs never reach `npm run build` on Railway, so a
// canonical-origin env var can be empty at build time even when the running
// container has it set. `dynamic = "force-dynamic"` keeps this route from
// being prerendered once and frozen with that empty value; each request
// re-evaluates `buildPrivateAppRobotsTxt()` against the container's current
// environment.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return buildPrivateAppRobotsTxt();
}
