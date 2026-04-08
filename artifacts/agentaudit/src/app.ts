import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { routes } from "./routes/index.js";

export function buildApp() {
  const isDev = process.env["NODE_ENV"] === "development";

  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      ...(isDev
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:standard" },
            },
          }
        : {}),
    },
  });

  app.register(cors, { origin: true });
  app.register(sensible);
  app.register(routes);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, "Unhandled error");
    reply.status(error.statusCode ?? 500).send({
      error: error.name,
      message: error.message,
      statusCode: error.statusCode ?? 500,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: "Not Found",
      message: "Route not found",
      statusCode: 404,
    });
  });

  return app;
}
