import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { logger } from "./logger.js";
import { runMigrations } from "./migrate.js";

async function main() {
  await runMigrations();
  const server = createApp().listen(config.port, () => {
    logger.info("TaskFlow API listening", { port: config.port });
  });

  const shutdown = (signal: string) => {
    logger.info("shutting down", { signal });
    server.close(() => void pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("failed to start", { error: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
