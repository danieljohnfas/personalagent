---
# Phase 5 — Discovery Agent Workflow
# Schedule: weekly (run manually or via cron in the future)
# Output: A read-only Artifact — never auto-applied. You review and decide.
---

# Discover New Tools

## Goal
Search for new MCP servers, updated model releases, and new capabilities
that could be integrated into the Personal Agent Platform.

## Instructions for Agent

1. **Search for new MCP servers**
   - Check https://github.com/modelcontextprotocol/servers for new entries
   - Search npm for packages matching `@modelcontextprotocol/*` or `mcp-server-*`
   - Search GitHub for `mcp server` published in the last 7 days

2. **Check for model updates**
   - Check OpenAI, Anthropic, Google, and Mistral release notes pages
   - Note any new model names, context window sizes, or pricing changes

3. **Evaluate candidates**
   For each candidate MCP server, assess:
   - Does it require write access? (flag these separately)
   - Does it have an official SDK/README?
   - Is it maintained (last commit < 3 months)?
   - What secret/token does it need?

4. **Produce output as an Artifact**
   Create a markdown artifact `mcp_discovery_<date>.md` containing:
   - A table of discovered servers: name, description, requires_write, status
   - A draft diff for `mcp_config.json` (new entries with `mock_mode: true`, `enabled: false`)
   - Model release notes summary

5. **STOP — do not apply anything**
   The artifact is for review only. The human decides what to add.

## Safety Rules
- NEVER modify `mcp_config.json` directly
- NEVER enable a server automatically
- NEVER request OAuth scopes during discovery
- All output is read-only

## Example Output Format

```markdown
## MCP Server Candidates — 2025-01-01

| Name | Description | Write? | Maintained? | Token Needed |
|------|-------------|--------|-------------|--------------|
| @mcp/notion | Notion read API | No | Yes | NOTION_TOKEN |
| @mcp/linear | Linear issue tracker | Yes ⚠ | Yes | LINEAR_API_KEY |

### Draft mcp_config.json diff
\`\`\`json
{
  "servers": [
    {
      "name": "notion",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-notion"],
      "env": { "NOTION_TOKEN": "NOTION_TOKEN" },
      "enabled": false,
      "mock_mode": true
    }
  ]
}
\`\`\`
```
