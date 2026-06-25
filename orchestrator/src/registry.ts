import { Capability } from './types.js';

class Registry {
  private capabilities: Map<string, Capability> = new Map();

  registerCapability(cap: Capability): void {
    this.capabilities.set(cap.name, cap);
  }

  getCapability(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  listCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }
}

export const registry = new Registry();

// Pre-register some safe, read-only built-in capabilities
registry.registerCapability({
  name: 'memory.search',
  description: 'Search the agent memory using semantic similarity',
  reversible: false,
  schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
});

registry.registerCapability({
  name: 'audit.list',
  description: 'List recent actions from the audit log',
  reversible: false,
  schema: { type: 'object', properties: { limit: { type: 'number' } } }
});

registry.registerCapability({
  name: 'system.status',
  description: 'Get current system health and status',
  reversible: false,
  schema: { type: 'object', properties: {} }
});
