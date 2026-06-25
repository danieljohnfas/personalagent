import React from 'react';

export default function Dashboard() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Agent Dashboard & Approvals</h1>
      <p>This is where you review and approve reversible agent actions.</p>
      
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid orange', borderRadius: '8px', backgroundColor: '#fff3cd' }}>
        <h2>Pending Approvals</h2>
        <p><strong>Action:</strong> <code>Deploy to Vercel</code></p>
        <button style={{ marginRight: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>Approve</button>
        <button style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Deny</button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <a href="/" style={{ color: 'blue' }}>Back to Chat</a>
      </div>
    </main>
  );
}
