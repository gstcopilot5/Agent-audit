# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API frameworks**: Express 5 (api-server), Fastify 5 (agentaudit)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Artifacts

- `artifacts/api-server` — Express API server (port 8080, `/api` prefix)
- `artifacts/agentaudit` — Fastify API server (port 3001)

## agentaudit (Fastify server)

Located at `artifacts/agentaudit/`. Key structure:
- `src/index.ts` — Entry point, reads PORT env var
- `src/app.ts` — Fastify instance with CORS, sensible defaults, error handling
- `src/routes/index.ts` — Route aggregator (`GET /`)
- `src/routes/health.ts` — Health check (`GET /health`)

Endpoints:
- `GET /` — Server info (name, version, description)
- `GET /health` — Health status (uptime, startedAt, timestamp)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run Express API server locally
- `pnpm --filter @workspace/agentaudit run dev` — run Fastify server locally (set PORT)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
