import { describe, it, expect } from 'vitest';
import { createPlan } from '../src/planner.js';

describe('Planner', () => {
  const capabilities: any[] = []; // Mock capabilities list

  it('produces a plan with a reversible step for "deploy"', () => {
    const plan = createPlan('deploy the site', capabilities);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].reversible).toBe(true);
    expect(plan.steps[0].tool).toBe('system.generic_write');
  });

  it('produces a plan with no reversible steps for "summarize"', () => {
    const plan = createPlan('summarize the latest logs', capabilities);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].reversible).toBe(false);
    expect(plan.steps[0].tool).toBe('system.generic_read');
  });

  it('generates valid IDs for the plan and its steps', () => {
    const plan = createPlan('test', capabilities);
    expect(plan.id).toBeDefined();
    expect(plan.steps[0].id).toBeDefined();
  });
});
