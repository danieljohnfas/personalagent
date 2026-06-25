/**
 * A mock MCP server that unconditionally accepts any tool call and returns safe dummy data.
 * Used as the default integration test layer before real credentials are added.
 */
export class MockMCPServer {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async call(tool: string, args: unknown): Promise<unknown> {
    console.log(`[MOCK][${this.name}] Executed tool: ${tool}`);
    
    // For testing safety, never throw — just return what we received
    return {
      result: 'mock',
      server: this.name,
      tool,
      args
    };
  }
}
