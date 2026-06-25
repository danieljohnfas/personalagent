import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStep, AgentWriteDisabledError, ApprovalRequiredError } from '../src/router.js';
import { config } from '../src/config.js';
import { Step } from '../src/types.js';

vi.mock('../src/config.js', () => ({
  config: {
    AGENT_WRITE_DISABLED: false,
    INTEGRATION_URL: 'http://localhost:3002',
  }
}));

// Mock the global fetch so tests never hit a real network
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Router Execution', () => {
  beforeEach(() => {
    config.AGENT_WRITE_DISABLED = false;
    mockFetch.mockReset();
    // Default: successful integration response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { mock: true } }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws ApprovalRequiredError for unapproved reversible steps', async () => {
    const step: Step = {
      id: '1',
      description: 'Test',
      tool: 'test.write',
      args: {},
      reversible: true,
      status: 'pending', // Not approved
    };

    await expect(executeStep(step)).rejects.toThrow(ApprovalRequiredError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws AgentWriteDisabledError when kill switch is on for reversible step', async () => {
    config.AGENT_WRITE_DISABLED = true;

    const step: Step = {
      id: '2',
      description: 'Test',
      tool: 'test.write',
      args: {},
      reversible: true,
      status: 'approved', // Approved, but global switch is on
    };

    await expect(executeStep(step)).rejects.toThrow(AgentWriteDisabledError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('executes a non-reversible step without approval (calls integration layer)', async () => {
    const step: Step = {
      id: '3',
      description: 'Test',
      tool: 'github.list_repos',
      args: {},
      reversible: false,
      status: 'pending',
    };

    const result = await executeStep(step);
    expect(result).toEqual({ mock: true });
    expect(step.status).toBe('done');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3002/api/execute',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('executes a reversible step if it is approved (calls integration layer)', async () => {
    const step: Step = {
      id: '4',
      description: 'Test',
      tool: 'github.create_issue',
      args: {},
      reversible: true,
      status: 'approved', // Approved!
    };

    const result = await executeStep(step);
    expect(result).toEqual({ mock: true });
    expect(step.status).toBe('done');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws when integration layer returns an error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const step: Step = {
      id: '5',
      description: 'Test',
      tool: 'github.some_tool',
      args: {},
      reversible: false,
      status: 'pending',
    };

    await expect(executeStep(step)).rejects.toThrow(/500/);
    expect(step.status).toBe('pending'); // reset on error
  });

  it('throws for invalid tool format (missing dot separator)', async () => {
    const step: Step = {
      id: '6',
      description: 'Test',
      tool: 'notvalid',
      args: {},
      reversible: false,
      status: 'pending',
    };

    await expect(executeStep(step)).rejects.toThrow(/Invalid tool format/);
  });
});
