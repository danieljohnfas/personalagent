import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeStep, AgentWriteDisabledError, ApprovalRequiredError } from '../src/router.js';
import { config } from '../src/config.js';
import { Step } from '../src/types.js';

vi.mock('../src/config.js', () => ({
  config: {
    AGENT_WRITE_DISABLED: false
  }
}));

describe('Router Execution', () => {
  beforeEach(() => {
    config.AGENT_WRITE_DISABLED = false;
  });

  it('throws ApprovalRequiredError for unapproved reversible steps', async () => {
    const step: Step = {
      id: '1',
      description: 'Test',
      tool: 'test.write',
      args: {},
      reversible: true,
      status: 'pending' // Not approved
    };

    await expect(executeStep(step)).rejects.toThrow(ApprovalRequiredError);
  });

  it('throws AgentWriteDisabledError when kill switch is on for reversible step', async () => {
    config.AGENT_WRITE_DISABLED = true;
    
    const step: Step = {
      id: '2',
      description: 'Test',
      tool: 'test.write',
      args: {},
      reversible: true,
      status: 'approved' // Approved, but global switch is on
    };

    await expect(executeStep(step)).rejects.toThrow(AgentWriteDisabledError);
  });

  it('executes a non-reversible step without approval', async () => {
    const step: Step = {
      id: '3',
      description: 'Test',
      tool: 'test.read',
      args: {},
      reversible: false,
      status: 'pending'
    };

    const result = await executeStep(step);
    expect(result).toHaveProperty('success', true);
    expect(step.status).toBe('done');
  });

  it('executes a reversible step if it is approved', async () => {
    const step: Step = {
      id: '4',
      description: 'Test',
      tool: 'test.write',
      args: {},
      reversible: true,
      status: 'approved' // Approved!
    };

    const result = await executeStep(step);
    expect(result).toHaveProperty('success', true);
    expect(step.status).toBe('done');
  });
});
