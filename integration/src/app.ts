import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'express-async-errors';
import { MCPManager } from './mcp/manager.js';
import { authRouter } from './auth.js';
import { chatRouter } from './chat.js';
import { WEB_TOOLS, callWebTool } from './web/index.js';

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

  // Built-in web tools — no subprocess needed
  if (serverName === 'web') {
    try {
      const result = await callWebTool(tool, args || {});
      return res.json({ result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: msg });
    }
  }

  try {
    const result = await mcpManager.call(serverName, tool, args || {});
    res.json({ result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// To fetch available tools for planner
router.get('/tools', async (req, res) => {
  try {
    const mcpTools = await mcpManager.listAllTools();
    // Append built-in web tools as a virtual "web" server
    const allTools = [
      ...mcpTools,
      { server: 'web', tools: WEB_TOOLS },
    ];
    res.json({ tools: allTools });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api', router);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Integration API Error]', err);
  res.status(500).json({ error: err.message });
});

