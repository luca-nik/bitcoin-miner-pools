import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

registerRoutes(app);

const PORT = process.env.PORT || 3001;

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Backend running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
