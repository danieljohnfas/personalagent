'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const ORCHESTRATOR = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET || 'super_secret_dev_passphrase_123';

type Role = 'agent' | 'user';
type MsgStatus = 'ok' | 'error' | 'loading';

interface PlanStep {
  id: string;
  description: string;
  tool: string;
  reversible: boolean;
  status: string;
}

interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
}

interface Message {
  id: string;
  role: Role;
  text: string;
  status?: MsgStatus;
  plan?: Plan;
  result?: unknown;
  ts: Date;
}

const SUGGESTIONS = [
  '🔀 List recent commits in personalagent',
  '📋 Show open issues in my repo',
  '🔍 Search code for MCPManager',
  '📊 What are the latest pull requests?',
];

function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ResultBlock({ data }: { data: unknown }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return <pre className="result-block">{text}</pre>;
}

function PlanCard({ plan, onApprove, onDeny, approving }: {
  plan: Plan;
  onApprove: (planId: string, stepId: string) => void;
  onDeny: (planId: string, stepId: string) => void;
  approving: string | null;
}) {
  return (
    <div className="plan-card">
      <div className="plan-card-header">📋 Execution Plan — {plan.steps.length} step{plan.steps.length !== 1 ? 's' : ''}</div>
      {plan.steps.map(step => (
        <div key={step.id} className="plan-step">
          <span className={`step-pill ${step.reversible ? 'write' : 'read'}`}>
            {step.reversible ? '✍ WRITE' : '👁 READ'}
          </span>
          <div style={{ flex: 1 }}>
            <div className="step-desc">{step.description}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {step.tool}
            </div>
            {step.reversible && step.status === 'pending' && (
              <div className="approval-actions">
                <button
                  className="btn btn-success"
                  onClick={() => onApprove(plan.id, step.id)}
                  disabled={approving === step.id}
                >
                  {approving === step.id ? '...' : '✓ Approve'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => onDeny(plan.id, step.id)}
                  disabled={approving === step.id}
                >
                  ✕ Deny
                </button>
              </div>
            )}
            {step.reversible && step.status === 'approved' && (
              <span className="step-pill approved" style={{ marginTop: 6, display: 'inline-block' }}>✓ Approved</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // Poll pending approvals count for badge
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${ORCHESTRATOR}/approvals`);
        if (r.ok) {
          const data = await r.json() as unknown[];
          setPendingCount(data.length);
        }
      } catch { /* offline */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  function addMsg(msg: Omit<Message, 'id' | 'ts'>) {
    const full: Message = { ...msg, id: crypto.randomUUID(), ts: new Date() };
    setMessages(prev => [...prev, full]);
    return full.id;
  }

  function updateMsg(id: string, patch: Partial<Message>) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  async function send(goal?: string) {
    const text = (goal ?? input).trim();
    if (!text || loading) return;
    setInput('');

    addMsg({ role: 'user', text });
    setLoading(true);

    const agentId = addMsg({ role: 'agent', text: '', status: 'loading' });

    try {
      // 1. Ask orchestrator to plan
      const planRes = await fetch(`${ORCHESTRATOR}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: text }),
      });
      if (!planRes.ok) throw new Error(await planRes.text());
      const plan: Plan = await planRes.json();

      const hasReversible = plan.steps.some(s => s.reversible);

      if (hasReversible) {
        // Show plan for approval
        updateMsg(agentId, {
          text: `I created an execution plan that includes write actions. Please review and approve each step before I proceed.`,
          status: 'ok',
          plan,
        });
        setLoading(false);
        return;
      }

      // 2. No reversible steps — auto-execute all
      updateMsg(agentId, { text: 'Executing…', status: 'loading' });

      const results: unknown[] = [];
      for (const step of plan.steps) {
        const execRes = await fetch(`${ORCHESTRATOR}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step }),
        });
        if (!execRes.ok) throw new Error(await execRes.text());
        const { result } = await execRes.json() as { result: unknown };
        results.push(result);
      }

      const resultData = results.length === 1 ? results[0] : results;
      const content = extractContent(resultData);

      updateMsg(agentId, {
        text: `Done! Here are the results for: "${text}"`,
        status: 'ok',
        result: content,
        plan,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      updateMsg(agentId, { text: `❌ ${msg}`, status: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function extractContent(data: unknown): string {
    // MCP returns { content: [{ type: 'text', text: '...' }] }
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.content)) {
        const first = d.content[0] as Record<string, unknown>;
        if (first?.text) return String(first.text);
      }
    }
    return JSON.stringify(data, null, 2);
  }

  async function handleApprove(planId: string, stepId: string) {
    setApproving(stepId);
    try {
      const r = await fetch(`${ORCHESTRATOR}/approvals/${planId}/${stepId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, token: JWT_SECRET }),
      });
      if (!r.ok) throw new Error(await r.text());

      // Update local step status
      setMessages(prev => prev.map(m => {
        if (m.plan?.id !== planId) return m;
        return {
          ...m,
          plan: {
            ...m.plan!,
            steps: m.plan!.steps.map(s =>
              s.id === stepId ? { ...s, status: 'approved' } : s
            ),
          },
        };
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      addMsg({ role: 'agent', text: `❌ Approval failed: ${msg}`, status: 'error' });
    } finally {
      setApproving(null);
    }
  }

  async function handleDeny(planId: string, stepId: string) {
    setMessages(prev => prev.map(m => {
      if (m.plan?.id !== planId) return m;
      return {
        ...m,
        plan: {
          ...m.plan!,
          steps: m.plan!.steps.map(s =>
            s.id === stepId ? { ...s, status: 'denied' } : s
          ),
        },
        text: m.text + '\n\n⛔ Action denied by you.',
      };
    }));
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🤖</div>
          <div className="logo-text">Partner <span>v0.1</span></div>
        </div>
        <Link href="/" className="nav-item active">💬 Chat</Link>
        <Link href="/dashboard" className="nav-item">
          🛡 Approvals
          {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
        </Link>

        <div className="sidebar-footer">
          <div className="status-dot">
            <span className="dot" />
            Agent online
          </div>
        </div>
      </nav>

      {/* Chat */}
      <main className="main">
        <div className="chat-layout">
          <header className="chat-header">
            <div className="avatar agent" style={{ width: 28, height: 28, fontSize: 13 }}>🤖</div>
            <div>
              <h1>Personal Agent</h1>
              <p>Connected · GitHub integration active</p>
            </div>
          </header>

          <div className="messages">
            {showWelcome && (
              <div className="welcome-banner">
                <div className="welcome-emoji">✨</div>
                <div>
                  <div className="welcome-title">Your agent is ready</div>
                  <div className="welcome-desc">
                    Ask me anything about your GitHub repositories, issues, pull requests, or code.
                    Write actions require your explicit approval before execution.
                  </div>
                  <div className="suggestions">
                    {SUGGESTIONS.map(s => (
                      <button key={s} className="suggestion-chip" onClick={() => send(s.replace(/^[^\s]+\s/, ''))}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`message ${m.role}`}>
                <div className={`avatar ${m.role}`}>
                  {m.role === 'agent' ? '🤖' : '👤'}
                </div>
                <div>
                  <div className="bubble">
                    {m.status === 'loading' ? (
                      <div className="typing">
                        <span /><span /><span />
                      </div>
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                    )}
                    {m.plan && (
                      <PlanCard
                        plan={m.plan}
                        onApprove={handleApprove}
                        onDeny={handleDeny}
                        approving={approving}
                      />
                    )}
                    {m.result !== undefined && <ResultBlock data={m.result} />}
                  </div>
                  <div className={`bubble-meta ${m.role === 'user' ? 'text-right' : ''}`}>
                    {fmt(m.ts)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="input-bar">
            <div className="input-wrap">
              <textarea
                ref={taRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask your agent anything… (⏎ to send, Shift+⏎ for newline)"
                rows={1}
                disabled={loading}
              />
              <button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading}>
                ↑
              </button>
            </div>
            <p className="input-hint">
              Read actions execute immediately · Write actions require your approval
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
