import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { FastifyReply, FastifyRequest } from 'fastify';

interface AuthenticatedRequest extends FastifyRequest {
  user?: unknown;
}

export default fp(async (fastify) => {
  fastify.register(cookie);
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev_secret_change_me',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const authorization = request.headers.authorization;
        const tokenFromHeader =
          authorization && authorization.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : authorization;

        const token = request.cookies?.token ?? tokenFromHeader;

        if (!token) {
          return reply.status(401).send({ error: 'Missing token' });
        }

        const payload = await request.server.jwt.verify(token);
        (request as AuthenticatedRequest).user = payload;
      } catch (error) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  );
});
