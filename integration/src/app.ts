import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'express-async-errors';
import { MCPManager } from './mcp/manager.js';

export const app = express();
app.use(express.json());
app.use(cors({ origin: true }));

const mcpManager = new MCPManager();

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', layer: 'integration' });
});

router.post('/execute', async (req, res) => {
  const { serverName, tool, args } = req.body;
  if (!serverName || !tool) {
    return res.status(400).json({ error: 'serverName and tool are required' });
  }

  try {
    const result = await mcpManager.call(serverName, tool, args || {});
    res.json({ result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// To fetch available tools for planner
router.get('/tools', async (req, res) => {
  try {
    const tools = await mcpManager.listAllTools();
    res.json({ tools });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.use('/api', router);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Integration API Error]', err);
  res.status(500).json({ error: err.message });
});
