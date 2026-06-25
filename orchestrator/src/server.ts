import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import 'express-async-errors';
import { config } from './config.js';
import { registry } from './registry.js';
import { createPlan } from './planner.js';
import { getPendingApprovals, resolveApproval } from './approval.js';
import { executeStep } from './router.js';
import { chatCompletion, ChatMessage } from './agent.js';

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

router.post('/plan', async (req, res) => {
  const { goal } = req.body;
  if (!goal) return res.status(400).json({ error: 'goal is required' });

  try {
    // 1. Fetch live tool schemas from the Integration layer
    const toolsRes = await fetch(`${config.INTEGRATION_URL}/api/tools`);
    const toolsData = toolsRes.ok ? await toolsRes.json() as { tools: any[] } : { tools: [] };
    
    // 2. Generate the execution plan using the LLM and the real tool schemas
    const plan = await createPlan(goal, toolsData.tools);
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  const { messages } = req.body as { messages: ChatMessage[] };
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

  try {
    const toolsRes = await fetch(`${config.INTEGRATION_URL}/api/tools`);
    const toolsData = toolsRes.ok ? await toolsRes.json() as { tools: any[] } : { tools: [] };
    
    const response = await chatCompletion(messages, toolsData.tools);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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
  const { toolCall, reversible, token } = req.body;
  try {
    if (reversible && config.AGENT_WRITE_DISABLED) {
      return res.status(403).json({ error: 'Agent write actions are currently disabled.' });
    }
    
    if (reversible) {
      if (!token) return res.status(401).json({ error: 'Approval token is required for write actions.' });
      if (!config.JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET not configured on server.' });
      try {
        jwt.verify(token, config.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid approval token.' });
      }
    }

    // Support both "server.tool" and "server__tool"
    let serverName = '';
    let toolName = '';
    
    const toolString = toolCall.name || toolCall.tool;
    if (toolString.includes('__')) {
      [serverName, toolName] = toolString.split('__');
    } else {
      const dotIndex = toolString.indexOf('.');
      if (dotIndex === -1) throw new Error(`Invalid tool format "${toolString}"`);
      serverName = toolString.slice(0, dotIndex);
      toolName = toolString.slice(dotIndex + 1);
    }

    const integrationUrl = `${config.INTEGRATION_URL}/api/execute`;
    const response = await fetch(integrationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName, tool: toolName, args: toolCall.args ?? {} }),
    });

    if (!response.ok) {
      throw new Error(`Integration layer returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { result: unknown };
    res.json({ result: data.result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Proxy Auth routes to Integration layer
router.get('/auth/google/url', async (req, res) => {
  try {
    const response = await fetch(`${config.INTEGRATION_URL}/api/auth/google/url`);
    res.json(await response.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/auth/connections', async (req, res) => {
  try {
    const response = await fetch(`${config.INTEGRATION_URL}/api/auth/connections`);
    res.json(await response.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/v1', router);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
