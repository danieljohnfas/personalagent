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

export async function executeStep(step: Step): Promise<unknown> {
  if (step.reversible && config.AGENT_WRITE_DISABLED) {
    throw new AgentWriteDisabledError();
  }

  if (step.reversible && step.status !== 'approved') {
    throw new ApprovalRequiredError();
  }

  // TODO: Actual call to Integration Layer via HTTP
  // const response = await fetch(`${config.INTEGRATION_URL}/api/execute`, ...)
  
  step.status = 'executing';
  
  // Simulate execution
  await new Promise(resolve => setTimeout(resolve, 500));
  
  step.status = 'done';
  return { success: true, mockResult: `Executed tool ${step.tool}` };
}
