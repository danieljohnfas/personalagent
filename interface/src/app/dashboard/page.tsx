'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const ORCHESTRATOR = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001/api/v1';
const JWT_SECRET   = process.env.NEXT_PUBLIC_JWT_SECRET   || 'super_secret_dev_passphrase_123';

interface Step {
  id: string;
  description: string;
  tool: string;
  reversible: boolean;
  status: string;
}

interface Approval {
  planId: string;
  stepId: string;
  step: Step;
  goal: string;
  created_at: string;
}



export default function DashboardPage() {
  interface OAuthConnection { id: string; provider: string; accountEmail: string; createdAt: string; }
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [health, setHealth] = useState<{ orchestrator: boolean; integration: boolean }>({
    orchestrator: false,
    integration: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const [appRes, connRes] = await Promise.all([
        fetch(`${ORCHESTRATOR}/approvals`),
        fetch(`${ORCHESTRATOR}/auth/connections`)
      ]);
      if (appRes.ok) setApprovals(await appRes.json());
      if (connRes.ok) setConnections(await connRes.json());
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const [o, i] = await Promise.allSettled([
        fetch(`${ORCHESTRATOR}/health`),
        fetch('http://localhost:3002/api/health'),
      ]);
      setHealth({
        orchestrator: o.status === 'fulfilled' && o.value.ok,
        integration:  i.status === 'fulfilled' && i.value.ok,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchData();
    checkHealth();
    const id = setInterval(() => { fetchData(); checkHealth(); }, 5000);
    return () => clearInterval(id);
  }, [fetchData, checkHealth]);

  async function resolve(planId: string, stepId: string, approved: boolean) {
    setActioning(stepId);
    try {
      await fetch(`${ORCHESTRATOR}/approvals/${planId}/${stepId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, token: JWT_SECRET }),
      });
      await fetchData();
    } catch { /* ignore */ }
    finally { setActioning(null); }
  }

  return (
    <div className="shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🤖</div>
          <div className="logo-text">Partner <span>v0.1</span></div>
        </div>
        <Link href="/" className="nav-item">💬 Chat</Link>
        <Link href="/dashboard" className="nav-item active">
          🛡 Approvals
          {approvals.length > 0 && <span className="nav-badge">{approvals.length}</span>}
        </Link>
        <div className="sidebar-footer">
          <div className="status-dot">
            <span className={`dot`} style={{ background: health.orchestrator ? 'var(--success)' : 'var(--danger)', boxShadow: health.orchestrator ? '0 0 6px var(--success)' : '0 0 6px var(--danger)' }} />
            {health.orchestrator ? 'Agent online' : 'Orchestrator offline'}
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="dashboard-layout">
          {/* Header */}
          <div>
            <h1 className="page-title">🛡 Approvals & Status</h1>
            <p className="page-subtitle">Review and approve pending agent actions before they execute.</p>
          </div>

          {/* System health */}
          <div>
            <p className="section-title">System Status</p>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Orchestrator</div>
                <div className="stat-value" style={{ fontSize: 20, color: health.orchestrator ? 'var(--success)' : 'var(--danger)' }}>
                  {health.orchestrator ? '● Online' : '● Offline'}
                </div>
                <div className="stat-sub">localhost:3001</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Integration</div>
                <div className="stat-value" style={{ fontSize: 20, color: health.integration ? 'var(--success)' : 'var(--danger)' }}>
                  {health.integration ? '● Online' : '● Offline'}
                </div>
                <div className="stat-sub">localhost:3002</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pending Approvals</div>
                <div className="stat-value" style={{ color: approvals.length > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {approvals.length}
                </div>
                <div className="stat-sub">waiting for review</div>
              </div>
            </div>
          </div>

          {/* Pending approvals */}
          <div>
            <p className="section-title">Pending Approvals</p>
            <div className="card">
              {loading && <div className="empty-state">Loading…</div>}
              {!loading && approvals.length === 0 && (
                <div className="empty-state">✅ No pending approvals — all clear!</div>
              )}
              {approvals.map(a => (
                <div key={a.stepId} className="card-row">
                  <div className="card-icon icon-warning">✍</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="card-row-title">{a.step.description}</div>
                    <div className="card-row-sub">{a.step.tool}</div>
                    {a.goal && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Goal: &quot;{a.goal}&quot;
                      </div>
                    )}
                  </div>
                  <div className="card-row-actions">
                    <button
                      className="btn btn-success"
                      disabled={actioning === a.stepId}
                      onClick={() => resolve(a.planId, a.stepId, true)}
                    >
                      {actioning === a.stepId ? '…' : '✓ Approve'}
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={actioning === a.stepId}
                      onClick={() => resolve(a.planId, a.stepId, false)}
                    >
                      ✕ Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connected Accounts */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-title">Connected Integrations</p>
              <button 
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const r = await fetch(`${ORCHESTRATOR}/auth/google/url`);
                    if (r.ok) {
                      const { url } = await r.json();
                      if (url) window.location.href = url;
                    }
                  } catch (e) {
                    console.error('Failed to initiate OAuth', e);
                  }
                }}
              >
                + Connect Google Account
              </button>
            </div>
            <div className="card">
              {loading && <div className="empty-state">Loading…</div>}
              {!loading && connections.length === 0 && (
                <div className="empty-state">No accounts connected yet.</div>
              )}
              {connections.map((c) => (
                <div key={c.id} className="card-row">
                  <div className="card-icon icon-info">G</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="card-row-title">{c.accountEmail}</div>
                    <div className="card-row-sub">Connected via {c.provider}</div>
                  </div>
                  <div className="card-row-actions">
                    <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Linked</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <p className="section-title">Quick Links</p>
            <div className="card">
              <div className="card-row">
                <div className="card-icon icon-info">💬</div>
                <div>
                  <div className="card-row-title">Chat Interface</div>
                  <div className="card-row-sub">Send goals and read results</div>
                </div>
                <div className="card-row-actions">
                  <Link href="/" className="btn btn-primary">Open →</Link>
                </div>
              </div>
              <div className="card-row">
                <div className="card-icon icon-success">🐙</div>
                <div>
                  <div className="card-row-title">GitHub Repository</div>
                  <div className="card-row-sub">danieljohnfas/personalagent</div>
                </div>
                <div className="card-row-actions">
                  <a href="https://github.com/danieljohnfas/personalagent" target="_blank" rel="noreferrer" className="btn btn-primary">
                    Open →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
