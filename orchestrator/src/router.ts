import { config } from './config.js';
import { Step } from './types.js';

export class AgentWriteDisabledError extends Error {
  constructor() {
    super('Agent write actions are currently disabled by the kill switch (AGENT_WRITE_DISABLED=true).');
    this.name = 'AgentWriteDisabledError';
  }
}

export class ApprovalRequiredError extends Error {
  constructor() {
    super('This step is reversible and requires explicit user approval before execution.');
    this.name = 'ApprovalRequiredError';
  }
}

/**
 * executeStep — safety-checks then forwards the step to the Integration
 * microservice at INTEGRATION_URL/api/execute.
 *
 * The step.tool is expected to be in the format "serverName.toolName"
 * e.g. "github.search_repositories".
 */
export async function executeStep(step: Step): Promise<unknown> {
  // ── Safety gates ─────────────────────────────────────────────────────────
  if (step.reversible && config.AGENT_WRITE_DISABLED) {
    throw new AgentWriteDisabledError();
  }
  if (step.reversible && step.status !== 'approved') {
    throw new ApprovalRequiredError();
  }

  // ── Parse tool string into serverName + toolName ─────────────────────────
  const dotIndex = step.tool.indexOf('.');
  if (dotIndex === -1) {
    throw new Error(`Invalid tool format "${step.tool}". Expected "serverName.toolName".`);
  }
  const serverName = step.tool.slice(0, dotIndex);
  const toolName   = step.tool.slice(dotIndex + 1);

  // ── Forward to Integration microservice ──────────────────────────────────
  step.status = 'executing';
  const integrationUrl = `${config.INTEGRATION_URL}/api/execute`;

  const response = await fetch(integrationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverName, tool: toolName, args: step.args ?? {} }),
  });

  if (!response.ok) {
    const body = await response.text();
    step.status = 'pending'; // reset so the user can retry
    throw new Error(`Integration layer returned ${response.status}: ${body}`);
  }

  const data = await response.json() as { result: unknown };
  step.status = 'done';
  return data.result;
}
