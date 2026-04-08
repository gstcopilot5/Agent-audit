import type { FastifyPluginAsync } from "fastify";

const startedAt = new Date().toISOString();

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              uptime: { type: "number" },
              startedAt: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: "ok",
        uptime: process.uptime(),
        startedAt,
        timestamp: new Date().toISOString(),
      });
    },
  );
};
