import Fastify from 'fastify';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import jwtPlugin from './plugins/jwt.js';
import tenancyPlugin from './plugins/tenancy.js';
import authRoutes from './routes/auth.js';
import reservationsRoutes from './routes/reservations.js';

dotenv.config();

const app = Fastify({ logger: true });
app.register(formbody);
app.register(jwtPlugin);
app.register(tenancyPlugin);

app.register(authRoutes);
app.register(reservationsRoutes);

const port = Number(process.env.PORT || 3000);
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`API ready on http://localhost:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
