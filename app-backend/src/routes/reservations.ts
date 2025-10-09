import { FastifyPluginAsync } from 'fastify';
import { PrismaClient, ReservationStatus } from '@prisma/client';
import { z } from 'zod';

const reservationsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma as PrismaClient;

  fastify.get(
    '/api/reservations',
    { preHandler: [fastify.authenticate, fastify.requireTenant] },
    async (req: any) => {
      const tenantId = req.tenantId!;
      const items = await prisma.reservation.findMany({
        where: { restaurantId: tenantId },
        orderBy: { reservedAt: 'asc' }
      });
      return { items };
    }
  );

  fastify.post(
    '/api/reservations',
    { preHandler: [fastify.authenticate, fastify.requireTenant] },
    async (req: any, reply) => {
      const tenantId = req.tenantId!;
      const schema = z.object({
        name: z.string(),
        phone: z.string(),
        guests: z.number().int().min(1),
        reservedAt: z.string(),
        notes: z.string().optional()
      });
      const body = schema.parse(req.body);

      const r = await prisma.reservation.create({
        data: {
          restaurantId: tenantId,
          name: body.name,
          phone: body.phone,
          guests: body.guests,
          reservedAt: new Date(body.reservedAt),
          createdById: req.user.sub,
          status: ReservationStatus.PENDING,
          notes: body.notes ?? null
        }
      });
      reply.send({ ok: true, id: r.id });
    }
  );

  fastify.patch(
    '/api/reservations/:id',
    { preHandler: [fastify.authenticate, fastify.requireTenant] },
    async (req: any, reply) => {
      const tenantId = req.tenantId!;
      const id = req.params.id as string;
      const schema = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW']) });
      const body = schema.parse(req.body);

      const reservation = await prisma.reservation.findUnique({ where: { id } });
      if (!reservation) return reply.status(404).send({ error: 'Reservation not found' });
      if (reservation.restaurantId !== tenantId) {
        return reply.status(403).send({ error: 'Cross-tenant access' });
      }

      await prisma.reservation.update({
        where: { id },
        data: { status: body.status }
      });

      reply.send({ ok: true });
    }
  );
};

export default reservationsRoutes;
