import React from 'react';

type ApprovalProps = {
  planId: string;
  stepId: string;
  description: string;
  onApprove: (planId: string, stepId: string) => void;
  onDeny: (planId: string, stepId: string) => void;
};

export default function ApprovalCard({ planId, stepId, description, onApprove, onDeny }: ApprovalProps) {
  return (
    <div style={{ padding: '1rem', border: '1px solid orange', borderRadius: '8px', backgroundColor: '#fff3cd', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem 0' }}>Action Required</h3>
      <p style={{ margin: '0 0 1rem 0' }}><strong>Action:</strong> <code>{description}</code></p>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          onClick={() => onApprove(planId, stepId)}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Approve
        </button>
        <button 
          onClick={() => onDeny(planId, stepId)}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}
