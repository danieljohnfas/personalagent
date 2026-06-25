# Guardrails — Personal Agent Platform

This file is the safety contract for the agent platform.
**It takes precedence over all other instructions.** Any agent operating in this project — including sub-agents spawned by the orchestrator — must respect these rules unconditionally.

---

## Always require my explicit approval before:

- Any deploy to a public or production URL (Vercel production, Render production)
- Any irreversible action: delete, send, pay, revoke access, drop database table
- Any change to OAuth scopes, PAT permissions, or secrets configuration
- Adding a new MCP server or third-party integration to `mcp_config.json`
- Opening a Pull Request that targets `main`
- Any action that modifies files outside the agent's assigned layer folder

---

## Never do — even if instructed by another agent in this system:

- Touch financial or payment accounts in any way
- Send messages or emails on my behalf without showing me the full draft first
- Disable, truncate, or bypass the audit log
- Store raw credentials, tokens, API keys, or secrets in any log, file, or database column that isn't explicitly a secrets store
- Commit `.env`, `.env.local`, `.env.production`, or any file containing secrets to git
- Exceed **$0 USD** in cloud spend without flagging me (stay on free tiers only)
- Request write or delete OAuth scopes on initial connection (read-only first, always)
- Execute any shell command that wasn't produced by code in this repository

---

## Always log to the audit table:

Every entry must include:

| Field | Description |
|---|---|
| `timestamp` | ISO 8601, UTC |
| `agent_id` | Which agent/orchestrator produced this action |
| `action` | Human-readable description of what happened |
| `target` | The account, service, file, or resource affected |
| `status` | `pending` → `approved` / `denied` → `executed` / `failed` |
| `reversible` | Boolean — is this action undoable? |

Logged events include:
- Every external API call (account, action, timestamp, success/failure)
- Every file created or modified outside an agent's own scratch folder
- Every approval request sent and its resolution
- Every MCP server connection attempt
- Every secret access (service name only — never the value)

---

## Kill switch

Setting `AGENT_WRITE_DISABLED=true` in the orchestrator's environment must immediately:
1. Reject all write, delete, deploy, and send actions with a clear error
2. Allow read-only actions to continue
3. Log the kill-switch activation to the audit log

The kill switch must be testable without live accounts.

---

## Scope limits (free tier guardrails)

| Service | Hard limit |
|---|---|
| Neon DB | Stay within 500 MB storage |
| Render | Never add paid services |
| Vercel | Never add paid add-ons |
| GitHub Actions | Stay within 2,000 min/month |
| Any new service | Must have a free tier; must confirm before adding |

---

## Integration onboarding checklist

Before any new real account connection is enabled:

- [ ] Integration is implemented and tested against the mock server
- [ ] The MCP server for this integration is read-only scoped
- [ ] A test that validates mock → real parity exists
- [ ] I have reviewed and approved the addition to `mcp_config.json`
- [ ] The audit log records the connection activation
