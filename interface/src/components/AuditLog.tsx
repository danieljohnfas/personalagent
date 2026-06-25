import React from 'react';

type AuditEntry = {
  id: string;
  action: string;
  timestamp: string;
};

export default function AuditLog({ logs }: { logs: AuditEntry[] }) {
  return (
    <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Recent Agent Actions</h2>
      {logs.length === 0 ? (
        <p>No recent actions.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {logs.map((log) => (
            <li key={log.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
              <span style={{ color: 'gray', marginRight: '1rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span>{log.action}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
