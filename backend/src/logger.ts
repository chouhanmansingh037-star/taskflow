import { config } from "./config.js";

type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (config.isTest) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...meta });
  (level === "error" ? process.stderr : process.stdout).write(line + "\n");
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
