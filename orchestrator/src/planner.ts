import crypto from 'crypto';
import { Capability, Plan, Step } from './types.js';

/**
 * Creates a plan from a natural language goal.
 * For now, this uses a simple keyword heuristic. In a real system, 
 * this would call an LLM to produce the steps.
 */
export function createPlan(goal: string, availableCapabilities: Capability[]): Plan {
  const isReversible = /(deploy|delete|send|push|write)/i.test(goal);
  
  const stepId = crypto.randomUUID();
  const step: Step = {
    id: stepId,
    description: `Execute goal: ${goal}`,
    tool: isReversible ? 'system.generic_write' : 'system.generic_read',
    args: { goal },
    reversible: isReversible,
    status: 'pending',
  };

  return {
    id: crypto.randomUUID(),
    goal,
    steps: [step],
    created_at: new Date().toISOString(),
  };
}
