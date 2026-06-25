import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { ApprovalRequest } from './types.js';

export const pendingApprovals = new Map<string, ApprovalRequest & { resolvedStatus?: 'approved' | 'denied' }>();

export async function requestApproval(req: ApprovalRequest): Promise<void> {
  const key = `${req.plan_id}:${req.step_id}`;
  pendingApprovals.set(key, req);

  const timeoutMs = 5 * 60 * 1000; // 5 mins
  const pollIntervalMs = 100;
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const current = pendingApprovals.get(key);
      if (!current) {
        clearInterval(timer);
        reject(new Error('Approval request vanished'));
        return;
      }

      if (current.resolvedStatus === 'approved') {
        clearInterval(timer);
        pendingApprovals.delete(key);
        resolve();
      } else if (current.resolvedStatus === 'denied') {
        clearInterval(timer);
        pendingApprovals.delete(key);
        reject(new Error('Approval denied by user'));
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        pendingApprovals.delete(key);
        reject(new Error('Approval request timed out'));
      }
    }, pollIntervalMs);
  });
}

export function resolveApproval(planId: string, stepId: string, approved: boolean, token: string): void {
  // Verify JWT token ensures the request came from an authenticated UI session
  try {
    jwt.verify(token, config.JWT_SECRET);
  } catch (e) {
    throw new Error('Invalid or expired approval token');
  }

  const key = `${planId}:${stepId}`;
  const req = pendingApprovals.get(key);
  if (!req) {
    throw new Error('Approval request not found');
  }

  req.resolvedStatus = approved ? 'approved' : 'denied';
}

export function getPendingApprovals(): ApprovalRequest[] {
  return Array.from(pendingApprovals.values());
}
