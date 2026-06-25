'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

let orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001/api/v1';
if (orchestratorUrl.endsWith('/')) orchestratorUrl = orchestratorUrl.slice(0, -1);
if (!orchestratorUrl.endsWith('/api/v1')) orchestratorUrl += '/api/v1';
const ORCHESTRATOR = orchestratorUrl;
const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET || 'super_secret_dev_passphrase_123';

type Role = 'agent' | 'user' | 'function';
type MsgStatus = 'ok' | 'error' | 'loading';

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  reversible: boolean;
  status: 'pending' | 'approved' | 'denied' | 'executing' | 'done' | 'failed';
  result?: unknown;
}

interface Message {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: { name: string; result: unknown };
  status?: MsgStatus;
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

function ToolCard({ toolCall, onApprove, onDeny, approving }: {
  toolCall: ToolCall;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  approving: string | null;
}) {
  return (
    <div className="plan-card" style={{ marginTop: 8 }}>
      <div className="plan-card-header">
        {toolCall.reversible ? '✍ WRITE ACTION' : '👁 READ ACTION'}
      </div>
      <div className="plan-step">
        <div style={{ flex: 1 }}>
          <div className="step-desc" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {toolCall.name}({JSON.stringify(toolCall.args)})
          </div>
          
          {toolCall.reversible && toolCall.status === 'pending' && (
            <div className="approval-actions" style={{ marginTop: 8 }}>
              <button
                className="btn btn-success"
                onClick={() => onApprove(toolCall.id)}
                disabled={approving === toolCall.id}
              >
                {approving === toolCall.id ? '...' : '✓ Approve'}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onDeny(toolCall.id)}
                disabled={approving === toolCall.id}
              >
                ✕ Deny
              </button>
            </div>
          )}
          {toolCall.status === 'executing' && (
            <span className="step-pill" style={{ marginTop: 6, display: 'inline-block' }}>Executing...</span>
          )}
          {toolCall.status === 'done' && toolCall.reversible && (
            <span className="step-pill approved" style={{ marginTop: 6, display: 'inline-block' }}>✓ Approved & Executed</span>
          )}
          {toolCall.status === 'denied' && (
            <span className="step-pill" style={{ marginTop: 6, display: 'inline-block', background: '#442222', color: '#ffaaaa' }}>✕ Denied</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
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

  // Check if we need to auto-continue the loop
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // If the last message is from the model and has tool calls that are pending and NOT reversible
    // we should auto-execute them.
    if (lastMessage.role === 'agent' && lastMessage.toolCalls) {
      const pendingReads = lastMessage.toolCalls.filter(tc => !tc.reversible && tc.status === 'pending');
      if (pendingReads.length > 0) {
        executeTools(lastMessage.id, pendingReads);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function processChatLoop(currentMessages: Message[]) {
    try {
      setLoading(true);
      
      const apiMessages = currentMessages.map(m => {
        // Convert to backend format
        const role = m.role === 'agent' ? 'model' : m.role;
        return {
          role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolResult: m.toolResult
        };
      });

      const res = await fetch(`${ORCHESTRATOR}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });
      
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { text: string, toolCalls?: { name: string, args: Record<string, unknown> }[] };

      const newMsg: Message = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: data.text,
        ts: new Date(),
        status: 'ok',
      };

      if (data.toolCalls) {
        newMsg.toolCalls = data.toolCalls.map(tc => ({
          id: crypto.randomUUID(),
          name: tc.name,
          args: tc.args,
          reversible: /create|update|delete|write|push|post/i.test(tc.name),
          status: 'pending'
        }));
      }

      setMessages(prev => [...prev, newMsg]);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'agent', content: `❌ ${msg}`, status: 'error', ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  }

  async function executeTools(messageId: string, toolsToExec: ToolCall[], overrideToken?: string) {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const updatedCalls = m.toolCalls?.map(tc => 
        toolsToExec.some(t => t.id === tc.id) ? { ...tc, status: 'executing' as const } : tc
      );
      return { ...m, toolCalls: updatedCalls };
    }));

    let resultsAdded = false;
    const newHistory = [...messages];

    for (const tc of toolsToExec) {
      try {
        const execRes = await fetch(`${ORCHESTRATOR}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolCall: tc, reversible: tc.reversible, token: overrideToken }),
        });
        
        let resultData: unknown;
        if (!execRes.ok) {
          resultData = { error: await execRes.text() };
        } else {
          const { result } = await execRes.json() as { result: unknown };
          resultData = result;
        }

        // Add function result to history
        newHistory.push({
          id: crypto.randomUUID(),
          role: 'function',
          content: '',
          toolResult: { name: tc.name, result: resultData },
          ts: new Date()
        });
        resultsAdded = true;

        // Mark tool as done
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const updatedCalls = m.toolCalls?.map(call => 
            call.id === tc.id ? { ...call, status: 'done' as const, result: resultData } : call
          );
          return { ...m, toolCalls: updatedCalls };
        }));

      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        newHistory.push({
          id: crypto.randomUUID(),
          role: 'function',
          content: '',
          toolResult: { name: tc.name, result: { error: errorMsg } },
          ts: new Date()
        });
        resultsAdded = true;
        
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const updatedCalls = m.toolCalls?.map(call => 
            call.id === tc.id ? { ...call, status: 'failed' as const } : call
          );
          return { ...m, toolCalls: updatedCalls };
        }));
      }
    }

    if (resultsAdded) {
      // Re-trigger the chat loop with the new tool results so the LLM can respond
      processChatLoop(newHistory);
    }
  }

  async function send(goal?: string) {
    const text = (goal ?? input).trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, ts: new Date() };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    
    processChatLoop(currentMessages);
  }

  async function handleApprove(toolCallId: string) {
    setApproving(toolCallId);
    
    // Find the message containing this toolCall
    const msg = messages.find(m => m.toolCalls?.some(tc => tc.id === toolCallId));
    if (!msg) return;
    
    const tc = msg.toolCalls!.find(tc => tc.id === toolCallId)!;
    
    await executeTools(msg.id, [tc], JWT_SECRET);
    
    setApproving(null);
  }

  async function handleDeny(toolCallId: string) {
    const msg = messages.find(m => m.toolCalls?.some(tc => tc.id === toolCallId));
    if (!msg) return;
    const tc = msg.toolCalls!.find(tc => tc.id === toolCallId)!;

    // Mark as denied
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const updatedCalls = m.toolCalls?.map(call => 
        call.id === tc.id ? { ...call, status: 'denied' as const } : call
      );
      return { ...m, toolCalls: updatedCalls };
    }));

    // Push denial to history and resume loop
    const newHistory = [...messages, {
      id: crypto.randomUUID(),
      role: 'function' as Role,
      content: '',
      toolResult: { name: tc.name, result: { error: 'User explicitly denied this action.' } },
      ts: new Date()
    }];
    
    processChatLoop(newHistory);
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
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🤖</div>
          <div className="logo-text">Partner <span>v0.1</span></div>
        </div>
        <Link href="/" className="nav-item active">💬 Chat</Link>
        <Link href="/dashboard" className="nav-item">
          🛡 Approvals
        </Link>
        <div className="sidebar-footer">
          <div className="status-dot">
            <span className="dot" /> Agent online
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="chat-layout">
          <header className="chat-header">
            <div className="avatar agent" style={{ width: 28, height: 28, fontSize: 13 }}>🤖</div>
            <div>
              <h1>Personal Agent</h1>
              <p>Conversational Agent Loop Active</p>
            </div>
          </header>

          <div className="messages">
            {showWelcome && (
              <div className="welcome-banner">
                <div className="welcome-emoji">✨</div>
                <div>
                  <div className="welcome-title">Your agent is ready</div>
                  <div className="welcome-desc">
                    Ask me anything! I will now interact conversationally and seamlessly execute tools in the background. Write actions will still prompt for your approval.
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

            {messages.filter(m => m.role !== 'function').map(m => (
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
                      <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                    )}
                    
                    {m.toolCalls && m.toolCalls.map(tc => (
                      <ToolCard
                        key={tc.id}
                        toolCall={tc}
                        onApprove={handleApprove}
                        onDeny={handleDeny}
                        approving={approving}
                      />
                    ))}
                    {m.toolResult && m.toolResult.result !== undefined && <ResultBlock data={m.toolResult.result} />}
                  </div>
                  <div className={`bubble-meta ${m.role === 'user' ? 'text-right' : ''}`}>
                    {fmt(m.ts)}
                  </div>
                </div>
              </div>
            ))}
            {loading && messages.length > 0 && messages[messages.length-1].role !== 'agent' && (
              <div className="message agent">
                <div className="avatar agent">🤖</div>
                <div className="bubble">
                  <div className="typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
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
