import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type RequestUser = {
  sub: string;
  role: string;
  restaurantId?: string | null;
};

const prisma = new PrismaClient();

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string | null;
    user?: RequestUser;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
    requireTenant(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('prisma', prisma);

  fastify.decorate(
    'requireTenant',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: 'No user in request' });
      }

      if (user.role === 'SUPERADMIN') {
        request.tenantId = user.restaurantId ?? null;
        return;
      }

      if (!user.restaurantId) {
        return reply.status(403).send({ error: 'No tenant in token' });
      }

      request.tenantId = user.restaurantId;

      const dbUser = await prisma.user.findUnique({ where: { id: user.sub } });
      if (!dbUser || !dbUser.active) {
        return reply.status(403).send({ error: 'User inactive' });
      }
    }
  );
});
