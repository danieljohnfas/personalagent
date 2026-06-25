import 'dotenv/config';
import { app } from './app.js';

const PORT = parseInt(process.env.INTEGRATION_PORT ?? '3002', 10);

app.listen(PORT, () => {
  console.log(`[Integration] Microservice running on http://localhost:${PORT}`);
});
