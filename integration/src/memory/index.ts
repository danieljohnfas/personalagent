import { cosineDistance, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agentMemory } from '../db/schema.js';

/**
 * Stores a new memory block with its vector embedding.
 */
export async function storeMemory(content: string, embedding: number[], tags: string[] = []): Promise<string> {
  const [result] = await db.insert(agentMemory)
    .values({
      content,
      embedding,
      tags,
    })
    .returning({ id: agentMemory.id });

  if (!result) {
    throw new Error('Failed to store memory');
  }
  
  return result.id;
}

/**
 * Retrieves the most relevant memories using cosine similarity via pgvector.
 */
export async function retrieveMemory(
  queryEmbedding: number[], 
  topK: number = 5
): Promise<Array<{id: string, content: string, score: number}>> {
  
  const similarity = sql<number>`1 - (${cosineDistance(agentMemory.embedding, queryEmbedding)})`;
  
  const results = await db.select({
    id: agentMemory.id,
    content: agentMemory.content,
    score: similarity,
  })
  .from(agentMemory)
  .orderBy(desc(similarity))
  .limit(topK);

  return results;
}
