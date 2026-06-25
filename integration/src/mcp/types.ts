import { z } from 'zod';

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  // Environment variables needed by the server. 
  // IMPORTANT: The values here are keys for the secrets manager, NOT the raw secret values.
  env: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(false),
  mock_mode: z.boolean().default(true),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const MCPConfigSchema = z.object({
  servers: z.array(MCPServerConfigSchema).default([]),
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;
