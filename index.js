const fastify = require("fastify")({ logger: true });

const PORT = process.env.PORT || 3000;

fastify.get("/", async (request, reply) => {
  return { status: "working" };
});

fastify.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log("Server running"))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
