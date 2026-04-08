import { buildApp } from "./app.js";

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3000;

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
