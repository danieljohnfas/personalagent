import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'express-async-errors';
import { config } from './config.js';
import { registry } from './registry.js';
import { createPlan } from './planner.js';
import { getPendingApprovals, resolveApproval } from './approval.js';
import { executeStep } from './router.js';

export const app = express();

app.use(express.json());
app.use(cors({ origin: true })); // In prod, restrict to frontend URL

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', write_disabled: config.AGENT_WRITE_DISABLED });
});

router.get('/capabilities', (req, res) => {
  res.json(registry.listCapabilities());
});

router.post('/plan', (req, res) => {
  const { goal } = req.body;
  if (!goal) return res.status(400).json({ error: 'goal is required' });
  const plan = createPlan(goal, registry.listCapabilities());
  res.json(plan);
});

router.get('/approvals', (req, res) => {
  res.json(getPendingApprovals());
});

router.post('/approvals/:planId/:stepId/resolve', (req, res) => {
  const { planId, stepId } = req.params;
  const { approved, token } = req.body;
  
  try {
    resolveApproval(planId, stepId, approved, token);
    res.json({ success: true });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  const { step } = req.body; // Full step object for now
  try {
    const result = await executeStep(step);
    res.json({ result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.use('/api/v1', router);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
