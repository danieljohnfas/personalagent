import { describe, it, expect, vi } from 'vitest';
import { storeMemory, retrieveMemory } from '../src/memory/index.js';
import { db } from '../src/db/client.js';

// Fully mock the drizzle DB client to prevent any live calls
vi.mock('../src/db/client.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-uuid-123' }])
      })
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 'mock-uuid-123', content: 'mock content', score: 0.99 }
          ])
        })
      })
    })
  }
}));

describe('Memory Store', () => {
  it('stores memory and returns an id', async () => {
    const id = await storeMemory('test content', [0.1, 0.2, 0.3]);
    expect(id).toBe('mock-uuid-123');
    expect(db.insert).toHaveBeenCalled();
  });

  it('retrieves memory with scores', async () => {
    const results = await retrieveMemory([0.1, 0.2, 0.3], 5);
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('content', 'mock content');
    expect(results[0]).toHaveProperty('score', 0.99);
    expect(db.select).toHaveBeenCalled();
  });
});
