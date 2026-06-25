import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { Plan, Step } from './types.js';
import { config } from './config.js';

/**
 * Creates an execution plan using Gemini 1.5 Flash.
 */
export async function createPlan(goal: string, availableTools: any[]): Promise<Plan> {
  // If no API key, fallback to a dummy heuristic plan (useful for tests or setup phase)
  if (!config.GEMINI_API_KEY) {
    console.warn('[Planner] GEMINI_API_KEY is missing. Falling back to dummy planner.');
    const isReversible = /(deploy|delete|send|push|write|create|update)/i.test(goal);
    return {
      id: crypto.randomUUID(),
      goal,
      steps: [{
        id: crypto.randomUUID(),
        description: `Execute goal: ${goal}`,
        tool: isReversible ? 'github.create_issue' : 'github.list_repos',
        args: {},
        reversible: isReversible,
        status: 'pending',
      }],
      created_at: new Date().toISOString(),
    };
  }

  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  // Format the available tools for the prompt
  const toolDescriptions = availableTools.map(server => {
    return server.tools.map((t: any) => `
- Tool: "${server.server}.${t.name}"
  Description: ${t.description}
  Reversible (requires approval): ${t.name.match(/create|update|delete|write|push|post/i) ? 'YES' : 'NO'}
  Schema: ${JSON.stringify(t.inputSchema)}
`).join('\n');
  }).join('\n');

  const systemPrompt = `
You are the planning engine for a Personal Agent Platform.
Your job is to read a user's goal and output a JSON array of steps required to accomplish that goal using ONLY the available tools.

AVAILABLE TOOLS:
${toolDescriptions}

RULES:
1. You must return ONLY a JSON array of step objects. No markdown, no backticks, no explanations.
2. Each step object must exactly match this schema:
   {
     "description": "Human-readable description of what this step does",
     "tool": "serverName.toolName" (e.g., "github.search_repositories"),
     "args": { "key": "value" },
     "reversible": true or false
   }
3. Set "reversible" to true IF AND ONLY IF the tool modifies state (creates, updates, deletes, writes). If it only reads data, set to false.
4. Try to accomplish the goal in as few steps as possible. Usually 1 step is enough, but some complex goals might require 2 or 3 sequential steps.
5. IF the goal asks for something you don't have a tool for, output a single step with the tool "system.error" and args { "message": "I cannot do that" }.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: goal,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
      }
    });

    const text = response.text || '[]';
    // Clean up potential markdown code blocks
    const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const generatedSteps = JSON.parse(cleaned);

    const steps: Step[] = generatedSteps.map((s: any) => ({
      id: crypto.randomUUID(),
      description: s.description || 'Unknown action',
      tool: s.tool || 'unknown',
      args: s.args || {},
      reversible: Boolean(s.reversible),
      status: 'pending',
    }));

    return {
      id: crypto.randomUUID(),
      goal,
      steps,
      created_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[Planner] LLM Error:', error);
    throw new Error(`Failed to generate plan: ${error.message}`);
  }
}
