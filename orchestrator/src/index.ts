import { app } from './server.js';
import { config } from './config.js';

app.listen(config.PORT, () => {
  console.log(`Orchestrator running on port ${config.PORT}`);
  if (config.AGENT_WRITE_DISABLED) {
    console.warn('⚠️ AGENT_WRITE_DISABLED is true. All mutating actions will be rejected.');
  }
});
