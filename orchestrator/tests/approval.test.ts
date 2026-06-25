import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
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

  it('resolves approval successfully with valid token', async () => {
    const req = {
      plan_id: 'p2',
      step_id: 's2',
      description: 'Test action',
      payload: {},
    };
    
    const p = requestApproval(req);
    
    const token = jwt.sign({ sub: 'user' }, config.JWT_SECRET);
    resolveApproval('p2', 's2', true, token);
    
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
    
    expect(() => resolveApproval('p3', 's3', true, 'invalid.token.string')).toThrow(/Invalid or expired/);
  });
});
