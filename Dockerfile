# syntax=docker/dockerfile:1
# Clinical KB app tier (Next.js). See docs/deployment-architecture.md.
#
# The repo is engine-strict (Node 24.x / npm 11.x via .npmrc + preinstall
# guard), so every stage pins the same Node 24 base image. The build stage
# runs the repo's own `npm run build` (guard-next-build + next build) so the
# image build fails exactly where a local build would.
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# The publishable key is public by design; pass the real one for a
# production image:
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     --build-arg NEXT_PUBLIC_MAX_UPLOAD_MB=150 \
#     -t clinical-kb-app .
# Server-side secrets (SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ...) are
# NEVER baked into the image — inject them at run time from the host's
# secret store.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
# check-node-engine.cjs runs as the npm preinstall hook and
# install-git-hooks.mjs as the postinstall hook, so both must be in place
# before `npm ci`.
COPY package.json package-lock.json .npmrc ./
COPY scripts/check-node-engine.cjs scripts/check-node-engine.cjs
COPY scripts/install-git-hooks.mjs scripts/install-git-hooks.mjs
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL=https://sjrfecxgysukkwxsowpy.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-build-publishable-key
# Optional browser upload-limit mirror (clamped client-side). Must be set at
# build time to inline into the client bundle — runtime Railway vars alone are
# not enough when operators lower MAX_UPLOAD_MB.
ARG NEXT_PUBLIC_MAX_UPLOAD_MB=
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_MAX_UPLOAD_MB=${NEXT_PUBLIC_MAX_UPLOAD_MB}
# The repo build script allocates an 8 GiB heap; give the builder >= 10 GiB.
RUN npm run build

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts/check-node-engine.cjs scripts/check-node-engine.cjs
COPY scripts/install-git-hooks.mjs scripts/install-git-hooks.mjs
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY public ./public
COPY --from=build /app/src/lib/security-headers.ts ./src/lib/security-headers.ts
COPY --from=build /app/src/lib/supabase/project.ts ./src/lib/supabase/project.ts
COPY package.json next.config.ts ./
USER node
EXPOSE 3000
# /api/health is the app's own ops health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Bypass scripts/dev-free-port.mjs (a local-dev port picker): a container has
# exactly one app, so bind 0.0.0.0 on $PORT directly.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
