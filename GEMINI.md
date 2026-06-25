# Antigravity-Specific Configuration

## Model routing
- **Routine tasks** (file edits, test generation, small refactors): use the default fast model
- **Architecture decisions** (planner design, new integrations, security review): use the strongest available reasoning model
- **Research tasks** (finding MCP servers, checking API docs): delegate to a research subagent

## Agent behaviour
- Always produce an Artifact (plan, diff, or summary) before executing anything that touches files outside the current layer's folder
- For any task spanning more than one layer, produce a cross-layer plan Artifact and wait for my review before starting
- Enable Review Gates on all swarm agents — never silently merge

## Swarm guidance
When building across multiple layers simultaneously:
- Scope each agent to its own subfolder (`/interface`, `/orchestrator`, `/integration`, `/deploy`)
- Agents must not write files outside their assigned subfolder without explicit instruction
- Share state only through the integration layer's API — never by directly reading another agent's working files

## Approval workflow
- Any action that creates, modifies, or deletes files outside the project root requires showing me a diff first
- Any network request to an external service (beyond reading public docs) requires flagging the target URL and purpose

## Skills to load
- Use skills in `.agents/skills/` automatically when the task domain matches
- Prefer existing skills over ad-hoc approaches

## Discovery workflow
- The `.agents/workflows/discover_tools.md` workflow runs on a weekly schedule
- Its output is a read-only Artifact — never auto-applied
