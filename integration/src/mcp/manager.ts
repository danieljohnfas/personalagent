import fs from 'fs';
import path from 'path';
import { MCPServerConfig, MCPConfigSchema } from './types.js';
import { MockMCPServer } from './mock_server.js';

export class MCPManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private mockServers: Map<string, MockMCPServer> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const configPath = path.resolve(process.cwd(), '../mcp_config.json');
      if (fs.existsSync(configPath)) {
        const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const config = MCPConfigSchema.parse(rawConfig);
        for (const server of config.servers) {
          this.servers.set(server.name, server);
          if (server.mock_mode || !server.enabled) {
            this.mockServers.set(server.name, new MockMCPServer(server.name));
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load mcp_config.json, running with empty registry.', error);
    }
  }

  public listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  public async call(serverName: string, tool: string, args: unknown): Promise<unknown> {
    const server = this.servers.get(serverName);
    
    // If the server doesn't exist in config, or if it's explicitly marked mock or disabled, route to mock.
    // This is a fail-safe: real execution requires explicit config existence + mock_mode: false + enabled: true.
    if (!server || server.mock_mode || !server.enabled) {
      let mockServer = this.mockServers.get(serverName);
      if (!mockServer) {
        mockServer = new MockMCPServer(serverName);
        this.mockServers.set(serverName, mockServer);
      }
      return mockServer.call(tool, args);
    }

    // Attempting a real call
    throw new Error('Real MCP calls not yet implemented — enable mock_mode: false only after integration testing');
  }
}
