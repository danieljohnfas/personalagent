import { GoogleGenAI, Type, Schema } from '@google/genai';
import { config } from './config.js';

export type Role = 'user' | 'model' | 'function';

export interface ChatMessage {
  role: Role;
  content: string;
  toolCalls?: any[];
  toolResult?: any;
}

const SYSTEM_INSTRUCTION = `You are a helpful, conversational Personal Agent.
You have access to a variety of tools provided by MCP integration servers.
When a user asks you to do something, use your tools to accomplish it.
After using tools and getting the results, provide a concise, friendly response to the user summarizing what happened.
CRITICAL: Do NOT mention "tools", "MCP", or "schemas" to the user unless absolutely necessary. Just act like a capable assistant.`;

// Convert JSON Schema to Gemini Schema format roughly
function mapJsonSchemaToGeminiSchema(schema: any): Schema {
  if (!schema || typeof schema !== 'object') return { type: Type.STRING };

  let type = Type.STRING;
  if (schema.type === 'string') type = Type.STRING;
  else if (schema.type === 'number') type = Type.NUMBER;
  else if (schema.type === 'integer') type = Type.INTEGER;
  else if (schema.type === 'boolean') type = Type.BOOLEAN;
  else if (schema.type === 'array') type = Type.ARRAY;
  else if (schema.type === 'object') type = Type.OBJECT;

  const result: Schema = { type };

  if (schema.description) result.description = schema.description;

  if (type === Type.OBJECT && schema.properties) {
    result.properties = {};
    for (const key in schema.properties) {
      result.properties[key] = mapJsonSchemaToGeminiSchema(schema.properties[key]);
    }
  }

  if (type === Type.ARRAY && schema.items) {
    result.items = mapJsonSchemaToGeminiSchema(schema.items);
  }

  if (schema.required) {
    result.required = schema.required;
  }

  return result;
}

async function geminiCompletion(messages: ChatMessage[], availableTools: any[]) {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  const functionDeclarations = availableTools.flatMap(server => {
    return server.tools.map((t: any) => ({
      name: `${server.server}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      description: t.description || 'No description provided',
      parameters: mapJsonSchemaToGeminiSchema(t.inputSchema)
    }));
  });

  const geminiMessages = messages.map(msg => {
    if (msg.role === 'function') {
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.toolResult?.name || 'unknown',
            response: msg.toolResult?.result || { status: 'ok' }
          }
        }]
      };
    }
    
    const parts: any[] = [];
    if (msg.content) parts.push({ text: msg.content });
    if (msg.toolCalls) {
      msg.toolCalls.forEach(tc => {
        parts.push({
          functionCall: {
            name: tc.name,
            args: tc.args
          }
        });
      });
    }

    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts
    };
  });

  const aiConfig: any = {
    temperature: 0.2,
    systemInstruction: SYSTEM_INSTRUCTION
  };

  if (functionDeclarations.length > 0) {
    aiConfig.tools = [{ functionDeclarations }];
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: geminiMessages,
    config: aiConfig
  });

  let text = '';
  const toolCalls: any[] = [];

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args
        });
      }
    }
  }

  return {
    text: text.trim(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  };
}

async function openRouterCompletion(messages: ChatMessage[], availableTools: any[]) {
  // Translate MCP schemas to OpenAI tools
  const tools = availableTools.flatMap(server => {
    return server.tools.map((t: any) => ({
      type: "function",
      function: {
        name: `${server.server}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        description: t.description || 'No description provided',
        parameters: t.inputSchema || { type: "object", properties: {} }
      }
    }));
  });

  // Map messages to OpenAI format
  let openAIMessages: any[] = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
  
  messages.forEach((msg, idx) => {
    if (msg.role === 'function') {
      openAIMessages.push({
        role: 'tool',
        tool_call_id: `call_${idx}`,
        name: msg.toolResult?.name || 'unknown',
        content: JSON.stringify(msg.toolResult?.result || { status: 'ok' })
      });
    } else if (msg.role === 'model') {
      const assistantMsg: any = { role: 'assistant', content: msg.content || '' };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc, tcIdx) => ({
          id: `call_${idx + 1}`, // The next function msg will be idx+1
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args)
          }
        }));
      }
      openAIMessages.push(assistantMsg);
    } else {
      openAIMessages.push({
        role: 'user',
        content: msg.content
      });
    }
  });

  const body = {
    // google/gemini-2.5-flash:free or meta-llama/llama-3-8b-instruct:free
    model: 'meta-llama/llama-3-8b-instruct:free',
    messages: openAIMessages,
    temperature: 0.2,
    tools: tools.length > 0 ? tools : undefined
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/danieljohnfas/personalagent',
      'X-Title': 'Personal Agent'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${text}`);
  }

  const data = await response.json() as any;
  const choice = data.choices[0];
  const msg = choice.message;

  let text = msg.content || '';
  const toolCalls: any[] = [];

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      if (tc.type === 'function') {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (e) {
          console.warn("Failed to parse tool call args from OpenRouter", tc.function.arguments);
        }
        toolCalls.push({
          name: tc.function.name,
          args
        });
      }
    }
  }

  return {
    text: text.trim(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  };
}

export async function chatCompletion(messages: ChatMessage[], availableTools: any[]) {
  // INTERNAL ROUTER:
  // If OPENROUTER_API_KEY is available, we route the request there (Llama 3 8B Free).
  // This bypasses Gemini's restrictions and stays 100% free.
  if (config.OPENROUTER_API_KEY) {
    try {
      console.log("[Router] Routing request to OpenRouter (Llama 3 8B Free)");
      return await openRouterCompletion(messages, availableTools);
    } catch (e: any) {
      console.error("[Router] OpenRouter failed, falling back to Gemini:", e.message);
    }
  }

  // Fallback to Gemini if OpenRouter fails or is not configured
  if (!config.GEMINI_API_KEY) {
    throw new Error('Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured.');
  }
  
  console.log("[Router] Routing request to Gemini");
  return await geminiCompletion(messages, availableTools);
}
