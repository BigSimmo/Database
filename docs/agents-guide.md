# Agents Guide

## Purpose

This repository contains the Clinical KB application. It is a Next.js + Supabase + OpenAI RAG knowledge base for medical guidelines. Agents working with this project should follow these guidelines.

## Getting Started

- Use Node 24 and npm 11; the project uses Next.js v16.
- Copy `.env.example` to `.env.local` and populate secrets. **Never commit actual secrets**.
- Use `npm run ensure` to start or verify the local dev server. It selects a stable port automatically.
- Start the ingestion worker in a separate terminal using `npm run worker`.

## Development Guidelines

- Avoid changing `.env.example` values other than adding placeholders. Do not commit `.env.local`.
- When adding environment variables, update the schema in `src/lib/env.ts` and document them in `.env.example`.
- Use TypeScript and follow existing code patterns; avoid introducing new dependencies unless necessary.
- Run `npm run lint` and `npm run typecheck` before committing.
- Use `npm run test` and `npm run test:e2e` to ensure critical flows remain stable.
- Keep Supabase service role keys on the server; never expose them to the client.

## Routing & Architecture

- The app uses the Next.js App Router under `src/app`.
- API routes live under `src/app/api`.
- Client components are in `src/components`.
- Supabase integration code is in `src/lib/supabase`.

## Performance & Safety

- Use `zod` for request and environment validation.
- Enforce permissions server-side; do not rely on client-side checks.
- Respect the existing rate-limiting and source-governance logic.
- When adding new API endpoints, provide appropriate error handling and status codes.

## Documentation

- Keep the README up to date if you change setup, scripts, or environment variables.
- Add high-level architectural changes or decisions in `docs/`.
