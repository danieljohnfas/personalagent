import { z } from 'zod';
import 'dotenv/config';

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required in environment variables' }),
  INTEGRATION_URL: z.string().default('http://localhost:3002'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AGENT_WRITE_DISABLED: z.coerce.boolean().default(false),
  GEMINI_API_KEY: z.string().default(''),
});

export const config = ConfigSchema.parse(process.env);
