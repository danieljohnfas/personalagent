import { Router } from 'express';
import { db } from './db/client.js';
import { conversations, messages } from './db/schema.js';
import { eq, asc } from 'drizzle-orm';

export const chatRouter = Router();

// Get all conversations for a user
chatRouter.get('/conversations', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'x-user-id header required' });

  try {
    const list = await db.select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(asc(conversations.createdAt));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new conversation
chatRouter.post('/conversations', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'x-user-id header required' });

  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const newConv = await db.insert(conversations).values({
      userId,
      title
    }).returning();
    res.json(newConv[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a conversation
chatRouter.get('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  try {
    const list = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    
    // Map JSONB arrays back to objects for the client
    const mapped = list.map(m => ({
      ...m,
      toolCalls: m.toolCalls ? (m.toolCalls as any) : undefined,
      toolResult: m.toolResult ? (m.toolResult as any) : undefined
    }));
    res.json(mapped);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add a message to a conversation
chatRouter.post('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { role, content, toolCalls, toolResult } = req.body;
  
  if (!role) return res.status(400).json({ error: 'role is required' });

  try {
    const newMsg = await db.insert(messages).values({
      conversationId: id,
      role,
      content: content || '',
      toolCalls: toolCalls || null,
      toolResult: toolResult || null,
    }).returning();
    res.json(newMsg[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
