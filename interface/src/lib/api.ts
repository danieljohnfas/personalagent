const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001/api/v1';

export async function fetchApprovals() {
  const res = await fetch(`${API_BASE}/approvals`);
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json();
}

export async function resolveApproval(planId: string, stepId: string, approved: boolean, token: string) {
  const res = await fetch(`${API_BASE}/approvals/${planId}/${stepId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, token })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to resolve approval');
  }
  
  return res.json();
}

export async function submitGoal(goal: string) {
  const res = await fetch(`${API_BASE}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal })
  });
  
  if (!res.ok) throw new Error('Failed to submit goal');
  return res.json();
}
