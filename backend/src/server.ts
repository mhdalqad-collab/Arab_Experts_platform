import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createBackendApplication } from "./application.js";

const version = "0.1.0";
const config = loadConfig();
const application = createBackendApplication(config);
const server = createServer(application.handler);

server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;

server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ level: "info", event: "backend_started", host: config.host, port: config.port, environment: config.environment, version }));
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(JSON.stringify({ level: "info", event: "backend_stopping", signal }));
  const forceExit = setTimeout(() => process.exit(1), config.shutdownTimeoutMs);
  forceExit.unref();
  server.close(async () => {
    await application.close();
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
