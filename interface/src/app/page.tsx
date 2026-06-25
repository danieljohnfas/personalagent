import React from 'react';

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Personal Agent Platform</h1>
      <p>This is the primary chat interface for your agent.</p>
      
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Chat Window</h2>
        <p><em>Agent: Hello! I&apos;m ready to help you manage your digital life.</em></p>
        <input type="text" placeholder="Type a message..." style={{ width: '100%', padding: '0.5rem' }} />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <a href="/dashboard" style={{ color: 'blue' }}>Go to Dashboard & Approvals</a>
      </div>
    </main>
  );
}
