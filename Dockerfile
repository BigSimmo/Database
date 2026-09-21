# syntax=docker/dockerfile:1
# PsychSift app tier (Next.js). See docs/deployment-architecture.md.
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
#     --build-arg MAX_UPLOAD_MB=150 \
#     --build-arg NEXT_PUBLIC_MAX_UPLOAD_MB=150 \
#     -t clinical-kb-app .
# Server-side secrets (SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ...):
# NEVER declare as build arguments (ARG). Always inject at runtime via
# environment variables from the host's secret store. No exceptions.

FROM dhi.io/node:24-debian12-dev AS node-base

FROM node-base AS deps
WORKDIR /app
# Copy only npm configuration and manifests first (immutable layer for cache efficiency).
# This layer re-builds only when lock file or npm config changes.
COPY .npmrc package*.json ./
# Copy hook scripts early so they're cached separately from app code.
COPY scripts/check-node-engine.cjs scripts/check-node-engine.cjs
COPY scripts/install-git-hooks.mjs scripts/install-git-hooks.mjs
COPY scripts/check-installed-lock-parity.mjs scripts/check-installed-lock-parity.mjs
# Registry blips (ECONNRESET) have failed CI app-image builds mid-install; retry
# the whole `npm ci` rather than relying only on per-request fetch retries.
RUN for attempt in 1 2 3; do \
      npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 && break; \
      if [ "$attempt" -eq 3 ]; then exit 1; fi; \
      sleep $((attempt * 10)); \
    done

FROM node-base AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Copy node_modules first (large, stable layer).
COPY --from=deps /app/node_modules ./node_modules
# Define all build arguments at the top of the stage for clarity.
ARG NEXT_PUBLIC_SUPABASE_URL=https://sjrfecxgysukkwxsowpy.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-build-publishable-key
ARG NEXT_PUBLIC_MAX_UPLOAD_MB=
ARG MAX_UPLOAD_MB=
ARG RAILWAY_GIT_COMMIT_SHA=
ARG ALLOW_LOW_RAM_BUILD=0
# Copy application source (changes frequently, so place after node_modules).
COPY . .
# Set environment variables from build arguments (evaluated at RUN time).
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_MAX_UPLOAD_MB=${NEXT_PUBLIC_MAX_UPLOAD_MB} \
    RAILWAY_GIT_COMMIT_SHA=${RAILWAY_GIT_COMMIT_SHA} \
    ALLOW_LOW_RAM_BUILD=${ALLOW_LOW_RAM_BUILD}
# Run the Next.js build with 8 GiB heap and parity validation.
RUN UPLOAD_LIMIT_PARITY_SERVER_MB="${MAX_UPLOAD_MB}" env -u MAX_UPLOAD_MB npm run build

FROM node-base AS prod-deps
WORKDIR /app
# Install production dependencies only (--omit=dev reduces size).
# Copy npm config and manifests first.
COPY .npmrc package*.json ./
# Ignore scripts to skip hook installation (not needed at runtime).
RUN for attempt in 1 2 3; do \
      npm ci --omit=dev --ignore-scripts --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 && break; \
      if [ "$attempt" -eq 3 ]; then exit 1; fi; \
      sleep $((attempt * 10)); \
    done

FROM dhi.io/node:24-debian12 AS runner
WORKDIR /app
# Set all runtime environment variables in one RUN for layer efficiency (or ENV for clarity).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# Copy production dependencies first.
COPY --from=prod-deps /app/node_modules ./node_modules
# Copy Next.js build output.
COPY --from=build /app/.next ./.next
# Copy minimal config and public assets.
COPY package.json next.config.ts ./
COPY public ./public
# Copy required runtime source files for Sentry and Supabase config.
COPY --from=build /app/src/lib/security-headers.ts ./src/lib/security-headers.ts
COPY --from=build /app/src/lib/observability/sentry-release.ts ./src/lib/observability/sentry-release.ts
COPY --from=build /app/src/lib/supabase/project.ts ./src/lib/supabase/project.ts
COPY --from=build /app/src/components/therapy-compass/data/generated-assets.ts ./src/components/therapy-compass/data/generated-assets.ts
USER node
EXPOSE 3000
LABEL org.opencontainers.image.source="https://github.com/BigSimmo/Database"
LABEL org.opencontainers.image.title="PsychSift app tier"
LABEL org.opencontainers.image.description="Next.js 16 app tier for the PsychSift medical guideline RAG knowledge base"
LABEL org.opencontainers.image.licenses="UNLICENSED"
LABEL org.opencontainers.image.vendor="Docker Inc."
LABEL org.sbom.image="" 
STOPSIGNAL SIGTERM
# /api/health is the app's own ops health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Runtime validation: prove config and module resolution before promotion.
RUN node -e "if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') throw new Error('NODE_ENV must be production'); if (!require.resolve('next')) throw new Error('next not found'); if (!require.resolve('@supabase/supabase-js')) throw new Error('@supabase/supabase-js not found')"
# Bypass scripts/dev-free-port.mjs (a local-dev port picker): a container has
# exactly one app, so bind 0.0.0.0 on $PORT directly.
CMD ["sh", "-c", "exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
