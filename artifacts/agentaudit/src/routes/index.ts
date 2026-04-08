import type { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";

export const routes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        name: "agentaudit",
        version: "0.0.0",
        description: "Fastify API server",
      });
    },
  );

  app.register(healthRoutes);
};
