import { UserRole } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/bootstrap', async (req, reply) => {
    const bodySchema = z.object({
      name: z.string(),
      email: z.string().email(),
      passwordHash: z.string().min(10),
    });

    const body = bodySchema.parse(req.body);

    const exists = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (exists) {
      return reply.status(400).send({ error: 'Already exists' });
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: body.passwordHash,
        role: UserRole.SUPERADMIN,
      },
    });

    return reply.send({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  fastify.post('/api/auth/login', async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      passwordHash: z.string().min(10),
    });

    const body = bodySchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user || user.passwordHash !== body.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = await reply.jwtSign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId || null,
      },
      { expiresIn: '1d' },
    );

    reply.setCookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });

    return reply.send({
      ok: true,
      role: user.role,
      restaurantId: user.restaurantId || null,
    });
  });

  fastify.post(
    '/api/restaurants',
    { preHandler: [fastify.authenticate as any] },
    async (req: any, reply) => {
      if (req.user.role !== 'SUPERADMIN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const schema = z.object({
        name: z.string().min(2),
        owner: z.object({
          name: z.string(),
          email: z.string().email(),
          passwordHash: z.string().min(10),
        }),
      });

      const body = schema.parse(req.body);

      const restaurant = await prisma.restaurant.create({
        data: { name: body.name },
      });

      const owner = await prisma.user.create({
        data: {
          name: body.owner.name,
          email: body.owner.email,
          passwordHash: body.owner.passwordHash,
          role: UserRole.OWNER,
          restaurantId: restaurant.id,
        },
      });

      return reply.send({
        restaurant,
        owner: { id: owner.id, email: owner.email },
      });
    },
  );
};

export default authRoutes;
