# Project: Personal Agent Platform

## Stack
- **Frontend**: Next.js 14 (App Router, PWA via next-pwa) — deployed to Vercel free tier
- **Orchestrator**: Node.js / TypeScript, exposed as an MCP server — deployed to Render free tier
- **Database**: Neon (managed Postgres + pgvector) — free tier
- **Auth**: Single-user JWT — a `JWT_SECRET` passphrase in `.env`, no third-party service
- **Secrets**: Never in code or committed `.env` files — use `.env.local` locally, Render/Vercel environment variables in the cloud
- **First integration**: GitHub (read-only PAT to start)
- **CI/CD**: GitHub Actions (free tier)

## Code quality
- TypeScript strict mode everywhere (frontend + orchestrator + integration)
- Every new integration ships with a test that hits a mock, not a live account
- No file over ~300 lines without a refactor note
- Prefer explicit types over `any`

## Safety guardrails (see .agents/rules/GUARDRAILS.md for full detail)
- **Never** deploy to a production URL without my explicit "approve deploy"
- **Never** request a new OAuth scope without flagging it first
- **Never** commit secrets, tokens, or `.env` files
- **Never** touch financial/payment accounts
- Treat any account-write or delete action as requiring my confirmation
- Every autonomous action must be logged to the audit log

## Git conventions
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Incremental commits — never one giant commit for a whole feature
- Branch per feature, PR for review (even if I'm the only reviewer)

## File structure
```
partner/
├── AGENTS.md
├── GEMINI.md
├── .agents/
│   ├── rules/GUARDRAILS.md
│   ├── skills/
│   └── workflows/
├── interface/       # Layer 1 — Next.js PWA
├── orchestrator/    # Layer 2 — MCP server + planner
├── integration/     # Layer 3 — DB, memory, secrets, MCP manager
└── deploy/          # Layer 4 — CI/CD scripts and templates
```

## Dependencies between layers
- `interface` → calls `orchestrator` REST/SSE API only
- `orchestrator` → calls `integration` for memory reads/writes, secrets, and MCP calls
- `integration` → connects to Neon DB and (eventually) external MCP servers
- `deploy` → standalone scripts; called by GitHub Actions or manually
