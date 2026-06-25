import { GoogleGenAI, Type, Schema } from '@google/genai';
import { config } from './config.js';

export type Role = 'user' | 'model' | 'function';

export interface ChatMessage {
  role: Role;
  content: string;
  toolCalls?: any[];
  toolResult?: any;
}

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

export async function chatCompletion(messages: ChatMessage[], availableTools: any[]) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing');
  }

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
    systemInstruction: `You are a helpful, conversational Personal Agent.
You have access to a variety of tools provided by MCP integration servers.
When a user asks you to do something, use your tools to accomplish it.
After using tools and getting the results, provide a concise, friendly response to the user summarizing what happened.
CRITICAL: Do NOT mention "tools", "MCP", or "schemas" to the user unless absolutely necessary. Just act like a capable assistant.`
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
