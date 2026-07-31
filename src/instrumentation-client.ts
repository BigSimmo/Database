import * as Sentry from "@sentry/nextjs";
import { config } from "zod";

import "./sentry.client.config";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Keep zod schema compilation evaluation-side only; avoiding JIT probe noise
// in the browser protects this repo's strict CSP profile.
config({ jitless: true });
