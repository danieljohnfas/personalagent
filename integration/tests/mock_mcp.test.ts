import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockMCPServer } from '../src/mcp/mock_server.js';
import { MCPManager } from '../src/mcp/manager.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path', () => {
  return {
    default: {
      resolve: vi.fn(),
    },
    resolve: vi.fn(),
  };
});

describe('MCP Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(path.resolve).mockReturnValue('/mock/mcp_config.json');
  });

  describe('MockMCPServer', () => {
    it('should return a mock result for any tool call', async () => {
      const server = new MockMCPServer('test-server');
      const result = await server.call('any-tool', { foo: 'bar' });
      
      expect(result).toEqual({
        result: 'mock',
        server: 'test-server',
        tool: 'any-tool',
        args: { foo: 'bar' }
      });
    });
  });

  describe('MCPManager', () => {
    it('routes to mock when mock_mode is true', async () => {
      // Mock fs to return a config with mock_mode: true
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({
        servers: [
          {
            name: 'test-server',
            command: 'echo',
            enabled: true,
            mock_mode: true
          }
        ]
      }));

      const manager = new MCPManager();
      const result = await manager.call('test-server', 'tool', {});
      
      expect(result).toHaveProperty('result', 'mock');
    });

    it('throws "not yet implemented" error when attempting real call', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({
        servers: [
          {
            name: 'real-server',
            command: 'echo',
            enabled: true,
            mock_mode: false // Triggers real call attempt
          }
        ]
      }));

      const manager = new MCPManager();
      await expect(manager.call('real-server', 'tool', {}))
        .rejects
        .toThrow('Real MCP calls not yet implemented');
    });

    it('routes to mock for unknown server name (safe fallback)', async () => {
      (fs.existsSync as any).mockReturnValue(false); // No config
      const manager = new MCPManager();
      
      const result = await manager.call('unknown-server', 'tool', {});
      expect(result).toHaveProperty('result', 'mock');
    });
  });
});
