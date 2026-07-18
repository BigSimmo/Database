/* Clinical KB PWA retirement worker (docs/pwa.md rule 6).
 *
 * This file is NOT registered during normal operation. To retire the PWA, ship
 * this file's CONTENT as /sw.js (replace public/sw.js with it) in a single
 * deployment. /sw.js is served no-store and registered with
 * `updateViaCache: "none"`, so installed clients fetch the replacement on
 * their next update check; it then deletes every owned cache, unregisters
 * itself, and the site continues as a plain web application. Never remove the
 * /sw.js route instead — installed workers can outlive a 404.
 */

const CACHE_PREFIX = "clinical-kb-pwa-";

self.addEventListener("install", (event) => {
  // Retirement is the documented exception to the no-auto-skipWaiting rule:
  // the tear-down worker must replace the caching worker without waiting for
  // every tab to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      let names = [];
      try {
        names = await caches.keys();
      } catch {
        // CacheStorage may be unavailable; unregistration must still proceed.
      }
      await Promise.allSettled(
        names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)),
      );
      try {
        await self.registration.unregister();
      } catch {
        // Even if unregistration fails, this worker has no fetch handler, so
        // every request already goes straight to the network.
      }
      try {
        await self.clients.claim();
      } catch {
        // Best-effort: pages this worker never claims stop being controlled on
        // their next navigation anyway.
      }
    })(),
  );
});

// Deliberately no fetch listener: retirement means the network handles every
// request and nothing is ever served from or written to CacheStorage.
