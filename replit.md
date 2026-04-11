# AgentAudit Workspace

## Overview

pnpm workspace monorepo. The main product is **AgentAudit** — a plain CommonJS Fastify server at the workspace root (`index.js`), running on port 3000.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Main server**: Fastify 5, CommonJS (`index.js` at root)
- **Payments**: Razorpay (npm package)
- **Hashing**: Node.js built-in `crypto` (SHA-256 hash chaining, HMAC verification)
- **Storage**: In-memory (Map + Arrays — resets on restart)

## Artifacts / Workflows

- **`agentaudit: Fastify Server`** — `PORT=3000 node index.js` — main product
- `artifacts/api-server` — separate Express 5 server (port 8080, not actively used)
- `artifacts/mockup-sandbox` — Vite component preview server (port 8081)

## AgentAudit — `index.js`

### In-memory stores
- `apiKeys` — Map of `aa_*` key → `{ user (email), plan, created_at, usage_count, paid_order_id, upgraded_at }`
- `logs` — Array of hash-chained audit log entries
- `authorizations` — Array of agent authorization records
- `pendingOrders` — Map of Razorpay order_id → `{ email, target_plan }`

### Plans
| Plan       | Limit       | Price (INR) |
|------------|-------------|-------------|
| free       | 500 req/mo  | ₹0          |
| pro        | 10,000/mo   | ₹2,400/mo   |
| enterprise | Unlimited   | Custom      |

### Auth
- Global `onRequest` hook validates `x-api-key` header
- `PUBLIC_ROUTES` bypass auth: `/, /dashboard, /apikey, /plans, /payment/create, /payment/verify, /payment/webhook, /health`
- Admin key = `process.env.API_KEY` (default: `dev-key-change-me`)
- Admin key bypasses rate limits

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Landing page |
| GET | `/health` | Public | Health check + Razorpay status |
| GET | `/plans` | Public | Pricing page with Razorpay Checkout UI |
| POST | `/apikey` | Public | Create API key (body: `{user: email, plan?}`) |
| GET | `/apikeys` | Admin | List all keys with usage stats |
| POST | `/authorize` | Key | Register agent authorization |
| POST | `/log` | Key | Record hash-chained agent action |
| GET | `/logs` | Key | All audit logs |
| GET | `/authorizations` | Key | All authorization records |
| GET | `/agent/:name` | Key | Full history for a specific agent |
| GET | `/verify` | Key | Validate SHA-256 hash chain integrity |
| GET | `/export` | Key | Download logs+auths as JSON |
| GET | `/dashboard` | Public | Auto-refresh browser log table |
| POST | `/payment/create` | Public | Create Razorpay order by email (body: `{email, plan}`) |
| POST | `/payment/verify` | Public | Verify Razorpay signature + upgrade plan by email |
| POST | `/payment/webhook` | Public | Razorpay `payment.captured` webhook → upgrade plan by email |

### Payment Flow
1. User calls `POST /payment/create` with `{ email, plan: "pro" }` → looks up API key by email → creates Razorpay order → returns order details
2. Browser opens Razorpay Checkout modal (on `/plans` page)
3. On success, browser calls `POST /payment/verify` with Razorpay response → verifies HMAC signature → finds key by email → upgrades plan
4. Webhook `POST /payment/webhook` is a server-side fallback — fires on `payment.captured` event, finds key by email from order notes, upgrades plan

### Environment Variables / Secrets
- `API_KEY` — admin key (optional, defaults to `dev-key-change-me`)
- `RAZORPAY_KEY_ID` — Razorpay public key (starts with `rzp_`)
- `RAZORPAY_KEY_SECRET` — Razorpay secret key (24 chars)
- `RAZORPAY_WEBHOOK_SECRET` — (optional) webhook signature validation secret

## Key Commands

- `node index.js` — start the server (PORT env var required)
- `pnpm run typecheck` — typecheck TypeScript artifacts
- `pnpm run build` — build all packages
