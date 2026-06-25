import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerConfig, MCPConfigSchema } from './types.js';
import { MockMCPServer } from './mock_server.js';

/**
 * MCPManager: Reads mcp_config.json, resolves env-var keys to their live values,
 * and routes tool calls either to a real MCP subprocess (via the SDK stdio transport)
 * or the safe MockMCPServer fallback.
 *
 * env values in mcp_config.json are interpreted as ENVIRONMENT VARIABLE NAMES,
 * not raw secrets — the real values are resolved at runtime from process.env.
 */
export class MCPManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private mockServers: Map<string, MockMCPServer> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Walk up from integration/ to find mcp_config.json at the project root
    const configPath = path.resolve(process.cwd(), '../mcp_config.json');
    try {
      if (fs.existsSync(configPath)) {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const config = MCPConfigSchema.parse(raw);
        for (const server of config.servers) {
          this.servers.set(server.name, server);
          if (server.mock_mode || !server.enabled) {
            this.mockServers.set(server.name, new MockMCPServer(server.name));
          }
        }
        console.log(`[MCPManager] Loaded ${config.servers.length} server(s) from ${configPath}`);
      } else {
        console.warn(`[MCPManager] No mcp_config.json found at ${configPath}. Running empty.`);
      }
    } catch (error) {
      console.warn('[MCPManager] Failed to parse mcp_config.json:', error);
    }
  }

  /** Resolve env key references to real values from process.env */
  private resolveEnv(envMap: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, envVarName] of Object.entries(envMap)) {
      const value = process.env[envVarName];
      if (!value) {
        throw new Error(
          `[MCPManager] Required env var "${envVarName}" for key "${key}" is not set. ` +
          `Check your orchestrator/.env file.`
        );
      }
      resolved[key] = value;
    }
    return resolved;
  }

  public listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  /** List all tools available across all enabled real servers */
  public async listAllTools(): Promise<Array<{ server: string; tools: unknown[] }>> {
    const results = [];
    for (const server of this.servers.values()) {
      if (!server.enabled || server.mock_mode) continue;
      try {
        const tools = await this.getTools(server);
        results.push({ server: server.name, tools });
      } catch (err) {
        console.warn(`[MCPManager] Could not list tools for ${server.name}:`, err);
      }
    }
    return results;
  }

  private async getTools(server: MCPServerConfig): Promise<unknown[]> {
    const resolvedEnv = this.resolveEnv(server.env);
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...process.env as Record<string, string>, ...resolvedEnv },
    });
    const client = new Client({ name: 'partner-integration', version: '0.1.0' });
    await client.connect(transport);
    try {
      const res = await client.listTools();
      return res.tools;
    } finally {
      await client.close();
    }
  }

  public async call(serverName: string, tool: string, args: unknown): Promise<unknown> {
    const server = this.servers.get(serverName);

    // Fail-safe: if not configured as live, always use mock
    if (!server || server.mock_mode || !server.enabled) {
      let mock = this.mockServers.get(serverName);
      if (!mock) {
        mock = new MockMCPServer(serverName);
        this.mockServers.set(serverName, mock);
      }
      return mock.call(tool, args);
    }

    // Real call: spawn the MCP server subprocess via stdio
    console.log(`[MCPManager] Live call → ${serverName}.${tool}`);
    const resolvedEnv = this.resolveEnv(server.env);

    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...process.env as Record<string, string>, ...resolvedEnv },
    });

    const client = new Client({ name: 'partner-integration', version: '0.1.0' });
    await client.connect(transport);

    try {
      const result = await client.callTool({ name: tool, arguments: args as Record<string, unknown> });
      return result;
    } finally {
      // Always close the subprocess — we are stateless between calls
      await client.close();
    }
  }
}
