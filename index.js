const fastify = require("fastify")({ logger: true });

const start = async () => {
  try {
    fastify.get("/", async () => {
      return { status: "working" };
    });

    await fastify.listen({
      port: process.env.PORT || 3000,
      host: "0.0.0.0"
    });

    console.log("Server running");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
