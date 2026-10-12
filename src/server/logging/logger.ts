import { getEnvironment } from "@/config/env";

type Context = Record<string, string | number | boolean | null | undefined>;
type Level = "debug" | "info" | "warn" | "error";
const rank: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const blocked = /secret|token|password|key|authorization|cookie/i;

function sanitize(context: Context): Context {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, blocked.test(key) ? "[REDACTED]" : value]),
  );
}

function write(level: Level, message: string, context: Context = {}) {
  if (rank[level] < rank[getEnvironment().LOG_LEVEL]) return;
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...sanitize(context) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const logger = {
  debug: (message: string, context?: Context) => write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  error: (message: string, context?: Context) => write("error", message, context),
};
