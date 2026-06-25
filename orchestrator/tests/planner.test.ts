import { describe, it, expect, vi } from 'vitest';

// Mock config BEFORE importing the planner so it always hits the dummy fallback path.
vi.mock('../src/config.js', () => ({
  config: { GEMINI_API_KEY: '' },
}));

import { createPlan } from '../src/planner.js';

describe('Planner', () => {
  const capabilities: any[] = [];

  it('produces a plan with a reversible step for "deploy"', async () => {
    const plan = await createPlan('deploy the site', capabilities);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].reversible).toBe(true);
    expect(plan.steps[0].tool).toBe('github.create_issue');
  });

  it('produces a plan with no reversible steps for "summarize"', async () => {
    const plan = await createPlan('summarize the latest logs', capabilities);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].reversible).toBe(false);
    expect(plan.steps[0].tool).toBe('github.list_repos');
  });

  it('generates valid IDs for the plan and its steps', async () => {
    const plan = await createPlan('test', capabilities);
    expect(plan.id).toBeDefined();
    expect(plan.steps[0].id).toBeDefined();
  });
});
