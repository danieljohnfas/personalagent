import { describe, it, expect, beforeEach, vi } from 'vitest';
import { config } from '../src/config.js';
import { requestApproval, resolveApproval, getPendingApprovals, pendingApprovals } from '../src/approval.js';

vi.mock('../src/config.js', () => ({
  config: {
    JWT_SECRET: 'test_secret'
  }
}));

describe('Approval System', () => {
  beforeEach(() => {
    pendingApprovals.clear();
  });

  it('adds request to pending approvals', () => {
    const req = {
      plan_id: 'p1',
      step_id: 's1',
      description: 'Test action',
      payload: {},
    };

    // We expect this to reject because it's cleared in beforeEach
    requestApproval(req).catch(() => {});

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].plan_id).toBe('p1');
  });

  it('resolves approval successfully with correct passphrase', async () => {
    const req = {
      plan_id: 'p2',
      step_id: 's2',
      description: 'Test action',
      payload: {},
    };

    const p = requestApproval(req);

    // The token IS the JWT_SECRET passphrase in our single-user model
    resolveApproval('p2', 's2', true, 'test_secret');

    await expect(p).resolves.toBeUndefined();
    expect(getPendingApprovals()).toHaveLength(0);
  });

  it('throws on invalid token', () => {
    const req = {
      plan_id: 'p3',
      step_id: 's3',
      description: 'Test action',
      payload: {},
    };
    requestApproval(req).catch(() => {});

    expect(() => resolveApproval('p3', 's3', true, 'wrong-passphrase')).toThrow(/Invalid approval token/);
  });
});
