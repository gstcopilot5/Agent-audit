import { buildApp } from "./app.js";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const app = buildApp();

app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error({ err }, "Failed to start server");
    process.exit(1);
  }
});
